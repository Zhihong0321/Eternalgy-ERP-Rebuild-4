import express from 'express';
import IncrementalSyncService from '../services/incrementalSyncService.js';

const router = express.Router();

/**
 * Incremental Sync API (SYNC+)
 * 
 * 🎯 PURPOSE: Provide SYNC+ endpoints alongside regular sync
 * 🔒 SAFETY: Completely separate from existing sync endpoints
 * 
 * Routes:
 * - POST /table/{tableName}/plus - SYNC+ incremental sync
 * - POST /table/{tableName}/reset-cursor - Reset cursor to 0
 * - GET /cursors - View all cursor positions
 */

// Initialize service
let incrementalSyncService;
try {
  incrementalSyncService = new IncrementalSyncService();
  console.log('✅ IncrementalSyncService initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize IncrementalSyncService:', error.message);
}

/**
 * SYNC+ - Incremental sync for specific table
 * POST /api/sync/table/{tableName}/plus?limit=100
 * 
 * Fetches only NEW records since last sync using cursor tracking
 */
router.post('/table/:tableName/plus', async (req, res) => {
  const { tableName } = req.params;
  const limit = parseInt(req.query.limit) || 100;

  try {
    if (!incrementalSyncService) {
      return res.status(500).json({
        success: false,
        error: 'IncrementalSyncService not initialized',
        fallback: 'Use regular SYNC button instead'
      });
    }

    console.log(`🚀 SYNC+ requested: ${tableName} (limit: ${limit})`);

    const result = await incrementalSyncService.syncTableIncremental(tableName, limit);

    res.json({
      success: true,
      endpoint: 'incremental_sync',
      type: 'SYNC_PLUS',
      table: tableName,
      ...result,
      message: result.newRecords > 0 
        ? `✅ SYNC+ completed: ${result.synced} new records synced`
        : '✅ SYNC+ completed: No new records found',
      fallback: 'If issues occur, use regular SYNC button',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ SYNC+ failed for ${tableName}:`, error.message);
    
    res.status(500).json({
      success: false,
      endpoint: 'incremental_sync',
      type: 'SYNC_PLUS',
      table: tableName,
      error: error.message,
      fallback: 'Use regular SYNC button as alternative',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Reset cursor for specific table
 * POST /api/sync/table/{tableName}/reset-cursor
 * 
 * Resets cursor to 0 - next SYNC+ will start from beginning
 */
router.post('/table/:tableName/reset-cursor', async (req, res) => {
  const { tableName } = req.params;

  try {
    if (!incrementalSyncService) {
      return res.status(500).json({
        success: false,
        error: 'IncrementalSyncService not initialized'
      });
    }

    const result = await incrementalSyncService.resetCursor(tableName);

    res.json({
      success: true,
      endpoint: 'reset_cursor',
      table: tableName,
      ...result,
      message: `Cursor reset for ${tableName} - next SYNC+ will start from beginning`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Reset cursor failed for ${tableName}:`, error.message);
    
    res.status(500).json({
      success: false,
      endpoint: 'reset_cursor',
      table: tableName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Set cursor to specific position
 * POST /api/sync/table/{tableName}/set-cursor?position=3900
 * 
 * Sets cursor to specific position (useful when cursor gets out of sync with actual data)
 */
router.post('/table/:tableName/set-cursor', async (req, res) => {
  const { tableName } = req.params;
  const position = parseInt(req.query.position) || 0;

  try {
    if (!incrementalSyncService) {
      return res.status(500).json({
        success: false,
        error: 'IncrementalSyncService not initialized'
      });
    }

    const result = await incrementalSyncService.setCursor(tableName, position);

    res.json({
      success: true,
      endpoint: 'set_cursor',
      table: tableName,
      position: position,
      ...result,
      message: `Cursor set to position ${position} for ${tableName}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Set cursor failed for ${tableName}:`, error.message);
    
    res.status(500).json({
      success: false,
      endpoint: 'set_cursor',
      table: tableName,
      position: position,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get all cursor positions with ROBUST detection
 * GET /api/sync/cursors
 * 
 * Shows cursor positions vs actual database counts (useful for debugging)
 */
router.get('/cursors', async (req, res) => {
  try {
    if (!incrementalSyncService) {
      return res.status(500).json({
        success: false,
        error: 'IncrementalSyncService not initialized'
      });
    }

    // Ensure table exists
    await incrementalSyncService.ensureSyncCursorTable();

    // Get all cursor records
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const cursors = await prisma.sync_cursors.findMany({
      orderBy: { table_name: 'asc' }
    });

    // Add robust detection for each cursor
    const enhancedCursors = [];
    for (const cursor of cursors) {
      try {
        const actualCursor = await incrementalSyncService.detectActualCursor(cursor.table_name, 'cursor_check');
        const isAligned = cursor.last_cursor === actualCursor;
        
        enhancedCursors.push({
          ...cursor,
          actualRecordCount: actualCursor,
          isAligned,
          status: isAligned ? 'aligned' : 'misaligned',
          difference: actualCursor - cursor.last_cursor
        });
      } catch (error) {
        enhancedCursors.push({
          ...cursor,
          actualRecordCount: null,
          isAligned: false,
          status: 'error',
          error: error.message
        });
      }
    }

    const misalignedCount = enhancedCursors.filter(c => !c.isAligned).length;

    res.json({
      success: true,
      endpoint: 'get_cursors_robust',
      cursors: enhancedCursors,
      count: cursors.length,
      misalignedCount,
      message: `Found ${cursors.length} cursor records, ${misalignedCount} misaligned`,
      selfCorrection: 'Cursors will auto-correct on next SYNC+ operation',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get cursors failed:', error.message);
    
    res.status(500).json({
      success: false,
      endpoint: 'get_cursors_robust',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check for incremental sync service
 * GET /api/sync/plus/health
 */
router.get('/plus/health', async (req, res) => {
  try {
    const isHealthy = incrementalSyncService !== null && incrementalSyncService !== undefined;
    
    res.json({
      success: true,
      service: 'IncrementalSyncService',
      status: isHealthy ? 'healthy' : 'unhealthy',
      version: '1.0.0',
      type: 'SYNC_PLUS',
      description: 'Incremental sync using cursor-based pagination',
      safety: 'Completely separate from regular SYNC - zero impact on existing functionality',
      features: [
        'Cursor-based incremental sync',
        'Only fetches NEW records since last sync',
        'Fallback to regular SYNC if issues',
        'Independent error handling and logging'
      ],
      endpoints: {
        incrementalSync: 'POST /api/sync/table/{tableName}/plus?limit=100',
        resetCursor: 'POST /api/sync/table/{tableName}/reset-cursor',
        getCursors: 'GET /api/sync/cursors',
        health: 'GET /api/sync/plus/health'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      service: 'IncrementalSyncService',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;