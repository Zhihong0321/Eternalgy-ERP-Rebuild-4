# STEP 6: CONCRETE NEXT IMPLEMENTATION TASKS
**Sync Cursor and Parallelism Enhancement**

Generated: 2025-01-21T15:00:00.000Z  
Based on: Existing codebase analysis and architectural documentation  
Status: Implementation Ready  

---

## 📋 TASK OVERVIEW

This document outlines 6 concrete implementation tasks for enhancing the Bubble.io sync system with sync cursors and optional parallelism, based on the current codebase state and architectural requirements.

**Context**: Current system has working BubbleService, data discovery, and basic Prisma schema generation. Need to add production-ready sync capabilities with cursor tracking and optional parallel processing.

---

## 🎯 TASK 1: IMPLEMENT NAMESANITISER & COLLISION TESTS

### **Objective**: Replace current `toCamelCase()` with robust field name sanitization and collision detection

### **Background**
- Current `toCamelCase()` function has 34.3% failure rate on edge cases
- Fields like `"2nd Payment %"` → `"2ndPayment"` break Prisma validation
- Reserved words like `"_id"` → `"id"` cause conflicts
- Need 100% valid Prisma field name generation

### **Implementation Steps**

#### 1.1 Create NameSanitiser Service
```bash
# File: src/services/nameSanitiser.js
```

**Core Function**:
```javascript
function toSafePrismaFieldName(originalName) {
  // 8-step fallback strategy:
  // 1. Handle non-ASCII characters (unicode normalization)
  // 2. Remove invalid characters (keep only a-zA-Z0-9_)
  // 3. Handle empty strings after cleaning
  // 4. Convert to camelCase
  // 5. Fix numeric start (prefix 'f')
  // 6. Handle reserved words (append 'Field')
  // 7. Truncate long names (max 63 chars)
  // 8. Ultimate fallback (generate random)
}
```

**Additional Functions**:
- `detectCollision(fieldNames)` - Check for duplicate generated names
- `generateUniqueFieldName(baseName, existingNames)` - Resolve collisions
- `isPrismaReservedWord(name)` - Check against reserved word list
- `validateFieldName(name)` - Validate against Prisma rules

#### 1.2 Collision Detection System
```javascript
class CollisionTracker {
  constructor() {
    this.usedNames = new Set();
    this.collisionCounter = new Map();
  }
  
  addName(originalName, sanitizedName) {
    // Track usage and detect collisions
  }
  
  resolveCollision(baseName) {
    // Generate unique variant (e.g., fieldName2, fieldName3)
  }
}
```

#### 1.3 Comprehensive Test Suite
```bash
# File: src/services/__tests__/nameSanitiser.test.js
```

**Test Categories** (minimum 50 test cases):
- Basic camelCase conversion (10 tests)
- Edge cases from ADR-006 (35 tests)
- Unicode/non-ASCII handling (8 tests)
- Reserved word conflicts (12 tests)
- Collision resolution (10 tests)
- Performance benchmarks (5 tests)

**Critical Test Cases**:
```javascript
describe('Edge Cases from Real Data', () => {
  test('numeric start fields', () => {
    expect(toSafePrismaFieldName('2nd Payment %')).toBe('f2ndPaymentPercent');
    expect(toSafePrismaFieldName('1st Payment %')).toBe('f1stPaymentPercent');
  });
  
  test('reserved words', () => {
    expect(toSafePrismaFieldName('_id')).toBe('idField');
    expect(toSafePrismaFieldName('select')).toBe('selectField');
  });
  
  test('collision detection', () => {
    const sanitiser = new NameSanitiser();
    expect(sanitiser.sanitize('Customer Name')).toBe('customerName');
    expect(sanitiser.sanitize('customer-name')).toBe('customerName2');
  });
});
```

### **Integration Points**
- Update `bubble-data-dictionary.js` line 289 to use new sanitiser
- Modify `analyzeField()` function to track collisions
- Update Prisma schema generation to use sanitized names

### **Acceptance Criteria**
- [ ] 100% valid Prisma field names generated
- [ ] Zero collision conflicts in schema generation
- [ ] All 164+ discovered field names from real data handled correctly
- [ ] Comprehensive test suite with >95% coverage
- [ ] Performance: <1ms per field name sanitization

---

