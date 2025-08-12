# Frontend Integration Guide - ERP 2.0

**Eternalgy ERP Rebuild 4 - PostgreSQL-Based ERP System**  
**Updated**: 2025-08-12  
**Status**: ✅ Production-ready PostgreSQL API  

---

## 🎯 **CRITICAL ARCHITECTURE UNDERSTANDING**

### **ERP 2.0 Core Concept:**
1. **ERP 2.0 is PostgreSQL-based** - escape vendor lock from Bubble.io
2. **Data was copied from Bubble to PostgreSQL** during initial migration
3. **ERP operations work on LOCAL PostgreSQL data** - fast, reliable, cost-effective
4. **Bubble APIs are ONLY for data sync operations** (manual, controlled)

### **❌ WRONG Approach (ERP 1.0 style):**
```javascript
// DON'T DO THIS - Costs money, slow, vendor-locked
fetch('/api/bubble/fetch/agents') // ❌ Wrong!
```

### **✅ CORRECT Approach (ERP 2.0 style):**
```javascript
// DO THIS - Free, fast, local PostgreSQL
fetch('/api/database/data/agents') // ✅ Correct!
```

---

## 🌐 Base URL

**Production**: `https://eternalgy-erp-retry3-production.up.railway.app`  
**Local Development**: Not supported (Railway production only)

---

## 📊 **PRIMARY API ENDPOINTS (USE THESE FOR ERP)**

### 1. **Get All Database Tables**
**Endpoint**: `GET /api/database/tables`  
**Purpose**: Get list of all PostgreSQL tables with record counts  
**Use for**: Dashboard stats, table lists, navigation  

```javascript
// Get all available tables
fetch('/api/database/tables')
  .then(response => response.json())
  .then(data => {
    console.log(`Found ${data.tables.length} tables`);
    data.tables.forEach(table => {
      console.log(`${table.name}: ${table.recordCount} records`);
    });
  });
```

**Response**:
```json
{
  "success": true,
  "tables": [
    {
      "name": "agents",
      "tablename": "agents", 
      "recordCount": 150,
      "withData": true
    },
    {
      "name": "contacts",
      "tablename": "contacts",
      "recordCount": 245,
      "withData": true
    }
  ],
  "count": 60
}
```

### 2. **Get Table Data**
**Endpoint**: `GET /api/database/data/{tablename}`  
**Purpose**: Fetch actual records from PostgreSQL  
**Use for**: Data browsers, reports, dashboards  

**Query Parameters**:
- `limit` (optional): Number of records (default: 50)
- `offset` (optional): Skip records for pagination
- `search` (optional): Search term

```javascript
// Get agent records
fetch('/api/database/data/agents?limit=20&search=john')
  .then(response => response.json())
  .then(data => {
    console.log(`Found ${data.records.length} agents`);
    data.records.forEach(agent => {
      console.log(`${agent.name} - ${agent.email}`);
    });
  });
```

**Response**:
```json
{
  "success": true,
  "table": "agents",
  "records": [
    {
      "id": 1,
      "bubble_id": "1234567890abcdef",
      "name": "John Smith",
      "email": "john@example.com", 
      "commission_rate": 0.05,
      "created_date": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### 3. **Get Table Structure**
**Endpoint**: `GET /api/database/structure/{tablename}`  
**Purpose**: Get column information for a table  
**Use for**: Dynamic forms, table builders  

```javascript
// Get table structure
fetch('/api/database/structure/agents')
  .then(response => response.json())
  .then(data => {
    console.log(`Table ${data.table} has ${data.columns.length} columns`);
    data.columns.forEach(col => {
      console.log(`- ${col.name}: ${col.type}`);
    });
  });
```

### 4. **Health Check**
**Endpoint**: `GET /health`  
**Purpose**: Check system health and PostgreSQL connectivity  

```javascript
fetch('/health')
  .then(response => response.json())
  .then(data => {
    if (data.status === 'OK') {
      console.log('ERP system is healthy');
    }
  });
```

---

## 🔄 **SYNC OPERATIONS (DATA SYNC PAGE ONLY)**

**⚠️ WARNING**: These endpoints call Bubble.io API and **cost money**. Only use in Data Sync page when user explicitly wants to sync data.

### 1. **Test Bubble Connection** (Manual Only)
**Endpoint**: `GET /api/bubble/test-connection`  
**Use**: Only when user clicks "Test Connection" button  

```javascript
// Only call when user clicks test button!
const testConnection = async () => {
  const data = await fetch('/api/bubble/test-connection').then(r => r.json());
  console.log(data.success ? 'Connected' : 'Failed');
};
```

### 2. **Sync Single Table** (Manual Only)
**Endpoint**: `POST /api/sync/table/{tablename}?limit=3`  
**Use**: Only when user clicks "SYNC" button  

```javascript
// Only call when user clicks SYNC button!
const syncTable = async (tableName, limit = 3) => {
  const response = await fetch(`/api/sync/table/${tableName}?limit=${limit}`, {
    method: 'POST'
  });
  return response.json();
};
```

### 3. **Batch Sync All Tables** (Manual Only)
**Endpoint**: `POST /api/sync/batch?globalLimit=3`  
**Use**: Only when user clicks "Sync All Tables" button  

```javascript
// Only call when user clicks Sync All button!
const syncAll = async (limit = 3) => {
  const response = await fetch(`/api/sync/batch?globalLimit=${limit}`, {
    method: 'POST'
  });
  return response.json();
};
```

---

## 🏗️ **React Hook Implementation**

```javascript
import { useState } from 'react';

