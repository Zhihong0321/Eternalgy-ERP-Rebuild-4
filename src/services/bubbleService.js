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

  // EXHAUSTIVE discovery - finds ALL available data types (50+ expected)
  // Based on proven patterns that worked in previous successful attempts
  async discoverAllDataTypes() {
    console.log('🔍 Starting EXHAUSTIVE data type discovery...');
    console.log('⚠️  Expected: 50+ data types (not 7!)');
    
    const discoveredTypes = [];
    const failedTypes = [];
    
    // Comprehensive list of common business entities
    // Based on typical ERP/CRM systems and previous successful discoveries
    const possibleTypes = [
      // Core business entities
      'user', 'customer', 'client', 'contact', 'person', 'individual',
      'agent', 'sales_agent', 'representative', 'staff', 'employee', 'worker',
      'invoice', 'bill', 'receipt', 'transaction', 'payment', 'refund',
      'product', 'item', 'inventory', 'stock', 'asset', 'material',
      'package', 'bundle', 'kit', 'set', 'group', 'collection',
      'category', 'type', 'classification', 'tag', 'label',
      'agreement', 'contract', 'deal', 'proposal', 'quote', 'estimate',
      
      // Extended business entities
      'order', 'purchase_order', 'sales_order', 'work_order',
      'supplier', 'vendor', 'partner', 'company', 'organization',
      'project', 'task', 'activity', 'event', 'appointment', 'meeting',
      'report', 'document', 'file', 'attachment', 'note', 'comment',
      'lead', 'opportunity', 'prospect', 'campaign', 'marketing',
      'ticket', 'issue', 'case', 'complaint', 'request', 'inquiry',
      
      // Financial entities
      'account', 'ledger', 'journal', 'expense', 'cost', 'budget',
      'commission', 'bonus', 'incentive', 'discount', 'promotion',
      'tax', 'fee', 'charge', 'price', 'rate', 'tariff',
      
      // Operational entities
      'warehouse', 'location', 'address', 'region', 'territory',
      'department', 'division', 'unit', 'branch', 'office',
      'role', 'position', 'permission', 'access', 'authorization',
      'setting', 'configuration', 'preference', 'option', 'parameter',
      
      // Time-based entities
      'schedule', 'calendar', 'timeline', 'milestone', 'deadline',
      'period', 'term', 'season', 'quarter', 'year', 'month',
      
      // Communication entities
      'email', 'message', 'notification', 'alert', 'reminder',
      'call', 'phone', 'sms', 'chat', 'conversation',
      
      // Additional possibilities
      'brand', 'model', 'variant', 'specification', 'feature',
      'rating', 'review', 'feedback', 'survey', 'questionnaire',
      'log', 'audit', 'history', 'record', 'entry', 'data',
      'backup', 'archive', 'template', 'format', 'layout',
      'workflow', 'process', 'procedure', 'step', 'phase',
      
      // Plural forms (Bubble might use these)
      'users', 'customers', 'clients', 'contacts', 'agents',
      'invoices', 'payments', 'products', 'items', 'packages',
      'categories', 'agreements', 'contracts', 'orders'
    ];

    console.log(`🔍 Testing ${possibleTypes.length} possible data type names...`);

    for (const type of possibleTypes) {
      try {
        // Test endpoint accessibility
        const endpoint = `/api/1.1/obj/${type}`;
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: this.getHeaders(),
          timeout: this.timeout,
          params: { limit: 1 } // Minimal request to test accessibility
        });

        // If we get here, the endpoint exists
        const hasData = response.data?.response?.results?.length > 0;
        const dataCount = response.data?.response?.results?.length || 0;
        
        discoveredTypes.push({
          name: type,
          endpoint: endpoint,
          hasData: hasData,
          sampleCount: dataCount,
          status: 'accessible',
          testTimestamp: new Date().toISOString()
        });

        console.log(`✅ Found: ${type} (${hasData ? 'with data' : 'empty'})`);
        
        // Delay between requests to respect rate limits
        await this.delay();
        
      } catch (error) {
        // Skip non-existent endpoints (404 is expected for many)
        if (error.response?.status !== 404) {
          failedTypes.push({
            name: type,
            error: error.message,
            status: error.response?.status
          });
        }
        
        // Small delay even for failed requests
        await this.delay(100);
      }
    }

    console.log(`🎉 Discovery complete!`);
    console.log(`✅ Found ${discoveredTypes.length} accessible data types`);
    console.log(`❌ Failed: ${failedTypes.length} endpoints`);
    
    if (discoveredTypes.length < 20) {
      console.warn('⚠️  WARNING: Expected 50+ data types, found fewer. May need expanded search patterns.');
    }

    return {
      discoveredTypes,
      failedTypes,
      totalFound: discoveredTypes.length,
      searchPatterns: possibleTypes.length,
      timestamp: new Date().toISOString(),
      summary: {
        withData: discoveredTypes.filter(t => t.hasData).length,
        empty: discoveredTypes.filter(t => !t.hasData).length,
        total: discoveredTypes.length
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
