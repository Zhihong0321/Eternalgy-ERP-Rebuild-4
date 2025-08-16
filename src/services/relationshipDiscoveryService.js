import prisma from '../lib/prisma.js';
import { loggers } from '../utils/logger.js';

class RelationshipDiscoveryService {
  constructor() {
    this.logger = loggers.discovery;
  }

  /**
   * Initialize the relationship discovery status table (now using Prisma model)
   */
  async initializeStatusTable(runId) {
    try {
      // Table is now managed by Prisma schema - no need to create manually
      this.logger.info('Relationship discovery status table ready (Prisma managed)', runId, {
        operation: 'status_table_ready'
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to access status table', runId, {
        operation: 'status_table_error',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * IMPROVED DISCOVERY LOGIC: Is this relational data?
   * Step 1: Check if field contains ONLY Bubble ID format
   */
  isRelationalField(fieldValues, fieldName) {
    if (!Array.isArray(fieldValues) && typeof fieldValues !== 'string') {
      return false;
    }

    // Convert single value to array for uniform processing
    const values = Array.isArray(fieldValues) ? fieldValues : [fieldValues];
    
    if (values.length === 0) {
      return false;
    }

    // Bubble ID pattern: 13+ digits + 'x' + 15+ digits
    const bubbleIdPattern = /^\d{10,}x\d{15,}$/;
    
    // Check if ALL values match Bubble ID pattern
    const allAreBubbleIds = values.every(value => {
      return typeof value === 'string' && bubbleIdPattern.test(value);
    });

    this.logger.debug('Relational field analysis', null, {
      fieldName,
      valueCount: values.length,
      sampleValues: values.slice(0, 2),
      allAreBubbleIds
    });

    return allAreBubbleIds;
  }

  /**
   * Find which table contains a specific Bubble ID
   * Step 2: Can we find where it links?
   */
  async findBubbleIdTable(bubbleId, runId) {
    try {
      // Get list of all tables with bubble_id column
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'bubble_id'
        AND table_name != 'relationship_discovery_status'
      `;

      // Search each table for this Bubble ID
      for (const table of tables) {
        const tableName = table.table_name;
        
        try {
          const result = await prisma.$queryRawUnsafe(`
            SELECT 1 FROM "${tableName}" 
            WHERE bubble_id = $1 
            LIMIT 1
          `, bubbleId);

          if (result.length > 0) {
            this.logger.debug('Found Bubble ID target table', runId, {
              operation: 'bubble_id_found',
              bubbleId: bubbleId.substring(0, 20) + '...',
              targetTable: tableName
            });
            return tableName;
          }
        } catch (tableError) {
          // Skip tables that might not be accessible
          continue;
        }
      }

      this.logger.debug('Bubble ID not found in any table', runId, {
        operation: 'bubble_id_not_found', 
        bubbleId: bubbleId.substring(0, 20) + '...'
      });
      return null;

    } catch (error) {
      this.logger.warn('Failed to find Bubble ID table', runId, {
        operation: 'find_table_error',
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get or create discovery status for a field (using Prisma model)
   */
  async getFieldStatus(sourceTable, sourceField, runId) {
    try {
      const status = await prisma.relationship_discovery_status.findUnique({
        where: {
          source_table_source_field: {
            source_table: sourceTable,
            source_field: sourceField
          }
        }
      });

      return status;
    } catch (error) {
      this.logger.warn('Failed to get field status', runId, {
        operation: 'get_field_status_error',
        sourceTable,
        sourceField,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Update discovery status for a field (using Prisma model)
   */
  async updateFieldStatus(sourceTable, sourceField, fieldType, linkStatus, targetTable, runId) {
    try {
      await prisma.relationship_discovery_status.upsert({
        where: {
          source_table_source_field: {
            source_table: sourceTable,
            source_field: sourceField
          }
        },
        update: {
          field_type: fieldType,
          link_status: linkStatus,
          target_table: targetTable,
          last_checked: new Date()
        },
        create: {
          source_table: sourceTable,
          source_field: sourceField,
          field_type: fieldType,
          link_status: linkStatus,
          target_table: targetTable,
          last_checked: new Date()
        }
      });

      this.logger.debug('Updated field status', runId, {
        operation: 'field_status_updated',
        sourceTable,
        sourceField,
        fieldType,
        linkStatus,
        targetTable
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to update field status', runId, {
        operation: 'update_field_status_error',
        sourceTable,
        sourceField,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Discover relationships for a single table
   */
  async discoverTableRelationships(tableName, runId) {
    try {
      this.logger.info('Starting relationship discovery for table', runId, {
        operation: 'table_discovery_start',
        table: tableName
      });

      // Initialize status table if needed
      await this.initializeStatusTable(runId);

      // Get sample records from the table
      const records = await prisma.$queryRawUnsafe(`
        SELECT * FROM "${tableName}" LIMIT 10
      `);

      if (records.length === 0) {
        this.logger.warn('No records found in table', runId, {
          operation: 'table_empty',
          table: tableName
        });
        return { success: true, processed: 0, relationships: [] };
      }

      const relationships = [];
      let processedFields = 0;

      // Analyze each field in the first record (schema analysis)
      const sampleRecord = records[0];
      
      for (const [fieldName, fieldValue] of Object.entries(sampleRecord)) {
        // Skip system fields
        if (['id', 'bubble_id', 'created_at', 'synced_at'].includes(fieldName)) {
          continue;
        }

        // Check existing status
        const existingStatus = await this.getFieldStatus(tableName, fieldName, runId);
        
        // Skip TEXT_ONLY and LINKED fields (already processed)
        if (existingStatus && 
            (existingStatus.field_type === 'TEXT_ONLY' || existingStatus.link_status === 'LINKED')) {
          this.logger.debug('Skipping already processed field', runId, {
            operation: 'field_skip',
            table: tableName,
            field: fieldName,
            status: existingStatus.field_type + '/' + existingStatus.link_status
          });
          continue;
        }

        // Collect all values for this field across records
        const fieldValues = records.map(record => record[fieldName]).filter(val => val != null);
        
        if (fieldValues.length === 0) continue;

        // Step 1: Is this relational data?
        const isRelational = this.isRelationalField(fieldValues, fieldName);
        
        if (!isRelational) {
          // CONFIRMED: This is text data - never check again
          await this.updateFieldStatus(tableName, fieldName, 'TEXT_ONLY', null, null, runId);
          this.logger.info('Field confirmed as text data', runId, {
            operation: 'field_confirmed_text',
            table: tableName,
            field: fieldName
          });
          processedFields++;
          continue;
        }

        // CONFIRMED: This is relational data
        this.logger.info('Field confirmed as relational data', runId, {
          operation: 'field_confirmed_relational',
          table: tableName,
          field: fieldName,
          sampleValue: fieldValues[0]?.substring(0, 20) + '...'
        });

        // Step 2: Can we find where it links?
        const sampleBubbleId = Array.isArray(fieldValues[0]) ? fieldValues[0][0] : fieldValues[0];
        const targetTable = await this.findBubbleIdTable(sampleBubbleId, runId);

        if (targetTable) {
          // SUCCESS: Link found
          await this.updateFieldStatus(tableName, fieldName, 'RELATIONAL_CONFIRMED', 'LINKED', targetTable, runId);
          relationships.push({
            sourceTable: tableName,
            sourceField: fieldName,
            targetTable: targetTable,
            isArray: Array.isArray(fieldValues[0]),
            status: 'LINKED'
          });
          this.logger.info('Relationship linked successfully', runId, {
            operation: 'relationship_linked',
            sourceTable: tableName,
            sourceField: fieldName,
            targetTable: targetTable
          });
        } else {
          // PENDING: Target data not synced yet
          await this.updateFieldStatus(tableName, fieldName, 'RELATIONAL_CONFIRMED', 'PENDING_LINK', null, runId);
          relationships.push({
            sourceTable: tableName,
            sourceField: fieldName,
            targetTable: null,
            isArray: Array.isArray(fieldValues[0]),
            status: 'PENDING_LINK'
          });
          this.logger.info('Relationship pending - target data not found', runId, {
            operation: 'relationship_pending',
            sourceTable: tableName,
            sourceField: fieldName,
            sampleBubbleId: sampleBubbleId?.substring(0, 20) + '...'
          });
        }
        
        processedFields++;
      }

      this.logger.info('Table relationship discovery completed', runId, {
        operation: 'table_discovery_complete',
        table: tableName,
        processedFields,
        relationshipsFound: relationships.length
      });

      return {
        success: true,
        table: tableName,
        processed: processedFields,
        relationships
      };

    } catch (error) {
      this.logger.error('Table relationship discovery failed', runId, {
        operation: 'table_discovery_error',
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
   * Get relationship status summary for a table (using Prisma model)
   */
  async getTableRelationshipStatus(tableName, runId) {
    try {
      const statuses = await prisma.relationship_discovery_status.groupBy({
        by: ['field_type', 'link_status'],
        where: {
          source_table: tableName
        },
        _count: {
          _all: true
        }
      });

      const summary = {
        total: 0,
        relationalConfirmed: 0,
        textOnly: 0,
        linked: 0,
        pendingLink: 0,
        isRelationalReady: false
      };

      statuses.forEach(status => {
        const count = status._count._all;
        summary.total += count;
        
        if (status.field_type === 'RELATIONAL_CONFIRMED') {
          summary.relationalConfirmed += count;
          if (status.link_status === 'LINKED') {
            summary.linked += count;
          } else if (status.link_status === 'PENDING_LINK') {
            summary.pendingLink += count;
          }
        } else if (status.field_type === 'TEXT_ONLY') {
          summary.textOnly += count;
        }
      });

      // RELATIONAL READY = no pending links
      summary.isRelationalReady = summary.pendingLink === 0 && summary.total > 0;

      return {
        success: true,
        table: tableName,
        summary
      };

    } catch (error) {
      this.logger.error('Failed to get table relationship status', runId, {
        operation: 'get_table_status_error',
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

export default RelationshipDiscoveryService;