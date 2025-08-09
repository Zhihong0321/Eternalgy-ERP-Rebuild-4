import axios from 'axios';

export class BubbleService {
  constructor() {
    this.apiKey = process.env.BUBBLE_API_KEY;
    this.appName = process.env.BUBBLE_APP_NAME || 'eternalgy';
    this.baseUrl = process.env.BUBBLE_BASE_URL || `https://${this.appName}.bubbleapps.io`;
    
    if (!this.apiKey) {
      throw new Error('BUBBLE_API_KEY environment variable is required');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Test connection to Bubble API
   */
  async testConnection() {
    try {
      // Try to fetch a small sample from a common endpoint
      const response = await this.client.get('/api/1.1/obj/user', {
        params: { limit: 1 }
      });
      
      return {
        success: true,
        message: 'Bubble API connection successful',
        responseStatus: response.status
      };
    } catch (error) {
      return {
        success: false,
        message: 'Bubble API connection failed',
        error: error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Discover data types by testing common endpoints
   */
  async discoverDataTypes() {
    const commonTypes = [
      'user', 'customer', 'invoice', 'payment', 'agreement', 'agent', 
      'package', 'stock', 'commission', 'performance', 'item'
    ];
    
    const discoveredTypes = [];
    
    for (const type of commonTypes) {
      try {
        const response = await this.client.get(`/api/1.1/obj/${type}`, {
          params: { limit: 1 }
        });
        
        if (response.data && response.data.response) {
          discoveredTypes.push({
            name: type,
            endpoint: `/api/1.1/obj/${type}`,
            hasData: response.data.response.results?.length > 0
          });
        }
        
        // Rate limiting delay
        await this.delay(200);
        
      } catch (error) {
        // Endpoint doesn't exist or no access - skip it
        continue;
      }
    }
    
    return discoveredTypes;
  }

  /**
   * Fetch data from a specific data type
   */
  async fetchDataType(dataType, options = {}) {
    const { limit = 100, cursor = 0 } = options;
    
    try {
      const response = await this.client.get(`/api/1.1/obj/${dataType}`, {
        params: { 
          limit: Math.min(limit, 100), // Enforce max 100 per request
          cursor 
        }
      });
      
      if (!response.data || !response.data.response) {
        throw new Error(`Invalid response format from ${dataType} endpoint`);
      }
      
      return {
        success: true,
        data: response.data.response.results || [],
        cursor: response.data.response.cursor,
        hasMore: response.data.response.results?.length === limit
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Get sample records to understand field structure
   */
  async getSampleData(dataType, sampleSize = 3) {
    try {
      const result = await this.fetchDataType(dataType, { limit: sampleSize });
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result.data;
      
    } catch (error) {
      throw new Error(`Failed to get sample data for ${dataType}: ${error.message}`);
    }
  }

  /**
   * Utility: Add delay for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
