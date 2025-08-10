import BubbleService from './bubbleService.js';
import DataSyncService from './dataSyncService.js';
import { loggers } from '../utils/logger.js';

/**
 * Batch Sync Service - Option A (Global Limit)
 * Orchestrates DataSyncService for all discovered data types
 * Each table gets the same global limit (e.g., 5 records per table)
 * UDLS-compliant logging mandatory per project rules
 */
class BatchSyncService {
  constructor() {
    this.bubbleService = new BubbleService();
    this.dataSyncService = new DataSyncService();
    this.logger = loggers.sync;
  }

  /**
   * Sync all discovered data types with global limit
   * @param {number} globalLimit - Records to sync per table (default: 5)
   * @param {Object} options - Batch sync options
   * @returns {Object} Complete batch sync results with UDLS logging
   */
  async syncAllTables(globalLimit = 5, options = {}) {
    const runId = this.logger.generateRunId();
    const startTime = Date.now();
    
    const {
      onlyWithData = true,     // Only sync tables that have data
      continueOnError = false, // Stop on first error vs continue
      maxTables = null,        // Limit number of tables to sync (for testing)
      skipTables = []          // Array of table names to skip
    } = options;

    this.logger.info('Starting batch sync for all tables', runId, {
      operation: 'batch_sync_start',
      globalLimit,
      options: {
        onlyWithData,
        continueOnError,
        maxTables,
        skipTables: skipTables.length
      }
    });

    const batchResult = {
      runId,
      globalLimit,
      tables: {
        discovered: 0,
        attempted: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      },
      totalRecords: {
        synced: 0,
        errors: 0,
        skipped: 0
      },
      results: [],
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString()
    };

    try {
      // Step 1: Discover all available data types
      const discovery = await this.discoverTables(runId);
      if (!discovery.success) {
        throw new Error(discovery.error);
      }

      let tablesToSync = discovery.tables;
      batchResult.tables.discovered = tablesToSync.length;

      // Step 2: Apply filters
      tablesToSync = this.filterTables(tablesToSync, onlyWithData, skipTables, runId);
      
      // Step 3: Limit tables if maxTables specified
      if (maxTables && maxTables > 0) {
        tablesToSync = tablesToSync.slice(0, maxTables);
        this.logger.info('Limited tables for batch sync', runId, {
          operation: 'batch_limit_tables',
          original: batchResult.tables.discovered,
          limited: tablesToSync.length,
          maxTables
        });
      }

      batchResult.tables.attempted = tablesToSync.length;

      if (tablesToSync.length === 0) {
        this.logger.warn('No tables to sync after filtering', runId, {
          operation: 'batch_sync_empty',
          discovered: batchResult.tables.discovered,
          onlyWithData,
          skipTables: skipTables.length
        });

        batchResult.duration = Date.now() - startTime;
        return batchResult;
      }

      // Step 4: Sync each table with global limit
      this.logger.info('Beginning table sync operations', runId, {
        operation: 'batch_sync_tables_start',
        tableCount: tablesToSync.length,
        globalLimit,
        continueOnError
      });

      for (let i = 0; i < tablesToSync.length; i++) {
        const table = tablesToSync[i];
        const tableStartTime = Date.now();

        this.logger.info(`Syncing table ${i + 1}/${tablesToSync.length}`, runId, {
          operation: 'batch_table_sync_start',
          table: table.name,
          progress: `${i + 1}/${tablesToSync.length}`,
          hasData: table.hasData,
          globalLimit
        });

        try {
          // Sync individual table with global limit
          const tableResult = await this.dataSyncService.syncTable(
            table.name,
            globalLimit,
            { batchRunId: runId }
          );

          const tableDuration = Date.now() - tableStartTime;

          // Record successful sync
          batchResult.results.push({
            table: table.name,
            success: true,
            ...tableResult,
            batchOrder: i + 1,
            tableDuration
          });

          batchResult.tables.successful++;
          batchResult.totalRecords.synced += tableResult.synced || 0;
          batchResult.totalRecords.errors += tableResult.errors || 0;
          batchResult.totalRecords.skipped += tableResult.skipped || 0;

          this.logger.info('Table sync completed successfully', runId, {
            operation: 'batch_table_sync_success',
            table: table.name,
            synced: tableResult.synced,
            duration: tableDuration,
            progress: `${i + 1}/${tablesToSync.length}`
          });

        } catch (tableError) {
          const tableDuration = Date.now() - tableStartTime;
          
          // Record failed sync
          const errorResult = {
            table: table.name,
            success: false,
            error: tableError.message,
            batchOrder: i + 1,
            tableDuration
          };

          batchResult.results.push(errorResult);
          batchResult.errors.push(errorResult);
          batchResult.tables.failed++;

          this.logger.error('Table sync failed', runId, {
            operation: 'batch_table_sync_error',
            table: table.name,
            error: tableError.message,
            duration: tableDuration,
            progress: `${i + 1}/${tablesToSync.length}`
          });

          // Decide whether to continue or stop
          if (!continueOnError) {
            this.logger.error('Batch sync stopping due to table error', runId, {
              operation: 'batch_sync_stop_on_error',
              failedTable: table.name,
              tablesRemaining: tablesToSync.length - (i + 1),
              continueOnError
            });

            throw new Error(
              `Batch sync failed on table '${table.name}': ${tableError.message}`
            );
          } else {
            this.logger.warn('Batch sync continuing despite error', runId, {
              operation: 'batch_sync_continue_on_error',
              failedTable: table.name,
              tablesRemaining: tablesToSync.length - (i + 1)
            });
          }
        }
      }

      // Step 5: Complete batch sync
      const totalDuration = Date.now() - startTime;
      batchResult.duration = totalDuration;

      this.logger.info('Batch sync completed', runId, {
        operation: 'batch_sync_complete',
        discovered: batchResult.tables.discovered,
        attempted: batchResult.tables.attempted,
        successful: batchResult.tables.successful,
        failed: batchResult.tables.failed,
        totalSynced: batchResult.totalRecords.synced,
        totalErrors: batchResult.totalRecords.errors,
        duration: totalDuration,
        globalLimit
      });

      return batchResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      batchResult.duration = duration;
      
      this.logger.error('Batch sync failed', runId, {
        operation: 'batch_sync_error',
        error: error.message,
        duration,
        partialResults: {
          attempted: batchResult.tables.attempted,
          successful: batchResult.tables.successful,
          failed: batchResult.tables.failed
        }
      });

      throw error;
    }
  }

