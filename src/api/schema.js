import express from 'express';
import SchemaCreationService from '../services/schemaCreationService.js';
import { loggers } from '../utils/logger.js';

const router = express.Router();
const schemaCreationService = new SchemaCreationService();
const logger = loggers.api;

/**
 * Schema Creation API Endpoints
 * CREATE ALL TABLES FIRST before syncing data
 */

// POST /api/schema/create-all - Create all tables from discovered types
// ⚠️ DEPRECATED: Use /api/bubble/generate-schema instead for Prisma @map() approach
router.post('/create-all', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  // DEPRECATION WARNING
  logger.warn('DEPRECATED ENDPOINT USED: /api/schema/create-all', runId, {
    operation: 'deprecated_endpoint_warning',
    endpoint: '/api/schema/create-all',
    recommendation: 'Use /api/bubble/generate-schema for Prisma @map() approach'
  });
  
  // Parse options from query parameters
  const options = {
    dropExisting: req.query.dropExisting === 'true',  // Default false
    onlyWithData: req.query.onlyWithData !== 'false', // Default true
    maxTables: req.query.maxTables ? parseInt(req.query.maxTables) : null,
    sampleSize: req.query.sampleSize ? parseInt(req.query.sampleSize) : 5
  };
  
  logger.info('API request: Create all database tables', runId, {
    operation: 'api_request',
    endpoint: '/api/schema/create-all',
    options,
    query: req.query
  });

  try {
    // Validate options
    if (options.maxTables && (options.maxTables < 1 || options.maxTables > 100)) {
      throw new Error('Max tables must be between 1 and 100');
    }

    if (options.sampleSize && (options.sampleSize < 1 || options.sampleSize > 50)) {
      throw new Error('Sample size must be between 1 and 50');
    }

    // Execute schema creation
    const schemaResult = await schemaCreationService.createAllTables(options);

    const duration = Date.now() - startTime;

    logger.info('API response: Schema creation completed', runId, {
      operation: 'api_response',
      endpoint: '/api/schema/create-all',
      status: 200,
      discovered: schemaResult.tables.discovered,
      created: schemaResult.tables.created,
      failed: schemaResult.tables.failed,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'schema_create_all',
      options,
      result: schemaResult,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Schema creation failed', runId, {
      operation: 'api_error',
      endpoint: '/api/schema/create-all',
      options,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'schema_create_all',
      options,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/schema/stats - Get database schema statistics
router.get('/stats', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get schema statistics', runId, {
    operation: 'api_request',
    endpoint: '/api/schema/stats'
  });

  try {
    const schemaStats = await schemaCreationService.getSchemaStats();

    if (!schemaStats.success) {
      throw new Error(schemaStats.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Schema statistics retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/schema/stats',
      status: 200,
      tableCount: schemaStats.tableCount,
      duration
    });

    res.json({
      success: true,
      runId,
      ...schemaStats,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get schema statistics', runId, {
      operation: 'api_error',
      endpoint: '/api/schema/stats',
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

// DELETE /api/schema/drop-all - Drop all tables (dangerous operation)
router.delete('/drop-all', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.warn('API request: Drop all tables (DANGEROUS)', runId, {
    operation: 'api_request_dangerous',
    endpoint: '/api/schema/drop-all',
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  try {
    // Safety confirmation required
    if (req.query.confirm !== 'yes-drop-all-tables') {
      throw new Error('This operation requires confirmation: ?confirm=yes-drop-all-tables');
    }

    // Get current tables first
    const currentStats = await schemaCreationService.getSchemaStats();
    const tablesToDrop = currentStats.tables || [];

    let droppedCount = 0;
    const errors = [];

    // Drop each table
    for (const table of tablesToDrop) {
      try {
        await schemaCreationService.prisma.$executeRawUnsafe(
          `DROP TABLE IF EXISTS "${table.tablename}" CASCADE`
        );
        droppedCount++;

        logger.info('Table dropped', runId, {
          operation: 'schema_table_dropped',
          table: table.tablename
        });

      } catch (dropError) {
        errors.push({
          table: table.tablename,
          error: dropError.message
        });

        logger.error('Failed to drop table', runId, {
          operation: 'schema_drop_error',
          table: table.tablename,
          error: dropError.message
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.warn('API response: Tables dropped', runId, {
      operation: 'api_response_dangerous',
      endpoint: '/api/schema/drop-all',
      droppedCount,
      errorCount: errors.length,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'schema_drop_all',
      droppedCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Drop all tables failed', runId, {
      operation: 'api_error',
      endpoint: '/api/schema/drop-all',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'schema_drop_all',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/schema/recreate-all - Drop and recreate all tables
// ⚠️ DEPRECATED: Use /api/bubble/generate-schema instead for Prisma @map() approach
router.post('/recreate-all', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  // DEPRECATION WARNING
  logger.warn('DEPRECATED ENDPOINT USED: /api/schema/recreate-all', runId, {
    operation: 'deprecated_endpoint_warning',
    endpoint: '/api/schema/recreate-all',
    recommendation: 'Use /api/bubble/generate-schema for Prisma @map() approach'
  });
  
  logger.info('API request: Recreate all tables', runId, {
    operation: 'api_request',
    endpoint: '/api/schema/recreate-all',
    query: req.query
  });

  try {
    // This is equivalent to create-all with dropExisting=true
    const options = {
      dropExisting: true,  // Force drop existing
      onlyWithData: req.query.onlyWithData !== 'false',
      maxTables: req.query.maxTables ? parseInt(req.query.maxTables) : null,
      sampleSize: req.query.sampleSize ? parseInt(req.query.sampleSize) : 5
    };

    // Execute schema recreation
    const schemaResult = await schemaCreationService.createAllTables(options);

    const duration = Date.now() - startTime;

    logger.info('API response: Schema recreation completed', runId, {
      operation: 'api_response',
      endpoint: '/api/schema/recreate-all',
      status: 200,
      discovered: schemaResult.tables.discovered,
      created: schemaResult.tables.created,
      failed: schemaResult.tables.failed,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'schema_recreate_all',
      options,
      result: schemaResult,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Schema recreation failed', runId, {
      operation: 'api_error',
      endpoint: '/api/schema/recreate-all',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'schema_recreate_all',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
