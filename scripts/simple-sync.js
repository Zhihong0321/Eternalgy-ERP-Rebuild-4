#!/usr/bin/env node

import { BubbleService } from '../src/services/bubbleService.js';

// Simple field name converter for testing
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

async function runSimpleSync() {
  const bubbleService = new BubbleService();
  
  try {
    console.log('🔌 Testing Bubble API connection...');
    
    const connectionTest = await bubbleService.testConnection();
    if (!connectionTest.success) {
      console.error('❌ Bubble API connection failed:', connectionTest.message);
      process.exit(1);
    }
    
    console.log('✅ Connected to Bubble API');
    
    // Discover data types
    console.log('📊 Discovering data types...');
    const dataTypes = await bubbleService.discoverDataTypes();
    console.log(`Found ${dataTypes.length} data types:`, dataTypes.map(dt => dt.name));
    
    let totalRecords = 0;
    const rateLimitDelay = 300; // 300ms between requests
    
    // Test sync each data type with rate limiting
    for (const dataType of dataTypes) {
      if (!dataType.hasData) {
        console.log(`⏭️ Skipping ${dataType.name} (no data)`);
        continue;
      }
      
      console.log(`\n🔄 Testing sync for ${dataType.name}...`);
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
      
      // Fetch limited records for fast testing (max 5 per data type)
      const result = await bubbleService.fetchDataType(dataType.name, { limit: 5 });
      
      if (!result.success) {
        console.error(`❌ Failed to fetch ${dataType.name}:`, result.error);
        continue;
      }
      
      const records = result.data || [];
      console.log(`   Fetched ${records.length} sample records`);
      
      // Test field name conversion
      if (records.length > 0) {
        const firstRecord = records[0];
        const originalFields = Object.keys(firstRecord);
        const convertedFields = originalFields.map(field => ({
          original: field,
          converted: toSafeFieldName(field)
        }));
        
        console.log(`   Original fields: ${originalFields.length}`);
        console.log(`   Field conversion sample:`);
        convertedFields.slice(0, 5).forEach(f => {
          console.log(`     "${f.original}" → "${f.converted}"`);
        });
        
        totalRecords += records.length;
      }
    }
    
    console.log(`\n🎉 Sync test completed!`);
    console.log(`📊 Total sample records processed: ${totalRecords}`);
    console.log(`⏱️ Rate limiting: ${rateLimitDelay}ms between requests`);
    
  } catch (error) {
    console.error('❌ Sync test failed:', error.message);
    process.exit(1);
  }
}

// Check if script is run directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))) {
  runSimpleSync().catch(console.error);
}

export { runSimpleSync };
