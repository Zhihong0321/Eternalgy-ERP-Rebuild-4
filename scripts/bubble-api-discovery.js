#!/usr/bin/env node

/**
 * BUBBLE API DISCOVERY SCRIPT
 * 
 * Purpose: Systematic discovery and documentation of Bubble.io API
 * - Discover all available data types
 * - Test API limitations and constraints
 * - Sample real data from each type
 * - Document field patterns and structures
 * - Create comprehensive API manual for future sessions
 */

import { BubbleService } from '../src/services/bubbleService.js';
import fs from 'fs';
import path from 'path';

class BubbleAPIDiscovery {
  constructor() {
    this.bubbleService = new BubbleService();
    this.results = {
      discovery: {
        timestamp: new Date().toISOString(),
        apiBaseUrl: this.bubbleService.baseUrl,
        hasValidApiKey: !!this.bubbleService.apiKey
      },
      dataTypes: [],
      apiLimitations: {},
      fieldAnalysis: {},
      errors: [],
      samples: {}
    };
    
    // Ensure samples directory exists
    if (!fs.existsSync('./samples')) {
      fs.mkdirSync('./samples', { recursive: true });
    }
  }

  /**
   * Main discovery process
   */
  async runDiscovery() {
    console.log('🔍 Starting Bubble API Discovery Process...\n');
    
    try {
      // Step 1: Test API Connection
      await this.testAPIConnection();
      
      // Step 2: Discover Data Types
      await this.discoverDataTypes();
      
      // Step 3: Test API Limitations
      await this.testAPILimitations();
      
      // Step 4: Sample Data from Each Type
      await this.sampleAllDataTypes();
      
      // Step 5: Analyze Field Patterns
      await this.analyzeFieldPatterns();
      
      // Step 6: Generate Documentation
      await this.generateDocumentation();
      
      console.log('✅ Discovery process completed successfully!');
      
    } catch (error) {
      console.error('❌ Discovery process failed:', error.message);
      this.results.errors.push({
        phase: 'main',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Test basic API connectivity and authentication
   */
  async testAPIConnection() {
    console.log('1. Testing API Connection...');
    
    try {
      const connectionResult = await this.bubbleService.testConnection();
      this.results.discovery.connectionTest = connectionResult;
      
      if (connectionResult.success) {
        console.log('   ✅ API connection successful');
      } else {
        console.log('   ❌ API connection failed:', connectionResult.error);
      }
      
    } catch (error) {
      console.log('   ❌ Connection test error:', error.message);
      this.results.errors.push({
        phase: 'connection',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Discover all available data types
   */
  async discoverDataTypes() {
    console.log('2. Discovering Data Types...');
    
    try {
      // Test common data type names
      const commonTypes = [
        'user', 'customer', 'invoice', 'payment', 'agreement', 'agent',
        'package', 'stock', 'commission', 'performance', 'item',
        'order', 'product', 'category', 'contact', 'lead', 'account',
        'transaction', 'report', 'setting', 'config', 'log', 'audit',
        'notification', 'message', 'file', 'document', 'template'
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
              hasData: result.data.length > 0,
              sampleCount: result.data.length,
              testTimestamp: new Date().toISOString()
            };
            
            // Try to get more info about record count
            if (result.data.length > 0) {
              console.log(`   ✅ ${typeName}: Found data (${result.data.length} sample records)`);
            } else {
              console.log(`   📋 ${typeName}: Accessible but no records`);
            }
            
            discoveredTypes.push(typeInfo);
          }
          
          // Rate limiting delay
          await this.delay(300);
          
        } catch (error) {
          console.log(`   ❌ ${typeName}: ${error.message}`);
        }
      }
      
      this.results.dataTypes = discoveredTypes;
      console.log(`   📊 Discovery complete: ${discoveredTypes.length} data types found\n`);
      
    } catch (error) {
      console.log('   ❌ Data type discovery error:', error.message);
      this.results.errors.push({
        phase: 'discovery',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Test API limitations and constraints
   */
  async testAPILimitations() {
    console.log('3. Testing API Limitations...');
    
    const limitations = {};
    
    // Test rate limiting
    try {
      console.log('   Testing rate limits...');
      const startTime = Date.now();
      
      // Make 5 quick requests
      for (let i = 0; i < 5; i++) {
        await this.bubbleService.fetchDataType('user', { limit: 1 });
      }
      
      const endTime = Date.now();
      limitations.rateLimitTest = {
        requests: 5,
        totalTime: endTime - startTime,
        averageTime: (endTime - startTime) / 5,
        notes: 'Basic rate limit test completed without errors'
      };
      
      console.log(`   ✅ Rate limit test: ${limitations.rateLimitTest.averageTime}ms average`);
      
    } catch (error) {
      limitations.rateLimitTest = {
        error: error.message,
        timestamp: new Date().toISOString()
      };
      console.log('   ❌ Rate limit test error:', error.message);
    }

    // Test pagination limits
    try {
      console.log('   Testing pagination limits...');
      
      // Find a data type with records
      const typeWithData = this.results.dataTypes.find(type => type.hasData);
      
      if (typeWithData) {
        const largeRequest = await this.bubbleService.fetchDataType(typeWithData.name, { limit: 100 });
        limitations.paginationTest = {
          dataType: typeWithData.name,
          requestedLimit: 100,
          actualRecords: largeRequest.data?.length || 0,
          hasMore: largeRequest.hasMore,
          cursor: largeRequest.cursor
        };
        
        console.log(`   ✅ Pagination test: ${limitations.paginationTest.actualRecords} records returned`);
      }
      
    } catch (error) {
      limitations.paginationTest = {
        error: error.message,
        timestamp: new Date().toISOString()
      };
      console.log('   ❌ Pagination test error:', error.message);
    }

    this.results.apiLimitations = limitations;
    console.log('   📋 API limitations testing completed\n');
  }

  /**
   * Sample data from all discovered data types
   */
  async sampleAllDataTypes() {
    console.log('4. Sampling Data from All Types...');
    
    for (const dataType of this.results.dataTypes) {
      if (dataType.hasData) {
        try {
          console.log(`   Sampling ${dataType.name}...`);
          
          const sampleData = await this.bubbleService.getSampleData(dataType.name, 3);
          
          // Save sample data to file
          const filename = `${dataType.name}_sample.json`;
          const filepath = path.join('./samples', filename);
          
          fs.writeFileSync(filepath, JSON.stringify({
            dataType: dataType.name,
            sampleCount: sampleData.length,
            timestamp: new Date().toISOString(),
            endpoint: dataType.endpoint,
            data: sampleData
          }, null, 2));
          
          this.results.samples[dataType.name] = {
            filename: filename,
            recordCount: sampleData.length,
            filepath: filepath
          };
          
          console.log(`   ✅ ${dataType.name}: ${sampleData.length} samples saved to ${filename}`);
          
          // Rate limiting delay
          await this.delay(300);
          
        } catch (error) {
          console.log(`   ❌ ${dataType.name}: ${error.message}`);
          this.results.errors.push({
            phase: 'sampling',
            dataType: dataType.name,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    console.log('   📁 Data sampling completed\n');
  }

  /**
   * Analyze field patterns across all data types
   */
  async analyzeFieldPatterns() {
    console.log('5. Analyzing Field Patterns...');
    
    const fieldAnalysis = {
      allFields: new Set(),
      fieldTypes: {},
      fieldPatterns: {
        withSpaces: [],
        withSpecialChars: [],
        camelCase: [],
        allCaps: [],
        numbers: []
      },
      commonFields: {},
      dataTypeAnalysis: {}
    };

    // Analyze each sample file
    for (const [dataTypeName, sampleInfo] of Object.entries(this.results.samples)) {
      try {
        const sampleData = JSON.parse(fs.readFileSync(sampleInfo.filepath, 'utf8'));
        
        const typeAnalysis = {
          fieldCount: 0,
          fields: [],
          dataTypes: {},
          patterns: {}
        };

        if (sampleData.data && sampleData.data.length > 0) {
          const firstRecord = sampleData.data[0];
          const fieldNames = Object.keys(firstRecord);
          
          typeAnalysis.fieldCount = fieldNames.length;
          typeAnalysis.fields = fieldNames;

          fieldNames.forEach(fieldName => {
            fieldAnalysis.allFields.add(fieldName);
            
            // Analyze field name patterns
            if (fieldName.includes(' ')) {
              fieldAnalysis.fieldPatterns.withSpaces.push(fieldName);
            }
            if (/[^a-zA-Z0-9\s]/.test(fieldName)) {
              fieldAnalysis.fieldPatterns.withSpecialChars.push(fieldName);
            }
            if (/^[a-z][a-zA-Z0-9]*$/.test(fieldName)) {
              fieldAnalysis.fieldPatterns.camelCase.push(fieldName);
            }
            if (/^[A-Z\s]+$/.test(fieldName)) {
              fieldAnalysis.fieldPatterns.allCaps.push(fieldName);
            }
            if (/\d/.test(fieldName)) {
              fieldAnalysis.fieldPatterns.numbers.push(fieldName);
            }

            // Analyze data types
            const value = firstRecord[fieldName];
            const valueType = value === null ? 'null' : 
                            Array.isArray(value) ? 'array' : 
                            typeof value;
            
            typeAnalysis.dataTypes[fieldName] = valueType;
            
            if (!fieldAnalysis.fieldTypes[fieldName]) {
              fieldAnalysis.fieldTypes[fieldName] = new Set();
            }
            fieldAnalysis.fieldTypes[fieldName].add(valueType);
          });
        }

        fieldAnalysis.dataTypeAnalysis[dataTypeName] = typeAnalysis;
        console.log(`   ✅ ${dataTypeName}: ${typeAnalysis.fieldCount} fields analyzed`);

      } catch (error) {
        console.log(`   ❌ ${dataTypeName}: Analysis error - ${error.message}`);
      }
    }

    // Convert Sets to Arrays for JSON serialization
    fieldAnalysis.allFields = Array.from(fieldAnalysis.allFields);
    Object.keys(fieldAnalysis.fieldTypes).forEach(field => {
      fieldAnalysis.fieldTypes[field] = Array.from(fieldAnalysis.fieldTypes[field]);
    });

    this.results.fieldAnalysis = fieldAnalysis;
    console.log(`   📊 Field analysis complete: ${fieldAnalysis.allFields.length} unique fields found\n`);
  }

  /**
   * Generate comprehensive documentation
   */
  async generateDocumentation() {
    console.log('6. Generating Documentation...');
    
    // Save complete discovery results
    const resultsFile = './BUBBLE-API-DISCOVERY-RESULTS.json';
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    
    console.log(`   ✅ Complete results saved to ${resultsFile}`);
    console.log(`   📁 Sample data files saved to ./samples/ directory`);
    console.log(`   📋 Ready for manual documentation creation\n`);
  }

  /**
   * Utility: Add delay for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run discovery if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const discovery = new BubbleAPIDiscovery();
  discovery.runDiscovery().catch(console.error);
}

export { BubbleAPIDiscovery };
