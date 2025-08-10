import express from 'express';
import { PrismaClient } from '@prisma/client';
import { loggers } from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();
const logger = loggers.api;

/**
 * UDLS-Required Log Access Endpoints
 * All endpoints must work on Railway deployment
 */

// GET /api/logs/recent?limit=50 - Recent runtime logs
router.get('/recent', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get recent logs', runId, {
    operation: 'api_request',
    endpoint: '/api/logs/recent',
    params: req.query
  });

  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500); // UDLS max 500
    const logs = logger.getRecentLogs(limit);

    logger.info('API response: Recent logs retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/logs/recent',
      status: 200,
      count: logs.length,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      runId,
      data: logs,
      count: logs.length,
      limit,
      source: 'runtime'
    });
  } catch (error) {
    logger.error('API error: Failed to get recent logs', runId, {
      operation: 'api_error',
      endpoint: '/api/logs/recent',
      error: error.message
    });

    res.status(500).json({
      success: false,
      runId,
      error: error.message
    });
  }
});

// GET /api/logs/errors?limit=25 - Error logs only
router.get('/errors', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get error logs', runId, {
    operation: 'api_request',
    endpoint: '/api/logs/errors',
    params: req.query
  });

  try {
    const limit = parseInt(req.query.limit) || 25;
    const errorLogs = logger.getErrorLogs(limit);

    logger.info('API response: Error logs retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/logs/errors',
      status: 200,
      count: errorLogs.length,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      runId,
      data: errorLogs,
      count: errorLogs.length,
      limit,
      source: 'runtime',
      level: 'ERROR'
    });
  } catch (error) {
    logger.error('API error: Failed to get error logs', runId, {
      operation: 'api_error',
      endpoint: '/api/logs/errors',
      error: error.message
    });

    res.status(500).json({
      success: false,
      runId,
      error: error.message
    });
  }
});

// GET /api/logs/run/{runId} - Logs for specific run
router.get('/run/:runId', async (req, res) => {
  const requestRunId = logger.generateRunId();
  const targetRunId = req.params.runId;
  const startTime = Date.now();
  
  logger.info('API request: Get run-specific logs', requestRunId, {
    operation: 'api_request',
    endpoint: '/api/logs/run/:runId',
    targetRunId,
    params: req.params
  });

  try {
    // Get from runtime logs first
    const runtimeLogs = logger.getRunLogs(targetRunId);
    
    // Also try to get from historical database
    let historicalLogs = [];
    try {
      const dbLogs = await prisma.$queryRaw`
        SELECT timestamp, run_id, level, context, message, metadata
        FROM system_logs 
        WHERE run_id = ${targetRunId}
        ORDER BY timestamp ASC
      `;
      historicalLogs = dbLogs || [];
    } catch (dbError) {
      logger.warn('Failed to fetch historical logs for run', requestRunId, {
        operation: 'database_warning',
        targetRunId,
        error: dbError.message
      });
    }

    // Combine and deduplicate logs
    const allLogs = [...historicalLogs, ...runtimeLogs];
    const uniqueLogs = allLogs.filter((log, index, arr) => 
      arr.findIndex(l => l.timestamp === log.timestamp && l.message === log.message) === index
    );

    logger.info('API response: Run logs retrieved', requestRunId, {
      operation: 'api_response',
      endpoint: '/api/logs/run/:runId',
      targetRunId,
      status: 200,
      runtimeCount: runtimeLogs.length,
      historicalCount: historicalLogs.length,
      totalCount: uniqueLogs.length,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      runId: requestRunId,
      targetRunId,
      data: uniqueLogs,
      count: uniqueLogs.length,
      sources: {
        runtime: runtimeLogs.length,
        historical: historicalLogs.length,
        total: uniqueLogs.length
      }
    });
  } catch (error) {
    logger.error('API error: Failed to get run logs', requestRunId, {
      operation: 'api_error',
      endpoint: '/api/logs/run/:runId',
      targetRunId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      runId: requestRunId,
      targetRunId,
      error: error.message
    });
  }
});

// GET /api/logs/context/{context}?limit=100 - Context-filtered logs
router.get('/context/:context', async (req, res) => {
  const runId = logger.generateRunId();
  const context = req.params.context;
  const startTime = Date.now();
  
  logger.info('API request: Get context-filtered logs', runId, {
    operation: 'api_request',
    endpoint: '/api/logs/context/:context',
    context,
    params: req.query
  });

  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    
    // Get from runtime logs
    const contextLogs = logger.getRecentLogs(1000) // Get more to filter
      .filter(log => log.context === context)
      .slice(-limit);

    logger.info('API response: Context logs retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/logs/context/:context',
      context,
      status: 200,
      count: contextLogs.length,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      runId,
      context,
      data: contextLogs,
      count: contextLogs.length,
      limit,
      source: 'runtime'
    });
  } catch (error) {
    logger.error('API error: Failed to get context logs', runId, {
      operation: 'api_error',
      endpoint: '/api/logs/context/:context',
      context,
      error: error.message
    });

    res.status(500).json({
      success: false,
      runId,
      context,
      error: error.message
    });
  }
});

// GET /api/logs/stats - Logging statistics
router.get('/stats', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get log statistics', runId, {
    operation: 'api_request',
    endpoint: '/api/logs/stats'
  });

  try {
    const stats = logger.getStats();
    
    // Try to get historical stats from database
    let dbStats = {};
    try {
      const dbCounts = await prisma.$queryRaw`
        SELECT 
          level,
          context,
          COUNT(*) as count,
          MAX(timestamp) as latest
        FROM system_logs 
        WHERE timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY level, context
        ORDER BY count DESC
      `;
      
      dbStats.historical = dbCounts || [];
      dbStats.totalHistorical = dbCounts?.reduce((sum, row) => sum + parseInt(row.count), 0) || 0;
    } catch (dbError) {
      logger.warn('Failed to fetch historical statistics', runId, {
        operation: 'database_warning',
        error: dbError.message
      });
      dbStats.error = dbError.message;
    }

    const response = {
      ...stats,
      database: dbStats,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    logger.info('API response: Log statistics retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/logs/stats',
      status: 200,
      runtimeLogs: stats.runtime.total,
      pendingLogs: stats.pending,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      runId,
      data: response
    });
  } catch (error) {
    logger.error('API error: Failed to get log statistics', runId, {
      operation: 'api_error',
      endpoint: '/api/logs/stats',
      error: error.message
    });

    res.status(500).json({
      success: false,
      runId,
      error: error.message
    });
  }
});

// GET /api/logs/health - Health check for logging system
router.get('/health', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  try {
    // Test database connection
    let dbHealth = 'unknown';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbHealth = 'healthy';
    } catch (dbError) {
      dbHealth = 'unhealthy';
    }

    const health = {
      status: 'healthy',
      database: dbHealth,
      runtimeLogs: logger.getRecentLogs(1).length > 0 ? 'active' : 'empty',
      pendingBatch: logger.getStats().pending,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    logger.info('Log system health check completed', runId, {
      operation: 'health_check',
      status: health.status,
      database: dbHealth,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      runId,
      data: health
    });
  } catch (error) {
    logger.error('Health check failed', runId, {
      operation: 'health_check_error',
      error: error.message
    });

    res.status(500).json({
      success: false,
      runId,
      error: error.message
    });
  }
});

export default router;
