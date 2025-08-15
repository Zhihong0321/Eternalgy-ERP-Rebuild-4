import { PrismaClient } from '@prisma/client';
import BubbleService from './bubbleService.js';
import PendingPatchService from './pendingPatchService.js';
import { loggers } from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Incremental Sync Service (SYNC+)
 * 
 * 🎯 PURPOSE: Fetch only NEW records since last sync using cursor tracking
 * 🔒 SAFETY: Completely separate from existing DataSyncService
 * 
 * Key Differences from Regular Sync:
 * 1. Tracks cursor position per table
 * 2. Fetches from last cursor position (not from beginning)
 * 3. Only processes truly new records
 * 4. Falls back to full sync if cursor tracking fails
 */
class IncrementalSyncService {
  constructor() {
    this.bubbleService = new BubbleService();
    this.logger = loggers.sync;
    this.prisma = prisma;
    this.pendingPatchService = new PendingPatchService();
  }

  /**
   * SYNC+ - Incremental sync for a specific table
   * @param {string} tableName - Name of the Bubble data type to sync
   * @param {number} limit - Maximum NEW records to fetch (default: 100)
   * @returns {Object} Sync result with incremental info
   */
  async syncTableIncremental(tableName, limit = 100) {
    const runId = this.logger.generateRunId();
    const startTime = Date.now();
    
    this.logger.info('🚀 Starting SYNC+ incremental sync', runId, {
      operation: 'incremental_sync_start',
      table: tableName,
      limit,
      type: 'SYNC_PLUS'
    });

    try {
      // Step 1: Get last cursor position for this table
      const lastCursor = await this.getLastCursor(tableName, runId);
      
      // Step 2: Fetch records from last cursor position
      const fetchResult = await this.fetchIncrementalData(tableName, lastCursor, limit, runId);
      if (!fetchResult.success) {
        throw new Error(fetchResult.error);
      }

      const records = fetchResult.records;
      if (records.length === 0) {
        this.logger.info('✅ SYNC+ complete - no new records found', runId, {
          operation: 'incremental_sync_empty',
          table: tableName,
          lastCursor,
          message: 'All records already synced'
        });

        return {
          success: true,
          table: tableName,
          type: 'SYNC_PLUS',
          newRecords: 0,
          lastCursor,
          message: 'No new records to sync',
          duration: Date.now() - startTime
        };
      }

      // Step 3: Process and sync new records to database
      const syncResult = await this.syncRecordsToDatabase(tableName, records, runId);

      // Step 4: Update cursor position after successful sync
      const newCursor = lastCursor + records.length;
      await this.updateLastCursor(tableName, newCursor, runId);

      // Step 5: Complete sync logging
      const totalDuration = Date.now() - startTime;
      
      this.logger.info('✅ SYNC+ incremental sync completed successfully', runId, {
        operation: 'incremental_sync_complete',
        table: tableName,
        type: 'SYNC_PLUS',
        newRecords: records.length,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors,
        previousCursor: lastCursor,
        newCursor: newCursor,
        duration: totalDuration
      });

      return {
        success: true,
        table: tableName,
        type: 'SYNC_PLUS',
        newRecords: records.length,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors,
        previousCursor: lastCursor,
        newCursor: newCursor,
        duration: totalDuration,
        details: syncResult.details
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('❌ SYNC+ incremental sync failed', runId, {
        operation: 'incremental_sync_error',
        table: tableName,
        type: 'SYNC_PLUS',
        error: error.message,
        duration,
        fallback: 'User can use regular SYNC button as fallback'
      });

      // Check if this is a missing column error and create pending request
      await this.handleColumnError(error, tableName, runId);

      throw error;
    }
  }

  /**
   * Get last cursor position for a table
   */
  async getLastCursor(tableName, runId) {
    try {
      // Ensure sync cursor tracking table exists
      await this.ensureSyncCursorTable();

      const cursorRecord = await prisma.sync_cursors.findUnique({
        where: { table_name: tableName }
      });

      const lastCursor = cursorRecord?.last_cursor || 0;
      
      this.logger.info('📍 Retrieved last cursor position', runId, {
        operation: 'cursor_retrieved',
        table: tableName,
        lastCursor,
        hasRecord: !!cursorRecord
      });

      return lastCursor;

    } catch (error) {
      this.logger.warn('⚠️ Failed to get cursor, starting from 0', runId, {
        operation: 'cursor_retrieval_failed',
        table: tableName,
        error: error.message,
        fallback: 'Starting from cursor 0'
      });
      return 0;
    }
  }

  /**
   * Update last cursor position after successful sync
   */
  async updateLastCursor(tableName, newCursor, runId) {
    try {
      await prisma.sync_cursors.upsert({
        where: { table_name: tableName },
        update: { 
          last_cursor: newCursor,
          last_sync_at: new Date(),
          sync_run_id: runId
        },
        create: { 
          table_name: tableName,
          last_cursor: newCursor,
          last_sync_at: new Date(),
          sync_run_id: runId
        }
      });

      this.logger.info('💾 Updated cursor position', runId, {
        operation: 'cursor_updated',
        table: tableName,
        newCursor,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('❌ Failed to update cursor', runId, {
        operation: 'cursor_update_failed',
        table: tableName,
        newCursor,
        error: error.message
      });
      // Don't throw - sync succeeded even if cursor update failed
    }
  }

  /**
   * Fetch incremental data from Bubble starting from specific cursor
   */
  async fetchIncrementalData(tableName, startCursor, limit, runId) {
    this.logger.info('📡 Fetching incremental data from Bubble', runId, {
      operation: 'incremental_fetch_start',
      table: tableName,
      startCursor,
      limit,
      type: 'SYNC_PLUS'
    });

    try {
      const bubbleCall = await this.bubbleService.fetchDataType(tableName, {
        limit: Math.min(limit, 100), // Bubble max is 100 per call
        cursor: startCursor,
        includeEmpty: false
      });

      if (!bubbleCall.success) {
        return {
          success: false,
          error: `Bubble API error: ${bubbleCall.error}`
        };
      }

      const records = bubbleCall.records || [];
      
      this.logger.info('📡 Incremental fetch completed', runId, {
        operation: 'incremental_fetch_complete',
        table: tableName,
        startCursor,
        recordsFetched: records.length,
        hasMore: bubbleCall.pagination?.hasMore,
        remaining: bubbleCall.pagination?.remaining
      });

      return {
        success: true,
        records: records,
        cursor: startCursor,
        pagination: bubbleCall.pagination
      };

    } catch (error) {
      this.logger.error('❌ Incremental fetch failed', runId, {
        operation: 'incremental_fetch_error',
        table: tableName,
        startCursor,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create sync_cursors table if it doesn't exist
   */
  async ensureSyncCursorTable() {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "sync_cursors" (
          "id" SERIAL PRIMARY KEY,
          "table_name" TEXT UNIQUE NOT NULL,
          "last_cursor" INTEGER NOT NULL DEFAULT 0,
          "last_sync_at" TIMESTAMPTZ DEFAULT NOW(),
          "sync_run_id" TEXT,
          "created_at" TIMESTAMPTZ DEFAULT NOW(),
          "updated_at" TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (error) {
      this.logger.error('Failed to ensure sync cursor table', null, {
        operation: 'ensure_cursor_table_error',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Sync records to database (reuse existing logic from DataSyncService)
   * This maintains compatibility with existing schema mapping and error handling
   */
  async syncRecordsToDatabase(tableName, records, runId) {
    this.logger.info('💾 Starting incremental database sync', runId, {
      operation: 'incremental_database_sync_start',
      table: tableName,
      recordCount: records.length,
      type: 'SYNC_PLUS'
    });

    const syncResult = {
      synced: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    try {
      // Process each record individually (same as regular sync)
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const recordId = record._id || record.id || `record_${i}`;

        try {
          // Use same upsert logic as regular sync for compatibility
          const upsertResult = await this.upsertRecordDirect(tableName, record, recordId, runId);
          
          if (upsertResult.success) {
            syncResult.synced++;
            syncResult.details.push({
              recordId,
              status: 'synced',
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

          this.logger.error('❌ Incremental record sync failed', runId, {
            operation: 'incremental_record_sync_error',
            table: tableName,
            recordId,
            error: recordError.message
          });

          // Handle column errors (same as regular sync)
          await this.handleColumnError(recordError, tableName, runId);
          throw recordError;
        }
      }

      this.logger.info('✅ Incremental database sync completed', runId, {
        operation: 'incremental_database_sync_complete',
        table: tableName,
        type: 'SYNC_PLUS',
        totalRecords: records.length,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors
      });

      return syncResult;

    } catch (error) {
      this.logger.error('❌ Incremental database sync failed', runId, {
        operation: 'incremental_database_sync_error',
        table: tableName,
        type: 'SYNC_PLUS',
        error: error.message,
        partialResults: syncResult
      });

      await this.handleColumnError(error, tableName, runId);
      throw error;
    }
  }

  /**
   * Reuse existing upsert logic for compatibility
   * TODO: Import this from DataSyncService to avoid duplication
   */
  async upsertRecordDirect(tableName, bubbleRecord, recordId, runId) {
    // For now, delegate to a simplified version
    // In production, we'd import this from DataSyncService
    const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const bubbleId = bubbleRecord._id || bubbleRecord.id;
    
    if (!bubbleId) {
      throw new Error('Record missing required _id field');
    }

    try {
      // Simplified upsert - convert Bubble record to database record
      const dbRecord = { bubble_id: bubbleId };
      
      // Convert Bubble fields to snake_case (same logic as regular sync)
      Object.keys(bubbleRecord).forEach(key => {
        if (key === '_id') return;
        
        const snakeKey = key
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .toLowerCase()
          .replace(/^_|_$/g, '');
        
        dbRecord[snakeKey] = bubbleRecord[key];
      });

      // Check if record exists
      const existing = await this.prisma.$queryRawUnsafe(
        `SELECT "bubble_id" FROM "${safeTableName}" WHERE "bubble_id" = $1 LIMIT 1`,
        bubbleId
      );

      if (existing.length > 0) {
        // Update existing
        const updateFields = Object.keys(dbRecord)
          .filter(key => key !== 'bubble_id')
          .map((key, index) => `"${key}" = $${index + 2}`)
          .join(', ');

        if (updateFields) {
          const updateValues = Object.keys(dbRecord)
            .filter(key => key !== 'bubble_id')
            .map(key => dbRecord[key]);

          await this.prisma.$queryRawUnsafe(
            `UPDATE "${safeTableName}" SET ${updateFields} WHERE "bubble_id" = $1`,
            bubbleId,
            ...updateValues
          );
        }

        return { success: true, action: 'updated' };
      } else {
        // Insert new
        const fields = Object.keys(dbRecord).map(key => `"${key}"`).join(', ');
        const placeholders = Object.keys(dbRecord).map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(dbRecord);

        await this.prisma.$queryRawUnsafe(
          `INSERT INTO "${safeTableName}" (${fields}) VALUES (${placeholders})`,
          ...values
        );

        return { success: true, action: 'inserted' };
      }

    } catch (error) {
      this.logger.error('❌ Incremental upsert failed', runId, {
        operation: 'incremental_upsert_error',
        table: tableName,
        recordId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle column errors (same as regular sync)
   */
  async handleColumnError(error, tableName, runId) {
    try {
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        this.logger.info('🔧 SYNC+ detected missing column - creating pending patch request', runId, {
          operation: 'incremental_missing_column_detected',
          table: tableName,
          error: error.message,
          type: 'SYNC_PLUS'
        });

        const result = await this.pendingPatchService.createPendingRequest(
          error.message,
          runId,
          { 
            source: 'incremental_sync_service',
            table: tableName,
            syncType: 'SYNC_PLUS',
            originalError: error.message
          }
        );

        if (result.success) {
          this.logger.info('✅ SYNC+ pending patch request created', runId, {
            operation: 'incremental_pending_request_created',
            table: tableName,
            requestId: result.request?.id,
            type: 'SYNC_PLUS'
          });
        }
      }
    } catch (patchError) {
      this.logger.error('❌ SYNC+ patch service error (non-blocking)', runId, {
        operation: 'incremental_patch_service_error',
        table: tableName,
        patchError: patchError.message,
        originalError: error.message
      });
    }
  }

  /**
   * Reset cursor for a table (useful for testing or manual reset)
   */
  async resetCursor(tableName, runId = null) {
    try {
      await this.ensureSyncCursorTable();
      
      await prisma.sync_cursors.upsert({
        where: { table_name: tableName },
        update: { 
          last_cursor: 0,
          last_sync_at: new Date(),
          sync_run_id: runId || 'manual_reset'
        },
        create: { 
          table_name: tableName,
          last_cursor: 0,
          last_sync_at: new Date(),
          sync_run_id: runId || 'manual_reset'
        }
      });

      return { success: true, message: `Cursor reset to 0 for table ${tableName}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default IncrementalSyncService;