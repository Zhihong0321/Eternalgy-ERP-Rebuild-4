import { PrismaClient } from '@prisma/client';
import { loggers } from '../utils/logger.js';

const logger = loggers.service;

class DatabaseIntrospectionService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get all tables and their columns from PostgreSQL
   * @returns {Promise<Object>} Schema structure with tables and columns
   */
  async getFullSchema() {
    const runId = logger.generateRunId();
    
    logger.info('Starting database schema introspection', runId, {
      operation: 'schema_introspection_start',
      service: 'DatabaseIntrospectionService'
    });

    try {
      // Get all tables in public schema
      const tablesQuery = `
        SELECT 
          t.table_name,
          t.table_type,
          obj_description(c.oid) as table_comment
        FROM information_schema.tables t
        LEFT JOIN pg_class c ON c.relname = t.table_name
        WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name;
      `;

      const tables = await this.prisma.$queryRawUnsafe(tablesQuery);

      logger.info('Retrieved table list', runId, {
        operation: 'schema_tables_retrieved',
        tableCount: tables.length,
        tables: tables.map(t => t.table_name)
      });

      // Get columns for each table
      const schemaData = {};
      
      for (const table of tables) {
        const tableName = table.table_name;
        
        const columnsQuery = `
          SELECT 
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            c.ordinal_position,
            col_description(pgc.oid, c.ordinal_position) as column_comment
          FROM information_schema.columns c
          LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
          WHERE c.table_schema = 'public' 
          AND c.table_name = $1
          ORDER BY c.ordinal_position;
        `;

        const columns = await this.prisma.$queryRawUnsafe(columnsQuery, tableName);

        schemaData[tableName] = {
          tableName,
          tableType: table.table_type,
          tableComment: table.table_comment,
          columns: columns.map(col => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            default: col.column_default,
            maxLength: col.character_maximum_length,
            precision: col.numeric_precision,
            scale: col.numeric_scale,
            position: col.ordinal_position,
            comment: col.column_comment,
            // Business description will be added from documentation service
            businessDescription: null
          }))
        };

        logger.info('Retrieved columns for table', runId, {
          operation: 'schema_table_columns',
          tableName,
          columnCount: columns.length
        });
      }

      logger.info('Database schema introspection completed', runId, {
        operation: 'schema_introspection_complete',
        totalTables: Object.keys(schemaData).length,
        totalColumns: Object.values(schemaData).reduce((sum, table) => sum + table.columns.length, 0)
      });

      return {
        success: true,
        schema: schemaData,
        metadata: {
          introspectedAt: new Date().toISOString(),
          totalTables: Object.keys(schemaData).length,
          totalColumns: Object.values(schemaData).reduce((sum, table) => sum + table.columns.length, 0)
        }
      };

    } catch (error) {
      logger.error('Database schema introspection failed', runId, {
        operation: 'schema_introspection_error',
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        schema: null
      };
    }
  }

  /**
   * Get schema for a specific table
   * @param {string} tableName - Name of the table
   * @returns {Promise<Object>} Table schema structure
   */
  async getTableSchema(tableName) {
    const runId = logger.generateRunId();
    
    logger.info('Getting schema for specific table', runId, {
      operation: 'single_table_schema',
      tableName
    });

    try {
      const fullSchema = await this.getFullSchema();
      
      if (!fullSchema.success) {
        throw new Error(`Failed to get schema: ${fullSchema.error}`);
      }

      const tableSchema = fullSchema.schema[tableName];
      
      if (!tableSchema) {
        throw new Error(`Table '${tableName}' not found in database`);
      }

      logger.info('Single table schema retrieved', runId, {
        operation: 'single_table_schema_success',
        tableName,
        columnCount: tableSchema.columns.length
      });

      return {
        success: true,
        table: tableSchema
      };

    } catch (error) {
      logger.error('Single table schema retrieval failed', runId, {
        operation: 'single_table_schema_error',
        tableName,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        table: null
      };
    }
  }

  /**
   * Get list of all table names
   * @returns {Promise<Array>} Array of table names
   */
  async getTableNames() {
    const runId = logger.generateRunId();
    
    try {
      const tablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;

      const tables = await this.prisma.$queryRawUnsafe(tablesQuery);
      const tableNames = tables.map(t => t.table_name);

      logger.info('Retrieved table names list', runId, {
        operation: 'table_names_list',
        count: tableNames.length,
        tables: tableNames
      });

      return {
        success: true,
        tables: tableNames
      };

    } catch (error) {
      logger.error('Failed to get table names', runId, {
        operation: 'table_names_error',
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        tables: []
      };
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

export default DatabaseIntrospectionService;
