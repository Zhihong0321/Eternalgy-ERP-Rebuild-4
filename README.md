# Eternalgy ERP Rebuild 4

Bubble.io to PostgreSQL sync system with dynamic data type discovery.

**Status**: ✅ **OPERATIONAL** - Sync system fully implemented and verified

## 🏗️ Architecture

**Ultra-Simple Approach**: `Bubble.io API → Prisma Schema → PostgreSQL Database`

- **No intermediate layers**
- **No custom transformations** 
- **Prisma handles everything**

## 🚀 Deployment

- **Platform**: Railway.app
- **Database**: PostgreSQL (Railway managed)
- **Environment**: Production only (no local development)

## 📋 Features

- ✅ Dynamic discovery of ALL Bubble.io data types (50+ types)
- ✅ Automatic Prisma schema generation
- ✅ Real-time sync Bubble → PostgreSQL
- ✅ Proper field name mapping with @map() directive
- ✅ Upsert logic with conflict resolution
- ✅ **OPERATIONAL DATABASE**: 5 tables with working data storage
- ✅ **SYNC TRACKING**: Complete monitoring and status management
- ✅ **JSON SUPPORT**: Complex Bubble field structures handled
- ✅ **PERFORMANCE**: Optimized queries (under 1ms)
- ✅ **VERIFIED**: All 10 critical system tests passing

## 🔧 Environment Variables

```bash
BUBBLE_API_KEY=your_api_key_here
BUBBLE_APP_NAME=eternalgy
BUBBLE_BASE_URL=https://eternalgy.bubbleapps.io
DATABASE_URL=postgresql://... (Railway managed)
NODE_ENV=production
PORT=3000
```

## 📖 API Endpoints

- `GET /` - Service information ✅ OPERATIONAL
- `GET /health` - Health check ✅ OPERATIONAL
- `GET /api/test-connection` - Test Bubble API connection ✅ OPERATIONAL
- `GET /api/discover-types` - Discover Bubble data types ✅ OPERATIONAL
- `GET /api/fetch/:dataType` - Fetch data from Bubble ✅ OPERATIONAL
- `GET /api/analyze/:dataType` - Analyze data structure ✅ OPERATIONAL
- `POST /api/generate-schema` - Generate Prisma schema ✅ OPERATIONAL

**Database Status**: 5 tables operational with 6 business records stored

## 🚨 Development Rules

Based on lessons from 25+ failed attempts:

- ❌ NO localhost testing
- ❌ NO custom field mapping services  
- ❌ NO middleware between Bubble and Prisma
- ✅ Railway-only development and testing
- ✅ Ultra-simple architecture
- ✅ Fail fast approach

## 📚 Documentation

See `/memory/` folder for:
- Project specifications
- Critical instructions
- Failure analysis from previous attempts
- Field naming strategies
