import express from 'express';
import { PrismaClient } from '@prisma/client';
import SchemaCreationService from '../services/schemaCreationService.js';
import { loggers } from '../utils/logger.js';

const prisma = new PrismaClient();

const router = express.Router();
const schemaCreationService = new SchemaCreationService();
const logger = loggers.api;

/**
 * Schema Creation API Endpoints
 * CREATE ALL TABLES FIRST before syncing data
 */

// POST /api/schema/create-tables - Create all tables from Bubble discovery (skip existing)
router.post('/create-tables', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Create tables from Bubble discovery', runId, {
    operation: 'api_request',
    endpoint: '/api/schema/create-tables'
  });
  
  // Parse options from query parameters
  const options = {
    dropExisting: false,  // Never drop existing - only create new tables
    onlyWithData: true,   // Only create tables with data
    maxTables: null,      // No limit - create all discovered tables
    sampleSize: 5         // Sample size for schema analysis
  };
  
  logger.info('Creating tables with fixed options', runId, {
    operation: 'create_tables_start',
    endpoint: '/api/schema/create-tables',
    options
  });

  try {
    // Execute schema creation
    const schemaResult = await schemaCreationService.createAllTables(options);

    const duration = Date.now() - startTime;

    logger.info('API response: Table creation completed', runId, {
      operation: 'api_response',
      endpoint: '/api/schema/create-tables',
      status: 200,
      discovered: schemaResult.tables.discovered,
      created: schemaResult.tables.created,
      failed: schemaResult.tables.failed,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'schema_create_tables',
      result: schemaResult,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Table creation failed', runId, {
      operation: 'api_error',
      endpoint: '/api/schema/create-tables',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'schema_create_tables',
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

    // Create fresh prisma client for this operation
    const localPrisma = new PrismaClient();

    // Get current tables first
    const currentStats = await schemaCreationService.getSchemaStats();
    const tablesToDrop = currentStats.tables || [];

    let droppedCount = 0;
    const errors = [];

    // Drop each table
    for (const table of tablesToDrop) {
      try {
        await localPrisma.$executeRawUnsafe(
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

    // Clean up prisma connection
    await localPrisma.$disconnect();

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

// POST /api/schema/recreate-table/:tableName - Drop and recreate a single table
router.post('/recreate-table/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const { tableName } = req.params;
  
  logger.info('API request: Recreate single table', runId, {
    operation: 'api_request',
    endpoint: '/api/schema/recreate-table/:tableName',
    tableName
  });

  try {
    // Simplified approach: create table info object and use createSingleTable directly
    const tableInfo = { 
      name: tableName,
      hasData: true // Assume has data since user is trying to recreate
    };

    logger.info('Starting table recreation', runId, {
      operation: 'table_recreation_start',
      tableName
    });

    // Use createSingleTable with dropExisting=true to recreate the table
    const createResult = await schemaCreationService.createSingleTable(
      tableInfo, 
      5, // sampleSize
      true, // dropExisting - this will drop and recreate
      runId
    );

    if (!createResult.success) {
      throw new Error(createResult.error || 'Table recreation failed');
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Single table recreated', runId, {
      operation: 'api_response',
      endpoint: '/api/schema/recreate-table/:tableName',
      status: 200,
      tableName,
      created: createResult.created,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'schema_recreate_table',
      tableName,
      created: createResult.created,
      message: `Table '${tableName}' recreated successfully with updated schema`,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Single table recreation failed', runId, {
      operation: 'api_error',
      endpoint: '/api/schema/recreate-table/:tableName',
      tableName,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'schema_recreate_table',
      tableName,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
