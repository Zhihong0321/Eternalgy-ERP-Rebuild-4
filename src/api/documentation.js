import express from 'express';
import DatabaseIntrospectionService from '../services/databaseIntrospection.js';
import DocumentationService from '../services/documentationService.js';
import { loggers } from '../utils/logger.js';

const router = express.Router();
const logger = loggers.api;

// Initialize services
const dbIntrospection = new DatabaseIntrospectionService();
const documentationService = new DocumentationService();

/**
 * Schema Documentation API Endpoints
 * For managing field descriptions and schema documentation
 */

// GET /api/docs/schema - Get database schema structure
router.get('/schema', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get database schema', runId, {
    operation: 'api_request',
    endpoint: '/api/docs/schema'
  });

  try {
    const schemaResult = await dbIntrospection.getFullSchema();

    if (!schemaResult.success) {
      throw new Error(schemaResult.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Database schema retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/docs/schema',
      status: 200,
      totalTables: schemaResult.metadata.totalTables,
      totalColumns: schemaResult.metadata.totalColumns,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'docs_schema',
      schema: schemaResult.schema,
      metadata: schemaResult.metadata,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get database schema', runId, {
      operation: 'api_error',
      endpoint: '/api/docs/schema',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'docs_schema',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/docs/schema/:tableName - Get schema for specific table
router.get('/schema/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const { tableName } = req.params;
  
  logger.info('API request: Get table schema', runId, {
    operation: 'api_request',
    endpoint: '/api/docs/schema/:tableName',
    tableName
  });

  try {
    const tableResult = await dbIntrospection.getTableSchema(tableName);

    if (!tableResult.success) {
      throw new Error(tableResult.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Table schema retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/docs/schema/:tableName',
      status: 200,
      tableName,
      columnCount: tableResult.table.columns.length,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'docs_table_schema',
      table: tableResult.table,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get table schema', runId, {
      operation: 'api_error',
      endpoint: '/api/docs/schema/:tableName',
      tableName,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'docs_table_schema',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/docs/tables - Get list of table names
router.get('/tables', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get table names', runId, {
    operation: 'api_request',
    endpoint: '/api/docs/tables'
  });

  try {
    const tablesResult = await dbIntrospection.getTableNames();

    if (!tablesResult.success) {
      throw new Error(tablesResult.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Table names retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/docs/tables',
      status: 200,
      tableCount: tablesResult.tables.length,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'docs_tables',
      tables: tablesResult.tables,
      count: tablesResult.tables.length,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get table names', runId, {
      operation: 'api_error',
      endpoint: '/api/docs/tables',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'docs_tables',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/docs/descriptions/:tableName - Get saved descriptions for table
router.get('/descriptions/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const { tableName } = req.params;
  
  logger.info('API request: Get table descriptions', runId, {
    operation: 'api_request',
    endpoint: '/api/docs/descriptions/:tableName',
    tableName
  });

  try {
    const descriptionsResult = await documentationService.loadTableDescriptions(tableName);

    if (!descriptionsResult.success) {
      throw new Error(descriptionsResult.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Table descriptions retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/docs/descriptions/:tableName',
      status: 200,
      tableName,
      documentedFields: descriptionsResult.metadata.documentedFields,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'docs_table_descriptions',
      tableName: descriptionsResult.tableName,
      descriptions: descriptionsResult.descriptions,
      metadata: descriptionsResult.metadata,
      lastUpdated: descriptionsResult.lastUpdated,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get table descriptions', runId, {
      operation: 'api_error',
      endpoint: '/api/docs/descriptions/:tableName',
      tableName,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'docs_table_descriptions',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/docs/descriptions/:tableName - Save descriptions for table
router.post('/descriptions/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const { tableName } = req.params;
  const { descriptions } = req.body;
  
  logger.info('API request: Save table descriptions', runId, {
    operation: 'api_request',
    endpoint: 'POST /api/docs/descriptions/:tableName',
    tableName,
    fieldCount: Object.keys(descriptions || {}).length
  });

  try {
    if (!descriptions || typeof descriptions !== 'object') {
      throw new Error('Invalid descriptions data - must be an object');
    }

    const saveResult = await documentationService.saveTableDescriptions(tableName, descriptions);

    if (!saveResult.success) {
      throw new Error(saveResult.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Table descriptions saved', runId, {
      operation: 'api_response',
      endpoint: 'POST /api/docs/descriptions/:tableName',
      status: 200,
      tableName,
      saved: saveResult.saved,
      documented: saveResult.documented,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'docs_save_descriptions',
      tableName,
      saved: saveResult.saved,
      documented: saveResult.documented,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to save table descriptions', runId, {
      operation: 'api_error',
      endpoint: 'POST /api/docs/descriptions/:tableName',
      tableName,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'docs_save_descriptions',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/docs/documented-tables - Get list of documented tables
router.get('/documented-tables', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Get documented tables', runId, {
    operation: 'api_request',
    endpoint: '/api/docs/documented-tables'
  });

  try {
    const documentedResult = await documentationService.getDocumentedTables();

    if (!documentedResult.success) {
      throw new Error(documentedResult.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Documented tables retrieved', runId, {
      operation: 'api_response',
      endpoint: '/api/docs/documented-tables',
      status: 200,
      documentedTablesCount: documentedResult.metadata.totalTables,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'docs_documented_tables',
      tables: documentedResult.tables,
      metadata: documentedResult.metadata,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to get documented tables', runId, {
      operation: 'api_error',
      endpoint: '/api/docs/documented-tables',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'docs_documented_tables',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/docs/export - Export full documented schema as JSON
router.get('/export', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  logger.info('API request: Export all documentation', runId, {
    operation: 'api_request',
    endpoint: '/api/docs/export'
  });

  try {
    // Get full schema with structure
    const schemaResult = await dbIntrospection.getFullSchema();
    if (!schemaResult.success) {
      throw new Error(`Schema introspection failed: ${schemaResult.error}`);
    }

    // Get all documentation
    const docsResult = await documentationService.exportAllDocumentation();
    if (!docsResult.success) {
      throw new Error(`Documentation export failed: ${docsResult.error}`);
    }

    // Merge schema structure with documentation
    const combinedExport = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      metadata: {
        schemaIntrospectedAt: schemaResult.metadata.introspectedAt,
        documentationExportedAt: docsResult.data.exportedAt,
        totalTables: schemaResult.metadata.totalTables,
        totalColumns: schemaResult.metadata.totalColumns,
        documentedTables: Object.keys(docsResult.data.tables).length
      },
      tables: {}
    };

    // Combine schema structure with documentation
    for (const [tableName, tableSchema] of Object.entries(schemaResult.schema)) {
      const tableDocumentation = docsResult.data.tables[tableName];
      
      combinedExport.tables[tableName] = {
        tableName: tableSchema.tableName,
        tableType: tableSchema.tableType,
        tableComment: tableSchema.tableComment,
        columns: tableSchema.columns.map(column => ({
          name: column.name,
          type: column.type,
          nullable: column.nullable,
          default: column.default,
          maxLength: column.maxLength,
          precision: column.precision,
          scale: column.scale,
          position: column.position,
          comment: column.comment,
          businessDescription: tableDocumentation?.descriptions?.[column.name] || null
        })),
        documentation: {
          lastUpdated: tableDocumentation?.lastUpdated || null,
          totalFields: tableSchema.columns.length,
          documentedFields: tableDocumentation?.metadata?.documentedFields || 0
        }
      };
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Documentation exported successfully', runId, {
      operation: 'api_response',
      endpoint: '/api/docs/export',
      status: 200,
      totalTables: combinedExport.metadata.totalTables,
      documentedTables: combinedExport.metadata.documentedTables,
      duration
    });

    // Set headers for file download
    const filename = `schema_documentation_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json({
      success: true,
      runId,
      endpoint: 'docs_export',
      data: combinedExport,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to export documentation', runId, {
      operation: 'api_error',
      endpoint: '/api/docs/export',
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'docs_export',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/docs/descriptions/:tableName - Delete documentation for table
router.delete('/descriptions/:tableName', async (req, res) => {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  const { tableName } = req.params;
  
  logger.info('API request: Delete table documentation', runId, {
    operation: 'api_request',
    endpoint: 'DELETE /api/docs/descriptions/:tableName',
    tableName
  });

  try {
    const deleteResult = await documentationService.deleteTableDocumentation(tableName);

    if (!deleteResult.success) {
      throw new Error(deleteResult.error);
    }

    const duration = Date.now() - startTime;

    logger.info('API response: Table documentation deleted', runId, {
      operation: 'api_response',
      endpoint: 'DELETE /api/docs/descriptions/:tableName',
      status: 200,
      tableName,
      duration
    });

    res.json({
      success: true,
      runId,
      endpoint: 'docs_delete_descriptions',
      tableName,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('API error: Failed to delete table documentation', runId, {
      operation: 'api_error',
      endpoint: 'DELETE /api/docs/descriptions/:tableName',
      tableName,
      error: error.message,
      duration
    });

    res.status(500).json({
      success: false,
      runId,
      endpoint: 'docs_delete_descriptions',
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
