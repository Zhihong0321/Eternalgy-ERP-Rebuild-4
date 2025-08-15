import prisma from '../lib/prisma.js';
import BubbleService from './bubbleService.js';
import PendingPatchService from './pendingPatchService.js';
import DataSyncService from './dataSyncService.js';
import { loggers } from '../utils/logger.js';

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
    this.dataSyncService = new DataSyncService(); // Use regular sync logic for proper type handling
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

      // Step 4: Update cursor position ONLY if sync was successful and no errors
      if (syncResult.errors === 0) {
        // Only update cursor if ALL records synced successfully
        const newCursor = lastCursor + syncResult.synced;
        await this.updateLastCursor(tableName, newCursor, runId);
        
        this.logger.info('✅ Cursor updated after successful sync', runId, {
          operation: 'cursor_update_success',
          table: tableName,
          syncedRecords: syncResult.synced,
          newCursor,
          reason: 'all_records_synced_successfully'
        });
      } else {
        // Don't update cursor if there were errors - keep it at current position
        this.logger.warn('⚠️ Cursor NOT updated due to sync errors', runId, {
          operation: 'cursor_update_skipped',
          table: tableName,
          errors: syncResult.errors,
          cursor: lastCursor,
          reason: 'sync_had_errors_cursor_preserved'
        });
      }

      // Step 5: Complete sync logging
      const totalDuration = Date.now() - startTime;
      const finalCursor = syncResult.errors === 0 ? lastCursor + syncResult.synced : lastCursor;
      
      this.logger.info('✅ SYNC+ incremental sync completed', runId, {
        operation: 'incremental_sync_complete',
        table: tableName,
        type: 'SYNC_PLUS',
        newRecords: records.length,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors,
        previousCursor: lastCursor,
        finalCursor: finalCursor,
        cursorUpdated: syncResult.errors === 0,
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
        newCursor: finalCursor,
        cursorUpdated: syncResult.errors === 0,
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
   * Get ROBUST cursor position by checking actual database state
   * Runs before every sync to self-correct cursor position
   */
  async getLastCursor(tableName, runId) {
    try {
      // Ensure sync cursor tracking table exists
      await this.ensureSyncCursorTable();

      // STEP 1: Get stored cursor position
      const cursorRecord = await prisma.sync_cursors.findUnique({
        where: { table_name: tableName }
      });
      const storedCursor = cursorRecord?.last_cursor || 0;

      // STEP 2: Get ACTUAL record count from database (ROBUST DETECTION)
      const actualCursor = await this.detectActualCursor(tableName, runId);

      // STEP 3: Compare and self-correct if needed
      if (actualCursor !== storedCursor) {
        this.logger.warn('🔧 CURSOR MISMATCH DETECTED - Auto-correcting', runId, {
          operation: 'cursor_self_correction',
          table: tableName,
          storedCursor,
          actualCursor,
          action: 'correcting_to_actual_count'
        });

        // Auto-correct the cursor to match actual database state
        await this.updateLastCursor(tableName, actualCursor, runId);
        
        return actualCursor;
      }

      this.logger.info('📍 Cursor verified and correct', runId, {
        operation: 'cursor_verified',
        table: tableName,
        cursor: actualCursor,
        status: 'aligned_with_database'
      });

      return actualCursor;

    } catch (error) {
      this.logger.warn('⚠️ Failed cursor detection, starting from 0', runId, {
        operation: 'cursor_detection_failed',
        table: tableName,
        error: error.message,
        fallback: 'Starting from cursor 0'
      });
      return 0;
    }
  }

  /**
   * Detect actual cursor position by counting records in database
   * This is the ROBUST detection method that self-corrects
   */
  async detectActualCursor(tableName, runId) {
    try {
      const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      // Check if table exists first
      const tableExists = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, safeTableName);

      if (!tableExists[0].exists) {
        this.logger.info('📍 Table does not exist - cursor is 0', runId, {
          operation: 'cursor_detection_no_table',
          table: tableName,
          actualCursor: 0
        });
        return 0;
      }

      // Count actual records in the table (robust detection)
      const countResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "${safeTableName}"
      `);

      const actualCount = parseInt(countResult[0].count) || 0;

      // Removed debug log to reduce volume - only log when cursor correction needed

      return actualCount;

    } catch (error) {
      this.logger.error('❌ Failed to detect actual cursor', runId, {
        operation: 'cursor_detection_error',
        table: tableName,
        error: error.message,
        fallback: 'Returning 0'
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
   * Handles large limits by making multiple API calls
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
      const allRecords = [];
      let currentCursor = startCursor;
      let remainingLimit = limit;
      let batchCount = 0;

      // Fetch in batches of 100 (Bubble API limit) until we reach requested limit
      while (remainingLimit > 0) {
        const batchLimit = Math.min(remainingLimit, 100);
        batchCount++;

        // Only log every 5th batch to reduce log volume
        if (batchCount % 5 === 1 || batchCount === 1) {
          this.logger.info(`📡 Fetching batches ${batchCount}+ (${batchLimit} records per batch)`, runId, {
            operation: 'incremental_fetch_progress',
            table: tableName,
            batchCount,
            currentCursor,
            remainingLimit
          });
        }

        const bubbleCall = await this.bubbleService.fetchDataType(tableName, {
          limit: batchLimit,
          cursor: currentCursor,
          includeEmpty: false
        });

        if (!bubbleCall.success) {
          return {
            success: false,
            error: `Bubble API error in batch ${batchCount}: ${bubbleCall.error}`
          };
        }

        const batchRecords = bubbleCall.records || [];
        allRecords.push(...batchRecords);
        
        // Update cursor and remaining limit
        currentCursor += batchRecords.length;
        remainingLimit -= batchRecords.length;

        // If we got fewer records than requested in this batch, we've reached the end
        if (batchRecords.length < batchLimit) {
          this.logger.info(`📡 Reached end of data in batch ${batchCount}`, runId, {
            operation: 'incremental_fetch_end_reached',
            table: tableName,
            batchRecords: batchRecords.length,
            totalFetched: allRecords.length
          });
          break;
        }

        // Rate limiting between batches
        if (batchCount > 1) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
      }
      
      this.logger.info('📡 Incremental fetch completed', runId, {
        operation: 'incremental_fetch_complete',
        table: tableName,
        startCursor,
        requestedLimit: limit,
        recordsFetched: allRecords.length,
        batchCount,
        finalCursor: currentCursor
      });

      return {
        success: true,
        records: allRecords,
        cursor: startCursor,
        finalCursor: currentCursor,
        batchCount
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
   * Sync records to database - TRULY INCREMENTAL (only INSERT new records)
   * This is different from regular sync which does UPSERT
   */
  async syncRecordsToDatabase(tableName, records, runId) {
    this.logger.info('💾 Starting TRULY incremental database sync (INSERT only)', runId, {
      operation: 'incremental_database_sync_start',
      table: tableName,
      recordCount: records.length,
      type: 'SYNC_PLUS',
      behavior: 'INSERT_ONLY_NEW_RECORDS'
    });

    const syncResult = {
      synced: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    try {
      const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

      // Process each record individually - INSERT only (not upsert)
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const recordId = record._id || record.id || `record_${i}`;

        try {
          // Check if record already exists (skip if exists)
          const existingRecord = await prisma.$queryRawUnsafe(`
            SELECT bubble_id FROM "${safeTableName}" WHERE bubble_id = $1 LIMIT 1
          `, recordId);

          if (existingRecord && existingRecord.length > 0) {
            syncResult.skipped++;
            syncResult.details.push({
              recordId,
              status: 'skipped',
              reason: 'Record already exists (incremental sync skips existing)'
            });

            // Removed per-record logging to reduce volume
            continue;
          }

          // INSERT new record only (use regular sync logic for proper formatting)
          const insertResult = await this.dataSyncService.upsertRecordDirect(tableName, record, recordId, runId);
          
          if (insertResult.success) {
            syncResult.synced++;
            syncResult.details.push({
              recordId,
              status: 'synced',
              action: 'inserted_new'
            });

            // Removed per-record logging to reduce volume
          } else {
            syncResult.skipped++;
            syncResult.details.push({
              recordId,
              status: 'skipped',
              reason: insertResult.reason || 'Insert failed'
            });
          }

        } catch (recordError) {
          syncResult.errors++;
          syncResult.details.push({
            recordId,
            status: 'error',
            error: recordError.message
          });

          this.logger.error('❌ Incremental record sync failed - continuing with other records', runId, {
            operation: 'incremental_record_sync_error',
            table: tableName,
            recordId,
            error: recordError.message,
            action: 'continuing_with_remaining_records'
          });

          // Handle column errors (same as regular sync) but don't throw
          await this.handleColumnError(recordError, tableName, runId);
          
          // DON'T throw - continue processing other records
          // The error count will prevent cursor update
        }
      }

      this.logger.info('✅ TRULY incremental database sync completed', runId, {
        operation: 'incremental_database_sync_complete',
        table: tableName,
        type: 'SYNC_PLUS',
        behavior: 'INSERT_ONLY_NEW_RECORDS',
        totalRecords: records.length,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors,
        explanation: 'Only NEW records were inserted, existing records were skipped'
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
      
      // Return partial results instead of throwing
      return syncResult;
    }
  }

  // Note: Now using DataSyncService.upsertRecordDirect for proper type handling and compatibility

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

  /**
   * Set cursor to specific position (useful when cursor gets out of sync)
   */
  async setCursor(tableName, position, runId = null) {
    try {
      await this.ensureSyncCursorTable();
      
      await prisma.sync_cursors.upsert({
        where: { table_name: tableName },
        update: { 
          last_cursor: position,
          last_sync_at: new Date(),
          sync_run_id: runId || `manual_set_${position}`
        },
        create: { 
          table_name: tableName,
          last_cursor: position,
          last_sync_at: new Date(),
          sync_run_id: runId || `manual_set_${position}`
        }
      });

      return { success: true, message: `Cursor set to ${position} for table ${tableName}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default IncrementalSyncService;