  /**
   * Discover all available tables for batch sync
   */
  async discoverTables(runId) {
    this.logger.info('Discovering tables for batch sync', runId, {
      operation: 'batch_discover_start'
    });

    try {
      const discovery = await this.bubbleService.discoverAllDataTypes();
      
      if (!discovery.discoveredTypes) {
        throw new Error('Failed to discover data types from Bubble');
      }

      const accessibleTables = discovery.discoveredTypes.filter(
        type => type.status === 'accessible'
      );

      this.logger.info('Table discovery completed', runId, {
        operation: 'batch_discover_success',
        totalFound: discovery.discoveredTypes.length,
        accessible: accessibleTables.length,
        withData: accessibleTables.filter(t => t.hasData).length,
        empty: accessibleTables.filter(t => !t.hasData).length
      });

      return {
        success: true,
        tables: accessibleTables,
        totalFound: discovery.discoveredTypes.length,
        summary: discovery.summary
      };

    } catch (error) {
      this.logger.error('Table discovery failed', runId, {
        operation: 'batch_discover_error',
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Filter tables based on options
   */
  filterTables(tables, onlyWithData, skipTables, runId) {
    let filtered = tables;

    // Filter out tables without data if requested
    if (onlyWithData) {
      filtered = filtered.filter(table => table.hasData);
      this.logger.info('Filtered out empty tables', runId, {
        operation: 'batch_filter_empty',
        before: tables.length,
        after: filtered.length,
        removed: tables.length - filtered.length
      });
    }

    // Filter out skipped tables
    if (skipTables.length > 0) {
      const beforeSkip = filtered.length;
      filtered = filtered.filter(table => !skipTables.includes(table.name));
      
      this.logger.info('Filtered out skipped tables', runId, {
        operation: 'batch_filter_skip',
        before: beforeSkip,
        after: filtered.length,
        skipped: skipTables,
        removed: beforeSkip - filtered.length
      });
    }

    return filtered;
  }

  /**
   * Get batch sync statistics
   */
  async getBatchStats() {
    const runId = this.logger.generateRunId();
    
    this.logger.info('Retrieving batch sync statistics', runId, {
      operation: 'batch_stats_start'
    });

    try {
      // Get discovery stats
      const discovery = await this.bubbleService.discoverAllDataTypes();
      
      // Get individual table stats for accessible tables with data
      const tableStats = [];
      if (discovery.discoveredTypes) {
        const tablesWithData = discovery.discoveredTypes
          .filter(t => t.status === 'accessible' && t.hasData)
          .slice(0, 10); // Limit to first 10 for performance

        for (const table of tablesWithData) {
          try {
            const stats = await this.dataSyncService.getTableStats(table.name);
            if (stats.success) {
              tableStats.push({
                table: table.name,
                ...stats.stats
              });
            }
          } catch (error) {
            // Continue with other tables if one fails
            this.logger.warn('Failed to get stats for table', runId, {
              operation: 'batch_stats_table_error',
              table: table.name,
              error: error.message
            });
          }
        }
      }

      const response = {
        discovery: {
          totalFound: discovery.discoveredTypes?.length || 0,
          accessible: discovery.discoveredTypes?.filter(t => t.status === 'accessible').length || 0,
          withData: discovery.discoveredTypes?.filter(t => t.hasData).length || 0,
          empty: discovery.discoveredTypes?.filter(t => !t.hasData).length || 0
        },
        syncedTables: tableStats.length,
        tableDetails: tableStats,
        timestamp: new Date().toISOString()
      };

      this.logger.info('Batch stats retrieved successfully', runId, {
        operation: 'batch_stats_success',
        discovered: response.discovery.totalFound,
        syncedTables: response.syncedTables
      });

      return {
        success: true,
        runId,
        data: response
      };

    } catch (error) {
      this.logger.error('Failed to retrieve batch stats', runId, {
        operation: 'batch_stats_error',
        error: error.message
      });

      return {
        success: false,
        runId,
        error: error.message
      };
    }
  }

  /**
   * Get available tables for batch sync
   */
  async getAvailableTables() {
    const runId = this.logger.generateRunId();
    
    try {
      const discovery = await this.discoverTables(runId);
      
      if (!discovery.success) {
        throw new Error(discovery.error);
      }

      const availableTables = discovery.tables.map(table => ({
        name: table.name,
        hasData: table.hasData,
        sampleCount: table.sampleCount || 0,
        endpoint: table.endpoint,
        status: table.status
      }));

      return {
        success: true,
        runId,
        tables: availableTables,
        count: availableTables.length,
        summary: {
          withData: availableTables.filter(t => t.hasData).length,
          empty: availableTables.filter(t => !t.hasData).length,
          total: availableTables.length
        }
      };

    } catch (error) {
      this.logger.error('Failed to get available tables', runId, {
        operation: 'get_available_tables_error',
        error: error.message
      });

      return {
        success: false,
        runId,
        error: error.message
      };
    }
  }
}

export default BatchSyncService;
