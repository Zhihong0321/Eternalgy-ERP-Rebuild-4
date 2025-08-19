import { PrismaClient } from '@prisma/client';
import { loggers } from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Pending Schema Patch Service - SIMPLE & CLEAN
 * 
 * 🔒 SAFETY: 100% isolated from working sync system
 * 
 * Purpose: Handle missing field errors through approval workflow:
 * 1. Sync fails → Create pending request
 * 2. User reviews → Approves/rejects on page  
 * 3. System executes → Adds column safely
 * 4. User retries sync → Works!
 */
class PendingPatchService {
  constructor() {
    this.logger = loggers.schema;
  }

  /**
   * Create pending patch request table if it doesn't exist
   * SAFE: Only creates new table, never modifies existing ones
   */
  async ensurePendingPatchTable() {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "pending_schema_patches" (
          "id" SERIAL PRIMARY KEY,
          "table_name" TEXT NOT NULL,
          "field_name" TEXT NOT NULL,
          "original_field_name" TEXT,
          "suggested_type" TEXT NOT NULL,
          "error_message" TEXT,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "created_at" TIMESTAMPTZ DEFAULT NOW(),
          "approved_at" TIMESTAMPTZ,
          "approved_by" TEXT,
          "executed_at" TIMESTAMPTZ,
          "execution_result" TEXT,
          "sync_run_id" TEXT,
          UNIQUE("table_name", "field_name")
        )
      `);
      
      this.logger.debug('Pending patch table ensured', null, {
        operation: 'ensure_pending_patch_table'
      });
      
    } catch (error) {
      this.logger.error('Failed to ensure pending patch table', null, {
        operation: 'ensure_pending_patch_table_error',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Parse sync error and create pending patch request
   * Called when sync fails with "column does not exist" error
   */
  async createPendingRequest(errorMessage, syncRunId, context = {}) {
    const runId = this.logger.generateRunId();
    
    try {
      await this.ensurePendingPatchTable();
      
      // Parse the error message to extract missing field info
      const parsedError = this.parseColumnError(errorMessage, context.table);
      
      if (!parsedError) {
        return {
          success: false,
          error: 'Could not parse column error from message',
          errorMessage
        };
      }

      // Check if PENDING request already exists (ignore failed/rejected/approved ones)
      const existing = await prisma.pending_schema_patches.findFirst({
        where: {
          table_name: parsedError.tableName,
          field_name: parsedError.fieldName,
          status: 'pending' // Only check for pending status
        }
      });

      if (existing) {
        this.logger.info('Pending request already exists', runId, {
          operation: 'pending_request_exists',
          table: parsedError.tableName,
          field: parsedError.fieldName,
          existingId: existing.id,
          existingStatus: existing.status
        });
        
        return {
          success: true,
          message: 'Pending request already exists',
          existingRequest: existing
        };
      }

      // Create new pending request
      const request = await prisma.pending_schema_patches.create({
        data: {
          table_name: parsedError.tableName,
          field_name: parsedError.fieldName,
          original_field_name: parsedError.originalFieldName,
          suggested_type: parsedError.suggestedType,
          error_message: errorMessage,
          sync_run_id: syncRunId,
          status: 'pending'
        }
      });

      this.logger.info('✅ Pending patch request created', runId, {
        operation: 'pending_request_created',
        requestId: request.id,
        table: parsedError.tableName,
        field: parsedError.fieldName,
        type: parsedError.suggestedType
      });

      return {
        success: true,
        message: 'Pending patch request created',
        request: request,
        userAction: `Review and approve at: GET /api/pending-patches/list`
      };

    } catch (error) {
      this.logger.error('Failed to create pending request', runId, {
        operation: 'create_pending_request_error',
        error: error.message,
        errorMessage
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse "column does not exist" error to extract field info
   * Example: `column "achieved_tier_bonus__" of relation "agent_monthly_perf" does not exist`
   */
  parseColumnError(errorMessage, contextTableName = null) {
    // Pattern 1: Missing column (42703) - column "field_name" of relation "table_name" does not exist
    const missingColumnMatch = errorMessage.match(/column "([^"]+)" of relation "([^"]+)" does not exist/);
    
    if (missingColumnMatch) {
      const fieldName = missingColumnMatch[1];
      const tableName = missingColumnMatch[2];
      
      // Try to guess original field name (reverse snake_case conversion)
      const originalFieldName = this.guessOriginalFieldName(fieldName);
      
      // Suggest column type based on field name patterns
      const suggestedType = this.suggestColumnType(fieldName);

      return {
        errorType: 'missing_column',
        fieldName,
        tableName,
        originalFieldName,
        suggestedType,
        action: 'ADD_COLUMN'
      };
    }

    // Pattern 2: Type mismatch (42804) - column "field_name" is of type integer but expression is of type text
    const typeMismatchMatch = errorMessage.match(/column "([^"]+)" is of type (\w+) but expression is of type (\w+)/);
    
    if (typeMismatchMatch) {
      const fieldName = typeMismatchMatch[1];
      const currentType = typeMismatchMatch[2].toUpperCase();
      const attemptedType = typeMismatchMatch[3].toUpperCase();
      
      // Use context table name if available, otherwise try to extract from error
      let tableName = contextTableName;
      if (!tableName) {
        const tableMatch = errorMessage.match(/relation "([^"]+)"/);
        tableName = tableMatch ? tableMatch[1] : 'unknown_table';
      }
      
      // Try to guess original field name
      const originalFieldName = this.guessOriginalFieldName(fieldName);
      
      // For type mismatches, suggest the more permissive type (TEXT is safest)
      const suggestedType = this.resolveBestType(currentType, attemptedType);

      return {
        errorType: 'type_mismatch',
        fieldName,
        tableName,
        originalFieldName,
        currentType,
        attemptedType,
        suggestedType,
        action: 'ALTER_COLUMN_TYPE'
      };
    }

    return null;
  }

  /**
   * Guess original Bubble field name from snake_case database field
   */
  guessOriginalFieldName(snakeCaseField) {
    // Common patterns for reverse conversion
    const reversals = {
      'achieved_tier_bonus__': 'Achieved Tier Bonus %',
      'all_full_on_date': 'All Full On Date',
      'ic_front': 'IC FRONT',
      'ic_back': 'IC BACK',
      'bankin_account': 'Bankin Account'
    };

    if (reversals[snakeCaseField]) {
      return reversals[snakeCaseField];
    }

    // Generic conversion: snake_case -> Title Case
    return snakeCaseField
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Suggest PostgreSQL column type based on field name patterns
   */
  suggestColumnType(fieldName) {
    const lowerField = fieldName.toLowerCase();
    
    if (lowerField.includes('date') || lowerField.includes('time')) {
      return 'TIMESTAMPTZ';
    }
    if (lowerField.includes('bonus') || lowerField.includes('rate') || lowerField.includes('%')) {
      return 'DECIMAL';
    }
    if (lowerField.includes('amount') || lowerField.includes('price')) {
      return 'DECIMAL';
    }
    if (lowerField.includes('count') || lowerField.includes('number')) {
      return 'INTEGER';
    }
    if (lowerField.includes('is_') || lowerField.includes('active')) {
      return 'BOOLEAN';
    }
    
    return 'TEXT'; // Safe default
  }

  /**
   * Resolve the best type when there's a type mismatch
   * Rule: Choose the more permissive type (TEXT > INTEGER > etc)
   */
  resolveBestType(currentType, attemptedType) {
    // Type hierarchy: TEXT is most permissive, can hold any value
    const typeHierarchy = {
      'TEXT': 4,
      'VARCHAR': 3, 
      'DECIMAL': 2,
      'INTEGER': 1,
      'BOOLEAN': 0
    };

    const currentRank = typeHierarchy[currentType] || 0;
    const attemptedRank = typeHierarchy[attemptedType] || 0;

    // Always prefer TEXT for safety when there's a conflict
    if (currentType === 'INTEGER' && attemptedType === 'TEXT') {
      return 'TEXT'; // INTEGER field receiving TEXT data → convert to TEXT
    }
    
    if (currentType === 'DECIMAL' && attemptedType === 'TEXT') {
      return 'TEXT'; // DECIMAL field receiving TEXT data → convert to TEXT
    }

    // Choose the more permissive type
    return currentRank >= attemptedRank ? currentType : attemptedType;
  }

  /**
   * Get all pending patch requests
   */
  async getPendingRequests() {
    await this.ensurePendingPatchTable();
    
    return await prisma.pending_schema_patches.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'desc' }
    });
  }

  /**
   * Approve and execute a pending patch request
   */
  async approvePatch(requestId, approvedBy = 'user') {
    const runId = this.logger.generateRunId();
    
    try {
      // Get the pending request
      const request = await prisma.pending_schema_patches.findUnique({
        where: { id: requestId }
      });

      if (!request) {
        return {
          success: false,
          error: 'Pending request not found'
        };
      }

      if (request.status !== 'pending') {
        return {
          success: false,
          error: `Request already ${request.status}`
        };
      }

      // Execute the appropriate ALTER TABLE command based on error type
      let sql;
      let actionDescription;
      
      // Check if this is a type mismatch error (needs ALTER COLUMN TYPE)
      const isTypeMismatch = request.error_message && 
                            request.error_message.includes('is of type') && 
                            request.error_message.includes('but expression is of type');
      
      if (isTypeMismatch) {
        // ALTER COLUMN TYPE for type mismatches (INTEGER → TEXT)
        sql = `ALTER TABLE "${request.table_name}" ALTER COLUMN "${request.field_name}" TYPE ${request.suggested_type} USING "${request.field_name}"::${request.suggested_type}`;
        actionDescription = `Changed column type to ${request.suggested_type}`;
      } else {
        // ADD COLUMN for missing fields
        sql = `ALTER TABLE "${request.table_name}" ADD COLUMN IF NOT EXISTS "${request.field_name}" ${request.suggested_type}`;
        actionDescription = `Added new column with type ${request.suggested_type}`;
      }
      
      await prisma.$executeRawUnsafe(sql);

      // Update request status
      await prisma.pending_schema_patches.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          approved_at: new Date(),
          approved_by: approvedBy,
          executed_at: new Date(),
          execution_result: 'success'
        }
      });

      this.logger.info('✅ Patch request approved and executed', runId, {
        operation: 'patch_approved_executed',
        requestId,
        table: request.table_name,
        field: request.field_name,
        sql
      });

      return {
        success: true,
        message: `✅ ${actionDescription}`,
        sql: sql,
        field: request.field_name,
        table: request.table_name,
        action: isTypeMismatch ? 'ALTER_COLUMN_TYPE' : 'ADD_COLUMN'
      };

    } catch (error) {
      // Update request with error
      await prisma.pending_schema_patches.update({
        where: { id: requestId },
        data: {
          status: 'failed',
          execution_result: error.message
        }
      });

      this.logger.error('❌ Patch execution failed', runId, {
        operation: 'patch_execution_failed',
        requestId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reject a pending patch request
   */
  async rejectPatch(requestId, rejectedBy = 'user', reason = '') {
    await prisma.pending_schema_patches.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        approved_by: rejectedBy,
        execution_result: reason || 'Rejected by user'
      }
    });

    return {
      success: true,
      message: 'Patch request rejected'
    };
  }

  /**
   * Get request history (approved, rejected, failed)
   */
  async getRequestHistory() {
    await this.ensurePendingPatchTable();
    
    return await prisma.pending_schema_patches.findMany({
      where: { 
        status: { in: ['approved', 'rejected', 'failed'] }
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });
  }
}

export default PendingPatchService;