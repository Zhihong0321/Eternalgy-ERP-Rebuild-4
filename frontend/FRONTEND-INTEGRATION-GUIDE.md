# Frontend Integration Guide

**Eternalgy ERP Rebuild 4 - API Integration**  
**Generated**: 2025-08-11  
**Status**: ✅ All endpoints operational and tested  

---

## 🌐 Base URL

**Production**: `https://eternalgy-erp-retry3-production.up.railway.app`  
**Local Development**: Not supported (Railway production only)

---

## 📋 Available API Endpoints

### 1. Service Information
**Endpoint**: `GET /`  
**Purpose**: Get basic service information and status  
**Authentication**: None required  

```javascript
// Example usage
fetch('https://eternalgy-erp-retry3-production.up.railway.app/')
  .then(response => response.json())
  .then(data => console.log(data));
```

**Response**:
```json
{
  "service": "Eternalgy ERP Sync Service",
  "version": "1.0.0",
  "status": "operational",
  "timestamp": "2025-08-11T14:15:39Z"
}
```

### 2. Health Check
**Endpoint**: `GET /health`  
**Purpose**: Check service health and database connectivity  
**Authentication**: None required  

```javascript
// Example usage
fetch('https://eternalgy-erp-retry3-production.up.railway.app/health')
  .then(response => response.json())
  .then(data => {
    if (data.status === 'healthy') {
      console.log('Service is operational');
    }
  });
```

**Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-08-11T14:15:39Z",
  "uptime": "2h 30m"
}
```

### 3. Test Bubble API Connection
**Endpoint**: `GET /api/test-connection`  
**Purpose**: Test connectivity to Bubble.io API  
**Authentication**: None required (uses server-side API key)  

```javascript
// Example usage
fetch('https://eternalgy-erp-retry3-production.up.railway.app/api/test-connection')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Bubble API connected successfully');
    }
  });
```

**Response**:
```json
{
  "success": true,
  "message": "Bubble API connection successful",
  "app_name": "eternalgy",
  "timestamp": "2025-08-11T14:15:39Z"
}
```

### 4. Discover Data Types
**Endpoint**: `GET /api/discover-types`  
**Purpose**: Discover all available data types from Bubble.io  
**Authentication**: None required  

```javascript
// Example usage
fetch('https://eternalgy-erp-retry3-production.up.railway.app/api/discover-types')
  .then(response => response.json())
  .then(data => {
    console.log(`Found ${data.dataTypes.length} data types`);
    data.dataTypes.forEach(type => {
      console.log(`- ${type.name}: ${type.fields.length} fields`);
    });
  });
```

**Response**:
```json
{
  "success": true,
  "dataTypes": [
    {
      "name": "agents",
      "fields": [
        {"name": "Name", "type": "text"},
        {"name": "Email", "type": "text"},
        {"name": "Commission Rate", "type": "number"}
      ]
    },
    {
      "name": "contacts",
      "fields": [
        {"name": "Full Name", "type": "text"},
        {"name": "Company", "type": "text"},
        {"name": "Phone", "type": "text"}
      ]
    }
  ],
  "total": 50,
  "timestamp": "2025-08-11T14:15:39Z"
}
```

### 5. Fetch Data from Bubble
**Endpoint**: `GET /api/fetch/:dataType`  
**Purpose**: Fetch actual data records from a specific Bubble data type  
**Authentication**: None required  

**Parameters**:
- `dataType` (path parameter): Name of the data type to fetch
- `limit` (query parameter, optional): Number of records to fetch (default: 100)
- `cursor` (query parameter, optional): Pagination cursor

```javascript
// Example usage
fetch('https://eternalgy-erp-retry3-production.up.railway.app/api/fetch/agents?limit=50')
  .then(response => response.json())
  .then(data => {
    console.log(`Fetched ${data.records.length} agent records`);
    data.records.forEach(agent => {
      console.log(`Agent: ${agent.Name} - ${agent.Email}`);
    });
  });
```

**Response**:
```json
{
  "success": true,
  "dataType": "agents",
  "records": [
    {
      "_id": "1234567890abcdef",
      "Name": "John Smith",
      "Email": "john@example.com",
      "Commission Rate": 0.05,
      "Created Date": "2025-01-15T10:30:00Z",
      "Modified Date": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 1,
  "hasMore": false,
  "cursor": null,
  "timestamp": "2025-08-11T14:15:39Z"
}
```

### 6. Analyze Data Structure
**Endpoint**: `GET /api/analyze/:dataType`  
**Purpose**: Analyze the structure and patterns of a specific data type  
**Authentication**: None required  

**Parameters**:
- `dataType` (path parameter): Name of the data type to analyze

```javascript
// Example usage
fetch('https://eternalgy-erp-retry3-production.up.railway.app/api/analyze/products')
  .then(response => response.json())
  .then(data => {
    console.log(`Analysis for ${data.dataType}:`);
    console.log(`- ${data.totalRecords} total records`);
    console.log(`- ${data.fieldAnalysis.length} fields analyzed`);
  });
```

**Response**:
```json
{
  "success": true,
  "dataType": "products",
  "totalRecords": 150,
  "fieldAnalysis": [
    {
      "fieldName": "Product Name",
      "dataType": "text",
      "nullCount": 0,
      "uniqueValues": 150,
      "avgLength": 25
    },
    {
      "fieldName": "Price",
      "dataType": "number",
      "nullCount": 5,
      "minValue": 10.99,
      "maxValue": 999.99,
      "avgValue": 156.78
    }
  ],
  "recommendations": [
    "Consider adding validation for Price field (5 null values found)",
    "Product Name field has good data quality (no nulls)"
  ],
  "timestamp": "2025-08-11T14:15:39Z"
}
```

### 7. Generate Prisma Schema
**Endpoint**: `POST /api/generate-schema`  
**Purpose**: Generate Prisma schema from discovered Bubble data types  
**Authentication**: None required  

**Request Body**:
```json
{
  "dataTypes": ["agents", "contacts", "products"],
  "options": {
    "includeRelations": true,
    "generateIndexes": true
  }
}
```

```javascript
// Example usage
fetch('https://eternalgy-erp-retry3-production.up.railway.app/api/generate-schema', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    dataTypes: ['agents', 'contacts', 'products'],
    options: {
      includeRelations: true,
      generateIndexes: true
    }
  })
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Schema generated successfully');
    console.log(data.schema);
  }
});
```

**Response**:
```json
{
  "success": true,
  "schema": "// Prisma schema content here...",
  "tablesGenerated": 3,
  "fieldsGenerated": 30,
  "timestamp": "2025-08-11T14:15:39Z"
}
```

---

## 🔧 Frontend Implementation Examples

### React Hook for API Calls

```javascript
import { useState, useEffect } from 'react';

