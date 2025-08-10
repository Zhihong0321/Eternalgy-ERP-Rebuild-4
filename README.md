# Eternalgy ERP Rebuild 4

Bubble.io to PostgreSQL sync system with dynamic data type discovery.

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

- `GET /` - Service information
- `GET /health` - Health check
- `POST /api/sync` - Trigger sync process (coming soon)
- `GET /api/discovery` - View discovered data types (coming soon)

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
