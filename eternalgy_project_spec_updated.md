Of course. I've restructured and minimalist-ified your project specification to be optimized for an AI agent.

I have removed the tables and emojis, integrated the Shadcn UI requirement more clearly, and added a directive to reference the eternalgy-erp-retry3.txt architecture document. The result is a clean, instruction-focused document.

Here is the revised, AI-optimized project specification:

AI-OPTIMIZED PROJECT SPECIFICATION v2.0: Eternalgy ERP
DOCUMENT_PURPOSE: This document provides the complete, non-negotiable instructions for building the Eternalgy ERP 2.0 MVP. It is designed for an AI development agent and must be followed exactly.

PRIMARY_DIRECTIVE: The core sync logic, field mapping, and error handling rules are defined in eternalgy-erp-retry3.txt. This document provides the project structure and phases, but the retry3 document is the final authority on sync architecture. Both documents must be used together.

1. CORE OBJECTIVE
Create a real-time, read-only mirror of a Bubble.io application's data in a PostgreSQL database, managed by a Node.js backend and a React/shadcn/ui frontend. The entire system will be hosted and tested exclusively on Railway.app.

2. NON-NEGOTIABLE PRINCIPLES
Bubble is the Single Source of Truth: Local ERP data is always overwritten by data from Bubble.

Unidirectional Sync: Data flows only from Bubble to the ERP. No data is written back to Bubble.

Single User System: The system is for one user. Do not implement authentication or multi-user features.

Dynamic Discovery is Mandatory: Do not hardcode table or field names. The schema must be discovered dynamically from the Bubble API.

Railway-First Development: All development, testing, and deployment must occur on Railway. No local development is permitted.

3. TECHNOLOGY STACK
Frontend:

Language: TypeScript

Framework: React 18 + Vite

UI Library: shadcn/ui. All components must be from this library or styled to match it.

Styling: Tailwind CSS

Backend:

Runtime: Node.js

Framework: Express

Database:

ORM: Prisma

Database: PostgreSQL (via Railway add-on)

Hosting & Deployment:

Platform: Railway.app (this is the only environment)

Build Tool: pnpm

CI/CD: Automatic deployment from a linked GitHub repository.

4. FOLDER STRUCTURE
eternalgy-erp/
├── src/
│   ├── api/
│   │   ├── test/
│   │   ├── sync/
│   │   └── logs/
│   ├── services/
│   ├── lib/
│   ├── modules/
│   │   ├── sync/
│   │   ├── data-browser/
│   │   └── build-dashboard/
│   ├── components/
│   └── App.tsx
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── samples/
├── scripts/
├── public/
├── ai-playbook.md
├── eternalgy-erp-retry3.txt
├── .env.example
└── package.json
5. BUILD PHASES
Phase 1: Setup and API Validation
1.1. Create a GitHub repository named eternalgy-erp.

1.2. Initialize a Vite + React + TypeScript project.

1.3. Install all required dependencies: prisma, typescript, tailwindcss, @prisma/client, axios, express.

1.4. Create a Railway project linked to the GitHub repo.

1.5. Add a PostgreSQL database service in Railway.

1.6. Set all required environment variables in the Railway dashboard.

1.7. Create the API test endpoint src/api/test/bubble.js.

1.8. Create the log retrieval endpoint src/api/logs/recent.js.

1.9. Deploy the initial application to Railway by pushing to GitHub.

1.10. Validate API access by calling /api/test/bubble.

1.11. Implement and validate the /api/test/discover-tables endpoint.

1.12. Fetch sample data using a /api/test/sample-data endpoint and save the JSON responses into the /samples/ directory.

Phase 2: Database and Sync Engine
2.1. Build the discoverTables() function in a service file to fetch all table names from the Bubble API.

2.2. Build the generatePrismaSchema() function that uses the discovered tables to generate Prisma models dynamically.

2.3. Ensure the schema generator uses @map() for Bubble field names containing spaces or special characters.

2.4. Add bubbleId (unique), updatedAt, and isDeleted fields to every generated model.

2.5. Create an endpoint that triggers the schema generation and applies it to the database using prisma db push.

2.6. Build the core sync engine service as defined in eternalgy-erp-retry3.txt.

2.7. Implement the sync control endpoints: /api/sync/test, /api/sync/incremental, and /api/sync/stop.

2.8. Implement sync tracking using a lastSyncTime value.

2.9. Implement a stopSync() flag for pausing the sync process.

2.10. Deploy and test all sync APIs on Railway, verifying data in the PostgreSQL database.

Phase 3: Frontend UI
3.1. Set up shadcn/ui in the React project.

3.2. Create a main layout with a persistent left-side navigation panel (links: Dashboard, Sync, Data Browser).

3.3. Build the Data Browser module: it should list all dynamically discovered tables and allow Browse records.

3.4. Build the Sync Panel module: it should display real-time sync status (progress, current table) by polling /api/sync/status.

3.5. Build the developer-only Build Dashboard component for tracking progress and viewing logs.

3.6. Add buttons to the UI to manually trigger the sync control API endpoints.

3.7. Deploy and verify the full UI on Railway.

6. API ENDPOINT SPECIFICATION
Test Endpoints (/api/test/)
GET /api/test/bubble: Confirms connection to the Bubble API.

GET /api/test/discover-tables: Returns a JSON array of discovered table names.

GET /api/test/sample-data?table={tableName}&limit={number}: Returns sample records for a given table.

Log Endpoints (/api/logs/)
GET /api/logs/recent?limit={number}: Returns the most recent application logs.

GET /api/logs/errors?limit={number}: Returns the most recent error logs.

Sync Control Endpoints (/api/sync/)
POST /api/sync/test: Body { "table": "tableName", "limit": 10 }. Starts a limited sync for one table.

POST /api/sync/incremental: Starts a full incremental sync based on lastSyncTime.

POST /api/sync/stop: Sets a flag to stop any running sync process.

GET /api/sync/status: Returns the current sync status { "running": true/false, "currentTable": "...", "progress": 0-100 }.