import BubbleService from './bubbleService.js';
import { writeFileSync } from 'fs';
import path from 'path';

// ⚠️ WARNING: This service handles the EXACT failure point from 24 previous attempts
// ⚠️ CRITICAL: Use Prisma @map() directives - NO custom field mapping services
// ⚠️ SUCCESS PATTERN: Let Prisma handle field name mapping automatically

class SchemaGenerationService {
  constructor() {
    this.bubbleService = new BubbleService();
  }

  // EXACT toCamelCase function from memory - tested and proven
  // This is the ONLY transformation we do - everything else handled by Prisma @map()
  toCamelCase(str) {
    if (!str || typeof str !== 'string') return 'unknownField';
    
    return str
      .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove %, _, etc.
      .replace(/\s+/g, ' ')            // Normalize spaces
      .split(' ')
      .map((word, i) => {
        if (i === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
  }

  // Convert data type name to PascalCase for Prisma model names
  toPascalCase(str) {
    if (!str || typeof str !== 'string') return 'UnknownModel';
    
    return str
      .replace(/[^a-zA-Z0-9\s_]/g, '')
      .replace(/[_\s]+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  // Determine Prisma field type from Bubble data value
  getPrismaFieldType(value, fieldName) {
    if (value === null || value === undefined) {
      return 'String?'; // Default to nullable string for unknown types
    }

    if (Array.isArray(value)) {
      // Handle arrays - store as JSON strings for simplicity
      return 'String?'; // Will store JSON.stringify(array)
    }

    if (typeof value === 'boolean') {
      return 'Boolean?';
    }

    if (typeof value === 'number') {
      return 'Float?'; // Use Float for all numbers (handles both int and float)
    }

    if (typeof value === 'string') {
      // Check if it's a date string (Bubble uses ISO format)
      if (this.isDateString(value)) {
        return 'DateTime?';
      }
      return 'String?';
    }

    if (typeof value === 'object') {
      // Objects stored as JSON strings
      return 'String?';
    }

    // Fallback
    return 'String?';
  }

  // Check if string looks like a date (Bubble uses ISO format)
  isDateString(str) {
    if (typeof str !== 'string') return false;
    
    // Bubble typically uses ISO 8601 format
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return isoDatePattern.test(str) && !isNaN(Date.parse(str));
  }

  // Analyze field patterns from sample data to determine schema
  async analyzeDataTypeStructure(dataTypeName, sampleSize = 3) {
    console.log(`🔍 Analyzing structure for ${dataTypeName}...`);

    try {
      // Fetch sample data to understand field structure
      const sampleData = await this.bubbleService.fetchDataType(dataTypeName, {
        limit: sampleSize
      });

      if (!sampleData.success || !sampleData.records || sampleData.records.length === 0) {
        console.log(`⚠️  ${dataTypeName}: No sample data available, creating minimal schema`);
        return {
          hasData: false,
          fields: {},
          sampleCount: 0
        };
      }

      // Analyze all fields across all sample records
      const fieldTypes = {};
      const fieldExamples = {};

      sampleData.records.forEach(record => {
        Object.keys(record).forEach(fieldName => {
          const value = record[fieldName];
          
          // Track field type (use the most specific type we find)
          if (!fieldTypes[fieldName]) {
            fieldTypes[fieldName] = this.getPrismaFieldType(value, fieldName);
            fieldExamples[fieldName] = value;
          } else {
            // If we see different types, default to String? for safety
            const currentType = this.getPrismaFieldType(value, fieldName);
            if (fieldTypes[fieldName] !== currentType && value !== null && value !== undefined) {
              console.log(`⚠️  ${dataTypeName}.${fieldName}: Mixed types detected, using String?`);
              fieldTypes[fieldName] = 'String?';
            }
          }
        });
      });

      console.log(`✅ ${dataTypeName}: Found ${Object.keys(fieldTypes).length} fields from ${sampleData.records.length} records`);

      return {
        hasData: true,
        fields: fieldTypes,
        examples: fieldExamples,
        sampleCount: sampleData.records.length,
        totalAvailable: sampleData.pagination.remaining + sampleData.count
      };

    } catch (error) {
      console.error(`❌ Failed to analyze ${dataTypeName}:`, error.message);
      return {
        hasData: false,
        fields: {},
        error: error.message,
        sampleCount: 0
      };
    }
  }

  // Generate Prisma model definition for a single data type
  generateModelDefinition(dataTypeName, fieldAnalysis) {
    const modelName = this.toPascalCase(dataTypeName);
    const tableName = dataTypeName.toLowerCase();

    let modelDef = `model ${modelName} {\n`;
    modelDef += `  id        String   @id @default(cuid())\n`;
    modelDef += `  bubbleId  String   @unique @map("bubble_id")\n`;
    modelDef += `  \n`;

    if (fieldAnalysis.hasData && Object.keys(fieldAnalysis.fields).length > 0) {
      modelDef += `  // Fields from Bubble API (${fieldAnalysis.sampleCount} records analyzed)\n`;
      
      // Sort fields for consistent output (_id first, then alphabetical)
      const sortedFields = Object.keys(fieldAnalysis.fields).sort((a, b) => {
        if (a === '_id') return -1;
        if (b === '_id') return 1;
        return a.localeCompare(b);
      });

      sortedFields.forEach(originalFieldName => {
        // Skip _id as it's handled by bubbleId
        if (originalFieldName === '_id') return;

        const prismaFieldType = fieldAnalysis.fields[originalFieldName];
        const prismaFieldName = this.toCamelCase(originalFieldName);
        
        // Add field with @map directive to preserve original Bubble field name
        modelDef += `  ${prismaFieldName.padEnd(20)} ${prismaFieldType.padEnd(10)} @map("${originalFieldName}")\n`;
      });
      
      modelDef += `  \n`;
    } else {
      modelDef += `  // No data available for analysis - minimal schema\n`;
      modelDef += `  \n`;
    }

    // Standard tracking fields
    modelDef += `  createdAt DateTime @default(now())\n`;
    modelDef += `  updatedAt DateTime @updatedAt\n`;
    modelDef += `  isDeleted Boolean  @default(false)\n`;
    modelDef += `  \n`;
    modelDef += `  @@map("${tableName}")\n`;
    modelDef += `}\n`;

    return {
      modelName,
      tableName,
      definition: modelDef,
      fieldCount: Object.keys(fieldAnalysis.fields).length,
      hasData: fieldAnalysis.hasData
    };
  }

  // Generate complete Prisma schema for all discovered data types
  async generateCompleteSchema(dataTypes = null) {
    console.log('🏗️  Starting Prisma schema generation...');
    console.log('⚠️  Using EXACT field mapping strategy from memory to prevent failures');

    let discoveredTypes = dataTypes;
    
    // If no data types provided, discover them
    if (!discoveredTypes) {
      console.log('🔍 Discovering data types first...');
      const discovery = await this.bubbleService.discoverAllDataTypes();
      if (!discovery || discovery.totalFound === 0) {
        throw new Error('No data types discovered - cannot generate schema');
      }
      discoveredTypes = discovery.discoveredTypes;
    }

    console.log(`📋 Generating schema for ${discoveredTypes.length} data types...`);

    // Schema header
    let schema = `// Generated Prisma schema from Bubble.io data types\n`;
    schema += `// Generation timestamp: ${new Date().toISOString()}\n`;
    schema += `// Data types discovered: ${discoveredTypes.length}\n`;
    schema += `// CRITICAL: Uses @map() directives to preserve original Bubble field names\n`;
    schema += `\n`;
    schema += `generator client {\n`;
    schema += `  provider = "prisma-client-js"\n`;
    schema += `}\n`;
    schema += `\n`;
    schema += `datasource db {\n`;
    schema += `  provider = "postgresql"\n`;
    schema += `  url      = env("DATABASE_URL")\n`;
    schema += `}\n`;
    schema += `\n`;

    const results = {
      totalTypes: discoveredTypes.length,
      processedTypes: 0,
      typesWithData: 0,
      typesEmpty: 0,
      errors: [],
      models: []
    };

    // Process each data type
    for (const dataType of discoveredTypes) {
      try {
        console.log(`⚙️  Processing ${dataType.name}...`);
        
        // Analyze structure from sample data
        const analysis = await this.analyzeDataTypeStructure(dataType.name);
        
        // Generate model definition
        const model = this.generateModelDefinition(dataType.name, analysis);
        
        // Add to schema
        schema += `// ${dataType.name} (${analysis.hasData ? `${analysis.sampleCount} records sampled` : 'no data'})\n`;
        schema += model.definition;
        schema += `\n`;

        // Track results
        results.processedTypes++;
        if (analysis.hasData) {
          results.typesWithData++;
        } else {
          results.typesEmpty++;
        }
        
        results.models.push({
          name: dataType.name,
          modelName: model.modelName,
          fieldCount: model.fieldCount,
          hasData: model.hasData,
          totalRecords: analysis.totalAvailable || 0
        });

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ Error processing ${dataType.name}:`, error.message);
        results.errors.push({
          dataType: dataType.name,
          error: error.message
        });
      }
    }

    console.log(`🎉 Schema generation complete!`);
    console.log(`📊 Processed: ${results.processedTypes}/${results.totalTypes} types`);
    console.log(`✅ With data: ${results.typesWithData}`);
    console.log(`📭 Empty: ${results.typesEmpty}`);
    if (results.errors.length > 0) {
      console.log(`❌ Errors: ${results.errors.length}`);
    }

    return {
      schema,
      results,
      timestamp: new Date().toISOString()
    };
  }

  // Write schema to prisma/schema.prisma file
  async writeSchemaFile(schemaContent) {
    try {
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
      console.log(`📝 Writing schema to ${schemaPath}...`);
      
      writeFileSync(schemaPath, schemaContent, 'utf8');
      console.log('✅ Schema file written successfully');
      
      return { success: true, path: schemaPath };
    } catch (error) {
      console.error('❌ Failed to write schema file:', error.message);
      throw new Error(`Schema write failed: ${error.message}`);
    }
  }

  // Apply schema to database using Prisma
  async applySchema() {
    console.log('🚀 Applying schema to database...');
    
    try {
      const { execSync } = await import('child_process');
      
      // Generate Prisma client
      console.log('🔄 Generating Prisma client...');
      const generateOutput = execSync('npx prisma generate', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      console.log('✅ Prisma client generated');
      
      // Push schema to database
      console.log('🔄 Pushing schema to database...');
      const pushOutput = execSync('npx prisma db push', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      console.log('✅ Schema pushed to database successfully');
      
      return {
        success: true,
        generateOutput,
        pushOutput,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to apply schema:', error.message);
      throw new Error(`Schema application failed: ${error.message}`);
    }
  }

  // Complete schema generation and application process
  async generateAndApplySchema() {
    try {
      console.log('🏗️  Starting complete schema generation process...');
      
      // Generate schema
      const schemaResult = await this.generateCompleteSchema();
      
      // Write to file
      await this.writeSchemaFile(schemaResult.schema);
      
      // Apply to database
      const applyResult = await this.applySchema();
      
      console.log('🎉 Complete schema generation and application successful!');
      
      return {
        success: true,
        generation: schemaResult,
        application: applyResult,
        summary: {
          totalTypes: schemaResult.results.totalTypes,
          processedTypes: schemaResult.results.processedTypes,
          typesWithData: schemaResult.results.typesWithData,
          errors: schemaResult.results.errors.length
        }
      };
    } catch (error) {
      console.error('❌ Complete schema generation failed:', error.message);
      throw error;
    }
  }
}

export default SchemaGenerationService;
