import { PrismaClient } from '@prisma/client';
import BubbleService from './bubbleService.js';
import { loggers } from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Core Data Sync Service
 * Syncs single data type from Bubble → PostgreSQL with configurable limiter
 * UDLS-compliant logging mandatory per project rules
 */
class DataSyncService {
  constructor() {
    this.bubbleService = new BubbleService();
    this.logger = loggers.sync;
    this.prisma = prisma;
  }

  /**
   * Sync specific table with configurable limit
   * @param {string} tableName - Name of the Bubble data type to sync
   * @param {number} limit - Maximum records to sync (default: 5)
   * @param {Object} options - Additional sync options
   * @returns {Object} Sync result with UDLS logging
   */
  async syncTable(tableName, limit = 5, options = {}) {
    const runId = this.logger.generateRunId();
    const startTime = Date.now();
    
    this.logger.info('Starting table sync', runId, {
      operation: 'table_sync_start',
      table: tableName,
      limit,
      options
    });

    try {
      // Step 1: Validate table exists in discovered types
      const validation = await this.validateTable(tableName, runId);
      if (!validation.success) {
        throw new Error(validation.error);
      }

      // Step 2: Fetch limited records from Bubble
      const fetchResult = await this.fetchBubbleData(tableName, limit, runId);
      if (!fetchResult.success) {
        throw new Error(fetchResult.error);
      }

      const records = fetchResult.records;
      if (records.length === 0) {
        this.logger.warn('No records found for table', runId, {
          operation: 'table_sync_empty',
          table: tableName,
          limit
        });

        return {
          success: true,
          runId,
          table: tableName,
          synced: 0,
          skipped: 0,
          errors: 0,
          message: 'No records to sync',
          duration: Date.now() - startTime
        };
      }

      // Step 3: Process and sync records to database
      const syncResult = await this.syncRecordsToDatabase(tableName, records, runId);

      // Step 4: Complete sync logging
      const totalDuration = Date.now() - startTime;
      
      this.logger.info('Table sync completed', runId, {
        operation: 'table_sync_complete',
        table: tableName,
        limit,
        fetched: records.length,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors,
        duration: totalDuration
      });

      return {
        success: true,
        runId,
        table: tableName,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors,
        details: syncResult.details,
        duration: totalDuration,
        limit,
        fetched: records.length
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Table sync failed', runId, {
        operation: 'table_sync_error',
        table: tableName,
        limit,
        error: error.message,
        duration
      });

      // Fail fast per project rules
      throw error;
    }
  }

  /**
   * Validate that table exists in discovered data types
   */
  async validateTable(tableName, runId) {
    this.logger.info('Validating table exists', runId, {
      operation: 'table_validation',
      table: tableName
    });

    try {
      // Use existing discovery service to check if table exists
      const discovery = await this.bubbleService.discoverAllDataTypes();
      
      if (!discovery.discoveredTypes) {
        throw new Error('Failed to discover data types from Bubble');
      }

      const tableExists = discovery.discoveredTypes.find(
        type => type.name === tableName && type.status === 'accessible'
      );

      if (!tableExists) {
        const availableTables = discovery.discoveredTypes
          .filter(t => t.status === 'accessible')
          .map(t => t.name)
          .slice(0, 10); // Show first 10 for error message

        throw new Error(
          `Table '${tableName}' not found in accessible data types. ` +
          `Available: ${availableTables.join(', ')}${availableTables.length >= 10 ? '...' : ''}`
        );
      }

      this.logger.info('Table validation successful', runId, {
        operation: 'table_validation_success',
        table: tableName,
        hasData: tableExists.hasData,
        sampleCount: tableExists.sampleCount
      });

      return {
        success: true,
        table: tableExists,
        totalAvailable: discovery.discoveredTypes.length
      };

    } catch (error) {
      this.logger.error('Table validation failed', runId, {
        operation: 'table_validation_error',
        table: tableName,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch data from Bubble with specified limit
   */
  async fetchBubbleData(tableName, limit, runId) {
    this.logger.info('Fetching data from Bubble', runId, {
      operation: 'bubble_fetch_start',
      table: tableName,
      limit
    });

    try {
      const fetchResult = await this.bubbleService.fetchDataType(tableName, {
        limit,
        includeEmpty: false
      });

      if (!fetchResult.success) {
        throw new Error(fetchResult.error || 'Failed to fetch from Bubble API');
      }

      this.logger.info('Bubble data fetched successfully', runId, {
        operation: 'bubble_fetch_success',
        table: tableName,
        requested: limit,
        received: fetchResult.records.length,
        hasMore: fetchResult.pagination?.hasMore || false
      });

      return {
        success: true,
        records: fetchResult.records,
        pagination: fetchResult.pagination,
        fieldAnalysis: fetchResult.fieldAnalysis
      };

    } catch (error) {
      this.logger.error('Bubble data fetch failed', runId, {
        operation: 'bubble_fetch_error',
        table: tableName,
        limit,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync records to PostgreSQL database using Prisma
   */
  async syncRecordsToDatabase(tableName, records, runId) {
    this.logger.info('Starting database sync', runId, {
      operation: 'database_sync_start',
      table: tableName,
      recordCount: records.length
    });

    const syncResult = {
      synced: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    try {
      // CRITICAL FIX: Use existing Prisma schema instead of creating custom tables
      // The Prisma schema has correct TIMESTAMP columns for date fields
      this.logger.info('Using existing Prisma schema (no custom table creation)', runId, {
        operation: 'prisma_schema_usage',
        table: tableName
      });

      // Process each record individually (fail-fast approach)
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const recordId = record._id || record.id || `record_${i}`;

        try {
          // SIMPLIFIED: Direct upsert with raw Bubble field names
          const upsertResult = await this.upsertRecordDirect(tableName, record, recordId, runId);
          
          if (upsertResult.success) {
            syncResult.synced++;
            syncResult.details.push({
              recordId,
              status: 'synced',
              action: upsertResult.action
            });

            this.logger.debug('Record synced successfully', runId, {
              operation: 'record_sync_success',
              table: tableName,
              recordId,
              action: upsertResult.action
            });
          } else {
            syncResult.skipped++;
            syncResult.details.push({
              recordId,
              status: 'skipped',
              reason: upsertResult.reason
            });
          }

        } catch (recordError) {
          syncResult.errors++;
          syncResult.details.push({
            recordId,
            status: 'error',
            error: recordError.message
          });

          this.logger.error('Record sync failed', runId, {
            operation: 'record_sync_error',
            table: tableName,
            recordId,
            error: recordError.message
          });

          // Fail fast per project rules
          throw recordError;
        }
      }

      this.logger.info('Database sync completed', runId, {
        operation: 'database_sync_complete',
        table: tableName,
        totalRecords: records.length,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors
      });

      return syncResult;

    } catch (error) {
      this.logger.error('Database sync failed', runId, {
        operation: 'database_sync_error',
        table: tableName,
        error: error.message,
        partialResults: syncResult
      });

      throw error;
    }
  }

  /**
   * FIXED: Use existing tables created by SchemaCreationService
   * Skip table creation - tables already exist with correct Bubble field names
   */
  async ensureTableExists(tableName, sampleRecords, runId) {
    this.logger.info('Using existing table created by SchemaCreationService', runId, {
      operation: 'table_exists_check',
      table: tableName
    });

    try {
      const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      // Simply verify table exists (no schema changes)
      try {
        await this.prisma.$queryRawUnsafe(
          `SELECT 1 FROM "${safeTableName}" LIMIT 1`
        );
        
        this.logger.info('Table exists and ready for sync', runId, {
          operation: 'table_exists_confirmed',
          table: tableName
        });
        return;
        
      } catch (tableError) {
        // Table doesn't exist - this shouldn't happen after schema creation
        throw new Error(`Table "${tableName}" does not exist. Run schema creation first: POST /api/schema/create-all`);
      }

    } catch (error) {
      this.logger.error('Table existence check failed', runId, {
        operation: 'table_check_error',
        table: tableName,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Generate basic CREATE TABLE SQL
   */
  generateTableSQL(tableName, fields) {
    const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    let sql = `CREATE TABLE IF NOT EXISTS "${safeTableName}" (\n`;
    sql += `  id SERIAL PRIMARY KEY,\n`;
    sql += `  bubble_id TEXT UNIQUE,\n`;
    
    // Add basic fields (simplified approach)
    fields.forEach(field => {
      if (field !== '_id' && field !== 'id') {
        const safeField = field.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        sql += `  "${safeField}" TEXT,\n`;
      }
    });
    
    // Add synced_at column last
    sql += `  synced_at TIMESTAMPTZ DEFAULT NOW()\n`;
    sql += `)`;
    
    return sql;
  }

  /**
   * Transform Bubble record with proper data type conversion for Prisma schema
   * CRITICAL: Converts ISO date strings to Date objects for TIMESTAMP columns
   */
  transformRecordWithTypes(record, tableName, runId) {
    this.logger.debug('Starting record transformation with type conversion', runId, {
      operation: 'record_transform_start',
      table: tableName,
      recordId: record._id
    });

    const transformed = {
      bubbleId: record._id || record.id // Map to Prisma field name
    };

    // Process each field with proper type conversion
    Object.keys(record).forEach(originalFieldName => {
      if (originalFieldName === '_id' || originalFieldName === 'id') {
        return; // Skip, already handled as bubbleId
      }

      const value = record[originalFieldName];
      const prismaFieldName = this.toCamelCase(originalFieldName);
      
      // CRITICAL FIX: Convert date strings to Date objects for TIMESTAMP columns
      if (typeof value === 'string' && this.isDateString(value)) {
        try {
          transformed[prismaFieldName] = new Date(value);
          this.logger.debug('Converted date string to Date object', runId, {
            operation: 'date_conversion',
            field: originalFieldName,
            originalValue: value,
            convertedValue: transformed[prismaFieldName].toISOString()
          });
        } catch (dateError) {
          this.logger.warn('Date conversion failed, using string', runId, {
            operation: 'date_conversion_fallback',
            field: originalFieldName,
            value: value,
            error: dateError.message
          });
          transformed[prismaFieldName] = value;
        }
      }
      // Handle arrays as JSON strings
      else if (Array.isArray(value)) {
        transformed[prismaFieldName] = JSON.stringify(value);
      }
      // Handle objects as JSON strings
      else if (typeof value === 'object' && value !== null) {
        transformed[prismaFieldName] = JSON.stringify(value);
      }
      // Handle null/undefined
      else if (value === null || value === undefined) {
        transformed[prismaFieldName] = null;
      }
      // Handle primitives (string, number, boolean)
      else {
        transformed[prismaFieldName] = value;
      }
    });

    this.logger.debug('Record transformation completed', runId, {
      operation: 'record_transform_complete',
      table: tableName,
      originalFields: Object.keys(record).length,
      transformedFields: Object.keys(transformed).length
    });

    return transformed;
  }

  /**
   * Check if string looks like a date (same logic as schema generation)
   */
  isDateString(str) {
    if (typeof str !== 'string') return false;
    
    // Bubble typically uses ISO 8601 format
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return isoDatePattern.test(str) && !isNaN(Date.parse(str));
  }

  /**
   * Convert field name to camelCase (same logic as schema generation)
   */
  toCamelCase(str) {
    if (!str || typeof str !== 'string') return 'unknownField';
    
    let result = str
      .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove %, _, etc.
      .replace(/\s+/g, ' ')            // Normalize spaces
      .split(' ')
      .map((word, i) => {
        if (i === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');

    // Fix: Field names cannot start with numbers in Prisma
    if (/^\d/.test(result)) {
      result = 'field' + result.charAt(0).toUpperCase() + result.slice(1);
    }

    // Fallback for empty or invalid results
    if (!result || result === '') {
      result = 'unknownField';
    }

    return result;
  }

  /**
   * Transform Bubble record for database storage (LEGACY - kept for compatibility)
   */
  transformRecord(record, tableName) {
    const transformed = {
      bubble_id: record._id || record.id,
      synced_at: new Date() // Pass Date object instead of string
    };

    // Basic field transformation (serialize complex types as JSON)
    Object.keys(record).forEach(key => {
      if (key !== '_id' && key !== 'id') {
        const safeKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const value = record[key];
        
        // Convert complex types to JSON strings
        if (typeof value === 'object' && value !== null) {
          transformed[safeKey] = JSON.stringify(value);
        } else {
          transformed[safeKey] = value;
        }
      }
    });

    return transformed;
  }

  /**
   * Upsert record using existing schema with proper date conversion
   * CRITICAL: Converts dates properly but uses existing table structure
   */
  async upsertRecordViaPrisma(tableName, transformedRecord, recordId, runId) {
    this.logger.debug('Starting schema-aware upsert with date conversion', runId, {
      operation: 'schema_upsert_start',
      table: tableName,
      recordId,
      fields: Object.keys(transformedRecord).length
    });

    try {
      const safeTableName = tableName.toLowerCase();
      
      // Convert transformed record back to database field names using @map() logic
      const dbRecord = await this.convertToDbFieldNames(transformedRecord, tableName, runId);
      
      this.logger.debug('Converted to database field names', runId, {
        operation: 'field_name_conversion',
        table: tableName,
        originalFields: Object.keys(transformedRecord).length,
        dbFields: Object.keys(dbRecord).length
      });

      // Check if record exists using bubbleId (mapped to bubble_id)
      const existingRecords = await this.prisma.$queryRawUnsafe(
        `SELECT "bubble_id" FROM "${safeTableName}" WHERE "bubble_id" = $1 LIMIT 1`,
        dbRecord.bubble_id
      );

      const isUpdate = existingRecords.length > 0;
      
      if (isUpdate) {
        // Update existing record with proper type conversion
        const updateFields = Object.keys(dbRecord)
          .filter(key => key !== 'bubble_id')
          .map((key, index) => `"${key}" = $${index + 2}`)
          .join(', ');

        const updateValues = Object.keys(dbRecord)
          .filter(key => key !== 'bubble_id')
          .map(key => dbRecord[key]);

        await this.prisma.$queryRawUnsafe(
          `UPDATE "${safeTableName}" SET ${updateFields} WHERE "bubble_id" = $1`,
          dbRecord.bubble_id,
          ...updateValues
        );

        this.logger.debug('Record updated with date conversion', runId, {
          operation: 'record_update_success',
          table: tableName,
          recordId
        });

        return { success: true, action: 'updated' };
      } else {
        // Insert new record with proper type conversion
        const fields = Object.keys(dbRecord).map(key => `"${key}"`).join(', ');
        const placeholders = Object.keys(dbRecord).map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(dbRecord);

        await this.prisma.$queryRawUnsafe(
          `INSERT INTO "${safeTableName}" (${fields}) VALUES (${placeholders})`,
          ...values
        );

        this.logger.debug('Record inserted with date conversion', runId, {
          operation: 'record_insert_success',
          table: tableName,
          recordId
        });

        return { success: true, action: 'inserted' };
      }

    } catch (error) {
      this.logger.error('Schema-aware upsert failed', runId, {
        operation: 'schema_upsert_error',
        table: tableName,
        recordId,
        error: error.message,
        transformedFields: Object.keys(transformedRecord)
      });

      throw error;
    }
  }

  /**
   * SIMPLIFIED: Convert record directly using raw Bubble field names
   * Skip all camelCase conversion - use exact field names from Bubble
   */
  async convertToDbFieldNames(transformedRecord, tableName, runId) {
    // This method should never be called with the new approach
    // but keeping for compatibility
    throw new Error('convertToDbFieldNames should not be called with raw field approach');
  }

  /**
   * Fixed translator for standard Bubble fields + common patterns
   * UNIVERSAL: All Bubble data has Created Date, Modified Date, Created By, etc.
   */
  camelCaseToOriginal(camelCaseField) {
    // FIXED TRANSLATOR for standard Bubble fields (universal)
    const universalBubbleFields = {
      // Standard Bubble system fields (present in ALL tables)
      'createdDate': 'Created Date',
      'modifiedDate': 'Modified Date', 
      'createdBy': 'Created By',
      
      // Common Bubble field patterns
      'name': 'Name',
      'categoryName': 'Category Name',
      'invoiceDate': 'Invoice Date',
      'invoiceId': 'Invoice ID',
      
      // Commission related fields (invoice table)
      'commissionPaid': 'Commission Paid?',
      'normalCommission': 'Normal Commission',
      'performanceTierYear': 'Performance Tier Year',
      'performanceTierMonth': 'Performance Tier Month',
      'amountEligibleForComm': 'Amount Eligible for Comm',
      
      // Linked object fields (common pattern)
      'linkedInvoiceItem': 'Linked Invoice Item',
      'linkedCustomer': 'Linked Customer',
      'linkedAgent': 'Linked Agent',
      'linkedPayment': 'Linked Payment',
      'linkedPackage': 'Linked Package',
      'linkedProducts': 'Linked Products',
      
      // Percentage fields (common pattern)
      'field1StPayment': '1st Payment %',
      'field2NdPayment': '2nd Payment %',
      'percentOfTotalAmount': 'Percent of Total Amount',
      
      // Other common patterns
      'panelQty': 'Panel Qty',
      'invoiceCount': 'Invoice Count',
      'grandStrategy': 'Grand Strategy'
    };

    // Check fixed translator first
    if (universalBubbleFields[camelCaseField]) {
      return universalBubbleFields[camelCaseField];
    }

    // Fallback: convert camelCase to Title Case with spaces
    const converted = camelCaseField
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return converted;
  }

  /**
   * Convert data type name to PascalCase for Prisma model names
   */
  toPascalCase(str) {
    if (!str || typeof str !== 'string') return 'UnknownModel';
    
    return str
      .replace(/[^a-zA-Z0-9\s_]/g, '')
      .replace(/[_\s]+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * DIRECT UPSERT: Work with exact Bubble field names as they exist in database
   * No field name conversion - use raw Bubble fields directly
   */
  async upsertRecordDirect(tableName, bubbleRecord, recordId, runId) {
    this.logger.debug('Starting direct upsert with raw Bubble field names', runId, {
      operation: 'direct_upsert_start',
      table: tableName,
      recordId,
      bubbleFields: Object.keys(bubbleRecord).filter(k => k !== '_id').slice(0, 3)
    });

    try {
      const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const bubbleId = bubbleRecord._id || bubbleRecord.id;
      
      if (!bubbleId) {
        throw new Error('Record missing required _id field');
      }

      // Build database record using exact Bubble field names (no conversion)
      const dbRecord = {
        '_id': bubbleId // Use _id as the primary identifier
      };

      // Add all other fields using their exact Bubble names
      Object.keys(bubbleRecord).forEach(fieldName => {
        if (fieldName !== '_id') {
          const value = bubbleRecord[fieldName];
          
          // Handle different data types
          if (Array.isArray(value)) {
            dbRecord[fieldName] = JSON.stringify(value);
          } else if (typeof value === 'object' && value !== null) {
            dbRecord[fieldName] = JSON.stringify(value);
          } else {
            dbRecord[fieldName] = value;
          }
        }
      });

      this.logger.debug('Built database record with raw field names', runId, {
        operation: 'db_record_build',
        table: tableName,
        dbFields: Object.keys(dbRecord).slice(0, 5)
      });

      // Check if record exists
      const existingRecords = await this.prisma.$queryRawUnsafe(
        `SELECT "_id" FROM "${safeTableName}" WHERE "_id" = $1 LIMIT 1`,
        bubbleId
      );

      const isUpdate = existingRecords.length > 0;
      
      if (isUpdate) {
        // Update existing record
        const updateFields = Object.keys(dbRecord)
          .filter(key => key !== '_id')
          .map((key, index) => `"${key}" = $${index + 2}`)
          .join(', ');

        if (updateFields) {
          const updateValues = Object.keys(dbRecord)
            .filter(key => key !== '_id')
            .map(key => dbRecord[key]);

          await this.prisma.$queryRawUnsafe(
            `UPDATE "${safeTableName}" SET ${updateFields} WHERE "_id" = $1`,
            bubbleId,
            ...updateValues
          );
        }

        this.logger.debug('Record updated successfully', runId, {
          operation: 'direct_update_success',
          table: tableName,
          recordId
        });

        return { success: true, action: 'updated' };
        
      } else {
        // Insert new record
        const fields = Object.keys(dbRecord).map(key => `"${key}"`).join(', ');
        const placeholders = Object.keys(dbRecord).map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(dbRecord);

        await this.prisma.$queryRawUnsafe(
          `INSERT INTO "${safeTableName}" (${fields}) VALUES (${placeholders})`,
          ...values
        );

        this.logger.debug('Record inserted successfully', runId, {
          operation: 'direct_insert_success',
          table: tableName,
          recordId
        });

        return { success: true, action: 'inserted' };
      }

    } catch (error) {
      this.logger.error('Direct upsert failed', runId, {
        operation: 'direct_upsert_error',
        table: tableName,
        recordId,
        error: error.message,
        bubbleFields: Object.keys(bubbleRecord).slice(0, 5)
      });

      throw error;
    }
  }

  /**
   * Upsert single record to database (LEGACY - kept for compatibility)
   */
  async upsertRecord(tableName, record, recordId, runId) {
    const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    try {
      // Check if record exists
      const existingRecords = await this.prisma.$queryRawUnsafe(
        `SELECT bubble_id FROM "${safeTableName}" WHERE bubble_id = $1 LIMIT 1`,
        record.bubble_id
      );

      const isUpdate = existingRecords.length > 0;

      if (isUpdate) {
        // Update existing record
        const updateFields = Object.keys(record)
          .filter(key => key !== 'bubble_id')
          .map((key, index) => `"${key}" = $${index + 2}`)
          .join(', ');

        const updateValues = Object.keys(record)
          .filter(key => key !== 'bubble_id')
          .map(key => record[key]);

        await this.prisma.$queryRawUnsafe(
          `UPDATE "${safeTableName}" SET ${updateFields} WHERE bubble_id = $1`,
          record.bubble_id,
          ...updateValues
        );

        return { success: true, action: 'updated' };
      } else {
        // Insert new record
        const fields = Object.keys(record).map(key => `"${key}"`).join(', ');
        const placeholders = Object.keys(record).map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(record);

        await this.prisma.$queryRawUnsafe(
          `INSERT INTO "${safeTableName}" (${fields}) VALUES (${placeholders})`,
          ...values
        );

        return { success: true, action: 'inserted' };
      }

    } catch (error) {
      this.logger.error('Record upsert failed', runId, {
        operation: 'record_upsert_error',
        table: tableName,
        recordId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get sync statistics for a table
   */
  async getTableStats(tableName) {
    const runId = this.logger.generateRunId();
    
    try {
      const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      const stats = await this.prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(*) as total_records,
          MAX(synced_at) as last_sync,
          MIN(synced_at) as first_sync
        FROM "${safeTableName}"
      `);

      this.logger.info('Table stats retrieved', runId, {
        operation: 'table_stats',
        table: tableName,
        stats: stats[0]
      });

      return {
        success: true,
        table: tableName,
        stats: stats[0] || { total_records: 0, last_sync: null, first_sync: null }
      };

    } catch (error) {
      this.logger.error('Failed to get table stats', runId, {
        operation: 'table_stats_error',
        table: tableName,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default DataSyncService;
