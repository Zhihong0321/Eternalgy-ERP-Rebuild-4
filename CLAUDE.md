# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Eternalgy ERP Rebuild 4** is a Bubble.io to PostgreSQL sync system for Railway deployment. This is a specialized ERP data migration tool with unidirectional sync (Bubble → PostgreSQL only).

**Status**: ✅ OPERATIONAL - Sync system fully implemented and verified

## Common Development Commands

### Backend (Node.js/Express)
```bash
# Development with hot reload
npm run dev

# Production start  
npm start

# Database operations
npm run build          # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:studio      # Open Prisma Studio
```

### Frontend (React/TypeScript)
```bash
cd frontend

# Development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

**Ultra-Simple Approach**: `Bubble.io API → Prisma Schema → PostgreSQL Database`

### Core Components

1. **Backend Services** (`src/services/`)
   - `bubbleService.js` - Bubble.io API client with rate limiting
   - `dataSyncService.js` - Core sync logic with UDLS-compliant logging
   - `schemaCreationService.js` - Dynamic Prisma schema generation
   - `batchSyncService.js` - Batch operations with global limiters

2. **API Endpoints** (`src/api/`)
   - `bubble.js` - Bubble API testing and data discovery
   - `sync.js` - Single table and batch sync operations
   - `schema.js` - Schema management (create/drop/recreate)
   - `logs.js` - UDLS logging system access

3. **Frontend Architecture** (`frontend/src/`)
   - React 19 + TypeScript + Vite
   - shadcn/ui components with Tailwind CSS
   - Pages: Dashboard, DataBrowser, DataSync
   - Custom hooks: `useEternalgyAPI.ts` for backend communication

### Key Design Principles

- **Railway-First Development**: All development, testing, and deployment on Railway.app only
- **Dynamic Discovery**: NO hardcoded table/field names - everything discovered from Bubble API
- **Unidirectional Sync**: Data flows ONLY Bubble → PostgreSQL, never back
- **Ultra-Simple Architecture**: No middleware layers between Bubble and Prisma

## Database Schema

Uses Prisma ORM with PostgreSQL. Key models:
- `sync_status` - Track sync operations and progress
- `synced_records` - Store all synced data with metadata
- Dynamic tables generated from Bubble.io data types

## Environment Variables

Required for development:
```bash
BUBBLE_API_KEY=your_api_key_here
BUBBLE_APP_NAME=eternalgy
BUBBLE_BASE_URL=https://eternalgy.bubbleapps.io
DATABASE_URL=postgresql://... (Railway managed)
NODE_ENV=production
PORT=3000
```

## Testing and Deployment

### Testing Strategy
- **NO localhost testing** - Railway-only development per project rules
- Use Railway deployment for all testing
- Production URL: https://eternalgy-erp-retry3-production.up.railway.app

### Key Test Endpoints
- `GET /health` - Service health check
- `GET /api/bubble/test-connection` - Verify Bubble API connectivity
- `GET /api/bubble/discover-types` - Discover all Bubble data types
- `POST /api/sync/batch?globalLimit=5` - Test batch sync with limits

## Critical Development Rules

Based on lessons from 25+ failed attempts:

❌ **NEVER DO:**
- localhost testing or development
- Custom field mapping services
- Middleware between Bubble and Prisma
- Hardcoded data type or field names
- **OVER-ENGINEERING: Complex type detection logic that creates inconsistencies**
- **"Smart" array type detection between TEXT[] and JSONB - causes 3+ day debugging cycles**

✅ **ALWAYS DO:**
- Railway-only development and testing
- Ultra-simple architecture approach
- Fail fast approach
- Use UDLS-compliant logging for all operations
- **SIMPLE RULE: ALL Bubble arrays → TEXT[] in PostgreSQL (no exceptions)**

## ⚠️ CRITICAL WARNING: NO OVER-ENGINEERING

**LEARNED THE HARD WAY (3+ days wasted):**
- Bubble.io only sends simple data: strings, numbers, arrays of strings
- ALL arrays from Bubble should be TEXT[] in PostgreSQL
- Do NOT create "intelligent" type detection between TEXT[] and JSONB
- Consistency > "Smart" logic
- Simple, predictable behavior > Complex edge case handling

## Memory System

The `/memory/` folder contains critical project context:
- `project_spec.memory` - Core project requirements and principles
- `critical_instruction.memory` - Non-negotiable development rules
- `config.memory` - Environment and deployment settings

## Sync System Architecture

### Single Table Sync
```javascript
POST /api/sync/table/{tableName}?limit=5
```

### Batch Sync
```javascript
POST /api/sync/batch?globalLimit=5
```

### Monitoring
- UDLS-compliant logging system
- Real-time sync status tracking
- Error reporting with context

## Frontend Integration

- React Router for navigation
- Zustand for state management
- TanStack Query for server state
- Custom API hooks for backend communication

## Performance Considerations

- Optimized queries (under 1ms performance target)
- Rate limiting on all API endpoints
- Configurable sync limits to prevent overwhelming
- JSON field support for complex Bubble data structures