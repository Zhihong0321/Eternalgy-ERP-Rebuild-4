import express from 'express';
import DataSyncService from '../services/dataSyncService.js';
import BatchSyncService from '../services/batchSyncService.js';
import { loggers } from '../utils/logger.js';

const router = express.Router();
const dataSyncService = new DataSyncService();
const batchSyncService = new BatchSyncService();
const logger = loggers.api;

/**
 * Sync API Endpoints
 * Core and batch sync operations with UDLS logging
 */

// POST /api/sync/table/{tableName}?limit=5 - Sync single table
router.post('/table/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const tableName = req.params.tableName;
  const limit = parseInt(req.query.limit) || 5;
  
  logger.info('API request: Single table sync', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/table/:tableName',
    table: tableName,
    limit,
    params: req.params,
    query: req.query
  });

  try {
    // Validate limit (reasonable bounds)
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    // Execute table sync
    const syncResult = await dataSyncService.syncTable(tableName, limit, {
      apiRunId: runId,
      requestSource: 'api'
    });

    const duration = Date.now() - startTime;

    logger.info('API response: Single table sync completed', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/table/:tableName',
      table: tableName,
      status: 200,
      synced: syncResult.synced,
      errors: syncResult.errors,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'single_table_sync',
      table: tableName,
      limit,
      result: syncResult,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Single table sync failed', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/table/:tableName',
      table: tableName,
      limit,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'single_table_sync',
      table: tableName,
      limit,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/sync/batch?globalLimit=5 - Batch sync all tables
router.post('/batch', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const globalLimit = parseInt(req.query.globalLimit) || 5;
  
  // Parse batch options from query parameters
  const options = {
    onlyWithData: req.query.onlyWithData !== 'false', // Default true
    continueOnError: req.query.continueOnError === 'true', // Default false
    maxTables: req.query.maxTables ? parseInt(req.query.maxTables) : null,
    skipTables: req.query.skipTables ? req.query.skipTables.split(',') : []
  };
  
  logger.info('API request: Batch sync all tables', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/batch',
    globalLimit,
    options,
    query: req.query
  });

  try {
    // Validate global limit
    if (globalLimit < 1 || globalLimit > 100) {
      throw new Error('Global limit must be between 1 and 100');
    }

    // Validate maxTables if specified
    if (options.maxTables && (options.maxTables < 1 || options.maxTables > 50)) {
      throw new Error('Max tables must be between 1 and 50');
    }

    // Execute batch sync
    const batchResult = await batchSyncService.syncAllTables(globalLimit, options);

    const duration = Date.now() - startTime;

    logger.info('API response: Batch sync completed', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/batch',
      status: 200,
      globalLimit,
      attempted: batchResult.tables.attempted,
      successful: batchResult.tables.successful,
      failed: batchResult.tables.failed,
      totalSynced: batchResult.totalRecords.synced,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'batch_sync',
      globalLimit,
      options,
      result: batchResult,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Batch sync failed', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/batch',
      globalLimit,
      options,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'batch_sync',
      globalLimit,
      options,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/sync/status/{runId} - Get sync status for specific run
router.get('/status/:runId', async (req, res) => {
  const requestRunId = logger.generateRunId();
  const targetRunId = req.params.runId;
  const startTime = Date.now();
  
  logger.info('API request: Get sync status', requestRunId, {
    operation: 'api_request',
    endpoint: '/api/sync/status/:runId',
    targetRunId,
    params: req.params
  });

  try {
    // Get logs for the specific run ID
    const runLogs = logger.getRunLogs(targetRunId);
    
    if (runLogs.length === 0) {
      logger.warn('No logs found for run ID', requestRunId, {
        operation: 'sync_status_not_found',
        targetRunId
      });

      return res.status(404).json({
        success: false,
        runId: requestRunId,
        targetRunId,
        error: 'No logs found for the specified run ID',
        timestamp: new Date().toISOString()
      });
    }

    // Analyze logs to determine status
    const status = this.analyzeSyncStatus(runLogs);
    const duration = Date.now() - startTime;

    logger.info('API response: Sync status retrieved', requestRunId, {
      operation: 'api_response',
      endpoint: '/api/sync/status/:runId',
      targetRunId,
      status: 200,
      logCount: runLogs.length,
      syncStatus: status.status,
      duration
    });

    res.json({
      success: true,
      runId: requestRunId,
      targetRunId,
      status,
      logs: runLogs,
      logCount: runLogs.length,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get sync status', requestRunId, {
      operation: 'api_error',
      endpoint: '/api/sync/status/:runId',
      targetRunId,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId: requestRunId,
      targetRunId,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/sync/history?limit=10 - Get sync history
router.get('/history', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  
  logger.info('API request: Get sync history', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/history',
    limit,
    query: req.query
  });

  try {
    // Get recent sync-related logs
    const syncLogs = logger.getRecentLogs(500)
      .filter(log => log.context === 'sync' && (
        log.operation?.includes('sync_start') || 
        log.operation?.includes('sync_complete') ||
        log.operation?.includes('sync_error')
      ))
      .slice(-limit);

    // Group logs by runId to create sync history
    const syncHistory = this.groupLogsByRun(syncLogs);

    const duration = Date.now() - startTime;

    logger.info('API response: Sync history retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/history',
      status: 200,
      historyCount: syncHistory.length,
      logCount: syncLogs.length,
      duration
    });

    res.json({
      success: true,
      runId,
      history: syncHistory,
      count: syncHistory.length,
      limit,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get sync history', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/history',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/sync/tables - Get available tables for sync
router.get('/tables', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get available tables', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/tables'
  });

  try {
    const availableTables = await batchSyncService.getAvailableTables();

    if (!availableTables.success) {
      throw new Error(availableTables.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Available tables retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/tables',
      status: 200,
      tableCount: availableTables.count,
      withData: availableTables.summary.withData,
      duration
    });

    res.json({
      success: true,
      runId,
      ...availableTables,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get available tables', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/tables',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/sync/stats - Get sync statistics
router.get('/stats', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get sync statistics', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/stats'
  });

  try {
    const batchStats = await batchSyncService.getBatchStats();

    if (!batchStats.success) {
      throw new Error(batchStats.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Sync statistics retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/stats',
      status: 200,
      discovered: batchStats.data.discovery.totalFound,
      syncedTables: batchStats.data.syncedTables,
      duration
    });

    res.json({
      success: true,
      runId,
      ...batchStats,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get sync statistics', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/stats',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper method to analyze sync status from logs
function analyzeSyncStatus(logs) {
  const errorLogs = logs.filter(log => log.level === 'ERROR');
  const completeLogs = logs.filter(log => 
    log.operation?.includes('complete') || log.operation?.includes('success')
  );
  const startLogs = logs.filter(log => log.operation?.includes('start'));

  let status = 'unknown';
  let message = 'Unable to determine sync status';

  if (errorLogs.length > 0) {
    status = 'failed';
    message = `Sync failed: ${errorLogs[0].message}`;
  } else if (completeLogs.length > 0) {
    status = 'completed';
    message = 'Sync completed successfully';
  } else if (startLogs.length > 0) {
    status = 'running';
    message = 'Sync is in progress';
  }

  return {
    status,
    message,
    startTime: startLogs[0]?.timestamp || null,
    endTime: completeLogs[0]?.timestamp || errorLogs[0]?.timestamp || null,
    errorCount: errorLogs.length,
    totalLogs: logs.length
  };
}

// Helper method to group logs by run ID for history
function groupLogsByRun(logs) {
  const runGroups = {};
  
  logs.forEach(log => {
    if (!runGroups[log.runId]) {
      runGroups[log.runId] = {
        runId: log.runId,
        startTime: log.timestamp,
        endTime: log.timestamp,
        status: 'unknown',
        operation: 'unknown',
        logs: []
      };
    }
    
    const group = runGroups[log.runId];
    group.logs.push(log);
    
    // Update end time
    if (log.timestamp > group.endTime) {
      group.endTime = log.timestamp;
    }
    
    // Determine operation type and status
    if (log.operation?.includes('table_sync_start')) {
      group.operation = 'single_table_sync';
    } else if (log.operation?.includes('batch_sync_start')) {
      group.operation = 'batch_sync';
    }
    
    if (log.level === 'ERROR') {
      group.status = 'failed';
    } else if (log.operation?.includes('complete')) {
      group.status = 'completed';
    }
  });
  
  return Object.values(runGroups)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

export default router;
