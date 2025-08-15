import express from 'express';
import BubbleService from '../services/bubbleService.js';
import SchemaGenerationService from '../services/schemaGenerationService.js';

const router = express.Router();
const schemaService = new SchemaGenerationService();

// Initialize Bubble service
let bubbleService;
try {
  bubbleService = new BubbleService();
} catch (error) {
  console.error('❌ Failed to initialize BubbleService:', error.message);
}

// Test API connection and verify key works
router.get('/test-connection', async (req, res) => {
  try {
    if (!bubbleService) {
      return res.status(500).json({
        success: false,
        error: 'BubbleService not initialized - check BUBBLE_API_KEY environment variable'
      });
    }

    const result = await bubbleService.testConnection();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Bubble API connection test successful',
        connection: result,
        timestamp: new Date().toISOString(),
        nextSteps: {
          discovery: 'GET /api/bubble/discover-types',
          fetchData: 'GET /api/bubble/fetch/{dataType}?limit=5'
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Bubble API connection test failed',
        error: result,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Connection test error',
      timestamp: new Date().toISOString()
    });
  }
});

// Discover ALL available data types (EXHAUSTIVE - 50+ expected)
router.get('/discover-types', async (req, res) => {
  try {
    if (!bubbleService) {
      return res.status(500).json({
        success: false,
        error: 'BubbleService not initialized'
      });
    }

    console.log('🔍 Starting dynamic discovery of ALL data types...');
    const startTime = Date.now();
    
    const discovery = await bubbleService.discoverAllDataTypes();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Log results for debugging
    console.log(`🎉 Discovery completed in ${duration}ms`);
    console.log(`✅ Found ${discovery.totalFound} data types`);
    console.log(`📊 With data: ${discovery.summary.withData}`);
    console.log(`📭 Empty: ${discovery.summary.empty}`);

    // Return comprehensive results
    res.json({
      success: true,
      message: `Dynamic discovery completed - found ${discovery.totalFound} data types`,
      discovery: {
        totalFound: discovery.totalFound,
        searchPatterns: discovery.searchPatterns,
        duration: `${duration}ms`,
        summary: discovery.summary,
        timestamp: discovery.timestamp
      },
      discoveredTypes: discovery.discoveredTypes,
      failedTypes: discovery.failedTypes.length > 0 ? discovery.failedTypes : undefined,
      warnings: discovery.totalFound < 20 ? [
        'Expected 50+ data types but found fewer',
        'May need expanded search patterns',
        'Check if API access is limited'
      ] : undefined,
      nextSteps: {
        fetchData: 'GET /api/bubble/fetch/{dataType}?limit=5',
        example: 'GET /api/bubble/fetch/invoice?limit=3'
      }
    });

  } catch (error) {
    console.error('❌ Discovery failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Data type discovery failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Fetch specific data type with configurable limit
router.get('/fetch/:dataType', async (req, res) => {
  try {
    if (!bubbleService) {
      return res.status(500).json({
        success: false,
        error: 'BubbleService not initialized'
      });
    }

    const { dataType } = req.params;
    const { limit = 5, cursor = 0 } = req.query;
    
    // Validate parameters
    const numLimit = Math.max(1, Math.min(parseInt(limit) || 5, 100)); // Max 100 (Bubble limit)
    const numCursor = Math.max(0, parseInt(cursor) || 0);

    console.log(`📥 Fetching ${dataType} data...`);
    const startTime = Date.now();

    const result = await bubbleService.fetchDataType(dataType, {
      limit: numLimit,
      cursor: numCursor
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (result.success) {
      // Log success for debugging
      console.log(`✅ Fetched ${result.count} ${dataType} records in ${duration}ms`);
      console.log(`📊 Fields found: ${result.fieldAnalysis.fieldCount}`);

      res.json({
        success: true,
        message: `Successfully fetched ${result.count} ${dataType} records`,
        dataType: result.dataType,
        count: result.count,
        duration: `${duration}ms`,
        pagination: result.pagination,
        fieldAnalysis: result.fieldAnalysis,
        records: result.records,
        timestamp: result.timestamp,
        nextSteps: result.pagination.hasMore ? {
          nextPage: `GET /api/bubble/fetch/${dataType}?limit=${numLimit}&cursor=${result.pagination.cursor + numLimit}`,
          allData: `GET /api/bubble/fetch/${dataType}?limit=999999`
        } : undefined
      });
    } else {
      // Log error for debugging
      console.error(`❌ Failed to fetch ${dataType}:`, result.error);
      
      res.status(result.status || 500).json({
        success: false,
        message: `Failed to fetch ${dataType} data`,
        dataType: result.dataType,
        error: result.error,
        status: result.status,
        duration: `${duration}ms`,
        timestamp: result.timestamp,
        suggestions: [
          'Check if data type name is correct',
          'Verify data type exists in discovery results: GET /api/bubble/discover-types',
          'Check Bubble API permissions'
        ]
      });
    }

  } catch (error) {
    console.error('❌ Fetch request failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Data fetch request failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Get summary of available operations
router.get('/', (req, res) => {
  res.json({
    name: 'Bubble Data API',
    description: 'Dynamic discovery and fetching of Bubble.io data types',
    version: '1.0.0',
    warning: 'User has 50+ data types - discovery is exhaustive and dynamic',
    endpoints: {
      testConnection: {
        method: 'GET',
        path: '/api/bubble/test-connection',
        description: 'Test Bubble API connection and verify key'
      },
      discoverTypes: {
        method: 'GET', 
        path: '/api/bubble/discover-types',
        description: 'Discover ALL available data types (50+ expected)',
        note: 'This is exhaustive and takes time - tests hundreds of possibilities'
      },
      fetchData: {
        method: 'GET',
        path: '/api/bubble/fetch/{dataType}?limit=5&cursor=0',
        description: 'Fetch specific data type with configurable limits',
        parameters: {
          dataType: 'Name of the data type to fetch',
          limit: 'Number of records (1-100, default: 5)',
          cursor: 'Pagination cursor (default: 0)'
        },
        examples: [
          '/api/bubble/fetch/invoice?limit=3',
          '/api/bubble/fetch/user?limit=10&cursor=0',
          '/api/bubble/fetch/product?limit=999999'
        ]
      },
      generateSchema: {
        method: 'POST',
        path: '/api/bubble/generate-schema',
        description: 'Generate and apply Prisma schema from discovered data types',
        critical: 'This creates database tables - use carefully',
        ready: true
      },
      previewSchema: {
        method: 'POST',
        path: '/api/bubble/preview-schema',
        description: 'Generate schema preview without applying to database',
        safe: 'Preview only - no database changes',
        ready: true
      },
      analyzeType: {
        method: 'GET',
        path: '/api/bubble/analyze/{dataType}?samples=5',
        description: 'Analyze specific data type structure in detail',
        parameters: {
          dataType: 'Name of the data type to analyze',
          samples: 'Number of sample records to analyze (1-20, default: 5)'
        },
        ready: true
      }
    },
    environment: {
      bubbleApiKey: process.env.BUBBLE_API_KEY ? 'Set ✅' : 'Missing ❌',
      bubbleBaseUrl: process.env.BUBBLE_BASE_URL || 'Using default',
      serviceStatus: bubbleService ? 'Initialized ✅' : 'Failed ❌'
    }
  });
});

// SCHEMA GENERATION ENDPOINTS
// These endpoints handle the critical schema generation process

// Simple test endpoint to verify schema service deployment
router.get('/schema-test', (req, res) => {
  res.json({
    success: true,
    message: 'Schema generation service endpoints are deployed',
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      test: 'GET /api/bubble/schema-test',
      analyze: 'GET /api/bubble/analyze/{dataType}',
      preview: 'POST /api/bubble/preview-schema',
      generate: 'POST /api/bubble/generate-schema'
    },
    schemaServiceLoaded: schemaService ? true : false
  });
});

// Generate Prisma schema from discovered data types
router.post('/generate-schema', async (req, res) => {
  try {
    console.log('🏗️  Starting schema generation process...');
    const startTime = Date.now();

    const result = await schemaService.generateAndApplySchema();
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`🎉 Schema generation completed in ${(duration / 1000).toFixed(2)}s`);

    res.json({
      success: true,
      message: 'Prisma schema generated and applied successfully',
      duration: `${(duration / 1000).toFixed(2)}s`,
      summary: result.summary,
      generation: {
        totalTypes: result.generation.results.totalTypes,
        processedTypes: result.generation.results.processedTypes,
        typesWithData: result.generation.results.typesWithData,
        typesEmpty: result.generation.results.typesEmpty,
        errors: result.generation.results.errors
      },
      application: {
        success: result.application.success,
        timestamp: result.application.timestamp
      },
      timestamp: new Date().toISOString(),
      nextSteps: {
        viewSchema: 'Check prisma/schema.prisma file',
        testDatabase: 'Database tables created and ready',
        startSync: 'Ready for data synchronization'
      }
    });

  } catch (error) {
    console.error('❌ Schema generation failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Schema generation failed',
      timestamp: new Date().toISOString(),
      troubleshooting: [
        'Check Bubble API connection',
        'Verify database connection',
        'Check Prisma configuration',
        'Review error logs above'
      ]
    });
  }
});

// Generate schema preview without applying to database
router.post('/preview-schema', async (req, res) => {
  try {
    console.log('👀 Generating schema preview...');
    const startTime = Date.now();

    const result = await schemaService.generateCompleteSchema();
    const endTime = Date.now();
    const duration = endTime - startTime;

    res.json({
      success: true,
      message: 'Schema preview generated successfully',
      duration: `${(duration / 1000).toFixed(2)}s`,
      results: result.results,
      schema: result.schema,
      models: result.results.models,
      timestamp: result.timestamp,
      actions: {
        applySchema: 'POST /api/bubble/generate-schema',
        downloadSchema: 'Copy schema content from response'
      }
    });

  } catch (error) {
    console.error('❌ Schema preview failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Schema preview failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Analyze specific data type structure in detail
router.get('/analyze/:dataType', async (req, res) => {
  try {
    const { dataType } = req.params;
    const { samples = 5 } = req.query;
    const sampleSize = Math.max(1, Math.min(parseInt(samples) || 5, 20));

    console.log(`🔍 Analyzing ${dataType} structure with ${sampleSize} samples...`);
    
    const analysis = await schemaService.analyzeDataTypeStructure(dataType, sampleSize);
    const modelPreview = schemaService.generateModelDefinition(dataType, analysis);

    res.json({
      success: true,
      message: `Structure analysis complete for ${dataType}`,
      dataType,
      analysis: {
        hasData: analysis.hasData,
        sampleCount: analysis.sampleCount,
        fieldCount: Object.keys(analysis.fields).length,
        totalAvailable: analysis.totalAvailable || 0
      },
      fields: analysis.fields,
      examples: analysis.examples,
      modelPreview: {
        modelName: modelPreview.modelName,
        tableName: modelPreview.tableName,
        definition: modelPreview.definition
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Analysis failed for ${req.params.dataType}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: `Structure analysis failed for ${req.params.dataType}`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Scan total record count for specific data type
 * GET /api/bubble/scan/{dataType}
 * 
 * Returns total record count with minimal API cost (1 API call, 1 record)
 */
router.get('/scan/:dataType', async (req, res) => {
  const { dataType } = req.params;

  try {
    console.log(`🔍 SCAN requested for data type: ${dataType}`);
    
    if (!bubbleService) {
      return res.status(500).json({
        success: false,
        error: 'BubbleService not initialized'
      });
    }
    
    const result = await bubbleService.scanRecordCount(dataType);

    if (result.success) {
      res.json({
        success: true,
        endpoint: 'bubble_scan',
        dataType: dataType,
        totalRecords: result.totalRecords,
        scanDetails: result.scanDetails,
        apiCost: result.apiCost,
        message: `✅ SCAN complete: ${dataType} has ${result.totalRecords} total records`,
        timestamp: result.timestamp
      });
    } else {
      res.status(400).json({
        success: false,
        endpoint: 'bubble_scan',
        dataType: dataType,
        error: result.error,
        message: `❌ SCAN failed for ${dataType}`,
        timestamp: result.timestamp
      });
    }

  } catch (error) {
    console.error(`❌ SCAN error for ${dataType}:`, error.message);
    
    res.status(500).json({
      success: false,
      endpoint: 'bubble_scan',
      dataType: dataType,
      error: error.message,
      message: `❌ SCAN failed for ${dataType}`,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
