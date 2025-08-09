import { SimpleSyncService } from '../../services/simpleSyncService.js';

let syncService = null;
let currentSync = null;

/**
 * Initialize sync service if not already done
 */
function initSyncService() {
  if (!syncService) {
    syncService = new SimpleSyncService();
  }
  return syncService;
}

/**
 * Test Bubble API connection
 */
export async function testSyncConnection(req, res) {
  try {
    const service = initSyncService();
    const result = await service.bubbleService.testConnection();
    
    res.json({
      success: result.success,
      message: result.message,
      status: result.responseStatus || result.status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Run quick sync test with record limits
 */
export async function runQuickSync(req, res) {
  try {
    // Check if sync is already running
    if (currentSync) {
      return res.status(409).json({
        success: false,
        error: 'Sync already in progress',
        timestamp: new Date().toISOString()
      });
    }

    const service = initSyncService();
    const recordLimit = parseInt(req.query.limit) || 3; // Default 3 records per table
    
    res.json({
      success: true,
      message: `Quick sync started with ${recordLimit} records per data type`,
      timestamp: new Date().toISOString()
    });

    // Run sync in background
    currentSync = service.syncAll(recordLimit)
      .then(totalRecords => {
        console.log(`✅ Sync completed: ${totalRecords} total records`);
        currentSync = null;
        return totalRecords;
      })
      .catch(error => {
        console.error('❌ Sync failed:', error.message);
        currentSync = null;
        throw error;
      });

  } catch (error) {
    currentSync = null;
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get current sync status
 */
export async function getSyncStatus(req, res) {
  try {
    const service = initSyncService();
    const status = await service.getSyncStatus();
    
    res.json({
      success: true,
      status: status || {
        running: false,
        progress: 0,
        currentTable: null,
        lastSync: null,
        error: null
      },
      isRunning: currentSync !== null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Test field name conversion
 */
export async function testFieldConversion(req, res) {
  try {
    const service = initSyncService();
    
    const testFields = [
      '_id', 'Customer Name', '2nd Payment %', '123invalid', 
      'special!@#chars', '', 'id', 'select', 'data'
    ];
    
    const results = testFields.map(field => ({
      original: field,
      converted: service.toSafeFieldName(field),
      changed: field !== service.toSafeFieldName(field)
    }));
    
    const changedCount = results.filter(r => r.changed).length;
    
    res.json({
      success: true,
      results,
      summary: {
        total: testFields.length,
        converted: changedCount,
        successRate: ((testFields.length - changedCount) / testFields.length * 100).toFixed(1) + '%'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get all synced records from database
 */
export async function getAllSyncedRecords(req, res) {
  try {
    const service = initSyncService();
    const limit = parseInt(req.query.limit) || 50;
    const dataType = req.query.dataType;
    
    const where = dataType ? { dataType } : {};
    
    const records = await service.prisma.syncedRecord.findMany({
      where,
      take: limit,
      orderBy: { syncedAt: 'desc' },
      select: {
        id: true,
        bubbleId: true,
        dataType: true,
        rawData: true,
        processedData: true,
        syncedAt: true
      }
    });
    
    const total = await service.prisma.syncedRecord.count({ where });
    
    res.json({
      success: true,
      records,
      pagination: {
        total,
        limit,
        returned: records.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get synced records by data type
 */
export async function getSyncedRecordsByType(req, res) {
  try {
    const service = initSyncService();
    const dataType = req.params.dataType;
    const limit = parseInt(req.query.limit) || 10;
    
    const records = await service.prisma.syncedRecord.findMany({
      where: { dataType },
      take: limit,
      orderBy: { syncedAt: 'desc' },
      select: {
        id: true,
        bubbleId: true,
        dataType: true,
        rawData: true,
        processedData: true,
        syncedAt: true
      }
    });
    
    const total = await service.prisma.syncedRecord.count({ where: { dataType } });
    
    res.json({
      success: true,
      dataType,
      records,
      pagination: {
        total,
        limit,
        returned: records.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get sync summary statistics
 */
export async function getSyncSummary(req, res) {
  try {
    const service = initSyncService();
    
    // Get total records
    const totalRecords = await service.prisma.syncedRecord.count();
    
    // Get records by data type
    const recordsByType = await service.prisma.syncedRecord.groupBy({
      by: ['dataType'],
      _count: {
        dataType: true
      },
      orderBy: {
        _count: {
          dataType: 'desc'
        }
      }
    });
    
    // Get last sync time
    const lastSync = await service.prisma.syncedRecord.findFirst({
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true }
    });
    
    res.json({
      success: true,
      summary: {
        totalRecords,
        dataTypes: recordsByType.length,
        lastSync: lastSync?.syncedAt,
        recordsByType: recordsByType.map(item => ({
          dataType: item.dataType,
          count: item._count.dataType
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
