import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Railway/Heroku deployment (fixes rate limiting error)
// CRITICAL: This fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR error
// DEPLOYMENT VERSION: v1.1.0-fixed-20250810
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for frontend assets
}));
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Serve frontend static files
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Eternalgy ERP Rebuild 4',
    environment: process.env.NODE_ENV || 'development',
    deploymentTime: '2025-08-10T15:01:00Z',
    syncServicesEnabled: true
  });
});

// API info endpoint (moved to /api)
app.get('/api', (req, res) => {
  res.json({
    name: 'Eternalgy ERP Rebuild 4',
    description: 'Bubble.io to PostgreSQL sync system',
    version: '1.1.0-fixed',
    endpoints: {
      health: '/health',
      bubble: {
        testConnection: '/api/bubble/test-connection',
        discoverTypes: '/api/bubble/discover-types',
        fetchData: '/api/bubble/fetch/{dataType}?limit=5'
      },
      schema: {
        createAll: 'POST /api/schema/create-all?maxTables=5',
        recreateAll: 'POST /api/schema/recreate-all',
        stats: '/api/schema/stats',
        dropAll: 'DELETE /api/schema/drop-all?confirm=yes-drop-all-tables'
      },
      sync: {
        singleTable: 'POST /api/sync/table/{tableName}?limit=5',
        batchSync: 'POST /api/sync/batch?globalLimit=5',
        status: '/api/sync/status/{runId}',
        history: '/api/sync/history?limit=10',
        tables: '/api/sync/tables',
        stats: '/api/sync/stats'
      },
      logs: {
        recent: '/api/logs/recent?limit=50',
        errors: '/api/logs/errors?limit=25',
        byRun: '/api/logs/run/{runId}',
        byContext: '/api/logs/context/{context}?limit=100',
        stats: '/api/logs/stats',
        health: '/api/logs/health'
      }
    },
    status: {
      phase: 'Phase 3: Sync Implementation Complete',
      features: [
        'UDLS-compliant logging (mandatory)',
        'Single table sync with limiter',
        'Batch sync with global limit (Option A)',
        'HTTP log access endpoints',
        'Railway deployment ready'
      ]
    }
  });
});

// Deployment verification endpoint
app.get('/deploy-status', (req, res) => {
  res.json({
    deployed: true,
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    syncServicesAvailable: true,
    logsServicesAvailable: true,
    message: 'Sync implementation deployed successfully'
  });
});

// API routes
import bubbleRoutes from './api/bubble.js';
import syncRoutes from './api/sync.js';
import logsRoutes from './api/logs.js';
import schemaRoutes from './api/schema.js';
import databaseRoutes from './api/database.js';

app.use('/api/bubble', bubbleRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/database', databaseRoutes);

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Serve React app for all other routes
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🎨 Frontend served from: ${frontendDistPath}`);
});
