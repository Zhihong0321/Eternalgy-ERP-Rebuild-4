# PROJECT SPEC: BUBBLE.IO TO ERP 2.0 SYNC SYSTEM

## 🎯 **ULTIMATE GOAL**
Sync ALL data types from Bubble.io to PostgreSQL database with 100% reliability.

---

## 🚨 **CRITICAL LESSONS FROM 7-DAY FAILURE**

### ❌ **WHAT WENT WRONG:**
1. **Over-engineering**: Built complex field mapping services instead of using Prisma's built-in capabilities
2. **Multiple transformations**: Created redundant field name transformations (SimpleFieldMapping + Prisma)
3. **Feature creep**: Added "collision resistance" for a problem that didn't exist
4. **No clear requirements**: Started coding without understanding the real problem
5. **Breaking working code**: Each "improvement" broke existing functionality

### ✅ **WHAT TO AVOID:**
- **NO custom field mapping services**
- **NO middleware between Bubble data and Prisma**
- **NO "collision-resistant" naming schemes**
- **NO building solutions before understanding the problem**
- **NO localhost testing (production deployment only)**

---

## 📋 **PROJECT REQUIREMENTS**

### **Core Functionality:**
1. **Step 1**: Discover Bubble.io data types → Generate Prisma schema → Create empty tables
2. **Step 2**: Fetch Bubble.io data → Store in PostgreSQL tables

### **Success Criteria:**
- ✅ All discovered Bubble data types become PostgreSQL tables
- ✅ All records from Bubble sync to corresponding tables
- ✅ Field names are database-compatible
- ✅ System works reliably without manual intervention

---

## 🏗️ **ARCHITECTURE PRINCIPLES**

### **ULTRA-SIMPLE APPROACH:**
```
Bubble.io API → Prisma Schema → PostgreSQL Database
```

**NO INTERMEDIATE LAYERS. NO TRANSFORMATIONS. PRISMA HANDLES EVERYTHING.**

### **One Service Rule:**
- **One file**: `bubbleSyncService.js`
- **One responsibility**: Sync Bubble to Database
- **One transformation layer**: Prisma only

---

## 📄 **BUBBLE.IO API DOCUMENTATION**

### **Current Working Implementation:**
The existing codebase successfully handles Bubble.io API connectivity:

#### **Data Type Discovery:**
```javascript
// This part works correctly in current system
const bubbleService = new BubbleService();
const discoveredTypes = await bubbleService.discoverDataTypes();
// Returns: [{ name: 'customer', endpoint: '/api/1.1/obj/customer', fields: [...] }]
```

#### **Data Fetching:**
```javascript
// This also works correctly
const data = await bubbleService.fetchDataType('customer', { limit: 100 });
// Returns: Array of records with original Bubble field names
```

### **Bubble.io API Structure:**
- **Base URL**: `https://your-app.bubbleapps.io`
- **Authentication**: API Key in headers
- **Discovery**: Works by checking known endpoints
- **Data Format**: JSON with original field names like "Customer Name", "Contact Email"

### **CRITICAL API LIMITATIONS & CONSTRAINTS:**

#### **Rate Limiting:**
- **Concurrent requests**: Bubble.io has strict rate limits
- **Batch processing**: Must implement delays between requests
- **Recommended**: Process one data type at a time, not parallel

#### **Data Fetching Constraints:**
- **Pagination**: Large datasets require cursor-based pagination
- **Timeout issues**: Long-running requests may timeout
- **Sample size**: Use small samples (3 records) for structure discovery
- **Full sync**: Fetch data in manageable chunks, not all at once

#### **API Response Patterns:**
- **Empty data types**: Some endpoints return valid structure but no data
- **Field inconsistency**: Same field may have different types across records
- **Null values**: Many fields will be null/undefined in responses
- **Date formats**: Bubble dates come as ISO strings, need parsing

#### **Authentication & Access:**
- **API key expiration**: Keys may expire, causing sudden failures
- **Permission changes**: Access to data types can change in Bubble app
- **Network issues**: Railway deployment may have connection timeouts

#### **Discovered Data Patterns:**
- **Mandatory limiters**: Current system enforces max 15-100 records per request
- **Test mode**: System has built-in test mode for development
- **API endpoints**: Use `/obj/{dataType}` pattern for data access
- **Cursor pagination**: Use `cursor` and `limit` parameters
- **Response structure**: `response.results` contains the actual data array

---

## 🔧 **ENVIRONMENT & DEPLOYMENT**

### **Required Environment Variables:**
```bash
# Bubble.io Configuration (CRITICAL)
BUBBLE_API_KEY=your_bubble_api_key_here
BUBBLE_APP_NAME=eternalgy
BUBBLE_BASE_URL=https://eternalgy.bubbleapps.io  # Optional override

# Database (Railway provides automatically)
DATABASE_URL=postgresql://username:password@host:port/database

# Application
NODE_ENV=production
PORT=3000
```

### **Railway Deployment:**
- **Platform**: Railway.app hosting
- **Database**: PostgreSQL provided by Railway
- **Build**: Automatic with `npm run build`
- **Start**: `npm start` runs `src/server.js`
- **Dependencies**: Prisma, Express, Axios core stack

### **Prisma Commands:**
```bash
npx prisma db push          # Apply schema to database
npx prisma generate         # Generate Prisma client
npx prisma studio          # Database GUI (for debugging)
```

