# 📊 Unified Debug & Logging Strategy (UDLS)

**Version**: 1.0  
**Created**: 2025-08-10  
**Mandatory**: All generated code MUST implement UDLS-compliant logging  

---

## 🎯 Purpose

This document defines the **mandatory logging strategy** for all Eternalgy ERP services. Every piece of generated code must integrate proper logging per UDLS requirements, or it's considered **incomplete**.

**CRITICAL**: According to project rules, code without UDLS-compliant logging cannot be deployed.

---

## 📋 Core Components

### 1. Run ID System
Every operation (sync, discovery, schema generation, API call) must have a unique Run ID for tracking:

```typescript
const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

### 2. Log Structure Standard
All logs must follow this exact format:

```typescript
interface LogEntry {
  timestamp: string;        // ISO 8601 format
  runId: string;           // Unique identifier for this execution
  level: "INFO" | "ERROR" | "DEBUG" | "WARN";
  context: "sync" | "api" | "schema" | "database" | "discovery";
  message: string;         // Human readable message
  metadata: {
    table?: string;        // Database table/data type
    recordId?: string;     // Specific record ID
    field?: string;        // Field name if applicable
    operation?: string;    // Operation type (insert, update, delete, fetch)
    duration?: number;     // Operation duration in ms
    count?: number;        // Number of records processed
    error?: string;        // Error details if applicable
  };
}
```

### 3. Runtime vs Historical Logs

**Runtime Logs**: In-memory logs for current session
- Keep last 1000 entries in memory
- Accessible via API endpoints
- Cleared on server restart

**Historical Logs**: Persistent storage
- Store in database table: `system_logs`
- Retain for 30 days
- Indexed by runId, timestamp, level

---

## 🚀 Implementation Requirements

### 1. Logger Service
Every service must initialize a logger:

```javascript
import Logger from '../utils/logger.js';

class SomeService {
  constructor() {
    this.logger = new Logger('sync'); // context name
  }
  
  async doSomething() {
    const runId = this.logger.generateRunId();
    
    this.logger.info('Starting operation', runId, {
      operation: 'data_sync',
      table: 'invoices'
    });
    
    try {
      // ... operation logic
      this.logger.info('Operation completed', runId, {
        operation: 'data_sync',
        table: 'invoices',
        count: 150,
        duration: 2300
      });
    } catch (error) {
      this.logger.error('Operation failed', runId, {
        operation: 'data_sync',
        table: 'invoices',
        error: error.message
      });
      throw error;
    }
  }
}
```

### 2. API Endpoint Logging
All API endpoints must log requests/responses:

```javascript
router.get('/some-endpoint', async (req, res) => {
  const runId = logger.generateRunId();
  
  logger.info('API request received', runId, {
    operation: 'api_request',
    endpoint: req.path,
    method: req.method,
    params: req.params,
    query: req.query
  });
  
  try {
    const result = await someService.doWork();
    
    logger.info('API response sent', runId, {
      operation: 'api_response',
      endpoint: req.path,
      status: 200,
      duration: Date.now() - startTime
    });
    
    res.json({ success: true, runId, result });
  } catch (error) {
    logger.error('API error', runId, {
      operation: 'api_error',
      endpoint: req.path,
      error: error.message
    });
    
    res.status(500).json({ success: false, runId, error: error.message });
  }
});
```

### 3. Database Operations
All Prisma operations must be logged:

```javascript
async syncTable(tableName, records, runId) {
  this.logger.info('Starting table sync', runId, {
    operation: 'table_sync_start',
    table: tableName,
    count: records.length
  });
  
  for (const record of records) {
    try {
      await prisma[tableName].upsert({
        where: { bubbleId: record._id },
        update: record,
        create: record
      });
      
      this.logger.debug('Record synced', runId, {
        operation: 'record_upsert',
        table: tableName,
        recordId: record._id
      });
    } catch (error) {
      this.logger.error('Record sync failed', runId, {
        operation: 'record_upsert_error',
        table: tableName,
        recordId: record._id,
        error: error.message
      });
      throw error; // Fail fast per project rules
    }
  }
  
  this.logger.info('Table sync completed', runId, {
    operation: 'table_sync_complete',
    table: tableName,
    count: records.length
  });
}
```

---

## 🌐 HTTP Log Access Endpoints

All services must provide these log access endpoints:

### 1. Recent Logs
```
GET /api/logs/recent?limit=50
```
Returns recent runtime logs (default 50, max 500)

### 2. Error Logs Only
```
GET /api/logs/errors?limit=25
```
Returns only ERROR level logs

### 3. Run-Specific Logs
```
GET /api/logs/run/{runId}
```
Returns all logs for specific run ID

### 4. Context-Filtered Logs
```
GET /api/logs/context/{context}?limit=100
```
Returns logs for specific context (sync, api, schema, etc.)

### 5. Log Statistics
```
GET /api/logs/stats
```
Returns logging statistics (counts by level, recent activity)

---

## 📊 Database Schema for Historical Logs

```sql
CREATE TABLE system_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  run_id VARCHAR(50) NOT NULL,
  level VARCHAR(10) NOT NULL,
  context VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_logs_run_id ON system_logs(run_id);
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_context ON system_logs(context);
```

---

## ⚠️ Critical Implementation Rules

### 1. Mandatory Integration
- **NO CODE** can be generated without proper UDLS logging
- Every service must implement the Logger class
- All API endpoints must have request/response logging
- All database operations must be tracked

### 2. Performance Considerations
- Use async logging to avoid blocking operations
- Batch historical log writes (every 30 seconds or 100 entries)
- Implement log level filtering (production = INFO+, development = DEBUG+)

### 3. Error Handling
- Logging errors must NOT crash the application
- If logging fails, write to console.error as fallback
- Always include runId in error responses for debugging

### 4. Railway Deployment
- All log endpoints must work on Railway production
- Historical logs stored in Railway PostgreSQL
- Runtime logs cleared on Railway container restart (expected)

---

## 🚨 Compliance Checklist

Before any code is deployed, verify:

- [ ] Logger service integrated
- [ ] All API endpoints have request/response logging  
- [ ] All database operations logged with runId
- [ ] HTTP log access endpoints implemented
- [ ] Error logging includes full context
- [ ] Success metrics tracked and logged
- [ ] Log levels properly configured
- [ ] Historical log persistence working
- [ ] All logs include required metadata fields
- [ ] No logging errors crash the application

---

## 📝 Example Implementation

See `src/utils/logger.js` and `src/api/logs.js` for complete reference implementations that must be created alongside any new services.

**Remember**: Code without UDLS compliance is considered incomplete and cannot be deployed according to project rules.
