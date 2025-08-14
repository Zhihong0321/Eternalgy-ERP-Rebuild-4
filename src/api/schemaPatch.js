import express from 'express';
import SchemaPatchService from '../services/schemaPatchService.js';

const router = express.Router();

/**
 * ISOLATED Schema Patch API - ZERO impact on working sync system
 * 
 * 🔒 SAFETY GUARANTEE: This API is completely isolated from sync functionality
 * Purpose: Add missing fields to tables when "column does not exist" errors occur
 */

// Initialize patch service
let patchService;
try {
  patchService = new SchemaPatchService();
  console.log('✅ SchemaPatchService initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize SchemaPatchService:', error.message);
}

/**
 * Manually add specific fields to a table (for ultra-sparse fields)
 * POST /api/schema-patch/manual-add-fields/{tableName}
 * 
 * Usage: When automated discovery can't find ultra-sparse fields
 * Body: { "fields": [{"name": "field_name", "type": "DECIMAL"}] }
 */
router.post('/manual-add-fields/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const { fields } = req.body;

  try {
    if (!patchService) {
      return res.status(500).json({
        success: false,
        error: 'SchemaPatchService not initialized'
      });
    }

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Body must contain "fields" array with field specifications',
        example: {
          fields: [
            { name: "achieved_tier_bonus__", type: "DECIMAL" },
            { name: "all_full_on_date", type: "TIMESTAMPTZ" }
          ]
        }
      });
    }

    const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const fieldsAdded = [];
    const sqlExecuted = [];

    // Execute manual column additions
    for (const field of fields) {
      const sql = `ALTER TABLE "${safeTableName}" ADD COLUMN IF NOT EXISTS "${field.name}" ${field.type}`;
      
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.$executeRawUnsafe(sql);
        await prisma.$disconnect();
        fieldsAdded.push(field);
        sqlExecuted.push(sql);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: `Failed to add column ${field.name}: ${error.message}`,
          sqlAttempted: sql
        });
      }
    }

    res.json({
      success: true,
      table: tableName,
      fieldsAdded,
      sqlExecuted,
      message: `Successfully added ${fieldsAdded.length} fields manually`,
      endpoint: 'schema_patch_manual_add_fields',
      nextSteps: [`Try your sync again: POST /api/sync/table/${tableName}?limit=100`]
    });

  } catch (error) {
    console.error('Manual add fields error:', error);
    res.status(500).json({
      success: false,
      endpoint: 'schema_patch_manual_add_fields',
      table: tableName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Patch missing fields for a specific table
 * POST /api/schema-patch/fix-missing-fields/{tableName}
 * 
 * Usage: When you get "column does not exist" error, run this to add missing fields
 */
router.post('/fix-missing-fields/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const { sampleSize = 500, dryRun = false } = req.query;

  try {
    if (!patchService) {
      return res.status(500).json({
        success: false,
        error: 'SchemaPatchService not initialized'
      });
    }

    const result = await patchService.patchMissingFields(tableName, {
      sampleSize: parseInt(sampleSize),
      dryRun: dryRun === 'true'
    });

    if (result.success) {
      res.json({
        ...result,
        endpoint: 'schema_patch_fix_missing_fields',
        usage: dryRun === 'true' 
          ? 'DRY RUN completed - no changes made'
          : 'Missing fields added - sync should now work',
        nextSteps: result.fieldsAdded.length > 0
          ? [`Try your sync again: POST /api/sync/table/${tableName}?limit=100`]
          : ['Table is already complete - no action needed']
      });
    } else {
      res.status(400).json({
        ...result,
        endpoint: 'schema_patch_fix_missing_fields'
      });
    }

  } catch (error) {
    console.error('Schema patch error:', error);
    res.status(500).json({
      success: false,
      endpoint: 'schema_patch_fix_missing_fields',
      table: tableName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Analyze table and preview what would be patched (dry run)
 * GET /api/schema-patch/analyze/{tableName}
 * 
 * Usage: Check what missing fields would be added without making changes
 */
router.get('/analyze/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const { sampleSize = 500 } = req.query;

  try {
    if (!patchService) {
      return res.status(500).json({
        success: false,
        error: 'SchemaPatchService not initialized'
      });
    }

    const result = await patchService.analyzeTable(tableName, parseInt(sampleSize));

    res.json({
      ...result,
      endpoint: 'schema_patch_analyze',
      analysisType: 'dry_run',
      message: result.fieldsAdded.length > 0
        ? `Analysis complete: Found ${result.fieldsAdded.length} missing fields`
        : 'Analysis complete: No missing fields detected',
      nextSteps: result.fieldsAdded.length > 0
        ? [`To add missing fields: POST /api/schema-patch/fix-missing-fields/${tableName}`]
        : ['Table schema is complete - no patch needed']
    });

  } catch (error) {
    console.error('Schema analysis error:', error);
    res.status(500).json({
      success: false,
      endpoint: 'schema_patch_analyze',
      table: tableName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check for patch service
 * GET /api/schema-patch/health
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = patchService !== null && patchService !== undefined;
    
    res.json({
      success: true,
      service: 'SchemaPatchService',
      status: isHealthy ? 'healthy' : 'unhealthy',
      version: '1.0.0',
      description: 'ISOLATED service for adding missing table fields',
      safety: 'Zero impact on working sync system - only adds missing columns',
      endpoints: {
        analyze: 'GET /api/schema-patch/analyze/{tableName}',
        patch: 'POST /api/schema-patch/fix-missing-fields/{tableName}',
        health: 'GET /api/schema-patch/health'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      service: 'SchemaPatchService',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * API documentation
 * GET /api/schema-patch/docs
 */
router.get('/docs', (req, res) => {
  res.json({
    service: 'Schema Patch API',
    version: '1.0.0',
    description: 'ISOLATED service for fixing missing field errors',
    safety: '🔒 ZERO impact on working sync system',
    
    usageScenario: 'When you get: Invalid prisma.$queryRawUnsafe() invocation: column "field_name" does not exist',
    
    endpoints: [
      {
        method: 'GET',
        path: '/api/schema-patch/analyze/{tableName}',
        description: 'Preview what missing fields would be added (safe, read-only)',
        example: 'GET /api/schema-patch/analyze/agent_monthly_perf',
        parameters: {
          sampleSize: 'Number of Bubble records to analyze (default: 500)'
        }
      },
      {
        method: 'POST', 
        path: '/api/schema-patch/fix-missing-fields/{tableName}',
        description: 'Add missing fields to table (safe ALTER TABLE operations)',
        example: 'POST /api/schema-patch/fix-missing-fields/agent_monthly_perf',
        parameters: {
          sampleSize: 'Number of Bubble records to analyze (default: 500)',
          dryRun: 'true/false - Preview changes without executing (default: false)'
        }
      },
      {
        method: 'GET',
        path: '/api/schema-patch/health',
        description: 'Check if patch service is running correctly'
      }
    ],
    
    workflow: [
      '1. Get column error during sync',
      '2. Analyze: GET /api/schema-patch/analyze/{tableName}',
      '3. Review what would be added',  
      '4. Patch: POST /api/schema-patch/fix-missing-fields/{tableName}',
      '5. Retry your sync - should now work!'
    ],

    safety: [
      '✅ Only adds missing columns',
      '✅ Never drops or modifies existing columns',
      '✅ Uses safe ALTER TABLE ADD COLUMN operations',
      '✅ Completely isolated from sync logic',
      '✅ Read-only analysis available',
      '✅ Dry run option for testing'
    ]
  });
});

export default router;