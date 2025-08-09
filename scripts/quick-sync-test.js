#!/usr/bin/env node

import { SimpleSyncService } from '../src/services/simpleSyncService.js';

async function quickSyncTest() {
  console.log('🚀 Quick Sync Test - Limited Records');
  console.log('====================================\n');
  
  const syncService = new SimpleSyncService();
  
  try {
    console.log('🔌 Testing API connection...');
    
    const connectionTest = await syncService.bubbleService.testConnection();
    if (!connectionTest.success) {
      console.error('❌ API connection failed:', connectionTest.message);
      process.exit(1);
    }
    
    console.log('✅ API connected\n');
    
    // Quick sync with only 3 records per data type for fast testing
    console.log('📊 Starting sync with 3 records limit per data type...\n');
    
    const totalRecords = await syncService.syncAll(3);
    
    console.log('\n🎉 Quick test completed!');
    console.log(`📊 Total records processed: ${totalRecords}`);
    console.log('⚡ Fast testing with record limits prevents long waits');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await syncService.disconnect();
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))) {
  quickSyncTest();
}

export { quickSyncTest };
