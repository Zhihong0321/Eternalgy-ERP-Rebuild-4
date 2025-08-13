import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loggers } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = loggers.api;

class DocumentationService {
  constructor() {
    // Use docs folder in project root for storing field descriptions
    this.docsDir = path.join(__dirname, '../../docs/field-descriptions');
    this.metadataFile = path.join(this.docsDir, 'metadata.json');
  }

  /**
   * Initialize documentation directory structure
   */
  async initialize() {
    const runId = logger.generateRunId();
    
    logger.info('Initializing documentation service', runId, {
      operation: 'docs_service_init',
      docsDir: this.docsDir
    });

    try {
      // Create docs directory if it doesn't exist
      await fs.mkdir(this.docsDir, { recursive: true });
      
      // Initialize metadata file if it doesn't exist
      try {
        await fs.access(this.metadataFile);
      } catch {
        const initialMetadata = {
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
          description: 'Schema field documentation metadata',
          tables: {}
        };
        
        await fs.writeFile(this.metadataFile, JSON.stringify(initialMetadata, null, 2));
        
        logger.info('Created initial metadata file', runId, {
          operation: 'docs_metadata_created',
          file: this.metadataFile
        });
      }

      logger.info('Documentation service initialized', runId, {
        operation: 'docs_service_init_complete'
      });

      return { success: true };

    } catch (error) {
      logger.error('Documentation service initialization failed', runId, {
        operation: 'docs_service_init_error',
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save field descriptions for a table
   * @param {string} tableName - Name of the table
   * @param {Object} descriptions - Field descriptions object
   */
  async saveTableDescriptions(tableName, descriptions) {
    const runId = logger.generateRunId();
    
    logger.info('Saving table field descriptions', runId, {
      operation: 'save_table_descriptions',
      tableName,
      fieldCount: Object.keys(descriptions).length
    });

    try {
      await this.initialize();
      
      const tableFile = path.join(this.docsDir, `${tableName}.json`);
      const documentationData = {
        tableName,
        lastUpdated: new Date().toISOString(),
        descriptions,
        metadata: {
          totalFields: Object.keys(descriptions).length,
          documentedFields: Object.values(descriptions).filter(desc => desc && desc.trim()).length
        }
      };

      await fs.writeFile(tableFile, JSON.stringify(documentationData, null, 2));

      // Update metadata
      await this.updateMetadata(tableName, documentationData.metadata);

      logger.info('Table descriptions saved successfully', runId, {
        operation: 'save_table_descriptions_success',
        tableName,
        file: tableFile,
        documentedFields: documentationData.metadata.documentedFields
      });

      return {
        success: true,
        saved: documentationData.metadata.totalFields,
        documented: documentationData.metadata.documentedFields
      };

    } catch (error) {
      logger.error('Failed to save table descriptions', runId, {
        operation: 'save_table_descriptions_error',
        tableName,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load field descriptions for a table
   * @param {string} tableName - Name of the table
   */
  async loadTableDescriptions(tableName) {
    const runId = logger.generateRunId();
    
    logger.info('Loading table field descriptions', runId, {
      operation: 'load_table_descriptions',
      tableName
    });

    try {
      const tableFile = path.join(this.docsDir, `${tableName}.json`);
      
      try {
        const fileContent = await fs.readFile(tableFile, 'utf8');
        const documentationData = JSON.parse(fileContent);

        logger.info('Table descriptions loaded successfully', runId, {
          operation: 'load_table_descriptions_success',
          tableName,
          documentedFields: documentationData.metadata?.documentedFields || 0
        });

        return {
          success: true,
          tableName,
          descriptions: documentationData.descriptions,
          metadata: documentationData.metadata,
          lastUpdated: documentationData.lastUpdated
        };

      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          // File doesn't exist - return empty descriptions
          logger.info('No descriptions file found for table', runId, {
            operation: 'load_table_descriptions_not_found',
            tableName
          });

          return {
            success: true,
            tableName,
            descriptions: {},
            metadata: { totalFields: 0, documentedFields: 0 },
            lastUpdated: null
          };
        }
        throw fileError;
      }

    } catch (error) {
      logger.error('Failed to load table descriptions', runId, {
        operation: 'load_table_descriptions_error',
        tableName,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update metadata file with table information
   * @param {string} tableName - Name of the table
   * @param {Object} tableMetadata - Table metadata
   */
  async updateMetadata(tableName, tableMetadata) {
    try {
      const metadataContent = await fs.readFile(this.metadataFile, 'utf8');
      const metadata = JSON.parse(metadataContent);

      metadata.tables[tableName] = {
        ...tableMetadata,
        lastUpdated: new Date().toISOString()
      };
      metadata.lastUpdated = new Date().toISOString();

      await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));

    } catch (error) {
      logger.error('Failed to update metadata', '', {
        operation: 'update_metadata_error',
        tableName,
        error: error.message
      });
    }
  }

  /**
   * Get all documented tables
   */
  async getDocumentedTables() {
    const runId = logger.generateRunId();
    
    try {
      const metadataContent = await fs.readFile(this.metadataFile, 'utf8');
      const metadata = JSON.parse(metadataContent);

      logger.info('Retrieved documented tables list', runId, {
        operation: 'get_documented_tables',
        count: Object.keys(metadata.tables).length
      });

      return {
        success: true,
        tables: metadata.tables,
        metadata: {
          totalTables: Object.keys(metadata.tables).length,
          lastUpdated: metadata.lastUpdated
        }
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: true,
          tables: {},
          metadata: { totalTables: 0, lastUpdated: null }
        };
      }

      logger.error('Failed to get documented tables', runId, {
        operation: 'get_documented_tables_error',
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export all documentation as a single JSON structure
   */
  async exportAllDocumentation() {
    const runId = logger.generateRunId();
    
    logger.info('Exporting all documentation', runId, {
      operation: 'export_all_documentation'
    });

    try {
      const documentedTables = await this.getDocumentedTables();
      
      if (!documentedTables.success) {
        throw new Error(`Failed to get documented tables: ${documentedTables.error}`);
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        metadata: documentedTables.metadata,
        tables: {}
      };

      // Load descriptions for each table
      for (const tableName of Object.keys(documentedTables.tables)) {
        const tableDescriptions = await this.loadTableDescriptions(tableName);
        
        if (tableDescriptions.success) {
          exportData.tables[tableName] = {
            descriptions: tableDescriptions.descriptions,
            metadata: tableDescriptions.metadata,
            lastUpdated: tableDescriptions.lastUpdated
          };
        }
      }

      logger.info('All documentation exported successfully', runId, {
        operation: 'export_all_documentation_success',
        tablesExported: Object.keys(exportData.tables).length,
        totalFields: Object.values(exportData.tables).reduce(
          (sum, table) => sum + (table.metadata?.totalFields || 0), 0
        )
      });

      return {
        success: true,
        data: exportData
      };

    } catch (error) {
      logger.error('Failed to export all documentation', runId, {
        operation: 'export_all_documentation_error',
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete documentation for a table
   * @param {string} tableName - Name of the table
   */
  async deleteTableDocumentation(tableName) {
    const runId = logger.generateRunId();
    
    logger.info('Deleting table documentation', runId, {
      operation: 'delete_table_documentation',
      tableName
    });

    try {
      const tableFile = path.join(this.docsDir, `${tableName}.json`);
      
      try {
        await fs.unlink(tableFile);
        
        // Update metadata
        const metadataContent = await fs.readFile(this.metadataFile, 'utf8');
        const metadata = JSON.parse(metadataContent);
        delete metadata.tables[tableName];
        metadata.lastUpdated = new Date().toISOString();
        await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));

        logger.info('Table documentation deleted successfully', runId, {
          operation: 'delete_table_documentation_success',
          tableName
        });

        return { success: true };

      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          // File doesn't exist - consider it already deleted
          return { success: true };
        }
        throw fileError;
      }

    } catch (error) {
      logger.error('Failed to delete table documentation', runId, {
        operation: 'delete_table_documentation_error',
        tableName,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default DocumentationService;
