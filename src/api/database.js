import express from 'express';
import { PrismaClient } from '@prisma/client';
import { loggers } from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();
const logger = loggers.api;

/**
 * Database API Endpoints
 * Read data from PostgreSQL tables (synced from Bubble.io)
 */

// GET /api/database/tables - Get all PostgreSQL tables with data counts
router.get('/tables', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get database tables', runId, {
    operation: 'api_request',
    endpoint: '/api/database/tables'
  });

  try {
    // Get all table names from PostgreSQL
    const tables = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        (
          SELECT COUNT(*) 
          FROM information_schema.tables ist 
          WHERE ist.table_name = pgt.tablename 
          AND ist.table_schema = 'public'
        ) as table_exists
      FROM pg_tables pgt 
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
      AND tablename != '_prisma_migrations'
      ORDER BY tablename;
    `;

    // Get record counts for each table
    const tablesWithCounts = await Promise.all(
      tables.map(async (table) => {
        try {
          const countResult = await prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as count FROM "${table.tablename}"`
          );
          const count = parseInt(countResult[0]?.count || 0);
          
          return {
            name: table.tablename,
            tablename: table.tablename,
            recordCount: count,
            withData: count > 0
          };
        } catch (error) {
          logger.warn('Failed to get count for table', runId, {
            table: table.tablename,
            error: error.message
          });
          
          return {
            name: table.tablename,
            tablename: table.tablename,
            recordCount: 0,
            withData: false
          };
        }
      })
    );

    const duration = Date.now() - startTime;

    logger.info('API response: Database tables retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/database/tables',
      status: 200,
      tableCount: tablesWithCounts.length,
      duration
    });

    res.json({
      success: true,
      runId,
      tables: tablesWithCounts,
      count: tablesWithCounts.length,
      summary: {
        withData: tablesWithCounts.filter(t => t.withData).length,
        empty: tablesWithCounts.filter(t => !t.withData).length,
        total: tablesWithCounts.length
      },
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get database tables', runId, {
      operation: 'api_error',
      endpoint: '/api/database/tables',
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

// GET /api/database/data/:tableName - Get data from specific PostgreSQL table
router.get('/data/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const tableName = req.params.tableName;
  const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const search = req.query.search || '';
  
  logger.info('API request: Get table data', runId, {
    operation: 'api_request',
    endpoint: '/api/database/data/:tableName',
    table: tableName,
    limit,
    offset,
    search
  });

  try {
    // Validate table name (security check)
    const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    if (safeTableName !== tableName) {
      throw new Error('Invalid table name');
    }

    // Check if table exists
    const tableExists = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      tableName
    );

    if (!tableExists[0]?.exists) {
      return res.status(404).json({
        success: false,
        runId,
        error: `Table '${tableName}' not found`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }

    // Get table structure (columns)
    const columns = await prisma.$queryRawUnsafe(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'
       ORDER BY ordinal_position`,
      tableName
    );

    // Build search condition if provided
    let searchCondition = '';
    let searchParams = [];
    if (search) {
      const textColumns = columns
        .filter(col => col.data_type.includes('text') || col.data_type.includes('varchar'))
        .map(col => `"${col.column_name}"::text ILIKE $${searchParams.length + 3}`)
        .join(' OR ');
      
      if (textColumns) {
        searchCondition = `WHERE ${textColumns}`;
        searchParams.push(`%${search}%`);
      }
    }

    // Get total count
    const totalQuery = `SELECT COUNT(*) as count FROM "${tableName}" ${searchCondition}`;
    const totalResult = await prisma.$queryRawUnsafe(totalQuery, ...searchParams);
    const total = parseInt(totalResult[0]?.count || 0);

    // Get data with pagination
    const dataQuery = `
      SELECT * FROM "${tableName}" 
      ${searchCondition}
      ORDER BY 
        CASE WHEN "bubble_id" IS NOT NULL THEN "bubble_id" ELSE "id" END
      LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}
    `;
    const data = await prisma.$queryRawUnsafe(dataQuery, ...searchParams, limit, offset);

    const duration = Date.now() - startTime;

    logger.info('API response: Table data retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/database/data/:tableName',
      table: tableName,
      status: 200,
      recordCount: data.length,
      total,
      duration
    });

    res.json({
      success: true,
      runId,
      tableName,
      data,
      columns: columns.map(col => ({
        key: col.column_name,
        label: col.column_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: col.data_type,
        nullable: col.is_nullable === 'YES'
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit)
      },
      search: search || null,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get table data', runId, {
      operation: 'api_error',
      endpoint: '/api/database/data/:tableName',
      table: tableName,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      tableName,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/database/structure/:tableName - Get table structure info
router.get('/structure/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const tableName = req.params.tableName;
  
  logger.info('API request: Get table structure', runId, {
    operation: 'api_request',
    endpoint: '/api/database/structure/:tableName',
    table: tableName
  });

  try {
    // Validate table name
    const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    if (safeTableName !== tableName) {
      throw new Error('Invalid table name');
    }

    // Get table info
    const tableInfo = await prisma.$queryRawUnsafe(
      `SELECT 
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length
       FROM information_schema.columns c
       WHERE c.table_name = $1 
       AND c.table_schema = 'public'
       ORDER BY c.ordinal_position`,
      tableName
    );

    if (tableInfo.length === 0) {
      return res.status(404).json({
        success: false,
        runId,
        error: `Table '${tableName}' not found`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }

    // Get record count
    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "${tableName}"`
    );
    const recordCount = parseInt(countResult[0]?.count || 0);

    // Get sample data for analysis
    const sampleData = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${tableName}" LIMIT 5`
    );

    const duration = Date.now() - startTime;

    logger.info('API response: Table structure retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/database/structure/:tableName',
      table: tableName,
      status: 200,
      fieldCount: tableInfo.length,
      recordCount,
      duration
    });

    res.json({
      success: true,
      runId,
      tableName,
      recordCount,
      fieldCount: tableInfo.length,
      fields: tableInfo.map(field => ({
        name: field.column_name,
        type: field.data_type,
        nullable: field.is_nullable === 'YES',
        default: field.column_default,
        maxLength: field.character_maximum_length
      })),
      sampleData,
      lastUpdated: new Date().toISOString(),
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get table structure', runId, {
      operation: 'api_error',
      endpoint: '/api/database/structure/:tableName',
      table: tableName,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      tableName,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;