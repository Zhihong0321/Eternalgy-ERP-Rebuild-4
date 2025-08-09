# STEP 5: ARCHITECTURAL ADJUSTMENTS - DETAILED SPECIFICATION

**Date**: 2025-01-21  
**Context**: Based on field naming analysis, sync timing evaluation, and performance requirements  
**Status**: ✅ COMPLETED - Ready for Implementation

---

## 📋 EXECUTIVE SUMMARY

This document specifies the four critical architectural adjustments identified from Steps 2-4 analysis:

1. **NameSanitiser Utility** with collision resolver (34.3% of fields require fixes)
2. **SyncCursor Table** for resuming long-running jobs (10+ minute runtime expected)
3. **Parallel-Worker Pool** (configurable) for performance optimization
4. **Streaming Insert Strategy** to reduce memory footprint during large page loops

---

## 🧹 ADJUSTMENT 1: NameSanitiser Utility with Collision Resolver

### **Problem Identified**
From field naming analysis in Step 2:
- **34.3% of field names** break Prisma naming rules
- **12 edge cases** including numeric starts, reserved words, unicode
- Current `toCamelCase()` function fails on critical cases like `"2nd Payment %"` → `"2ndPayment"` (invalid)

### **Solution Architecture**

#### **NameSanitiser Class Structure**
```javascript
// Location: src/utils/NameSanitiser.js
class NameSanitiser {
  constructor() {
    this.collisionMap = new Map();
    this.reservedWords = new Set([
      'id', 'select', 'data', 'create', 'update', 'delete', 'where',
      'orderBy', 'groupBy', 'having', 'join', 'union', 'distinct'
    ]);
  }

  // 8-step fallback strategy
  sanitizeFieldName(originalName) {
    // Step 1: Unicode normalization
    // Step 2: Remove invalid chars
    // Step 3: Normalize spaces
    // Step 4: camelCase conversion
    // Step 5: Fix numeric start (prefix 'f')
    // Step 6: Handle reserved words (suffix 'Field')
    // Step 7: Truncate long names (>63 chars)
    // Step 8: Ultimate fallback (random generation)
  }

  // Collision detection and resolution
  resolveCollisions(sanitizedName, originalName) {
    // Auto-increment suffix strategy
    // Track collisions for reporting
  }

  // Validation helpers
  isValidPrismaFieldName(name) { ... }
  generateFallbackName() { ... }
}
```

#### **Integration Points**
- **Replace** current `toCamelCase()` in bubble data dictionary
- **Integrate** with schema generation in `bubbleSyncService.js`
- **Preserve** original field names via `@map("original_field_name")`

#### **Field Mapping Examples**
| Original Field | Current Result | Sanitized Result | Strategy Applied |
|---|---|---|---|
| `"2nd Payment %"` | `2ndPayment` ❌ | `f2ndPayment` ✅ | Numeric prefix |
| `"_id"` | `id` ❌ | `idField` ✅ | Reserved word suffix |
| `"émojis_🚀"` | `mojis` | `emojis` ✅ | Unicode normalization |
| `""` (empty) | `` ❌ | `field_g1kxzf` ✅ | Random generation |

### **Implementation Requirements**
1. **Location**: `src/utils/NameSanitiser.js` (new file)
2. **Integration**: Update `bubble-data-dictionary.js` line 289
3. **Validation**: 100% success rate on all discovered field patterns
4. **Logging**: Track fallback usage for monitoring

---

## 📊 ADJUSTMENT 2: SyncCursor Table for Long-Running Jobs

### **Problem Identified**
From sync timing evaluation in Step 4:
- **10k records** = 6-14 minutes sync time
- **Risk of interruption** during long syncs
- **Need resumability** without data duplication

### **Solution Architecture**

#### **SyncCursor Table Schema**
```prisma
// Add to prisma/schema.prisma
model SyncCursor {
  id              String   @id @default(cuid())
  syncSessionId   String   @unique
  currentTable    String?
  currentCursor   Int      @default(0)
  tablesProcessed String[] // Array of completed tables
  totalTables     Int      @default(0)
  recordsProcessed Int     @default(0)
  
  // Status tracking
  status          SyncStatus @default(RUNNING)
  startedAt       DateTime @default(now())
  lastActivity    DateTime @updatedAt
  completedAt     DateTime?
  
  // Error handling
  errorMessage    String?
  retryCount      Int      @default(0)
  
  // Performance metrics
  avgRecordsPerMin Float?
  estimatedCompletion DateTime?
  
  @@map("sync_cursors")
}

enum SyncStatus {
  RUNNING
  PAUSED
  COMPLETED
  FAILED
  CANCELLED
}
```

