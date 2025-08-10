import express from 'express';
import BubbleService from '../services/bubbleService.js';

const router = express.Router();

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
      }
    },
    environment: {
      bubbleApiKey: process.env.BUBBLE_API_KEY ? 'Set ✅' : 'Missing ❌',
      bubbleBaseUrl: process.env.BUBBLE_BASE_URL || 'Using default',
      serviceStatus: bubbleService ? 'Initialized ✅' : 'Failed ❌'
    }
  });
});

export default router;