## 🎯 TASK 2: EXTEND GENERATOR TO EMIT PRISMA MODELS FOR ALL 7 TYPES

### **Objective**: Enhance schema generation to create complete Prisma models for all discovered data types using sanitized names + @map

### **Background**
- Current system discovers data types but doesn't generate complete schemas
- Need to integrate NameSanitiser with Prisma model generation
- Support for 7+ discovered data types (user, customer, invoice, payment, agreement, agent, package)

### **Implementation Steps**

#### 2.1 Enhanced BubbleDataDictionary Integration
```bash
# File: scripts/bubble-data-dictionary.js (extend existing)
```

**Modifications**:
```javascript
import { NameSanitiser } from '../src/services/nameSanitiser.js';

class BubbleDataDictionary {
  constructor() {
    this.nameSanitiser = new NameSanitiser();
    // existing code...
  }
  
  async analyzeField(fieldName, records) {
    const analysis = {
      // existing analysis...
      sanitizedName: this.nameSanitiser.sanitize(fieldName),
      hasCollision: this.nameSanitiser.hasCollision(fieldName),
      fallbackUsed: this.nameSanitiser.usedFallback(fieldName)
    };
    return analysis;
  }
}
```

#### 2.2 Complete Prisma Schema Generator
```bash
# File: src/services/prismaSchemaGenerator.js (new)
```

**Core Functions**:
```javascript
class PrismaSchemaGenerator {
  constructor(dataDictionary, nameSanitiser) {
    this.dataDictionary = dataDictionary;
    this.nameSanitiser = nameSanitiser;
  }
  
  async generateCompleteSchema() {
    // Generate complete schema.prisma file
  }
  
  generateModelForTable(tableName, tableAnalysis) {
    // Generate individual Prisma model
  }
  
  generateFieldDefinition(fieldName, fieldAnalysis) {
    // Generate individual field with proper @map
  }
}
```

#### 2.3 Model Template Enhancement
```prisma
model {PascalCaseTableName} {
  id               String    @id @default(cuid())
  bubbleId         String    @unique @map("_id")
  
  // Auto-generated fields using sanitized names + @map
  {sanitizedFieldName}  {PrismaType}?  @map("{originalFieldName}")
  
  // Sync cursor tracking
  syncCursorPosition  Int?     @map("sync_cursor_position")
  
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  isDeleted        Boolean   @default(false)
  
  @@map("{lowercaseTableName}")
}
```

#### 2.4 Schema Validation & Testing
```bash
# File: src/services/__tests__/prismaSchemaGenerator.test.js
```

**Test Requirements**:
- Generate valid schema for all 7+ discovered types
- Verify @map directives preserve original field names
- Test schema compilation with `prisma validate`
- Performance testing with large field sets

### **Integration Points**
- Replace manual schema in `prisma/schema.prisma`
- Update API endpoint `/api/admin/sync-schema`
- Add schema validation before `prisma db push`

### **Acceptance Criteria**
- [ ] Complete Prisma schema generated for all discovered data types
- [ ] All field names sanitized with proper @map directives
- [ ] Schema passes `prisma validate` without errors
- [ ] Generated schema supports sync cursor tracking
- [ ] Backward compatibility with existing sync status model

---

## 🎯 TASK 3: ADD SYNCCURSOR MODEL & MIGRATION

### **Objective**: Implement cursor-based pagination tracking for reliable sync resumption

### **Background**
- Current sync lacks resumption capability
- Need to track sync progress per table with cursor positions
- Enable partial sync recovery on errors or interruptions

### **Implementation Steps**

#### 3.1 SyncCursor Model Definition
```prisma
model SyncCursor {
  id              String   @id @default(cuid())
  
  // Table identification
  tableName       String   
  bubbleDataType  String   @map("bubble_data_type")
  
  // Cursor tracking
  currentCursor   Int      @default(0) @map("current_cursor")
  lastCursor      Int?     @map("last_cursor")
  totalRecords    Int?     @map("total_records")
  syncedRecords   Int      @default(0) @map("synced_records")
  
  // Status tracking
  status          SyncCursorStatus @default(PENDING)
  startedAt       DateTime?   @map("started_at")
  completedAt     DateTime?   @map("completed_at")
  lastError       String?     @map("last_error")
  
  // Metadata
  syncJobId       String   @map("sync_job_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  @@unique([tableName, syncJobId])
  @@index([status])
  @@index([syncJobId])
  @@map("sync_cursors")
}

enum SyncCursorStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  ERROR
  CANCELLED
}
```

