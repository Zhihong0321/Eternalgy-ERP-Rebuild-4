# Expected UDLS Log Sequence for Sync Test

## Test 1: POST /api/sync/table/agent?limit=10

### Expected Log Entries (in chronological order):

```json
[
  {
    "timestamp": "2025-08-10T14:50:15.123Z",
    "runId": "run_1723302615123_abc123def",
    "level": "INFO",
    "context": "api",
    "message": "API request: Single table sync",
    "metadata": {
      "operation": "api_request",
      "endpoint": "/api/sync/table/:tableName",
      "table": "agent",
      "limit": 10,
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:15.145Z", 
    "runId": "run_1723302615123_abc123def",
    "level": "INFO",
    "context": "sync",
    "message": "Starting table sync",
    "metadata": {
      "operation": "table_sync_start",
      "table": "agent",
      "limit": 10,
      "options": {"apiRunId": "run_1723302615123_abc123def"},
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:15.167Z",
    "runId": "run_1723302615123_abc123def", 
    "level": "INFO",
    "context": "sync",
    "message": "Validating table exists",
    "metadata": {
      "operation": "table_validation",
      "table": "agent",
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:16.234Z",
    "runId": "run_1723302615123_abc123def",
    "level": "INFO", 
    "context": "sync",
    "message": "Table validation successful",
    "metadata": {
      "operation": "table_validation_success",
      "table": "agent",
      "hasData": true,
      "sampleCount": 1,
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:16.256Z",
    "runId": "run_1723302615123_abc123def",
    "level": "INFO",
    "context": "sync", 
    "message": "Fetching data from Bubble",
    "metadata": {
      "operation": "bubble_fetch_start",
      "table": "agent",
      "limit": 10,
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:16.567Z",
    "runId": "run_1723302615123_abc123def",
    "level": "INFO",
    "context": "sync",
    "message": "Bubble data fetched successfully", 
    "metadata": {
      "operation": "bubble_fetch_success",
      "table": "agent",
      "requested": 10,
      "received": 10,
      "hasMore": false,
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:16.589Z",
    "runId": "run_1723302615123_abc123def",
    "level": "INFO",
    "context": "sync",
    "message": "Starting database sync",
    "metadata": {
      "operation": "database_sync_start", 
      "table": "agent",
      "recordCount": 10,
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:16.612Z",
    "runId": "run_1723302615123_abc123def",
    "level": "INFO",
    "context": "sync",
    "message": "Ensuring table exists in database",
    "metadata": {
      "operation": "table_ensure_start",
      "table": "agent", 
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:16.723Z",
    "runId": "run_1723302615123_abc123def",
    "level": "INFO",
    "context": "sync",
    "message": "Table ensured successfully",
    "metadata": {
      "operation": "table_ensure_success",
      "table": "agent",
      "fields": 15,
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:16.745Z",
    "runId": "run_1723302615123_abc123def",
    "level": "DEBUG", 
    "context": "sync",
    "message": "Record synced successfully",
    "metadata": {
      "operation": "record_sync_success",
      "table": "agent",
      "recordId": "1723302456789_agent_001",
      "action": "inserted",
      "logger_version": "1.0"
    }
  },
  // ... 9 more similar record sync entries ...
  {
    "timestamp": "2025-08-10T14:50:17.123Z",
    "runId": "run_1723302615123_abc123def",
    "level": "INFO",
    "context": "sync",
    "message": "Database sync completed",
    "metadata": {
      "operation": "database_sync_complete",
      "table": "agent",
      "totalRecords": 10,
      "synced": 10, 
      "skipped": 0,
      "errors": 0,
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:17.145Z",
    "runId": "run_1723302615123_abc123def", 
    "level": "INFO",
    "context": "sync",
    "message": "Table sync completed",
    "metadata": {
      "operation": "table_sync_complete",
      "table": "agent",
      "limit": 10,
      "fetched": 10,
      "synced": 10,
      "skipped": 0,
      "errors": 0,
      "duration": 2022,
      "logger_version": "1.0"
    }
  },
  {
    "timestamp": "2025-08-10T14:50:17.167Z",
    "runId": "run_1723302615123_abc123def",
    "level": "INFO", 
    "context": "api",
    "message": "API response: Single table sync completed",
    "metadata": {
      "operation": "api_response",
      "endpoint": "/api/sync/table/:tableName",
      "table": "agent",
      "status": 200,
      "synced": 10,
      "errors": 0,
      "duration": 2044,
      "logger_version": "1.0"
    }
  }
]
```

## Test 2: POST /api/sync/table/agent_daily_report?limit=10

### Expected Log Pattern (Similar structure with new runId):

```json
[
  {
    "timestamp": "2025-08-10T14:50:25.234Z",
    "runId": "run_1723302625234_xyz789ghi", 
    "level": "INFO",
    "context": "api", 
    "message": "API request: Single table sync",
    "metadata": {
      "operation": "api_request",
      "endpoint": "/api/sync/table/:tableName", 
      "table": "agent_daily_report",
      "limit": 10,
      "logger_version": "1.0"
    }
  },
  // ... similar sync flow with agent_daily_report table ...
]
```

## UDLS Log Access Commands (Once Deployed):

### 1. Get Recent Logs:
```bash
curl "https://eternalgy-erp-retry3-production.up.railway.app/api/logs/recent?limit=50"
```

### 2. Get Error Logs Only:
```bash  
curl "https://eternalgy-erp-retry3-production.up.railway.app/api/logs/errors?limit=25"
```

### 3. Get Logs for Specific Sync Run:
```bash
curl "https://eternalgy-erp-retry3-production.up.railway.app/api/logs/run/run_1723302615123_abc123def"
```

### 4. Get Sync Context Logs Only:
```bash
curl "https://eternalgy-erp-retry3-production.up.railway.app/api/logs/context/sync?limit=100"
```

### 5. Get Logging Statistics:
```bash
curl "https://eternalgy-erp-retry3-production.up.railway.app/api/logs/stats"
```

### 6. Check Log System Health:
```bash
curl "https://eternalgy-erp-retry3-production.up.railway.app/api/logs/health"
```

## Expected Database Tables Created:

After successful sync, these PostgreSQL tables will be created:

1. **`agent`** - Contains 10 synced agent records
2. **`agent_daily_report`** - Contains 10 synced daily report records  
3. **`system_logs`** - Contains all UDLS log entries for tracking

Each table will have:
- `id` (SERIAL PRIMARY KEY)
- `bubble_id` (TEXT UNIQUE) 
- `synced_at` (TIMESTAMPTZ DEFAULT NOW())
- Dynamic fields based on Bubble data structure

## Key UDLS Metrics to Observe:

- **Total Log Entries**: ~40-50 per sync operation
- **Run ID Tracking**: Each sync gets unique run ID  
- **Operation Tracking**: From API request → table validation → data fetch → database sync → completion
- **Performance Metrics**: Duration tracking at each step
- **Error Handling**: Any failures logged with full context
- **Success Validation**: Synced record counts and confirmation