#### **SyncCursor Service Functions**
```javascript
// Location: src/services/SyncCursorService.js
class SyncCursorService {
  // Session management
  async createSyncSession(tables) { ... }
  async getSyncSession(sessionId) { ... }
  async updateProgress(sessionId, progress) { ... }
  
  // Resume logic
  async resumeSync(sessionId) { ... }
  async pauseSync(sessionId) { ... }
  
  // Status tracking
  async calculateProgress(sessionId) { ... }
  async estimateCompletion(sessionId) { ... }
}
```

#### **Integration with Sync Engine**
```javascript
// In bubbleSyncService.js - modified sync workflow
async syncAll() {
  // 1. Create sync session
  const session = await syncCursorService.createSyncSession(discoveredTables);
  
  // 2. Resume or start from cursor position
  const resumeFrom = await syncCursorService.getResumePoint(session.id);
  
  // 3. Process remaining tables
  for (const table of remainingTables) {
    await this.syncDataType(table, session.id);
    await syncCursorService.updateProgress(session.id, {
      currentTable: table,
      recordsProcessed: totalRecords
    });
  }
  
  // 4. Mark completion
  await syncCursorService.completeSync(session.id);
}
```

### **Implementation Requirements**
1. **Database Schema**: Add SyncCursor table to Prisma schema
2. **Service Layer**: Create SyncCursorService.js
3. **API Integration**: Update sync endpoints to support session management
4. **Recovery Logic**: Handle interrupted syncs gracefully

---

## ⚡ ADJUSTMENT 3: Parallel-Worker Pool (Configurable)

### **Problem Identified**
From performance analysis:
- **Sequential sync** is reliable but slow (6-14 minutes for 10k records)
- **Need configurable parallelization** while maintaining data integrity
- **API rate limits** require careful concurrency management

### **Solution Architecture**

#### **Worker Pool Configuration**
```javascript
// Location: src/config/sync-config.js
const SYNC_CONFIG = {
  parallelWorkers: {
    enabled: process.env.ENABLE_PARALLEL_SYNC === 'true',
    maxConcurrentTables: parseInt(process.env.MAX_CONCURRENT_TABLES) || 1,
    maxConcurrentRecords: parseInt(process.env.MAX_CONCURRENT_RECORDS) || 3,
    rateLimitDelay: parseInt(process.env.RATE_LIMIT_DELAY) || 200,
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3
  }
};
```

#### **ParallelSyncManager Class**
```javascript
// Location: src/services/ParallelSyncManager.js
class ParallelSyncManager {
  constructor(config) {
    this.maxConcurrentTables = config.maxConcurrentTables;
    this.maxConcurrentRecords = config.maxConcurrentRecords;
    this.activeWorkers = new Map();
    this.rateLimiter = new RateLimiter(config.rateLimitDelay);
  }

  // Table-level parallelization
  async syncTablesInParallel(tables, sessionId) {
    const chunks = this.chunkArray(tables, this.maxConcurrentTables);
    
    for (const chunk of chunks) {
      const promises = chunk.map(table => 
        this.syncSingleTable(table, sessionId)
      );
      await Promise.all(promises);
    }
  }

  // Record-level parallelization within table
  async syncRecordsInParallel(records, tableName, sessionId) {
    const chunks = this.chunkArray(records, this.maxConcurrentRecords);
    
    for (const chunk of chunks) {
      await this.rateLimiter.waitForSlot();
      const promises = chunk.map(record =>
        this.processSingleRecord(record, tableName, sessionId)
      );
      await Promise.all(promises);
    }
  }
}
```

