import { BubbleDataDictionary } from '../../../scripts/bubble-data-dictionary.js';

export async function generateDataDictionary(req, res) {
  try {
    console.log('📊 Starting Comprehensive Data Dictionary Generation via API...');
    
    const dictionary = new BubbleDataDictionary();
    
    // Run comprehensive analysis
    const result = await dictionary.generateDataDictionary();
    
    res.json({
      status: 'success',
      message: 'Data dictionary generated successfully',
      timestamp: new Date().toISOString(),
      summary: {
        totalTables: result.metadata.totalTables,
        totalFields: result.metadata.totalFields,
        analysisComplete: result.metadata.analysisComplete,
        errorsCount: result.errors.length
      },
      files: {
        dataDictionary: 'BUBBLE-DATA-DICTIONARY.json',
        readableDoc: 'BUBBLE-DATA-DICTIONARY.md',
        prismaSchema: 'PRISMA-SCHEMA-RECOMMENDATIONS.md',
        location: 'Project root directory'
      },
      tables: Object.keys(result.tables),
      fieldPatterns: result.fieldAnalysis.fieldPatterns,
      dataTypeFrequency: result.fieldAnalysis.dataTypeFrequency
    });
    
  } catch (error) {
    console.error('❌ Data dictionary generation error:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Data dictionary generation failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getDataDictionaryStatus(req, res) {
  try {
    const fs = await import('fs');
    
    // Check if data dictionary files exist
    const jsonExists = fs.existsSync('./BUBBLE-DATA-DICTIONARY.json');
    const mdExists = fs.existsSync('./BUBBLE-DATA-DICTIONARY.md');
    const prismaExists = fs.existsSync('./PRISMA-SCHEMA-RECOMMENDATIONS.md');
    
    if (jsonExists && mdExists && prismaExists) {
      const data = JSON.parse(fs.readFileSync('./BUBBLE-DATA-DICTIONARY.json', 'utf8'));
      
      res.json({
        status: 'complete',
        message: 'Data dictionary available',
        timestamp: data.metadata.timestamp,
        totalTables: data.metadata.totalTables,
        totalFields: data.metadata.totalFields,
        files: {
          json: jsonExists,
          markdown: mdExists,
          prismaDoc: prismaExists
        },
        tables: Object.keys(data.tables || {})
      });
    } else {
      res.json({
        status: 'not_generated',
        message: 'Data dictionary not yet generated',
        timestamp: new Date().toISOString(),
        files: {
          json: jsonExists,
          markdown: mdExists,
          prismaDoc: prismaExists
        }
      });
    }
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to check data dictionary status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getTableDetails(req, res) {
  try {
    const { tableName } = req.params;
    const fs = await import('fs');
    
    if (!fs.existsSync('./BUBBLE-DATA-DICTIONARY.json')) {
      return res.status(404).json({
        status: 'not_found',
        message: 'Data dictionary not found. Generate it first.',
        timestamp: new Date().toISOString()
      });
    }
    
    const data = JSON.parse(fs.readFileSync('./BUBBLE-DATA-DICTIONARY.json', 'utf8'));
    
    if (!data.tables[tableName]) {
      return res.status(404).json({
        status: 'table_not_found',
        message: `Table '${tableName}' not found in data dictionary`,
        availableTables: Object.keys(data.tables),
        timestamp: new Date().toISOString()
      });
    }
    
    const table = data.tables[tableName];
    const prismaRec = data.fieldAnalysis.prismaRecommendations[tableName];
    
    res.json({
      status: 'success',
      message: `Table details for ${tableName}`,
      timestamp: new Date().toISOString(),
      table: {
        name: table.name,
        recordCount: table.recordCount,
        fieldCount: table.fieldCount,
        analysisTimestamp: table.analysisTimestamp,
        fields: table.fields,
        prismaModel: prismaRec
      }
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Failed to get table details for ${req.params.tableName}`,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
