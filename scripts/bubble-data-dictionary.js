#!/usr/bin/env node

/**
 * BUBBLE DATA DICTIONARY GENERATOR
 * 
 * Purpose: Create comprehensive data dictionary with all tables, fields, and data types
 * - Discover all data types
 * - Analyze ALL fields in each table
 * - Document field data types and patterns
 * - Generate Prisma schema recommendations
 * - Save complete documentation locally
 */

import { BubbleService } from '../src/services/bubbleService.js';
import fs from 'fs';
import path from 'path';

class BubbleDataDictionary {
  constructor() {
    this.bubbleService = new BubbleService();
    this.dataDictionary = {
      metadata: {
        timestamp: new Date().toISOString(),
        apiBaseUrl: this.bubbleService.baseUrl,
        totalTables: 0,
        totalFields: 0,
        analysisComplete: false
      },
      tables: {},
      fieldAnalysis: {
        allFieldNames: new Set(),
        fieldPatterns: {
          withSpaces: new Set(),
          withSpecialChars: new Set(),
          withNumbers: new Set(),
          camelCase: new Set()
        },
        dataTypeFrequency: {},
        prismaRecommendations: {}
      },
      errors: []
    };
  }

  /**
   * Main data dictionary generation process
   */
  async generateDataDictionary() {
    console.log('📊 Starting Comprehensive Data Dictionary Generation...\n');
    
    try {
      // Step 1: Discover all data types
      const dataTypes = await this.discoverAllDataTypes();
      
      // Step 2: Analyze each table in detail
      for (const dataType of dataTypes) {
        if (dataType.hasData) {
          await this.analyzeTableStructure(dataType.name);
        }
      }
      
      // Step 3: Perform cross-table field analysis
      await this.performFieldAnalysis();
      
      // Step 4: Generate Prisma recommendations
      await this.generatePrismaRecommendations();
      
      // Step 5: Save documentation locally
      await this.saveDocumentation();
      
      this.dataDictionary.metadata.analysisComplete = true;
      console.log('✅ Data dictionary generation completed successfully!\n');
      
      return this.dataDictionary;
      
    } catch (error) {
      console.error('❌ Data dictionary generation failed:', error.message);
      this.dataDictionary.errors.push({
        phase: 'main',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Discover all available data types
   */
  async discoverAllDataTypes() {
    console.log('1. Discovering All Data Types...');
    
    const commonTypes = [
      'user', 'customer', 'invoice', 'payment', 'agreement', 'agent',
      'package', 'stock', 'commission', 'performance', 'item',
      'order', 'product', 'category', 'contact', 'lead', 'account',
      'transaction', 'report', 'setting', 'config', 'log', 'audit',
      'notification', 'message', 'file', 'document', 'template',
      'project', 'task', 'event', 'booking', 'subscription'
    ];
    
    const discoveredTypes = [];
    
    for (const typeName of commonTypes) {
      try {
        console.log(`   Testing: ${typeName}...`);
        
        const result = await this.bubbleService.fetchDataType(typeName, { limit: 1 });
        
        if (result.success) {
          const typeInfo = {
            name: typeName,
            endpoint: `/api/1.1/obj/${typeName}`,
            hasData: result.data.length > 0
          };
          
          discoveredTypes.push(typeInfo);
          console.log(`   ✅ ${typeName}: ${result.data.length > 0 ? 'Has data' : 'Empty table'}`);
        }
        
        // Rate limiting delay
        await this.delay(300);
        
      } catch (error) {
        // Skip non-existent types
      }
    }
    
    this.dataDictionary.metadata.totalTables = discoveredTypes.length;
    console.log(`   📊 Discovery complete: ${discoveredTypes.length} data types found\n`);
    
    return discoveredTypes;
  }

  /**
   * Analyze complete structure of a single table
   */
  async analyzeTableStructure(tableName) {
    console.log(`2. Analyzing Table: ${tableName}...`);
    
    try {
      // Get multiple samples to understand field variations
      const sampleData = await this.bubbleService.getSampleData(tableName, 5);
      
      if (sampleData.length === 0) {
        console.log(`   ⚠️  ${tableName}: No records found`);
        return;
      }

      const tableAnalysis = {
        name: tableName,
        recordCount: sampleData.length,
        fields: {},
        fieldCount: 0,
        samples: sampleData,
        analysisTimestamp: new Date().toISOString()
      };

      // Analyze all fields across all samples
      const allFields = new Set();
      
      // Collect all possible field names from all samples
      sampleData.forEach(record => {
        Object.keys(record).forEach(fieldName => {
          allFields.add(fieldName);
        });
      });

      // Analyze each field
      for (const fieldName of allFields) {
        const fieldAnalysis = await this.analyzeField(fieldName, sampleData);
        tableAnalysis.fields[fieldName] = fieldAnalysis;
        
        // Add to global field tracking
        this.dataDictionary.fieldAnalysis.allFieldNames.add(fieldName);
      }

      tableAnalysis.fieldCount = allFields.size;
      this.dataDictionary.tables[tableName] = tableAnalysis;
      
      console.log(`   ✅ ${tableName}: ${tableAnalysis.fieldCount} fields analyzed from ${sampleData.length} records`);
      
    } catch (error) {
      console.log(`   ❌ ${tableName}: Analysis failed - ${error.message}`);
      this.dataDictionary.errors.push({
        phase: 'table_analysis',
        table: tableName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Analyze a single field across multiple records
   */
  async analyzeField(fieldName, records) {
    const values = records.map(record => record[fieldName]).filter(val => val !== undefined);
    const nonNullValues = values.filter(val => val !== null);
    
    const analysis = {
      fieldName,
      occurrenceCount: values.length,
      nullCount: values.length - nonNullValues.length,
      isAlwaysPresent: values.length === records.length,
      isNeverNull: nonNullValues.length === values.length,
      dataTypes: new Set(),
      sampleValues: [],
      patterns: {
        hasSpaces: fieldName.includes(' '),
        hasSpecialChars: /[^a-zA-Z0-9\s]/.test(fieldName),
        hasNumbers: /\d/.test(fieldName),
        isCamelCase: /^[a-z][a-zA-Z0-9]*$/.test(fieldName),
        isAllCaps: /^[A-Z\s_]+$/.test(fieldName)
      }
    };

    // Analyze data types of values
    nonNullValues.forEach(value => {
      const type = this.getValueType(value);
      analysis.dataTypes.add(type);
      
      // Keep sample values (max 3)
      if (analysis.sampleValues.length < 3) {
        analysis.sampleValues.push({ value, type });
      }
    });

    // Convert Set to Array for JSON serialization
    analysis.dataTypes = Array.from(analysis.dataTypes);
    
    // Determine primary data type
    analysis.primaryType = this.determinePrimaryType(analysis.dataTypes);
    analysis.prismaType = this.getPrismaType(analysis.primaryType, analysis.isNeverNull);
    analysis.camelCaseName = this.toCamelCase(fieldName);
    
    return analysis;
  }

  /**
   * Get the type of a value
   */
  getValueType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') {
      // Check if it's a date string
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return 'date';
      }
      return 'string';
    }
    return typeof value;
  }

  /**
   * Determine primary type from multiple observed types
   */
  determinePrimaryType(types) {
    if (types.length === 1) return types[0];
    if (types.includes('string')) return 'string'; // String can handle most things
    if (types.includes('number')) return 'number';
    return types[0];
  }

  /**
   * Get recommended Prisma type
   */
  getPrismaType(primaryType, isNeverNull) {
    const optional = isNeverNull ? '' : '?';
    
    switch (primaryType) {
      case 'string': return `String${optional}`;
      case 'number': return `Float${optional}`;
      case 'boolean': return `Boolean${optional}`;
      case 'date': return `DateTime${optional}`;
      case 'array': return `String${optional}`; // Store as JSON string
      case 'object': return `String${optional}`; // Store as JSON string
      default: return `String${optional}`;
    }
  }

  /**
   * Convert field name to camelCase
   */
  toCamelCase(str) {
    return str
      .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special chars
      .replace(/\s+/g, ' ')            // Normalize spaces
      .split(' ')
      .map((word, i) => {
        if (i === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
  }

  /**
   * Perform cross-table field analysis
   */
  async performFieldAnalysis() {
    console.log('3. Performing Cross-Table Field Analysis...');
    
    const fieldPatterns = this.dataDictionary.fieldAnalysis.fieldPatterns;
    const dataTypeFreq = {};
    
    // Analyze patterns across all fields
    this.dataDictionary.fieldAnalysis.allFieldNames.forEach(fieldName => {
      if (fieldName.includes(' ')) fieldPatterns.withSpaces.add(fieldName);
      if (/[^a-zA-Z0-9\s]/.test(fieldName)) fieldPatterns.withSpecialChars.add(fieldName);
      if (/\d/.test(fieldName)) fieldPatterns.withNumbers.add(fieldName);
      if (/^[a-z][a-zA-Z0-9]*$/.test(fieldName)) fieldPatterns.camelCase.add(fieldName);
    });

    // Count data type frequency
    Object.values(this.dataDictionary.tables).forEach(table => {
      Object.values(table.fields).forEach(field => {
        const type = field.primaryType;
        dataTypeFreq[type] = (dataTypeFreq[type] || 0) + 1;
      });
    });

    // Convert Sets to Arrays
    Object.keys(fieldPatterns).forEach(key => {
      fieldPatterns[key] = Array.from(fieldPatterns[key]);
    });

    this.dataDictionary.fieldAnalysis.dataTypeFrequency = dataTypeFreq;
    this.dataDictionary.metadata.totalFields = this.dataDictionary.fieldAnalysis.allFieldNames.size;
    
    console.log(`   ✅ Cross-table analysis complete: ${this.dataDictionary.metadata.totalFields} unique fields found`);
  }

  /**
   * Generate Prisma schema recommendations
   */
  async generatePrismaRecommendations() {
    console.log('4. Generating Prisma Schema Recommendations...');
    
    const recommendations = {};
    
    Object.entries(this.dataDictionary.tables).forEach(([tableName, table]) => {
      const modelName = this.toPascalCase(tableName);
      const fields = [];
      
      // Standard fields
      fields.push('  id        String   @id @default(cuid())');
      fields.push('  bubbleId  String   @unique @map("_id")');
      fields.push('');
      
      // Dynamic fields from Bubble
      Object.entries(table.fields).forEach(([fieldName, field]) => {
        if (fieldName !== '_id') { // Skip _id as it's handled as bubbleId
          const prismaField = `  ${field.camelCaseName.padEnd(12)} ${field.prismaType.padEnd(12)} @map("${fieldName}")`;
          fields.push(prismaField);
        }
      });
      
      fields.push('');
      fields.push('  createdAt DateTime @default(now())');
      fields.push('  updatedAt DateTime @updatedAt');
      fields.push('  isDeleted Boolean  @default(false)');
      fields.push('');
      fields.push(`  @@map("${tableName}")`);
      
      recommendations[tableName] = {
        modelName,
        fields: fields.join('\n'),
        fieldCount: Object.keys(table.fields).length
      };
    });
    
    this.dataDictionary.fieldAnalysis.prismaRecommendations = recommendations;
    console.log(`   ✅ Prisma recommendations generated for ${Object.keys(recommendations).length} tables`);
  }

  /**
   * Convert to PascalCase for model names
   */
  toPascalCase(str) {
    return this.toCamelCase(str).charAt(0).toUpperCase() + this.toCamelCase(str).slice(1);
  }

  /**
   * Save complete documentation locally
   */
  async saveDocumentation() {
    console.log('5. Saving Documentation Locally...');
    
    // Save raw data dictionary
    const dictionaryFile = './BUBBLE-DATA-DICTIONARY.json';
    const dataDictCopy = JSON.parse(JSON.stringify(this.dataDictionary));
    dataDictCopy.fieldAnalysis.allFieldNames = Array.from(dataDictCopy.fieldAnalysis.allFieldNames);
    
    fs.writeFileSync(dictionaryFile, JSON.stringify(dataDictCopy, null, 2));
    
    // Generate readable markdown documentation
    await this.generateMarkdownDocumentation();
    
    console.log(`   ✅ Documentation saved:`);
    console.log(`       - ${dictionaryFile}`);
    console.log(`       - BUBBLE-DATA-DICTIONARY.md`);
    console.log(`       - PRISMA-SCHEMA-RECOMMENDATIONS.md`);
  }

  /**
   * Generate readable markdown documentation
   */
  async generateMarkdownDocumentation() {
    const markdown = this.generateDataDictionaryMarkdown();
    const prismaDoc = this.generatePrismaDocumentation();
    
    fs.writeFileSync('./BUBBLE-DATA-DICTIONARY.md', markdown);
    fs.writeFileSync('./PRISMA-SCHEMA-RECOMMENDATIONS.md', prismaDoc);
  }

  /**
   * Generate main data dictionary markdown
   */
  generateDataDictionaryMarkdown() {
    const dict = this.dataDictionary;
    
    let md = `# BUBBLE DATA DICTIONARY\n`;
    md += `**Generated**: ${dict.metadata.timestamp}\n`;
    md += `**Tables**: ${dict.metadata.totalTables}\n`;
    md += `**Fields**: ${dict.metadata.totalFields}\n\n`;
    
    md += `## 📊 OVERVIEW\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Total Tables | ${dict.metadata.totalTables} |\n`;
    md += `| Total Unique Fields | ${dict.metadata.totalFields} |\n`;
    md += `| API Base URL | ${dict.metadata.apiBaseUrl} |\n`;
    md += `| Analysis Status | ${dict.metadata.analysisComplete ? '✅ Complete' : '⏳ In Progress'} |\n\n`;
    
    md += `## 📋 TABLE DETAILS\n\n`;
    
    Object.entries(dict.tables).forEach(([tableName, table]) => {
      md += `### ${tableName.toUpperCase()}\n`;
      md += `- **Records Analyzed**: ${table.recordCount}\n`;
      md += `- **Fields**: ${table.fieldCount}\n`;
      md += `- **Endpoint**: \`/api/1.1/obj/${tableName}\`\n\n`;
      
      md += `#### Fields:\n`;
      md += `| Field Name | Type | Prisma Type | Always Present | Sample Value |\n`;
      md += `|------------|------|-------------|----------------|-------------|\n`;
      
      Object.entries(table.fields).forEach(([fieldName, field]) => {
        const sampleValue = field.sampleValues[0]?.value || 'null';
        const truncatedSample = typeof sampleValue === 'string' && sampleValue.length > 30 
          ? sampleValue.substring(0, 30) + '...' 
          : sampleValue;
        
        md += `| \`${fieldName}\` | ${field.primaryType} | \`${field.prismaType}\` | ${field.isAlwaysPresent ? '✅' : '❌'} | \`${truncatedSample}\` |\n`;
      });
      
      md += `\n`;
    });
    
    return md;
  }

  /**
   * Generate Prisma schema documentation
   */
  generatePrismaDocumentation() {
    const recommendations = this.dataDictionary.fieldAnalysis.prismaRecommendations;
    
    let md = `# PRISMA SCHEMA RECOMMENDATIONS\n`;
    md += `**Generated**: ${new Date().toISOString()}\n`;
    md += `**Based on**: Real Bubble.io API analysis\n\n`;
    
    md += `## 🏗️ COMPLETE SCHEMA\n\n`;
    md += `\`\`\`prisma\n`;
    md += `// Generated Prisma Schema for Bubble.io Data\n`;
    md += `generator client {\n`;
    md += `  provider = "prisma-client-js"\n`;
    md += `}\n\n`;
    md += `datasource db {\n`;
    md += `  provider = "postgresql"\n`;
    md += `  url      = env("DATABASE_URL")\n`;
    md += `}\n\n`;
    
    Object.entries(recommendations).forEach(([tableName, rec]) => {
      md += `model ${rec.modelName} {\n`;
      md += rec.fields;
      md += `\n}\n\n`;
    });
    
    md += `\`\`\`\n\n`;
    
    md += `## 📊 FIELD MAPPING REFERENCE\n\n`;
    Object.entries(this.dataDictionary.tables).forEach(([tableName, table]) => {
      md += `### ${tableName.toUpperCase()} Field Mappings\n\n`;
      md += `| Bubble Field | Prisma Field | Type |\n`;
      md += `|--------------|--------------|------|\n`;
      
      Object.entries(table.fields).forEach(([fieldName, field]) => {
        if (fieldName !== '_id') {
          md += `| \`"${fieldName}"\` | \`${field.camelCaseName}\` | \`${field.prismaType}\` |\n`;
        }
      });
      
      md += `\n`;
    });
    
    return md;
  }

  /**
   * Utility: Add delay for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dictionary = new BubbleDataDictionary();
  dictionary.generateDataDictionary().catch(console.error);
}

export { BubbleDataDictionary };