#### 3.2 SyncCursor Service
```bash
# File: src/services/syncCursorService.js
```

**Core Functions**:
```javascript
class SyncCursorService {
  async initializeSyncJob(tableNames) {
    // Create cursor entries for all tables
  }
  
  async updateCursor(tableName, syncJobId, cursor, recordCount) {
    // Update sync progress
  }
  
  async markTableComplete(tableName, syncJobId) {
    // Mark table sync as completed
  }
  
  async getSyncProgress(syncJobId) {
    // Get overall sync progress
  }
  
  async resumeFromCursor(tableName, syncJobId) {
    // Resume sync from last cursor position
  }
  
  async cancelSyncJob(syncJobId) {
    // Cancel all cursors for a sync job
  }
}
```

#### 3.3 Database Migration
```bash
# File: prisma/migrations/{timestamp}_add_sync_cursor/migration.sql
```

**Migration Tasks**:
- Create sync_cursors table
- Create SyncCursorStatus enum
- Add indexes for performance
- Update existing SyncStatus model for compatibility

#### 3.4 Integration with Existing Sync
```javascript
// Update existing SyncStatus model
model SyncStatus {
  id           String   @id @default(cuid())
  running      Boolean  @default(false)
  progress     Int      @default(0)
  currentTable String?
  lastSync     DateTime?
  error        String?
  
  // Add sync job relationship
  syncJobId    String?  @map("sync_job_id")
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  @@map("sync_status")
}
```

### **Acceptance Criteria**
- [ ] SyncCursor model defined in schema
- [ ] Database migration applied successfully
- [ ] SyncCursorService handles all cursor operations
- [ ] Integration with existing sync status tracking
- [ ] Resume capability tested with partial sync scenarios

---

## 🎯 TASK 4: ENHANCE SYNC RUNNER WITH OPTIONAL PARALLEL PAGES

### **Objective**: Add configurable parallel processing while maintaining sequential table processing

### **Background**
- Current sync is purely sequential (6-14 minutes for 10k records)
- Optional parallelism for page-level processing within each table
- Environment variable `SYNC_CONCURRENCY` controls parallel pages
- Maintain sequential table processing for reliability

### **Implementation Steps**

#### 4.1 Enhanced BubbleSyncService
```bash
# File: src/services/bubbleSyncService.js (new/major enhancement)
```

**Core Architecture**:
```javascript
class BubbleSyncService {
  constructor() {
    this.bubbleService = new BubbleService();
    this.syncCursorService = new SyncCursorService();
    this.concurrency = parseInt(process.env.SYNC_CONCURRENCY || '1');
    this.rateLimitManager = new RateLimitManager();
  }
  
  async syncAllTables(syncJobId) {
    // Sequential table processing (unchanged)
    for (const table of discoveredTables) {
      await this.syncTable(table, syncJobId);
    }
  }
  
  async syncTable(tableName, syncJobId) {
    // Optional parallel page processing within table
    if (this.concurrency > 1) {
      await this.syncTableParallel(tableName, syncJobId);
    } else {
      await this.syncTableSequential(tableName, syncJobId);
    }
  }
  
  async syncTableParallel(tableName, syncJobId) {
    // Parallel page processing with cursor management
  }
}
```

#### 4.2 Rate Limit Management
```javascript
class RateLimitManager {
  constructor(maxRequestsPerMinute = 20) {
    this.maxRequests = maxRequestsPerMinute;
    this.requestWindow = new Map();
    this.requestQueue = [];
  }
  
  async acquireSlot() {
    // Rate limiting logic for parallel requests
  }
  
  releaseSlot() {
    // Release request slot
  }
}
```

#### 4.3 Parallel Page Processing
```javascript
async syncTableParallel(tableName, syncJobId) {
  const cursor = await this.syncCursorService.getCurrentCursor(tableName, syncJobId);
  const concurrency = Math.min(this.concurrency, 3); // Max 3 parallel pages
  
  const pagePromises = [];
  for (let i = 0; i < concurrency; i++) {
    const pageCursor = cursor + (i * 100); // Staggered cursors
    pagePromises.push(this.syncPage(tableName, syncJobId, pageCursor));
  }
  
  await Promise.all(pagePromises);
}
```

