import { PrismaClient } from '@prisma/client';
import BubbleService from './bubbleService.js';
import { loggers } from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Schema Patch Service - ISOLATED FUNCTIONALITY
 * 
 * CRITICAL: This service is completely isolated from the working sync system.
 * It ONLY adds missing columns to existing tables using safe ALTER TABLE operations.
 * 
 * 🔒 SAFETY GUARANTEES:
 * - NEVER modifies existing sync logic
 * - NEVER drops or recreates tables  
 * - NEVER touches existing columns
 * - ONLY performs safe ADD COLUMN operations
 * 
 * Purpose: Fix "column does not exist" errors by adding missing sparse fields
 */
class SchemaPatchService {
  constructor() {
    this.bubbleService = new BubbleService();
    this.logger = loggers.schema;
  }

  /**
   * Patch missing fields for a specific table
   * Safely adds missing columns without affecting existing data or sync logic
   * 
   * @param {string} tableName - Name of table to patch
   * @param {Object} options - Patch options
   * @returns {Promise<Object>} Patch result
   */
  async patchMissingFields(tableName, options = {}) {
    const runId = this.logger.generateRunId();
    const startTime = Date.now();
    
    const {
      sampleSize = 500,    // Larger sample to catch sparse fields
      dryRun = false       // Preview what would be added without making changes
    } = options;

    this.logger.info('🔧 Starting schema patch for missing fields', runId, {
      operation: 'schema_patch_start',
      table: tableName,
      sampleSize,
      dryRun,
      safety_note: 'ISOLATED - No impact on working sync system'
    });

    try {
      // Step 1: Get current table schema (existing columns)
      const currentSchema = await this.getCurrentTableSchema(tableName, runId);
      if (!currentSchema.exists) {
        return {
          success: false,
          error: `Table '${tableName}' does not exist`,
          runId
        };
      }

      // Step 2: Fetch large sample from Bubble to discover all fields
      const bubbleFields = await this.discoverAllBubbleFields(tableName, sampleSize, runId);
      
      // Step 3: Identify missing fields (in Bubble but not in database)
      const missingFields = await this.identifyMissingFields(
        currentSchema.columns, 
        bubbleFields, 
        runId
      );

      if (missingFields.length === 0) {
        this.logger.info('✅ No missing fields found - table is complete', runId, {
          operation: 'schema_patch_complete',
          table: tableName,
          currentColumns: currentSchema.columns.length
        });

        return {
          success: true,
          table: tableName,
          fieldsAdded: [],
          message: 'Table schema is complete - no missing fields detected',
          currentColumns: currentSchema.columns.length,
          runId,
          duration: Date.now() - startTime
        };
      }

      // Step 4: Add missing columns (or preview if dry run)
      const patchResult = await this.addMissingColumns(
        tableName, 
        missingFields, 
        dryRun, 
        runId
      );

      this.logger.info('✅ Schema patch completed successfully', runId, {
        operation: 'schema_patch_success',
        table: tableName,
        fieldsAdded: patchResult.fieldsAdded.length,
        dryRun
      });

      return {
        success: true,
        table: tableName,
        currentColumns: currentSchema.columns.length,
        fieldsAdded: patchResult.fieldsAdded,
        sqlExecuted: patchResult.sqlExecuted,
        message: dryRun 
          ? `DRY RUN: Would add ${missingFields.length} missing fields` 
          : `Successfully added ${missingFields.length} missing fields`,
        runId,
        duration: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('❌ Schema patch failed', runId, {
        operation: 'schema_patch_error',
        table: tableName,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        table: tableName,
        error: error.message,
        runId,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get current table schema from database
   * SAFE: Read-only operation, no modifications
   */
  async getCurrentTableSchema(tableName, runId) {
    const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    try {
      const columns = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `, safeTableName);

      this.logger.debug('📋 Current table schema retrieved', runId, {
        operation: 'get_current_schema',
        table: tableName,
        columnCount: columns.length
      });

      return {
        exists: columns.length > 0,
        columns: columns,
        columnNames: columns.map(col => col.column_name)
      };

    } catch (error) {
      this.logger.error('❌ Failed to get current table schema', runId, {
        operation: 'get_current_schema_error',
        table: tableName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Discover all fields from Bubble data using large sample
   * SAFE: Read-only Bubble API calls, no database modifications
   */
  async discoverAllBubbleFields(tableName, sampleSize, runId) {
    this.logger.info('🔍 Discovering all Bubble fields with large sample', runId, {
      operation: 'discover_bubble_fields',
      table: tableName,
      sampleSize
    });

    try {
      const bubbleData = await this.bubbleService.fetchDataType(tableName, {
        limit: sampleSize,
        cursor: 0,
        includeEmpty: false
      });

      if (!bubbleData.success || !bubbleData.records) {
        throw new Error(`Failed to fetch Bubble data: ${bubbleData.error}`);
      }

      // Collect all unique field names across all records
      const allFields = new Set();
      bubbleData.records.forEach(record => {
        Object.keys(record).forEach(field => {
          if (field !== '_id') { // Skip Bubble ID field
            allFields.add(field);
          }
        });
      });

      const fieldList = Array.from(allFields).sort();
      
      this.logger.info('✅ Bubble field discovery complete', runId, {
        operation: 'discover_bubble_fields_success',
        table: tableName,
        recordsAnalyzed: bubbleData.records.length,
        uniqueFields: fieldList.length,
        fields: fieldList.slice(0, 10) // Log first 10 fields
      });

      return fieldList;

    } catch (error) {
      this.logger.error('❌ Bubble field discovery failed', runId, {
        operation: 'discover_bubble_fields_error',  
        table: tableName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Identify fields that exist in Bubble but are missing from database
   * SAFE: Pure comparison logic, no modifications
   */
  async identifyMissingFields(currentColumns, bubbleFields, runId) {
    // Convert Bubble field names to snake_case (same logic as working sync)
    const bubbleFieldsSnakeCase = bubbleFields.map(field => 
      field.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    );

    // Get current database column names (excluding system columns)
    const systemColumns = ['id', 'bubble_id', 'synced_at'];
    const currentColumnNames = currentColumns
      .map(col => col.column_name)
      .filter(name => !systemColumns.includes(name));

    // Find missing fields
    const missingFields = [];
    
    bubbleFields.forEach((originalField, index) => {
      const snakeCaseField = bubbleFieldsSnakeCase[index];
      
      if (!currentColumnNames.includes(snakeCaseField)) {
        missingFields.push({
          originalName: originalField,
          snakeCaseName: snakeCaseField,
          suggestedType: this.suggestColumnType(originalField)
        });
      }
    });

    this.logger.info('🔍 Missing field analysis complete', runId, {
      operation: 'identify_missing_fields',
      currentColumns: currentColumnNames.length,
      bubbleFields: bubbleFields.length,
      missingFields: missingFields.length,
      missing: missingFields.map(f => f.originalName)
    });

    return missingFields;
  }

  /**
   * Suggest PostgreSQL column type based on field name patterns
   * SAFE: Pure logic, no database operations
   */
  suggestColumnType(fieldName) {
    const lowerField = fieldName.toLowerCase();
    
    // Date/time fields
    if (lowerField.includes('date') || lowerField.includes('time')) {
      return 'TIMESTAMPTZ';
    }
    
    // Percentage/bonus fields  
    if (lowerField.includes('%') || lowerField.includes('bonus') || lowerField.includes('rate')) {
      return 'DECIMAL';
    }
    
    // Amount/price fields
    if (lowerField.includes('amount') || lowerField.includes('price') || lowerField.includes('cost')) {
      return 'DECIMAL';
    }
    
    // Count/number fields
    if (lowerField.includes('count') || lowerField.includes('number') || lowerField.includes('qty')) {
      return 'INTEGER';
    }
    
    // Boolean fields
    if (lowerField.includes('is_') || lowerField.includes('has_') || lowerField.includes('active')) {
      return 'BOOLEAN';
    }
    
    // Default to TEXT for safety (works with any data)
    return 'TEXT';
  }

  /**
   * Add missing columns to table using safe ALTER TABLE operations
   * SAFE: Only uses ADD COLUMN, never drops or modifies existing columns
   */
  async addMissingColumns(tableName, missingFields, dryRun, runId) {
    const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const sqlStatements = [];
    const fieldsAdded = [];

    // Build ALTER TABLE statements
    for (const field of missingFields) {
      const sql = `ALTER TABLE "${safeTableName}" ADD COLUMN IF NOT EXISTS "${field.snakeCaseName}" ${field.suggestedType}`;
      sqlStatements.push(sql);
      
      fieldsAdded.push({
        originalName: field.originalName,
        columnName: field.snakeCaseName,
        dataType: field.suggestedType
      });
    }

    if (dryRun) {
      this.logger.info('🔍 DRY RUN - SQL statements that would be executed', runId, {
        operation: 'add_missing_columns_dry_run',
        table: tableName,
        statements: sqlStatements
      });

      return {
        fieldsAdded,
        sqlExecuted: sqlStatements
      };
    }

    // Execute ALTER TABLE statements
    this.logger.info('🔧 Executing ADD COLUMN statements', runId, {
      operation: 'add_missing_columns_execute',
      table: tableName,
      columnCount: sqlStatements.length
    });

    for (const sql of sqlStatements) {
      try {
        await prisma.$executeRawUnsafe(sql);
        
        this.logger.debug('✅ Column added successfully', runId, {
          operation: 'add_column_success',
          sql: sql.substring(0, 100) + '...'
        });

      } catch (error) {
        this.logger.error('❌ Failed to add column', runId, {
          operation: 'add_column_error',
          sql,
          error: error.message
        });
        throw error;
      }
    }

    this.logger.info('✅ All missing columns added successfully', runId, {
      operation: 'add_missing_columns_complete',
      table: tableName,
      columnsAdded: fieldsAdded.length
    });

    return {
      fieldsAdded,
      sqlExecuted: sqlStatements
    };
  }

  /**
   * Analyze a table and preview what would be patched
   * SAFE: Read-only analysis, no modifications
   */
  async analyzeTable(tableName, sampleSize = 500) {
    const runId = this.logger.generateRunId();
    
    return await this.patchMissingFields(tableName, {
      sampleSize,
      dryRun: true
    });
  }
}

export default SchemaPatchService;