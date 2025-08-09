import { BubbleService } from '../../services/bubbleService.js';

export async function testBubbleConnection(req, res) {
  try {
    const bubbleService = new BubbleService();
    const result = await bubbleService.testConnection();
    
    if (result.success) {
      res.json({
        status: 'success',
        message: result.message,
        timestamp: new Date().toISOString(),
        api: {
          baseUrl: bubbleService.baseUrl,
          hasApiKey: !!bubbleService.apiKey
        }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: result.message,
        error: result.error,
        httpStatus: result.status,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to test Bubble connection',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export async function discoverTables(req, res) {
  try {
    const bubbleService = new BubbleService();
    const discoveredTypes = await bubbleService.discoverDataTypes();
    
    res.json({
      status: 'success',
      message: `Discovered ${discoveredTypes.length} data types`,
      tables: discoveredTypes,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to discover tables',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getSampleData(req, res) {
  try {
    const { table, limit = 3 } = req.query;
    
    if (!table) {
      return res.status(400).json({
        status: 'error',
        message: 'Table name is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const bubbleService = new BubbleService();
    const sampleData = await bubbleService.getSampleData(table, parseInt(limit));
    
    res.json({
      status: 'success',
      message: `Retrieved ${sampleData.length} sample records from ${table}`,
      table: table,
      data: sampleData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Failed to get sample data for table: ${req.query.table}`,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