const useEternalgyAPI = () => {
  const baseURL = 'https://eternalgy-erp-retry3-production.up.railway.app';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleRequest = async (requestFn) => {
    setLoading(true);
    setError(null);
    try {
      const response = await requestFn();
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ✅ PRIMARY ERP FUNCTIONS (use these for all normal operations)
  const getDataTypes = () => handleRequest(() => 
    fetch(`${baseURL}/api/database/tables`).then(r => r.json())
  );
  
  const getData = (tableName, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return handleRequest(() => 
      fetch(`${baseURL}/api/database/data/${tableName}?${query}`).then(r => r.json())
    );
  };
  
  const getDataStructure = (tableName) => handleRequest(() =>
    fetch(`${baseURL}/api/database/structure/${tableName}`).then(r => r.json())
  );

  // ⚠️ SYNC FUNCTIONS (only use in Data Sync page, manual triggers only)
  const testBubbleConnection = () => handleRequest(() =>
    fetch(`${baseURL}/api/bubble/test-connection`).then(r => r.json())
  );
  
  const syncTable = (tableName, limit = 3) => handleRequest(() =>
    fetch(`${baseURL}/api/sync/table/${tableName}?limit=${limit}`, { method: 'POST' })
      .then(r => r.json())
  );
  
  const syncAllTables = (limit = 3) => handleRequest(() =>
    fetch(`${baseURL}/api/sync/batch?globalLimit=${limit}`, { method: 'POST' })
      .then(r => r.json())
  );

  return {
    // ✅ Use these for normal ERP operations
    getDataTypes,      // List all tables
    getData,          // Get table records  
    getDataStructure, // Get table columns
    
    // ⚠️ Use these ONLY in Data Sync page, manually triggered
    testBubbleConnection,
    syncTable,
    syncAllTables,
    
    // State
    loading,
    error
  };
};
```

---

## 📱 **Page Implementation Guidelines**

### ✅ **Dashboard Page - PostgreSQL Only**
```javascript
const Dashboard = () => {
  const { getDataTypes, getData } = useEternalgyAPI();
  
  useEffect(() => {
    // ✅ Load dashboard from PostgreSQL
    loadDashboardData();
  }, []);
  
  const loadDashboardData = async () => {
    const tables = await getDataTypes();
    const agentCount = await getData('agents', { limit: 1 });
    // Display stats from PostgreSQL
  };
};
```

### ✅ **Data Browser Page - PostgreSQL Only**
```javascript
const DataBrowser = () => {
  const { getDataTypes, getData, getDataStructure } = useEternalgyAPI();
  
  // ✅ All data comes from PostgreSQL
  const loadTableData = async (tableName) => {
    const records = await getData(tableName, { limit: 50 });
    const structure = await getDataStructure(tableName);
    // Display PostgreSQL data
  };
};
```

### ✅ **Data Sync Page - Mixed (PostgreSQL + Manual Sync)**
```javascript
const DataSync = () => {
  const { 
    getDataTypes,         // ✅ PostgreSQL tables
    testBubbleConnection, // ⚠️ Manual only
    syncTable,           // ⚠️ Manual only
    syncAllTables        // ⚠️ Manual only
  } = useEternalgyAPI();
  
  // ✅ Load page data from PostgreSQL
  useEffect(() => {
    loadPageData(); // Only calls getDataTypes
  }, []);
  
  // ⚠️ Only call sync when user clicks buttons
  const handleSyncTable = (tableName) => {
    // User clicked SYNC button
    syncTable(tableName, limit);
  };
};
```

---

## ❌ **Common Mistakes to Avoid**

### ❌ **Don't Auto-Call Bubble APIs**
```javascript
// ❌ NEVER DO THIS - Costs money on every page load
useEffect(() => {
  testBubbleConnection(); // ❌ Wrong!
  syncTable('agents');    // ❌ Wrong!
}, []);
```

### ❌ **Don't Use Bubble APIs for Normal ERP Operations**
```javascript
// ❌ Wrong - slow and costs money
const loadAgents = () => fetch('/api/bubble/fetch/agents');

// ✅ Correct - fast and free
const loadAgents = () => fetch('/api/database/data/agents');
```

### ❌ **Don't Mix Data Sources**
```javascript
// ❌ Wrong - mixing Bubble and PostgreSQL data
const agents = await fetch('/api/bubble/fetch/agents');
const contacts = await fetch('/api/database/data/contacts');

// ✅ Correct - consistent PostgreSQL data
const agents = await fetch('/api/database/data/agents');  
const contacts = await fetch('/api/database/data/contacts');
```

---

## 🎯 **Summary for Frontend Teams**

### **ERP 2.0 Philosophy:**
1. **PostgreSQL is your primary database** - fast, local, free
2. **Bubble APIs are for sync only** - expensive, slow, external  
3. **Users control sync operations** - manual, explicit, intentional
4. **ERP works offline** - no external dependencies for normal operations

### **API Usage Rules:**
- ✅ **Use `/api/database/*` for everything** (dashboard, browsers, reports)
- ⚠️ **Use `/api/sync/*` and `/api/bubble/*` only in Data Sync page**
- ❌ **Never auto-call Bubble APIs** on page load or timers
- ✅ **Cache PostgreSQL data** for better performance

### **Development Workflow:**
1. **Build feature using PostgreSQL APIs**
2. **Test with existing data** 
3. **Add sync controls only if needed** (in Data Sync page)
4. **Never assume Bubble data is fresh** - work with PostgreSQL

---

## 📞 Support

- **System Health**: `GET /health`
- **Repository**: `https://github.com/Zhihong0321/Eternalgy-ERP-Rebuild-4`
- **Architecture**: PostgreSQL-first, Bubble-sync-optional

---

**Last Updated**: 2025-08-12  
**Architecture**: ERP 2.0 - PostgreSQL Native  
**Status**: ✅ Production Ready