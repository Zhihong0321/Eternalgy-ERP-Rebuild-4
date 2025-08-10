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
    version: '1.0.0',
    endpoints: {
      health: '/health',
      bubbleAPI: '/api/bubble',
      testConnection: '/api/bubble/test-connection',
      discoverTypes: '/api/bubble/discover-types',
      fetchData: '/api/bubble/fetch/{dataType}?limit=5'
    },
    status: {
      phase: 'Step 1: Bubble Data Fetching Foundation',
      features: ['Dynamic discovery (50+ types)', 'Selective data fetching', 'API key verification']
    }
  });
});

// Bubble Data API routes
import bubbleRoutes from './api/bubble.js';
app.use('/api/bubble', bubbleRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
