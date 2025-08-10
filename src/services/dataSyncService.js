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
      // Ensure the table exists in database schema
      await this.ensureTableExists(tableName, records, runId);

      // Process each record individually (fail-fast approach)
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const recordId = record._id || record.id || `record_${i}`;

        try {
          // Transform record for database (basic field mapping)
          const transformedRecord = this.transformRecord(record, tableName);

          // Upsert record to database
          const upsertResult = await this.upsertRecord(tableName, transformedRecord, recordId, runId);
          
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
   * Ensure database table exists (basic schema handling)
   */
  async ensureTableExists(tableName, sampleRecords, runId) {
    this.logger.info('Ensuring table exists in database', runId, {
      operation: 'table_ensure_start',
      table: tableName
    });

    try {
      const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const sampleRecord = sampleRecords[0] || {};
      const fields = Object.keys(sampleRecord);
      
      // Check if table exists and if it has the correct schema
      try {
        // Try to query synced_at column to see if it exists
        await this.prisma.$queryRawUnsafe(
          `SELECT synced_at FROM "${safeTableName}" LIMIT 1`
        );
        
        this.logger.info('Table exists with correct schema', runId, {
          operation: 'table_schema_valid',
          table: tableName
        });
        return;
        
      } catch (schemaError) {
        // Table exists but has wrong schema, recreate it
        if (schemaError.message.includes('column "synced_at" of relation')) {
          this.logger.warn('Table exists with wrong schema, recreating', runId, {
            operation: 'table_schema_mismatch',
            table: tableName,
            error: schemaError.message
          });
          
          // Drop existing table and recreate with correct schema
          await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${safeTableName}"`);
          
          this.logger.info('Dropped existing table', runId, {
            operation: 'table_dropped',
            table: tableName
          });
        }
      }
      
      // Create table with correct schema
      const tableSql = this.generateTableSQL(tableName, fields);
      
      this.logger.debug('Creating table with correct schema', runId, {
        operation: 'table_create_sql',
        table: tableName,
        fields: fields.length,
        sql: tableSql.substring(0, 200) + '...'
      });

      // Execute table creation
      await this.prisma.$executeRawUnsafe(tableSql);

      this.logger.info('Table created successfully', runId, {
        operation: 'table_ensure_success',
        table: tableName,
        fields: fields.length
      });

    } catch (error) {
      this.logger.error('Failed to ensure table exists', runId, {
        operation: 'table_ensure_error',
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
   * Transform Bubble record for database storage
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
   * Upsert single record to database
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
