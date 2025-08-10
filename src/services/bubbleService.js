import axios from 'axios';

// ⚠️ WARNING: User has 50+ data types in Bubble system
// ⚠️ NEVER hardcode data type lists or counts
// ⚠️ Previous restart #24 failed due to hardcoding 7 types
// ⚠️ ALWAYS discover dynamically to prevent viral mindset

class BubbleService {
  constructor() {
    this.baseUrl = process.env.BUBBLE_BASE_URL || 'https://eternalgy.bubbleapps.io';
    this.apiKey = process.env.BUBBLE_API_KEY;
    this.timeout = 30000; // Proven working timeout from reference docs
    this.requestDelay = 300; // 300ms delay between requests (tested and working)
    
    if (!this.apiKey) {
      throw new Error('BUBBLE_API_KEY environment variable is required');
    }
  }

  // Proven header pattern from reference documents
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // Add delay between requests to respect rate limits (proven pattern)
  async delay(ms = this.requestDelay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test API connection and verify key works
  async testConnection() {
    try {
      // Test with a known endpoint pattern from reference docs
      const response = await axios.get(`${this.baseUrl}/api/1.1/obj/user`, {
        headers: this.getHeaders(),
        timeout: this.timeout,
        params: { limit: 1 } // Minimal test request
      });

      return {
        success: true,
        status: response.status,
        message: 'Bubble API connection successful',
        apiKey: this.apiKey?.substring(0, 8) + '...', // Partial key for verification
        baseUrl: this.baseUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        message: 'Bubble API connection failed'
      };
    }
  }

  // PROPER discovery using Bubble's meta endpoint - finds ALL available data types
  // This is the correct method that previous successful attempts used
  async discoverAllDataTypes() {
    console.log('🔍 Starting PROPER data type discovery using /api/1.1/meta...');
    console.log('✅ Using official Bubble meta endpoint (not brute force)');
    
    const discoveredTypes = [];
    const failedTypes = [];
    let allDataTypeNames = [];

    try {
      // Step 1: Get the complete list of data types from meta endpoint
      console.log('📡 Fetching meta information from Bubble...');
      const metaResponse = await axios.get(`${this.baseUrl}/api/1.1/meta`, {
        headers: this.getHeaders(),
        timeout: this.timeout
      });

      // Extract data type names from the "get" array
      allDataTypeNames = metaResponse.data?.get || [];
      console.log(`📋 Found ${allDataTypeNames.length} data types in meta endpoint`);
      console.log('🎯 Sample types:', allDataTypeNames.slice(0, 10).join(', '), '...');

      if (allDataTypeNames.length === 0) {
        throw new Error('Meta endpoint returned no data types');
      }

    } catch (error) {
      console.error('❌ Failed to fetch meta endpoint:', error.message);
      return {
        discoveredTypes: [],
        failedTypes: [{ name: 'meta-endpoint', error: error.message, status: error.response?.status }],
        totalFound: 0,
        searchMethod: 'meta-endpoint-failed',
        timestamp: new Date().toISOString(),
        summary: { withData: 0, empty: 0, total: 0 }
      };
    }

    // Step 2: Test each data type for accessibility and data
    console.log(`🔍 Testing accessibility of ${allDataTypeNames.length} discovered data types...`);
    
    for (const typeName of allDataTypeNames) {
      try {
        const endpoint = `/api/1.1/obj/${typeName}`;
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: this.getHeaders(),
          timeout: this.timeout,
          params: { limit: 1 } // Minimal request to test accessibility
        });

        // If we get here, the endpoint exists and is accessible
        const hasData = response.data?.response?.results?.length > 0;
        const dataCount = response.data?.response?.results?.length || 0;
        
        discoveredTypes.push({
          name: typeName,
          endpoint: endpoint,
          hasData: hasData,
          sampleCount: dataCount,
          status: 'accessible',
          testTimestamp: new Date().toISOString()
        });

        console.log(`✅ ${typeName}: ${hasData ? 'has data' : 'empty'}`);
        
        // Delay between requests to respect rate limits
        await this.delay();
        
      } catch (error) {
        failedTypes.push({
          name: typeName,
          error: error.message,
          status: error.response?.status,
          endpoint: `/api/1.1/obj/${typeName}`
        });
        
        console.log(`❌ ${typeName}: ${error.response?.status || 'error'}`);
        
        // Small delay even for failed requests
        await this.delay(100);
      }
    }

    console.log(`🎉 Discovery complete using PROPER meta endpoint!`);
    console.log(`✅ Found ${discoveredTypes.length} accessible data types`);
    console.log(`❌ Failed: ${failedTypes.length} endpoints`);
    console.log(`📊 Success rate: ${Math.round((discoveredTypes.length / allDataTypeNames.length) * 100)}%`);

    return {
      discoveredTypes,
      failedTypes,
      totalFound: discoveredTypes.length,
      searchMethod: 'meta-endpoint',
      metaTypesCount: allDataTypeNames.length,
      timestamp: new Date().toISOString(),
      summary: {
        withData: discoveredTypes.filter(t => t.hasData).length,
        empty: discoveredTypes.filter(t => !t.hasData).length,
        total: discoveredTypes.length,
        failed: failedTypes.length
      }
    };
  }

  // Fetch specific data type with configurable limits
  async fetchDataType(dataType, options = {}) {
    const {
      limit = 5,           // Default to small sample for testing
      cursor = 0,          // Cursor-based pagination
      includeEmpty = false // Whether to include empty fields
    } = options;

    // Validate limit (Bubble enforces max 100 per request)
    const maxLimit = Math.min(limit, 100);
    
    console.log(`📥 Fetching ${dataType} data (limit: ${maxLimit})...`);

    try {
      const endpoint = `/api/1.1/obj/${dataType}`;
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: this.getHeaders(),
        timeout: this.timeout,
        params: {
          limit: maxLimit,
          cursor: cursor
        }
      });

      const results = response.data?.response?.results || [];
      const remaining = response.data?.response?.remaining || 0;
      const currentCursor = response.data?.response?.cursor || 0;

      // Analyze field patterns (useful for schema generation later)
      const fieldAnalysis = this.analyzeFields(results);

      return {
        success: true,
        dataType,
        records: results,
        count: results.length,
        pagination: {
          cursor: currentCursor,
          remaining,
          hasMore: remaining > 0,
          limit: maxLimit
        },
        fieldAnalysis,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        dataType,
        error: error.message,
        status: error.response?.status,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Analyze field patterns in fetched data (helper method)
  analyzeFields(records) {
    if (!records || records.length === 0) {
      return { fieldCount: 0, fields: [], dataTypes: {} };
    }

    const allFields = new Set();
    const fieldTypes = {};

    records.forEach(record => {
      Object.keys(record).forEach(field => {
        allFields.add(field);
        
        const value = record[field];
        const type = Array.isArray(value) ? 'array' : 
                    value === null ? 'null' :
                    typeof value;
        
        if (!fieldTypes[field]) {
          fieldTypes[field] = new Set();
        }
        fieldTypes[field].add(type);
      });
    });

    // Convert Sets to arrays for JSON serialization
    const cleanFieldTypes = {};
    Object.keys(fieldTypes).forEach(field => {
      cleanFieldTypes[field] = Array.from(fieldTypes[field]);
    });

    return {
      fieldCount: allFields.size,
      fields: Array.from(allFields),
      dataTypes: cleanFieldTypes,
      recordCount: records.length
    };
  }
}

export default BubbleService;
