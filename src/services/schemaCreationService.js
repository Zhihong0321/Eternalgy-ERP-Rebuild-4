import { PrismaClient } from '@prisma/client';
import BubbleService from './bubbleService.js';
import { loggers } from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Schema Creation Service
 * Creates ALL database tables FIRST using discovery API
 * Preserves relationships and proper schema structure
 */
class SchemaCreationService {
  constructor() {
    this.bubbleService = new BubbleService();
    this.logger = loggers.schema;
  }

  /**
   * Create ALL database tables from discovered Bubble data types
   * This should be run BEFORE any data syncing
   */
  async createAllTables(options = {}) {
    const runId = this.logger.generateRunId();
    const startTime = Date.now();
    
    const {
      dropExisting = false,     // Drop existing tables first
      onlyWithData = true,      // Only create tables that have data
      maxTables = null,         // Limit number of tables (for testing)
      sampleSize = 5            // Sample records to analyze schema
    } = options;

    this.logger.info('Starting schema creation for all tables', runId, {
      operation: 'schema_creation_start',
      options: { dropExisting, onlyWithData, maxTables, sampleSize }
    });

    const result = {
      runId,
      tables: {
        discovered: 0,
        created: 0,
        failed: 0,
        skipped: 0
      },
      results: [],
      errors: [],
      duration: 0
    };

    try {
      // Step 1: Discover all data types
      const discovery = await this.discoverAllDataTypes(runId);
      if (!discovery.success) {
        throw new Error(discovery.error);
      }

      let tablesToCreate = discovery.tables;
      result.tables.discovered = tablesToCreate.length;

      // Step 2: Filter tables
      if (onlyWithData) {
        tablesToCreate = tablesToCreate.filter(table => table.hasData);
        this.logger.info('Filtered to tables with data', runId, {
          operation: 'schema_filter_data',
          before: result.tables.discovered,
          after: tablesToCreate.length
        });
      }

      if (maxTables && maxTables > 0) {
        tablesToCreate = tablesToCreate.slice(0, maxTables);
        this.logger.info('Limited tables for testing', runId, {
          operation: 'schema_limit_tables',
          maxTables,
          selected: tablesToCreate.length
        });
      }

      // Step 3: Create each table
      for (let i = 0; i < tablesToCreate.length; i++) {
        const table = tablesToCreate[i];
        
        this.logger.info(`Creating table ${i + 1}/${tablesToCreate.length}`, runId, {
          operation: 'schema_table_create_start',
          table: table.name,
          progress: `${i + 1}/${tablesToCreate.length}`
        });

        try {
          const tableResult = await this.createSingleTable(table, sampleSize, dropExisting, runId);
          
          result.results.push({
            table: table.name,
            success: true,
            ...tableResult,
            order: i + 1
          });

          result.tables.created++;

          this.logger.info('Table created successfully', runId, {
            operation: 'schema_table_create_success',
            table: table.name,
            fields: tableResult.fieldCount,
            progress: `${i + 1}/${tablesToCreate.length}`
          });

        } catch (tableError) {
          const errorResult = {
            table: table.name,
            success: false,
            error: tableError.message,
            order: i + 1
          };

          result.results.push(errorResult);
          result.errors.push(errorResult);
          result.tables.failed++;

          this.logger.error('Table creation failed', runId, {
            operation: 'schema_table_create_error',
            table: table.name,
            error: tableError.message
          });

          // Continue with other tables (don't fail fast for schema creation)
        }
      }

      // Step 4: Complete schema creation
      const totalDuration = Date.now() - startTime;
      result.duration = totalDuration;

      this.logger.info('Schema creation completed', runId, {
        operation: 'schema_creation_complete',
        discovered: result.tables.discovered,
        created: result.tables.created,
        failed: result.tables.failed,
        duration: totalDuration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      result.duration = duration;

      this.logger.error('Schema creation failed', runId, {
        operation: 'schema_creation_error',
        error: error.message,
        duration
      });

      throw error;
    }
  }

  /**
   * Create a single table with proper schema
   */
  async createSingleTable(tableInfo, sampleSize, dropExisting, runId) {
    const tableName = tableInfo.name;
    const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    try {
      // Step 1: Drop existing table if requested
      if (dropExisting) {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${safeTableName}"`);
        
        this.logger.info('Dropped existing table', runId, {
          operation: 'schema_table_dropped',
          table: tableName
        });
      }

      // Step 2: Fetch sample data to analyze schema
      this.logger.info('Fetching sample data for schema analysis', runId, {
        operation: 'schema_sample_fetch',
        table: tableName,
        sampleSize
      });

      const sampleResult = await this.bubbleService.fetchDataType(tableName, {
        limit: sampleSize,
        includeEmpty: false
      });

      if (!sampleResult.success) {
        throw new Error(`Failed to fetch sample data: ${sampleResult.error}`);
      }

      const sampleRecords = sampleResult.records || [];
      if (sampleRecords.length === 0) {
        this.logger.warn('No sample data found, creating basic table', runId, {
          operation: 'schema_no_sample_data',
          table: tableName
        });
      }

      // Step 3: Analyze schema from sample data
      const schemaAnalysis = this.analyzeTableSchema(sampleRecords, tableName);

      this.logger.info('Schema analysis completed', runId, {
        operation: 'schema_analysis_complete',
        table: tableName,
        fields: schemaAnalysis.fields.length,
        relationships: schemaAnalysis.relationships.length
      });

      // Step 4: Generate and execute CREATE TABLE SQL
      const createTableSQL = this.generateCreateTableSQL(tableName, schemaAnalysis);

      this.logger.debug('Executing CREATE TABLE', runId, {
        operation: 'schema_execute_create',
        table: tableName,
        sql: createTableSQL.substring(0, 200) + '...'
      });

      await prisma.$executeRawUnsafe(createTableSQL);

      return {
        fieldCount: schemaAnalysis.fields.length,
        relationshipCount: schemaAnalysis.relationships.length,
        sampleRecords: sampleRecords.length,
        schema: schemaAnalysis
      };

    } catch (error) {
      this.logger.error('Single table creation failed', runId, {
        operation: 'schema_table_error',
        table: tableName,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Discover all data types using existing discovery service
   */
  async discoverAllDataTypes(runId) {
    this.logger.info('Discovering all data types for schema creation', runId, {
      operation: 'schema_discovery_start'
    });

    try {
      const discovery = await this.bubbleService.discoverAllDataTypes();
      
      if (!discovery.discoveredTypes) {
        throw new Error('Failed to discover data types from Bubble');
      }

      const accessibleTables = discovery.discoveredTypes.filter(
        type => type.status === 'accessible'
      );

      this.logger.info('Data type discovery completed', runId, {
        operation: 'schema_discovery_complete',
        totalFound: discovery.discoveredTypes.length,
        accessible: accessibleTables.length,
        withData: accessibleTables.filter(t => t.hasData).length
      });

      return {
        success: true,
        tables: accessibleTables,
        summary: discovery.summary
      };

    } catch (error) {
      this.logger.error('Data type discovery failed', runId, {
        operation: 'schema_discovery_error',
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze table schema from sample records
   * Preserves relationships and proper field types
   */
  analyzeTableSchema(sampleRecords, tableName) {
    const analysis = {
      tableName,
      fields: [],
      relationships: [],
      indexes: []
    };

    if (sampleRecords.length === 0) {
      // Create basic schema without sample data
      analysis.fields = [
        { name: 'id', type: 'SERIAL', isPrimary: true },
        { name: 'bubble_id', type: 'TEXT', isUnique: true },
        { name: 'synced_at', type: 'TIMESTAMPTZ', hasDefault: true }
      ];
      return analysis;
    }

    // Collect all fields from sample records
    const fieldMap = new Map();
    const relationshipFields = new Set();

    sampleRecords.forEach(record => {
      Object.keys(record).forEach(fieldName => {
        if (fieldName === '_id') return; // Skip internal ID

        const value = record[fieldName];
        const fieldInfo = this.analyzeFieldType(fieldName, value);
        
        if (fieldInfo.isRelationship) {
          relationshipFields.add(fieldName);
          analysis.relationships.push(fieldInfo.relationship);
        }

        if (!fieldMap.has(fieldName)) {
          fieldMap.set(fieldName, fieldInfo);
        } else {
          // Merge field type info (handle type conflicts)
          const existing = fieldMap.get(fieldName);
          fieldMap.set(fieldName, this.mergeFieldTypes(existing, fieldInfo));
        }
      });
    });

    // Add standard fields
    analysis.fields.push(
      { name: 'id', type: 'SERIAL', isPrimary: true },
      { name: 'bubble_id', type: 'TEXT', isUnique: true, comment: 'Bubble record ID' }
    );

    // Add analyzed fields
    fieldMap.forEach((fieldInfo, fieldName) => {
      const safeFieldName = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      analysis.fields.push({
        name: safeFieldName,
        originalName: fieldName,
        type: fieldInfo.sqlType,
        isNullable: fieldInfo.nullable,
        isRelationship: fieldInfo.isRelationship,
        comment: fieldInfo.comment
      });
    });

    // Add sync tracking field
    analysis.fields.push({
      name: 'synced_at',
      type: 'TIMESTAMPTZ',
      hasDefault: true,
      defaultValue: 'NOW()',
      comment: 'Record sync timestamp'
    });

    return analysis;
  }

  /**
   * Analyze individual field type and detect relationships
   */
  analyzeFieldType(fieldName, value) {
    const fieldInfo = {
      sqlType: 'TEXT',
      nullable: value === null || value === undefined,
      isRelationship: false,
      comment: null
    };

    if (value === null || value === undefined) {
      return fieldInfo;
    }

    // Detect relationships (fields ending with common patterns)
    const relationshipPatterns = [
      /_id$/i, /Id$/i, /_ref$/i, /Ref$/i,
      /^created_by$/i, /^modified_by$/i, /^owner$/i
    ];

    const isRelationshipField = relationshipPatterns.some(pattern => 
      pattern.test(fieldName)
    );

    if (isRelationshipField && typeof value === 'string') {
      fieldInfo.isRelationship = true;
      fieldInfo.relationship = {
        field: fieldName,
        referencedTable: this.guessReferencedTable(fieldName),
        referencedField: 'bubble_id'
      };
      fieldInfo.comment = `Relationship to ${fieldInfo.relationship.referencedTable}`;
    }

    // Determine SQL type based on JavaScript type
    switch (typeof value) {
      case 'number':
        fieldInfo.sqlType = Number.isInteger(value) ? 'INTEGER' : 'DECIMAL';
        break;
      case 'boolean':
        fieldInfo.sqlType = 'BOOLEAN';
        break;
      case 'object':
        if (value instanceof Date) {
          fieldInfo.sqlType = 'TIMESTAMPTZ';
        } else if (Array.isArray(value)) {
          // Check if array contains Bubble IDs (relationship array)
          const isRelationshipArray = this.isRelationshipArray(value, fieldName);
          if (isRelationshipArray) {
            fieldInfo.sqlType = 'TEXT[]';
            fieldInfo.isRelationship = true;
            fieldInfo.comment = `Array of Bubble IDs - relationships to ${this.guessReferencedTable(fieldName)}`;
            fieldInfo.relationship = {
              field: fieldName,
              referencedTable: this.guessReferencedTable(fieldName),
              referencedField: 'bubble_id',
              isArray: true
            };
          } else {
            fieldInfo.sqlType = 'JSONB';
            fieldInfo.comment = 'Array data stored as JSONB';
          }
        } else {
          fieldInfo.sqlType = 'JSONB';
          fieldInfo.comment = 'Object data stored as JSONB';
        }
        break;
      default:
        // Check if it looks like a date string
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          fieldInfo.sqlType = 'TIMESTAMPTZ';
        } else {
          fieldInfo.sqlType = 'TEXT';
        }
    }

    return fieldInfo;
  }

  /**
   * Check if array contains Bubble IDs (relationship array)
   * ROBUST detection method that catches all foreign key arrays
   */
  isRelationshipArray(array, fieldName) {
    if (!Array.isArray(array) || array.length === 0) {
      return false;
    }

    // Method 1: Check if ALL elements look like Bubble IDs
    // This is the most reliable method - if all elements are Bubble IDs, it's definitely a relationship
    const allElementsAreBubbleIds = array.every(element => {
      if (typeof element !== 'string') return false;
      
      // Bubble ID pattern: 13+ digits + 'x' + 15+ digits
      // Examples from real data:
      // "1692255756673x335736081690132500" (13x18)
      // "1696227082042x491448065157496800" (13x18) 
      // "1741614860801x190167310062321660" (13x18)
      const bubbleIdPattern = /^\d{10,}x\d{15,}$/;
      return bubbleIdPattern.test(element);
    });

    if (allElementsAreBubbleIds) {
      this.logger?.debug?.('Detected relationship array - all elements are Bubble IDs', null, {
        field: fieldName,
        sampleIds: array.slice(0, 2),
        count: array.length
      });
      return true;
    }

    // Method 2: Check if field name suggests relationships (backup method)
    const relationshipKeywords = [
      'linked', 'related', 'connected', 'associated', 'refs', 'references',
      'products', 'items', 'users', 'agents', 'customers', 'clients',
      'invoices', 'payments', 'orders', 'categories', 'tags', 'groups',
      'organizations', 'companies', 'contacts', 'leads', 'opportunities',
      'projects', 'tasks', 'assets', 'resources', 'dependencies'
    ];
    
    const fieldLower = fieldName.toLowerCase();
    const hasRelationshipName = relationshipKeywords.some(keyword => 
      fieldLower.includes(keyword)
    );

    // If name suggests relationship AND elements look like IDs, it's likely a relationship
    if (hasRelationshipName && array.length > 0) {
      const sampleElement = array[0];
      if (typeof sampleElement === 'string') {
        // More flexible pattern for potential Bubble IDs
        const possibleBubbleIdPattern = /^\d{10,}x\d{10,}$/;
        const couldBeBubbleId = possibleBubbleIdPattern.test(sampleElement);
        
        if (couldBeBubbleId) {
          this.logger?.debug?.('Detected relationship array - field name + ID pattern', null, {
            field: fieldName,
            sampleIds: array.slice(0, 2),
            count: array.length
          });
          return true;
        }
      }
    }

    // Method 3: Final check for arrays that might be relationships
    // If all elements are strings and longer than 20 chars, might be IDs
    const allStringsLongEnough = array.every(element => 
      typeof element === 'string' && element.length > 20
    );

    if (allStringsLongEnough && array.length > 0) {
      this.logger?.debug?.('Potential relationship array - long string IDs', null, {
        field: fieldName,
        sampleIds: array.slice(0, 2),
        count: array.length
      });
      // Return true if this looks like IDs, but log for verification
      return true;
    }

    return false;
  }

  /**
   * Guess referenced table from relationship field name
   */
  guessReferencedTable(fieldName) {
    // Remove common suffixes to guess table name
    let baseName = fieldName
      .replace(/_id$/i, '')
      .replace(/Id$/i, '')
      .replace(/_ref$/i, '')
      .replace(/Ref$/i, '')
      .replace(/^linked_?/i, '') // Remove "Linked" prefix
      .replace(/s$/, ''); // Remove plural 's'
    
    return baseName.toLowerCase();
  }

  /**
   * Merge field type information when conflicts occur
   */
  mergeFieldTypes(existing, newInfo) {
    // If types conflict, use TEXT as fallback
    if (existing.sqlType !== newInfo.sqlType) {
      return {
        ...existing,
        sqlType: 'TEXT',
        comment: 'Mixed types - stored as TEXT'
      };
    }

    return {
      ...existing,
      nullable: existing.nullable || newInfo.nullable
    };
  }

  /**
   * Generate CREATE TABLE SQL with proper schema
   */
  generateCreateTableSQL(tableName, schemaAnalysis) {
    const safeTableName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    let sql = `CREATE TABLE IF NOT EXISTS "${safeTableName}" (\n`;
    
    // Add fields
    const fieldDefinitions = schemaAnalysis.fields.map(field => {
      let definition = `  "${field.name}" ${field.type}`;
      
      if (field.isPrimary) {
        definition += ' PRIMARY KEY';
      }
      
      if (field.isUnique) {
        definition += ' UNIQUE';
      }
      
      if (field.hasDefault) {
        definition += ` DEFAULT ${field.defaultValue || 'NOW()'}`;
      }
      
      if (!field.isNullable) {
        definition += ' NOT NULL';
      }
      
      return definition;
    });
    
    sql += fieldDefinitions.join(',\n');
    sql += '\n)';
    
    return sql;
  }

  /**
   * Get schema creation statistics
   */
  async getSchemaStats() {
    const runId = this.logger.generateRunId();
    
    try {
      // Get table count from information_schema
      const tableStats = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          hasindexes,
          hasrules,
          hastriggers
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename != 'bubble_sync'
        AND tablename != '_prisma_migrations'
        ORDER BY tablename
      `;

      this.logger.info('Schema statistics retrieved', runId, {
        operation: 'schema_stats',
        tableCount: tableStats.length
      });

      return {
        success: true,
        runId,
        tableCount: tableStats.length,
        tables: tableStats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to get schema statistics', runId, {
        operation: 'schema_stats_error',
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

export default SchemaCreationService;
