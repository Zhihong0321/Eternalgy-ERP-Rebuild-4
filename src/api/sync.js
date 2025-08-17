import express from 'express';
import DataSyncService from '../services/dataSyncService.js';
import BatchSyncService from '../services/batchSyncService.js';
import RelationshipDiscoveryService from '../services/relationshipDiscoveryService.js';
import prisma from '../lib/prisma.js';
import { loggers } from '../utils/logger.js';

const router = express.Router();
const dataSyncService = new DataSyncService();
const batchSyncService = new BatchSyncService();
const relationshipDiscoveryService = new RelationshipDiscoveryService();
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
    if (limit < 1 || limit > 99999) {
      throw new Error('Limit must be between 1 and 99999');
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
    if (globalLimit < 1 || globalLimit > 99999) {
      throw new Error('Global limit must be between 1 and 99999');
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
    const status = analyzeSyncStatus(runLogs);
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
    const syncHistory = groupLogsByRun(syncLogs);

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

// POST /api/sync/discover/:tableName - Manual relationship discovery for a table
router.post('/discover/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const tableName = req.params.tableName;
  
  logger.info('API request: Manual relationship discovery', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/discover/:tableName',
    table: tableName,
    params: req.params
  });

  try {
    // Execute relationship discovery for the table
    const discoveryResult = await relationshipDiscoveryService.discoverTableRelationships(tableName, runId);

    if (!discoveryResult) {
      throw new Error('Discovery service returned null or undefined result');
    }

    if (!discoveryResult.success) {
      throw new Error(discoveryResult.error || 'Discovery failed with unknown error');
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Relationship discovery completed', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/discover/:tableName',
      table: tableName,
      status: 200,
      processedFields: discoveryResult.processed,
      relationshipsFound: discoveryResult.relationships.length,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'relationship_discovery',
      table: tableName,
      result: discoveryResult,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Relationship discovery failed', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/discover/:tableName',
      table: tableName,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'relationship_discovery',
      table: tableName,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/sync/discover-all - Discover relationships for ALL tables
router.post('/discover-all', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Discover all table relationships', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/discover-all'
  });

  try {
    // Get all tables that have data
    const tablesResult = await batchSyncService.getAvailableTables(runId, {
      onlyWithData: true
    });

    if (!tablesResult.success) {
      throw new Error('Failed to get available tables');
    }

    const tables = tablesResult.data.tables || [];
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    logger.info('Starting discovery for all tables', runId, {
      operation: 'discover_all_start',
      totalTables: tables.length
    });

    // Discover relationships for each table
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      
      try {
        logger.info(`Discovering table ${i + 1}/${tables.length}: ${table.name}`, runId, {
          operation: 'discover_all_progress',
          table: table.name,
          progress: `${i + 1}/${tables.length}`
        });

        const discoveryResult = await relationshipDiscoveryService.discoverTableRelationships(table.name, runId);
        
        if (discoveryResult && discoveryResult.success) {
          results.push({
            table: table.name,
            success: true,
            processed: discoveryResult.processed,
            relationships: discoveryResult.relationships?.length || 0
          });
          successCount++;
        } else {
          results.push({
            table: table.name,
            success: false,
            error: discoveryResult?.error || 'Unknown error'
          });
          errorCount++;
        }
      } catch (error) {
        results.push({
          table: table.name,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Discover all completed', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/discover-all',
      status: 200,
      totalTables: tables.length,
      successCount,
      errorCount,
      duration
    });

    res.json({
      success: true,
      endpoint: 'discover_all',
      tables: tables.length,
      results: {
        success: successCount,
        errors: errorCount,
        details: results
      },
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Discover all failed', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/discover-all',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      endpoint: 'discover_all',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/sync/relationship-statuses-cached - FAST read-only: Get saved relationship discovery status
router.get('/relationship-statuses-cached', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get cached relationship statuses (fast read-only)', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/relationship-statuses-cached'
  });

  try {
    // FAST QUERY: Direct read from relationship_discovery_status table
    const savedStatuses = await prisma.relationship_discovery_status.groupBy({
      by: ['source_table', 'field_type', 'link_status'],
      _count: {
        _all: true
      }
    });

    // Group by table and calculate summary for each
    const statuses = {};
    
    savedStatuses.forEach(status => {
      const tableName = status.source_table;
      
      if (!statuses[tableName]) {
        statuses[tableName] = {
          total: 0,
          relationalConfirmed: 0,
          textOnly: 0,
          linked: 0,
          pendingLink: 0,
          isRelationalReady: false
        };
      }
      
      const summary = statuses[tableName];
      const count = status._count._all;
      summary.total += count;
      
      if (status.field_type === 'RELATIONAL_CONFIRMED') {
        summary.relationalConfirmed += count;
        if (status.link_status === 'LINKED') {
          summary.linked += count;
        } else if (status.link_status === 'PENDING_LINK') {
          summary.pendingLink += count;
        }
      } else if (status.field_type === 'TEXT_ONLY') {
        summary.textOnly += count;
      }
    });

    // Calculate isRelationalReady for each table
    Object.values(statuses).forEach(summary => {
      summary.isRelationalReady = summary.pendingLink === 0 && summary.total > 0;
    });

    const duration = Date.now() - startTime;

    logger.info('API response: Cached relationship statuses retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/relationship-statuses-cached',
      status: 200,
      tableCount: Object.keys(statuses).length,
      duration
    });

    res.json({
      success: true,
      endpoint: 'relationship_statuses_cached',
      tables: Object.keys(statuses).length,
      statuses: statuses,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Get cached relationship statuses failed', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/relationship-statuses-cached',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      endpoint: 'relationship_statuses_cached',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/sync/relationship-statuses - Get relationship discovery status for ALL tables (bulk)
router.get('/relationship-statuses', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get all relationship statuses (bulk)', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/relationship-statuses'
  });

  try {
    // Get all tables that exist
    const tablesResult = await batchSyncService.getAvailableTables(runId, {
      onlyWithData: false
    });

    if (!tablesResult.success) {
      throw new Error('Failed to get available tables');
    }

    const tables = tablesResult.data.tables || [];
    const statuses = {};

    // Get relationship status for each table
    for (const table of tables) {
      try {
        const statusResult = await relationshipDiscoveryService.getTableRelationshipStatus(table.name, runId);
        if (statusResult && statusResult.success) {
          statuses[table.name] = statusResult.summary;
        } else {
          statuses[table.name] = null;
        }
      } catch (error) {
        console.warn(`Failed to get relationship status for ${table.name}:`, error.message);
        statuses[table.name] = null;
      }
    }

    const duration = Date.now() - startTime;

    logger.info('API response: All relationship statuses retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/relationship-statuses',
      status: 200,
      tableCount: tables.length,
      duration
    });

    res.json({
      success: true,
      endpoint: 'relationship_statuses_bulk',
      tables: tables.length,
      statuses: statuses,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Get all relationship statuses failed', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/relationship-statuses',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      endpoint: 'relationship_statuses_bulk',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/sync/relationship-status/:tableName - Get relationship discovery status for a table
router.get('/relationship-status/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const tableName = req.params.tableName;
  
  logger.info('API request: Get relationship status', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/relationship-status/:tableName',
    table: tableName,
    params: req.params
  });

  try {
    // Get relationship status for the table
    const statusResult = await relationshipDiscoveryService.getTableRelationshipStatus(tableName, runId);

    if (!statusResult.success) {
      throw new Error(statusResult.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Relationship status retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/relationship-status/:tableName',
      table: tableName,
      status: 200,
      isRelationalReady: statusResult.summary.isRelationalReady,
      totalFields: statusResult.summary.total,
      linkedFields: statusResult.summary.linked,
      pendingFields: statusResult.summary.pendingLink,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'relationship_status',
      table: tableName,
      result: statusResult,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get relationship status', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/relationship-status/:tableName',
      table: tableName,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'relationship_status',
      table: tableName,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple test endpoint to verify database storage capability
router.post('/test/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const tableName = req.params.tableName;
  const limit = parseInt(req.query.limit) || 2;
  
  logger.info('API request: Database storage test', runId, {
    endpoint: 'test_storage',
    table: tableName,
    limit
  });

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Simple test: just try to insert a basic record
    const testId = `test_${Date.now()}`;
    const safeTableName = tableName.toLowerCase();

    // Test if we can insert basic data into the table
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${safeTableName}" ("bubble_id") VALUES ($1) ON CONFLICT ("bubble_id") DO NOTHING`,
      testId
    );

    // Check if the record exists
    const result = await prisma.$queryRawUnsafe(
      `SELECT "bubble_id" FROM "${safeTableName}" WHERE "bubble_id" = $1 LIMIT 1`,
      testId
    );

    await prisma.$disconnect();

    res.json({
      success: true,
      runId,
      endpoint: 'test_storage',
      table: tableName,
      testId,
      canInsert: result.length > 0,
      message: result.length > 0 ? 'Database storage working!' : 'Insert may have failed',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Database storage test failed', runId, {
      table: tableName,
      error: error.message
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'test_storage',
      table: tableName,
      error: error.message,
      canInsert: false,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/sync/migrate-discovery-logs - Create discovery_logs table if it doesn't exist
router.post('/migrate-discovery-logs', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Migrate discovery logs table', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/migrate-discovery-logs'
  });

  try {
    // Create discovery_logs table if it doesn't exist
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS discovery_logs (
        id SERIAL PRIMARY KEY,
        run_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT NOT NULL,
        link_status TEXT,
        target_table TEXT,
        sample_value TEXT,
        reason TEXT,
        bubble_id_count INTEGER,
        discovered_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create indexes for performance
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_discovery_logs_run_id ON discovery_logs(run_id)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_discovery_logs_table_name ON discovery_logs(table_name)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_discovery_logs_discovered_at ON discovery_logs(discovered_at)`;

    const duration = Date.now() - startTime;

    logger.info('API response: Discovery logs table migration completed', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/migrate-discovery-logs',
      status: 200,
      duration
    });

    res.json({
      success: true,
      endpoint: 'migrate_discovery_logs',
      message: 'Discovery logs table created successfully',
      tables_created: ['discovery_logs'],
      indexes_created: ['idx_discovery_logs_run_id', 'idx_discovery_logs_table_name', 'idx_discovery_logs_discovered_at'],
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Discovery logs migration failed', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/migrate-discovery-logs',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      endpoint: 'migrate_discovery_logs',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/sync/discovery-logs - Get detailed discovery logs with field-level information
router.get('/discovery-logs', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const { table, run_id, limit = 100, offset = 0 } = req.query;
  
  logger.info('API request: Get discovery logs', runId, {
    operation: 'api_request',
    endpoint: '/api/sync/discovery-logs',
    filters: { table, run_id, limit, offset }
  });

  try {
    // Build where conditions
    const where = {};
    if (table) where.table_name = table;
    if (run_id) where.run_id = run_id;

    // Get discovery logs with pagination
    const logs = await prisma.discovery_logs.findMany({
      where,
      orderBy: { discovered_at: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Get total count for pagination
    const totalCount = await prisma.discovery_logs.count({ where });

    // Group logs by table and run for summary
    const summary = {};
    logs.forEach(log => {
      const key = `${log.table_name}_${log.run_id}`;
      if (!summary[key]) {
        summary[key] = {
          table_name: log.table_name,
          run_id: log.run_id,
          discovered_at: log.discovered_at,
          total_fields: 0,
          linked_fields: 0,
          pending_fields: 0,
          text_fields: 0
        };
      }
      
      summary[key].total_fields++;
      if (log.field_type === 'TEXT_ONLY') {
        summary[key].text_fields++;
      } else if (log.link_status === 'LINKED') {
        summary[key].linked_fields++;
      } else if (log.link_status === 'PENDING_LINK') {
        summary[key].pending_fields++;
      }
    });

    const duration = Date.now() - startTime;

    logger.info('API response: Discovery logs retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/sync/discovery-logs',
      status: 200,
      logCount: logs.length,
      totalCount,
      summaryCount: Object.keys(summary).length,
      duration
    });

    res.json({
      success: true,
      endpoint: 'discovery_logs',
      logs: logs,
      summary: Object.values(summary),
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + logs.length < totalCount
      },
      filters: { table, run_id },
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Get discovery logs failed', runId, {
      operation: 'api_error',
      endpoint: '/api/sync/discovery-logs',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      endpoint: 'discovery_logs',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
