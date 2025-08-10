import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Eternalgy ERP Rebuild 4',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Eternalgy ERP Rebuild 4',
    description: 'Bubble.io to PostgreSQL sync system',
    version: '1.1.0',
    endpoints: {
      health: '/health',
      bubble: {
        testConnection: '/api/bubble/test-connection',
        discoverTypes: '/api/bubble/discover-types',
        fetchData: '/api/bubble/fetch/{dataType}?limit=5'
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

// API routes
import bubbleRoutes from './api/bubble.js';
import syncRoutes from './api/sync.js';
import logsRoutes from './api/logs.js';

app.use('/api/bubble', bubbleRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/logs', logsRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
