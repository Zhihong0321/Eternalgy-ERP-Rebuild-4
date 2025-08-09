import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'eternalgy-erp-retry3'
  });
});

// Import API routes
import { testBubbleConnection, discoverTables, getSampleData as getBubbleSampleData } from './api/test/bubble.js';
import { debugEnvironment } from './api/test/debug.js';
import { runDiscovery, getDiscoveryStatus } from './api/test/discovery.js';
import { getDiscoveryResults, getSampleData as getDiscoverySampleData, getAllSamples } from './api/test/discovery-summary.js';
import { generateDataDictionary, getDataDictionaryStatus, getTableDetails } from './api/discovery/data-dictionary.js';
import { testSyncConnection, runQuickSync, getSyncStatus, testFieldConversion, getAllSyncedRecords, getSyncedRecordsByType, getSyncSummary } from './api/sync/sync.js';

// Test endpoints
app.get('/api/test/bubble', testBubbleConnection);
app.get('/api/test/discover-tables', discoverTables);
app.get('/api/test/sample-data', getBubbleSampleData);
app.get('/api/test/debug', debugEnvironment);

// Discovery endpoints
app.post('/api/discovery/run', runDiscovery);
app.get('/api/discovery/status', getDiscoveryStatus);
app.get('/api/discovery/results', getDiscoveryResults);
app.get('/api/discovery/samples', getAllSamples);
app.get('/api/discovery/sample/:dataType', getDiscoverySampleData);

// Data Dictionary endpoints
app.post('/api/data-dictionary/generate', generateDataDictionary);
app.get('/api/data-dictionary/status', getDataDictionaryStatus);
app.get('/api/data-dictionary/table/:tableName', getTableDetails);

// Sync endpoints
app.get('/api/sync/test-connection', testSyncConnection);
app.post('/api/sync/quick', runQuickSync);
app.get('/api/sync/status', getSyncStatus);
app.get('/api/sync/test-fields', testFieldConversion);

// Database query endpoints
app.get('/api/sync/records', getAllSyncedRecords);
app.get('/api/sync/records/:dataType', getSyncedRecordsByType);
app.get('/api/sync/summary', getSyncSummary);

app.get('/api/test/health', (req, res) => {
  res.json({
    status: 'API routes ready',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Eternalgy ERP Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