---

## 📄 **TECHNICAL SPECIFICATIONS**

### **Field Naming Strategy:**
```javascript
// Let Prisma handle field naming automatically
// Bubble: "Customer Name" 
// Prisma: customerName (field name)
// Database: customer_name (via @map())
```

### **Data Types:**
- **Default**: All fields as `String?` (nullable)
- **Special cases**: Numbers → `Float?`, Booleans → `Boolean?`
- **Objects/Arrays**: Store as JSON strings

### **Schema Template:**
```prisma
model Customer {
  id        String   @id @default(cuid())
  bubbleId  String   @unique @map("bubble_id")
  
  // Auto-generated fields from Bubble data
  customerName    String? @map("customer_name")
  contactEmail    String? @map("contact_email")
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("customers")
}
```

---

## 🔧 **IMPLEMENTATION GUIDE**

### **Step-by-Step Process:**
1. **Discover data types** from Bubble.io API (use existing working code)
2. **Sample 3 records** per data type to understand structure
3. **Generate Prisma schema** with simple field name conversion
4. **Apply schema** to database (`prisma db push`)
5. **Fetch all data** for each data type
6. **Upsert records** using Prisma client

### **Error Handling:**
- **Fail fast**: Stop on first error
- **Clear messages**: Show exactly what failed and why
- **No retries**: Simple debugging over complex recovery

---

## 🚦 **DEVELOPMENT GUIDELINES**

### **MINDSET RULES:**
1. **THINK FIRST**: Understand the problem completely before coding
2. **SIMPLE FIRST**: Choose the simplest solution that works
3. **ONE THING**: Each function does exactly one thing
4. **NO MIDDLEWARE**: Direct Bubble → Prisma → Database flow

### **CODE STRUCTURE:**
```
src/services/bubbleSyncService.js
├── discoverDataTypes()      // Use existing BubbleService
├── generateSchema()         // NEW - simple Prisma schema generation
├── applySchema()           // NEW - prisma db push
├── syncDataType()          // NEW - fetch and upsert data
└── syncAll()              // NEW - orchestrate everything
```

### **Testing Approach:**
- **Production only**: No localhost testing
- **Deploy and test**: Use staging environment on Railway
- **Incremental**: Test one data type at a time

---

## 🔍 **EXISTING CODEBASE ANALYSIS**

### **WHAT WORKS (Keep Using):**
- `src/services/bubbleService.js` - Bubble.io API connectivity
- Data type discovery functionality
- Data fetching from Bubble.io
- Environment variables and authentication

### **WHAT'S BROKEN (Ignore/Replace):**
- `src/services/simpleFieldMapping.js` - Creates incompatible field names
- Complex field mapping logic in schema generation
- Any middleware between Bubble data and database

### **KEY INSIGHT:**
The problem is NOT with reading Bubble data. The problem is with field name mapping and saving to PostgreSQL.

---

## ⚠️ **CRITICAL WARNINGS FOR NEXT AI**

### **DO NOT:**
1. ❌ Create any "FieldMappingService" or similar
2. ❌ Add collision detection or field name hashing
3. ❌ Build middleware between Bubble and Prisma
4. ❌ Create complex error recovery systems
5. ❌ Try to "improve" Prisma's field naming
6. ❌ Add any transformation layers

### **DO:**
1. ✅ Use existing BubbleService for API connectivity
2. ✅ Use Prisma's built-in field mapping (`@map()`)
3. ✅ Keep all logic in one simple service file
4. ✅ Let Prisma handle database compatibility
5. ✅ Focus on the core sync functionality only
6. ✅ Deploy to production for testing

---

## 🎯 **SUCCESS METRICS**

### **Completion Definition:**
- All discovered data types successfully synced
- 100% data accuracy (all Bubble records in PostgreSQL)
- Zero manual intervention required
- Reliable repeat syncing capability

### **Time Expectation:**
- **Implementation**: 2-4 hours max
- **Testing & deployment**: 1-2 hours max
- **Total**: Complete project in 1 day, not 1 week

---

## 📞 **PROJECT HANDOFF**

### **Current State:**
- Production site has broken SimpleFieldMapping
- BubbleService works correctly for API connectivity
- PostgreSQL database may have existing tables (ignore them)
- Need complete fresh start for field mapping and data saving

### **Production Environment:**
- **ERP 2.0 URL**: https://eter-agent-production-ba68.up.railway.app
- **Bubble.io Source**: https://eternalgy.bubbleapps.io 
- **Database**: Railway PostgreSQL (auto-provided via DATABASE_URL)

### **API Endpoints Available:**
- `POST /api/admin/sync-tables` - Step 1: Create tables
- `POST /api/admin/sync-data` - Step 2: Sync data
- `GET /api/admin/sync-status` - Check sync progress
- `POST /api/admin/cancel-sync` - Cancel running sync

### **Next AI Instructions:**
1. **REUSE** existing BubbleService for data discovery and fetching
2. Create the simplest possible schema generation (let Prisma handle naming)
3. Create simple upsert logic (no custom field transformations)
4. Deploy and test incrementally
5. **DO NOT** reference any existing field mapping code
6. **KEEP IT SIMPLE** - this is a basic data sync problem

---

**REMEMBER: This is a 1-hour problem that was turned into a 7-day nightmare by over-engineering. The API connectivity works fine. The problem is field mapping and database saves. Keep it simple.**