#### 4.4 Environment Configuration
```bash
# Environment variables
SYNC_CONCURRENCY=1          # Default: sequential (1 page at a time)
SYNC_CONCURRENCY=2          # Moderate: 2 parallel pages
SYNC_CONCURRENCY=3          # Maximum: 3 parallel pages (rate limit safe)
SYNC_RATE_LIMIT_RPM=20      # Requests per minute limit
```

#### 4.5 Comprehensive Error Handling
```javascript
async syncPage(tableName, syncJobId, cursor) {
  try {
    await this.rateLimitManager.acquireSlot();
    const result = await this.bubbleService.fetchDataType(tableName, {
      cursor,
      limit: 100
    });
    
    if (result.success) {
      await this.processBatch(tableName, syncJobId, result.data);
      await this.syncCursorService.updateCursor(tableName, syncJobId, cursor + 100);
    }
  } catch (error) {
    await this.handleSyncError(tableName, syncJobId, cursor, error);
    throw error; // Fail-fast for parallel processing
  } finally {
    this.rateLimitManager.releaseSlot();
  }
}
```

### **Performance Expectations**
- SYNC_CONCURRENCY=1: 6-14 minutes (current baseline)
- SYNC_CONCURRENCY=2: 3-7 minutes (50% improvement)
- SYNC_CONCURRENCY=3: 2-5 minutes (70% improvement)

### **Acceptance Criteria**
- [ ] Environment variable SYNC_CONCURRENCY controls parallel pages
- [ ] Sequential table processing maintained (reliability)
- [ ] Parallel page processing within each table
- [ ] Rate limiting prevents API errors
- [ ] Cursor tracking works with parallel processing
- [ ] Error handling maintains fail-fast principle
- [ ] Performance improvements measurable and documented

---

## 🎯 TASK 5: WRITE ADR-007-SYNC-CURSOR-AND-PARALLELISM

### **Objective**: Document architectural decisions for sync cursor implementation and parallelism strategy

### **Background**
- Need formal documentation of sync architecture decisions
- Record rationale for sequential table / parallel page strategy
- Document performance trade-offs and implementation choices

### **Implementation Steps**

#### 5.1 ADR Document Structure
```bash
# File: docs/ADR-007-sync-cursor-and-parallelism.md
```

**Required Sections**:
1. **Context** - Current sync limitations and requirements
2. **Decision** - Sync cursor + optional parallelism approach
3. **Rationale** - Why sequential tables + parallel pages
4. **Consequences** - Performance, complexity, reliability impacts
5. **Implementation** - Technical approach and code changes
6. **Monitoring** - Success metrics and monitoring strategy

#### 5.2 Key Decisions to Document

**Cursor Strategy**:
- Why cursor-based pagination over offset-based
- Cursor persistence for resumable syncs
- Per-table cursor tracking vs global cursor

**Parallelism Strategy**:
- Sequential table processing (reliability priority)
- Optional parallel page processing (performance optimization)
- Rate limiting integration with parallel requests

**Error Handling**:
- Fail-fast with graceful recovery
- Cursor rollback on partial failures
- Rate limit respect in parallel processing

#### 5.3 Performance Analysis Section
```markdown
## Performance Analysis

### Baseline (Sequential Only)
- 10k records across 7 tables: 6-14 minutes
- 700 API calls total (100 records per call)
- Average 322ms response time + 300ms rate limit delay

### With Parallel Pages (SYNC_CONCURRENCY=3)
- Same 10k records: 2-5 minutes (70% improvement)
- Same 700 API calls but 3 concurrent streams
- Rate limiting maintains API compliance

### Trade-offs
- **Performance**: 70% improvement with SYNC_CONCURRENCY=3
- **Complexity**: Increased error handling and cursor management
- **Reliability**: Sequential tables maintain overall reliability
- **Resource Usage**: Higher memory and connection usage
```

#### 5.4 Migration Strategy
```markdown
## Migration Strategy

### Phase 1: Cursor Implementation
- Add SyncCursor model and migration
- Update existing sync to use cursors
- Maintain backward compatibility

### Phase 2: Optional Parallelism
- Add SYNC_CONCURRENCY environment variable
- Implement parallel page processing
- Default to sequential (SYNC_CONCURRENCY=1)

### Phase 3: Production Rollout
- Staging environment testing with SYNC_CONCURRENCY=2
- Production deployment with SYNC_CONCURRENCY=1
- Gradual increase based on monitoring
```

