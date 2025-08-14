import express from 'express';
import PendingPatchService from '../services/pendingPatchService.js';

const router = express.Router();

/**
 * Pending Schema Patch API - SIMPLE & CLEAN
 * 
 * 🔒 SAFETY: 100% isolated from working sync system
 * 
 * Workflow:
 * 1. Sync fails → System creates pending request
 * 2. User visits /api/pending-patches/list → Reviews requests
 * 3. User calls /api/pending-patches/approve/{id} → Executes patch
 * 4. User retries sync → Works!
 */

// Initialize service
let patchService;
try {
  patchService = new PendingPatchService();
  console.log('✅ PendingPatchService initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize PendingPatchService:', error.message);
}

/**
 * Get all pending patch requests
 * GET /api/pending-patches/list
 * 
 * Shows what fields need approval to be added
 */
router.get('/list', async (req, res) => {
  try {
    if (!patchService) {
      return res.status(500).json({
        success: false,
        error: 'PendingPatchService not initialized'
      });
    }

    const pendingRequests = await patchService.getPendingRequests();

    res.json({
      success: true,
      endpoint: 'pending_patches_list',
      pendingCount: pendingRequests.length,
      requests: pendingRequests,
      message: pendingRequests.length > 0 
        ? `${pendingRequests.length} pending patch requests need your approval`
        : 'No pending patch requests',
      actions: pendingRequests.length > 0 ? {
        approve: 'POST /api/pending-patches/approve/{id}',
        reject: 'POST /api/pending-patches/reject/{id}'
      } : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('List pending patches error:', error);
    res.status(500).json({
      success: false,
      endpoint: 'pending_patches_list',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Approve and execute a pending patch request
 * POST /api/pending-patches/approve/{id}
 * 
 * Adds the missing column and marks request as approved
 */
router.post('/approve/:id', async (req, res) => {
  const { id } = req.params;
  const { approvedBy = 'api_user' } = req.body;

  try {
    if (!patchService) {
      return res.status(500).json({
        success: false,
        error: 'PendingPatchService not initialized'
      });
    }

    const result = await patchService.approvePatch(parseInt(id), approvedBy);

    if (result.success) {
      res.json({
        ...result,
        endpoint: 'pending_patches_approve',
        message: `✅ Column '${result.field}' added to table '${result.table}'`,
        nextSteps: [
          `Retry your sync: POST /api/sync/table/${result.table}?limit=100`,
          'The missing field error should now be resolved'
        ],
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        ...result,
        endpoint: 'pending_patches_approve',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Approve patch error:', error);
    res.status(500).json({
      success: false,
      endpoint: 'pending_patches_approve',
      requestId: id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Reject a pending patch request
 * POST /api/pending-patches/reject/{id}
 * 
 * Marks request as rejected without adding the column
 */
router.post('/reject/:id', async (req, res) => {
  const { id } = req.params;
  const { rejectedBy = 'api_user', reason = '' } = req.body;

  try {
    if (!patchService) {
      return res.status(500).json({
        success: false,
        error: 'PendingPatchService not initialized'
      });
    }

    const result = await patchService.rejectPatch(parseInt(id), rejectedBy, reason);

    res.json({
      ...result,
      endpoint: 'pending_patches_reject',
      requestId: id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Reject patch error:', error);
    res.status(500).json({
      success: false,
      endpoint: 'pending_patches_reject',
      requestId: id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get request history (approved, rejected, failed)
 * GET /api/pending-patches/history
 * 
 * Shows past patch requests and their outcomes
 */
router.get('/history', async (req, res) => {
  try {
    if (!patchService) {
      return res.status(500).json({
        success: false,
        error: 'PendingPatchService not initialized'
      });
    }

    const history = await patchService.getRequestHistory();

    res.json({
      success: true,
      endpoint: 'pending_patches_history',
      historyCount: history.length,
      requests: history,
      message: `${history.length} completed patch requests`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      endpoint: 'pending_patches_history',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Manually create a pending request (for testing or manual field additions)
 * POST /api/pending-patches/create
 * 
 * Body: { tableName, fieldName, originalFieldName, suggestedType, reason }
 */
router.post('/create', async (req, res) => {
  const { tableName, fieldName, originalFieldName, suggestedType, reason } = req.body;

  try {
    if (!patchService) {
      return res.status(500).json({
        success: false,
        error: 'PendingPatchService not initialized'
      });
    }

    if (!tableName || !fieldName || !suggestedType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tableName, fieldName, suggestedType',
        example: {
          tableName: 'agent_monthly_perf',
          fieldName: 'achieved_tier_bonus__',
          originalFieldName: 'Achieved Tier Bonus %',
          suggestedType: 'DECIMAL',
          reason: 'Manual field addition request'
        }
      });
    }

    // Create artificial error message for the manual request
    const errorMessage = `column "${fieldName}" of relation "${tableName}" does not exist (manual request: ${reason || 'user specified'})`;
    
    const result = await patchService.createPendingRequest(
      errorMessage,
      'manual_request',
      { source: 'manual_api', originalFieldName, reason }
    );

    res.json({
      ...result,
      endpoint: 'pending_patches_create',
      message: result.success 
        ? 'Manual pending request created successfully'
        : 'Failed to create manual pending request',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create manual request error:', error);
    res.status(500).json({
      success: false,
      endpoint: 'pending_patches_create',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check for pending patch service
 * GET /api/pending-patches/health
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = patchService !== null && patchService !== undefined;
    
    res.json({
      success: true,
      service: 'PendingPatchService',
      status: isHealthy ? 'healthy' : 'unhealthy',
      version: '1.0.0',
      description: 'Simple approval workflow for missing schema fields',
      safety: 'Zero impact on working sync system - only adds approved columns',
      workflow: [
        '1. Sync fails with column error',
        '2. System creates pending request',
        '3. User reviews at GET /api/pending-patches/list',
        '4. User approves with POST /api/pending-patches/approve/{id}',
        '5. User retries sync - should work!'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      service: 'PendingPatchService',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;