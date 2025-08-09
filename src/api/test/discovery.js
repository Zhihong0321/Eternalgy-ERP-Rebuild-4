import { BubbleAPIDiscovery } from '../../../scripts/bubble-api-discovery.js';

export async function runDiscovery(req, res) {
  try {
    console.log('🔍 Starting Bubble API Discovery via API endpoint...');
    
    const discovery = new BubbleAPIDiscovery();
    
    // Run discovery process
    await discovery.runDiscovery();
    
    res.json({
      status: 'success',
      message: 'Discovery process completed successfully',
      timestamp: new Date().toISOString(),
      results: discovery.results,
      files: {
        discoveryResults: 'BUBBLE-API-DISCOVERY-RESULTS.json',
        samplesDirectory: './samples/',
        note: 'Check project root for discovery files'
      }
    });
    
  } catch (error) {
    console.error('❌ Discovery API error:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Discovery process failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getDiscoveryStatus(req, res) {
  try {
    const fs = await import('fs');
    
    // Check if discovery results exist
    const resultsExist = fs.existsSync('./BUBBLE-API-DISCOVERY-RESULTS.json');
    
    if (resultsExist) {
      const results = JSON.parse(fs.readFileSync('./BUBBLE-API-DISCOVERY-RESULTS.json', 'utf8'));
      
      res.json({
        status: 'completed',
        message: 'Discovery results available',
        timestamp: results.discovery.timestamp,
        dataTypesFound: results.dataTypes.length,
        samplesGenerated: Object.keys(results.samples).length,
        errorsCount: results.errors.length
      });
    } else {
      res.json({
        status: 'not_run',
        message: 'Discovery has not been run yet',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to check discovery status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