const useEternalgyAPI = () => {
  const baseURL = 'https://eternalgy-erp-retry3-production.up.railway.app';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const apiCall = async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };
  
  return { apiCall, loading, error };
};

// Usage example
const DataComponent = () => {
  const { apiCall, loading, error } = useEternalgyAPI();
  const [agents, setAgents] = useState([]);
  
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const data = await apiCall('/api/fetch/agents?limit=10');
        setAgents(data.records);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      }
    };
    
    fetchAgents();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      {agents.map(agent => (
        <div key={agent._id}>
          {agent.Name} - {agent.Email}
        </div>
      ))}
    </div>
  );
};
```

### Vue.js Composable

```javascript
import { ref, reactive } from 'vue';

export function useEternalgyAPI() {
  const baseURL = 'https://eternalgy-erp-retry3-production.up.railway.app';
  const loading = ref(false);
  const error = ref(null);
  
  const apiCall = async (endpoint, options = {}) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await fetch(`${baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      loading.value = false;
      return data;
    } catch (err) {
      error.value = err.message;
      loading.value = false;
      throw err;
    }
  };
  
  return {
    apiCall,
    loading: readonly(loading),
    error: readonly(error)
  };
}
```

---

## 🚨 Error Handling

### Common Error Responses

```json
{
  "success": false,
  "error": "Data type 'invalid_type' not found",
  "code": "DATA_TYPE_NOT_FOUND",
  "timestamp": "2025-08-11T14:15:39Z"
}
```

### Error Codes
- `BUBBLE_API_ERROR`: Issue with Bubble.io API connection
- `DATA_TYPE_NOT_FOUND`: Requested data type doesn't exist
- `INVALID_PARAMETERS`: Invalid request parameters
- `DATABASE_ERROR`: Database connectivity issue
- `RATE_LIMIT_EXCEEDED`: Too many requests

### Frontend Error Handling

```javascript
const handleAPIError = (error, response) => {
  switch (response?.code) {
    case 'BUBBLE_API_ERROR':
      showNotification('Unable to connect to Bubble.io', 'error');
      break;
    case 'DATA_TYPE_NOT_FOUND':
      showNotification('Requested data not found', 'warning');
      break;
    case 'RATE_LIMIT_EXCEEDED':
      showNotification('Too many requests. Please wait.', 'info');
      break;
    default:
      showNotification('An unexpected error occurred', 'error');
  }
};
```

---

## 📊 Data Models

### Current Database Tables

1. **agents** (10 columns)
   - Primary fields: Name, Email, Commission Rate
   - Metadata: territories (JSON), created/modified dates

2. **contacts** (10 columns)
   - Primary fields: Full Name, Company, Phone
   - Metadata: priority (JSON), created/modified dates

3. **products** (10 columns)
   - Primary fields: Product Name, Price, Category
   - Metadata: warranty (JSON), created/modified dates

4. **sync_status** (System table)
   - Tracks sync operations for each data type

5. **synced_records** (System table)
   - Manages individual record sync status

---

## 🔐 Security Notes

- All API endpoints are public (no authentication required)
- Bubble API key is managed server-side
- CORS is configured for frontend access
- Rate limiting is implemented
- All data is read-only from frontend perspective

---

## 🚀 Getting Started

1. **Test connectivity**: Start with `GET /health`
2. **Discover data**: Use `GET /api/discover-types`
3. **Fetch sample data**: Try `GET /api/fetch/agents?limit=5`
4. **Implement in your app**: Use the provided React/Vue examples
5. **Handle errors**: Implement proper error handling

---

## 📞 Support

- **API Status**: Check `/health` endpoint
- **Documentation**: This guide + `DEPLOYMENT-STATUS.md`
- **Repository**: `https://github.com/Zhihong0321/Eternalgy-ERP-Rebuild-4`
- **Production URL**: `https://eternalgy-erp-retry3-production.up.railway.app`

---

**Last Updated**: 2025-08-11  
**API Version**: 1.0.0  
**Status**: ✅ All endpoints operational and tested