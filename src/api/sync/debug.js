import { BubbleService } from '../../services/bubbleService.js';

// Simple field name converter for debugging
function toSafeFieldName(fieldName) {
  if (!fieldName || typeof fieldName !== 'string') {
    return 'unknownField';
  }

  let safeName = fieldName;
  
  // Remove special characters except spaces
  safeName = safeName.replace(/[^a-zA-Z0-9\s]/g, '');
  
  // Convert to camelCase
  safeName = safeName.split(' ')
    .map((word, index) => {
      if (index === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');

  // Fix numeric start
  if (/^[0-9]/.test(safeName)) {
    safeName = 'f' + safeName;
  }

  // Fix reserved words - check original field name
  if (fieldName === '_id') {
    safeName = 'bubbleId';
  } else if (fieldName === 'id') {
    safeName = 'recordId';
  }

  return safeName || 'unknownField';
}

/**
 * Debug sync test - shows what would be synced without database
 */
export async function debugSync(req, res) {
  try {
    const bubbleService = new BubbleService();
    const recordLimit = parseInt(req.query.limit) || 5;
    
    console.log(`🐛 DEBUG SYNC: Starting with ${recordLimit} records per data type`);
    
    // Test API connection
    const connectionTest = await bubbleService.testConnection();
    if (!connectionTest.success) {
      return res.status(500).json({
        success: false,
        error: 'Bubble API connection failed',
        details: connectionTest.message,
        timestamp: new Date().toISOString()
      });
    }

    // Discover data types
    const dataTypes = await bubbleService.discoverDataTypes();
    console.log(`🔍 Found ${dataTypes.length} data types:`, dataTypes.map(dt => dt.name));

    const debugResults = [];
    let totalProcessed = 0;

    // Process each data type
    for (const dataType of dataTypes) {
      if (!dataType.hasData) {
        console.log(`⏭️ Skipping ${dataType.name} (no data)`);
        continue;
      }

      console.log(`🔄 Processing ${dataType.name} (limit: ${recordLimit})...`);

      // Fetch limited records
      const result = await bubbleService.fetchDataType(dataType.name, { limit: recordLimit });
      
      if (!result.success) {
        console.error(`❌ Failed to fetch ${dataType.name}:`, result.error);
        continue;
      }

      const records = result.data || [];
      console.log(`📦 Fetched ${records.length} records from ${dataType.name}`);

      // Process each record
      const processedRecords = records.map(record => {
        const originalFields = Object.keys(record);
        const processedData = {};
        
        originalFields.forEach(field => {
          const safeName = toSafeFieldName(field);
          processedData[safeName] = record[field];
        });

        totalProcessed++;
        
        return {
          bubbleId: record._id,
          originalFieldCount: originalFields.length,
          sampleOriginalFields: originalFields.slice(0, 5),
          sampleProcessedFields: Object.keys(processedData).slice(0, 5),
          rawData: record,
          processedData: processedData
        };
      });

      debugResults.push({
        dataType: dataType.name,
        recordCount: records.length,
        records: processedRecords
      });

      console.log(`✅ Processed ${records.length} records from ${dataType.name}`);
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`🎉 DEBUG SYNC COMPLETED: ${totalProcessed} total records processed`);

    res.json({
      success: true,
      debugMode: true,
      summary: {
        totalRecords: totalProcessed,
        dataTypesProcessed: debugResults.length,
        recordLimit,
        timestamp: new Date().toISOString()
      },
      results: debugResults,
      message: `Debug sync completed - ${totalProcessed} records processed from ${debugResults.length} data types`
    });

  } catch (error) {
    console.error('❌ Debug sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