### **Acceptance Criteria**
- [ ] Complete ADR document following template
- [ ] All architectural decisions documented with rationale
- [ ] Performance analysis with concrete metrics
- [ ] Migration strategy for production deployment
- [ ] Monitoring and success criteria defined

---

## 🎯 TASK 6: DEMO DRY-RUN AGAINST STAGING DB; RECORD METRICS

### **Objective**: Validate complete implementation with staging database and record comprehensive performance metrics

### **Background**
- All previous tasks must be completed and integrated
- Need production-ready validation before live deployment
- Comprehensive metrics collection for performance analysis

### **Implementation Steps**

#### 6.1 Staging Environment Setup
```bash
# Staging database configuration
DATABASE_URL=postgresql://staging_db_connection
SYNC_CONCURRENCY=2                    # Moderate parallelism for testing
SYNC_RATE_LIMIT_RPM=20               # Conservative rate limiting
NODE_ENV=staging
```

#### 6.2 Comprehensive Test Suite
```bash
# File: scripts/staging-demo.js
```

**Demo Scenarios**:
1. **Full Sync Test** - Complete data synchronization
2. **Resumable Sync Test** - Interrupted sync with cursor recovery
3. **Parallel Processing Test** - SYNC_CONCURRENCY=1,2,3 comparison
4. **Error Recovery Test** - Network interruption handling
5. **Large Dataset Test** - Performance with 10k+ records

#### 6.3 Metrics Collection
```javascript
class SyncMetricsCollector {
  constructor() {
    this.metrics = {
      totalDuration: 0,
      tablesProcessed: 0,
      recordsProcessed: 0,
      apiCallsTotal: 0,
      apiCallsSuccessful: 0,
      apiCallsFailed: 0,
      averageResponseTime: 0,
      parallelPagesUsed: 0,
      cursorUpdates: 0,
      errorsEncountered: [],
      performanceBreakdown: {}
    };
  }
  
  startSync(syncJobId) {
    // Initialize metrics collection
  }
  
  recordApiCall(duration, success, error) {
    // Track individual API call performance
  }
  
  recordTableComplete(tableName, recordCount, duration) {
    // Track per-table performance
  }
  
  generateReport() {
    // Generate comprehensive metrics report
  }
}
```

#### 6.4 Expected Metrics

**Performance Metrics**:
- Total sync duration
- Records per minute processing rate
- API calls per minute rate
- Average response time per call
- Error rate percentage

**Parallelism Metrics**:
- Sequential vs parallel performance comparison
- Resource utilization (memory, connections)
- Rate limiting efficiency

**Reliability Metrics**:
- Cursor accuracy (resumable sync validation)
- Error recovery success rate
- Data integrity verification

#### 6.5 Demo Report Template
```markdown
# STAGING DEMO REPORT - SYNC CURSOR & PARALLELISM
Generated: {timestamp}
Environment: Staging Railway Database
Bubble Data: 7 tables, ~{record_count} records

## Performance Results

### Sequential Sync (SYNC_CONCURRENCY=1)
- Duration: {duration} minutes
- Records/minute: {rate}
- API Calls: {call_count}
- Success Rate: {success_rate}%

### Parallel Sync (SYNC_CONCURRENCY=2)
- Duration: {duration} minutes  
- Records/minute: {rate}
- Performance Improvement: {improvement}%
- Resource Usage: {memory/connections}

### Parallel Sync (SYNC_CONCURRENCY=3)
- Duration: {duration} minutes
- Records/minute: {rate}
- Performance Improvement: {improvement}%
- Resource Usage: {memory/connections}

## Cursor & Recovery Testing
- Resume Accuracy: {accuracy}%
- Recovery Time: {recovery_duration}
- Data Integrity: {integrity_check}

## Production Readiness Assessment
- [ ] Performance targets met (< 10 minutes for 10k records)
- [ ] Error handling robust (>99% success rate)
- [ ] Cursor tracking accurate (100% resume capability)
- [ ] Rate limiting effective (zero 429 errors)
- [ ] Resource usage acceptable (< 500MB memory)
```

