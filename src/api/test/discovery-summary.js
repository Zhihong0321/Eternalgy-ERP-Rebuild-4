export async function getDiscoveryResults(req, res) {
  try {
    const fs = await import('fs');
    
    // Check if discovery results exist
    if (!fs.existsSync('./BUBBLE-API-DISCOVERY-RESULTS.json')) {
      return res.status(404).json({
        status: 'not_found',
        message: 'Discovery results not found. Run discovery first.',
        timestamp: new Date().toISOString()
      });
    }
    
    const results = JSON.parse(fs.readFileSync('./BUBBLE-API-DISCOVERY-RESULTS.json', 'utf8'));
    
    res.json({
      status: 'success',
      message: 'Discovery results retrieved',
      timestamp: new Date().toISOString(),
      summary: {
        discoveryTimestamp: results.discovery.timestamp,
        apiBaseUrl: results.discovery.apiBaseUrl,
        dataTypesFound: results.dataTypes.length,
        samplesGenerated: Object.keys(results.samples).length,
        errorsCount: results.errors.length,
        totalFields: results.fieldAnalysis.allFields?.length || 0
      },
      dataTypes: results.dataTypes.map(type => ({
        name: type.name,
        hasData: type.hasData,
        endpoint: type.endpoint
      })),
      fieldPatterns: results.fieldAnalysis.fieldPatterns,
      apiLimitations: results.apiLimitations,
      errors: results.errors
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve discovery results',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getSampleData(req, res) {
  try {
    const { dataType } = req.params;
    const fs = await import('fs');
    
    const sampleFile = `./samples/${dataType}_sample.json`;
    
    if (!fs.existsSync(sampleFile)) {
      return res.status(404).json({
        status: 'not_found',
        message: `Sample data for ${dataType} not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    const sampleData = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
    
    res.json({
      status: 'success',
      message: `Sample data for ${dataType} retrieved`,
      timestamp: new Date().toISOString(),
      data: sampleData
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Failed to retrieve sample data for ${req.params.dataType}`,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getAllSamples(req, res) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    if (!fs.existsSync('./samples')) {
      return res.status(404).json({
        status: 'not_found',
        message: 'Samples directory not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const sampleFiles = fs.readdirSync('./samples').filter(file => file.endsWith('_sample.json'));
    const allSamples = {};
    
    for (const file of sampleFiles) {
      const dataType = file.replace('_sample.json', '');
      try {
        const sampleData = JSON.parse(fs.readFileSync(path.join('./samples', file), 'utf8'));
        allSamples[dataType] = {
          recordCount: sampleData.sampleCount,
          timestamp: sampleData.timestamp,
          endpoint: sampleData.endpoint,
          firstRecord: sampleData.data[0] ? Object.keys(sampleData.data[0]) : []
        };
      } catch (error) {
        allSamples[dataType] = { error: error.message };
      }
    }
    
    res.json({
      status: 'success',
      message: 'All sample data retrieved',
      timestamp: new Date().toISOString(),
      samplesFound: sampleFiles.length,
      samples: allSamples
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve sample data',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