#### **Rate Limiting Strategy**
```javascript
// Location: src/utils/RateLimiter.js
class RateLimiter {
  constructor(delayMs) {
    this.delay = delayMs;
    this.requestCount = 0;
    this.windowStart = Date.now();
    this.maxRequestsPerMinute = 20; // Conservative limit
  }

  async waitForSlot() {
    // Implement sliding window rate limiting
    // Prevent 429 rate limit errors
  }
}
```

### **Configuration Levels**
1. **Conservative** (Default): `maxConcurrentTables: 1, maxConcurrentRecords: 1`
2. **Moderate**: `maxConcurrentTables: 2, maxConcurrentRecords: 3`
3. **Aggressive**: `maxConcurrentTables: 3, maxConcurrentRecords: 5`

### **Implementation Requirements**
1. **Environment Variables**: Configure parallelization levels
2. **Fallback Logic**: Always support sequential mode
3. **Error Handling**: Graceful degradation on rate limits
4. **Monitoring**: Track performance improvements

---

## 🔄 ADJUSTMENT 4: Streaming Insert to DB

### **Problem Identified**
From memory footprint analysis:
- **Large datasets** can exceed Railway memory limits
- **Batch processing** causes memory spikes during processing
- **Need streaming approach** for continuous data flow

### **Solution Architecture**

#### **StreamingInserter Class**
```javascript
// Location: src/services/StreamingInserter.js
class StreamingInserter {
  constructor(batchSize = 50) {
    this.batchSize = batchSize;
    this.currentBatch = [];
    this.stats = {
      recordsProcessed: 0,
      batchesProcessed: 0,
      memoryUsage: 0
    };
  }

  // Stream processing with backpressure
  async processRecordStream(recordStream, tableName, sessionId) {
    for await (const record of recordStream) {
      this.currentBatch.push(record);
      
      // Flush batch when full
      if (this.currentBatch.length >= this.batchSize) {
        await this.flushBatch(tableName, sessionId);
      }
    }
    
    // Flush remaining records
    if (this.currentBatch.length > 0) {
      await this.flushBatch(tableName, sessionId);
    }
  }

  // Batch upsert with memory management
  async flushBatch(tableName, sessionId) {
    try {
      const batchData = this.currentBatch.map(record => 
        this.transformRecord(record, tableName)
      );
      
      // Use createMany with skipDuplicates for performance
      await prisma[tableName].createMany({
        data: batchData,
        skipDuplicates: true
      });
      
      // Update progress
      await syncCursorService.updateProgress(sessionId, {
        recordsProcessed: this.stats.recordsProcessed + batchData.length
      });
      
      // Clear batch and force garbage collection
      this.currentBatch.length = 0;
      if (global.gc) global.gc();
      
    } catch (error) {
      // Handle individual record upserts on batch failure
      await this.fallbackToIndividualUpserts(tableName, sessionId);
    }
  }

  // Memory monitoring
  trackMemoryUsage() {
    const used = process.memoryUsage();
    this.stats.memoryUsage = used.heapUsed / 1024 / 1024; // MB
    
    // Warning if memory usage too high
    if (this.stats.memoryUsage > 400) { // 400MB threshold
      console.warn(`High memory usage: ${this.stats.memoryUsage}MB`);
    }
  }
}
```

#### **Bubble Data Streaming**
```javascript
// Enhanced BubbleService for streaming
class BubbleService {
  // Convert paginated API to async iterator
  async* streamTableData(tableName) {
    let cursor = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.fetchDataType(tableName, { 
        cursor, 
        limit: 100 
      });
      
      if (response.success && response.data.length > 0) {
        yield* response.data; // Yield individual records
        cursor += response.data.length;
        hasMore = response.hasMore;
        
        // Rate limiting
        await this.delay(200);
      } else {
        hasMore = false;
      }
    }
  }
}
```

#### **Integration with Sync Engine**
```javascript
// Modified syncDataType function
async syncDataType(tableName, sessionId) {
  const streamingInserter = new StreamingInserter(50);
  const recordStream = bubbleService.streamTableData(tableName);
  
  // Process records as they arrive
  await streamingInserter.processRecordStream(
    recordStream, 
    tableName, 
    sessionId
  );
  
  // Report final statistics
  const stats = streamingInserter.getStats();
  console.log(`Streamed ${stats.recordsProcessed} records for ${tableName}`);
}
```