### **Acceptance Criteria**
- [ ] Staging environment configured and operational
- [ ] Complete demo suite executed successfully
- [ ] Comprehensive metrics collected and analyzed
- [ ] Performance improvements demonstrated and quantified
- [ ] Detailed demo report generated
- [ ] Production readiness assessment completed
- [ ] All edge cases and error scenarios tested

---

## 🎯 IMPLEMENTATION SEQUENCE

### **Phase 1: Foundation** (Tasks 1-2)
**Duration**: 2-3 days
1. Implement NameSanitiser with comprehensive testing
2. Extend Prisma schema generation for all data types

### **Phase 2: Sync Infrastructure** (Task 3)
**Duration**: 1-2 days  
3. Add SyncCursor model and database migration

### **Phase 3: Enhanced Sync Engine** (Task 4)
**Duration**: 2-3 days
4. Implement parallel page processing with cursor tracking

### **Phase 4: Documentation & Validation** (Tasks 5-6)  
**Duration**: 1-2 days
5. Write comprehensive ADR document
6. Execute staging demo and collect metrics

**Total Estimated Duration**: 6-10 days

---

## 🔍 SUCCESS METRICS

### **Technical Metrics**
- [ ] 100% valid Prisma field names generated (Task 1)
- [ ] Complete schema for all 7+ discovered data types (Task 2)
- [ ] Cursor-based resumable sync capability (Task 3)
- [ ] 50-70% performance improvement with parallelism (Task 4)
- [ ] Comprehensive architectural documentation (Task 5)
- [ ] Production-ready validation with metrics (Task 6)

### **Performance Metrics**
- **Baseline**: 6-14 minutes for 10k records (sequential)
- **Target**: 2-5 minutes for 10k records (parallel)
- **Reliability**: >99% sync success rate
- **Recovery**: 100% accurate cursor resumption

### **Quality Metrics**
- **Test Coverage**: >90% for all new components
- **Error Handling**: Comprehensive with graceful degradation
- **Documentation**: Complete ADR with implementation details
- **Monitoring**: Real-time metrics and alerting

---

## ⚠️ RISKS & MITIGATION

### **Technical Risks**
1. **Name Collision Issues**: Mitigated by comprehensive collision detection
2. **Cursor Accuracy**: Mitigated by extensive testing and validation
3. **Parallel Processing Complexity**: Mitigated by sequential table fallback
4. **Rate Limiting**: Mitigated by conservative limits and monitoring

### **Implementation Risks**
1. **Integration Complexity**: Mitigated by phased implementation
2. **Regression Issues**: Mitigated by comprehensive testing suite
3. **Performance Degradation**: Mitigated by configurable concurrency
4. **Database Migration Issues**: Mitigated by staging validation

---

## 📞 NEXT ACTIONS

1. **Start with Task 1**: NameSanitiser implementation (highest priority)
2. **Create feature branch**: `feature/sync-cursor-parallelism`
3. **Set up tracking**: GitHub project board for task progress
4. **Environment prep**: Ensure staging database access
5. **Stakeholder alignment**: Review task priorities and timeline

This implementation plan provides concrete, actionable tasks that build upon the existing codebase to deliver production-ready sync capabilities with cursor tracking and optional parallelism.

---

## ✅ IMPLEMENTATION STATUS

### **COMPLETED TASKS**
- [x] **Step 6 Planning**: Comprehensive task breakdown and implementation roadmap
- [x] **Architecture Analysis**: Current codebase evaluation and constraint identification  
- [x] **Performance Baseline**: Established 6-14 minute sync time for 10k records
- [x] **Risk Assessment**: Identified and documented mitigation strategies

### **READY TO IMPLEMENT**
- [ ] **Task 1**: NameSanitiser service with collision resolution (HIGH PRIORITY)
- [ ] **Task 2**: Extended Prisma schema generator for all data types
- [ ] **Task 3**: SyncCursor model and database migration
- [ ] **Task 4**: Enhanced sync engine with optional parallelism
- [ ] **Task 5**: ADR-007 architectural documentation
- [ ] **Task 6**: Staging demo and comprehensive metrics collection

### **IMPLEMENTATION READY** 🚀
*All tasks have been thoroughly planned with clear acceptance criteria, technical specifications, and implementation details. Ready to begin development.*

**Next Step**: Begin Task 1 - NameSanitiser implementation to replace the current `toCamelCase()` function with a robust field name sanitization system.