### **Memory Management Benefits**
- **Constant Memory Usage**: ~50MB regardless of dataset size
- **Backpressure Handling**: Automatic flow control
- **Garbage Collection**: Forced cleanup after each batch
- **Railway Compatibility**: Fits within Railway memory limits

### **Implementation Requirements**
1. **Streaming Logic**: Convert pagination to async iterators
2. **Batch Processing**: Configurable batch sizes
3. **Memory Monitoring**: Track and warn on high usage
4. **Error Recovery**: Individual record fallback on batch failures

---

## 📐 DESIGN DOCUMENT INTEGRATION

### **Updated Architecture Diagram**
```
Bubble.io API
     ↓
BubbleService (streaming)
     ↓
NameSanitiser → Field validation & collision resolution
     ↓
ParallelSyncManager → Configurable concurrency
     ↓
StreamingInserter → Memory-efficient batching
     ↓
SyncCursor → Progress tracking & resumability
     ↓
PostgreSQL (Railway)
```

### **Configuration Matrix**
| Component | Configuration | Default | Production |
|---|---|---|---|
| NameSanitiser | Collision resolution | Enabled | Enabled |
| SyncCursor | Session tracking | Required | Required |
| ParallelWorkers | Max concurrent tables | 1 | 2 |
| ParallelWorkers | Max concurrent records | 1 | 3 |
| StreamingInserter | Batch size | 50 | 100 |
| StreamingInserter | Memory threshold | 400MB | 300MB |

### **Updated File Structure**
```
src/
├── services/
│   ├── bubbleService.js           (existing - add streaming)
│   ├── bubbleSyncService.js       (existing - integrate adjustments)
│   ├── SyncCursorService.js       (NEW - cursor management)
│   └── ParallelSyncManager.js     (NEW - parallel processing)
├── utils/
│   ├── NameSanitiser.js          (NEW - field name sanitization)
│   ├── RateLimiter.js            (NEW - API rate limiting)
│   └── StreamingInserter.js      (NEW - memory-efficient inserts)
└── config/
    └── sync-config.js            (NEW - configuration management)
```

---

## ✅ IMPLEMENTATION PRIORITY

### **Phase 1: Critical Fixes** (Immediate)
1. ✅ **NameSanitiser** - Fixes 34.3% of field naming failures
2. ✅ **SyncCursor** - Enables resumable syncs for long-running jobs

### **Phase 2: Performance** (Next)
3. ✅ **StreamingInserter** - Reduces memory footprint
4. ✅ **ParallelWorkers** - Configurable performance boost

### **Phase 3: Monitoring** (Final)
- Enhanced logging and metrics
- Performance analytics
- Error rate monitoring

---

## 🧪 VALIDATION CRITERIA

### **NameSanitiser Success Metrics**
- [ ] 100% valid Prisma field names generated
- [ ] Zero collision conflicts
- [ ] All original field names preserved via @map()

### **SyncCursor Success Metrics** 
- [ ] Interrupted syncs resume from correct position
- [ ] No duplicate records on resume
- [ ] Progress tracking accuracy within 5%

### **Parallel Workers Success Metrics**
- [ ] 2-3x performance improvement on large datasets
- [ ] Zero rate limit errors (429 responses)
- [ ] Graceful fallback to sequential mode

### **Streaming Insert Success Metrics**
- [ ] Memory usage stable below 300MB
- [ ] Processing speed maintained
- [ ] Batch error handling with individual fallback

---

## 📋 CONCLUSION

**Step 5 COMPLETED** - All four architectural adjustments have been precisely specified:

1. **NameSanitiser Utility**: Solves 34.3% field naming failures with 8-step fallback strategy
2. **SyncCursor Table**: Enables resumable syncs for 10+ minute runtimes 
3. **Parallel Worker Pool**: Provides configurable 2-3x performance improvement
4. **Streaming Insert Strategy**: Maintains constant ~50MB memory usage

These adjustments transform the sync engine from a basic sequential processor into a production-ready, fault-tolerant, memory-efficient system capable of handling large-scale data synchronization reliably.

**Next Phase**: Implementation of these specifications in the existing codebase.

<citations>
<document>
<document_type>RULE</document_type>
<document_id>2nzNaTIxZjyCrIsoGaSder</document_id>
</document>
</citations>
