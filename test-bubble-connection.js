import BubbleService from './src/services/bubbleService.js';
import 'dotenv/config';

async function testBubbleConnection() {
  console.log('🔍 Testing Bubble API connection...');
  
  try {
    // Check environment variables
    console.log('\n🔧 Environment check:');
    console.log(`BUBBLE_API_KEY: ${process.env.BUBBLE_API_KEY ? 'Set (' + process.env.BUBBLE_API_KEY.substring(0, 10) + '...)' : 'Missing'}`);
    console.log(`BUBBLE_APP_NAME: ${process.env.BUBBLE_APP_NAME || 'Missing'}`);
    console.log(`BUBBLE_BASE_URL: ${process.env.BUBBLE_BASE_URL || 'Missing'}`);
    
    const bubbleService = new BubbleService();
    
    // Test basic connection
    console.log('\n📡 Testing API connection...');
    const testResult = await bubbleService.testConnection();
    
    if (testResult.success) {
      console.log('✅ Bubble API connection successful');
      console.log(`📊 Response: ${JSON.stringify(testResult, null, 2)}`);
    } else {
      console.log('❌ Bubble API connection failed');
      console.log(`📊 Error: ${JSON.stringify(testResult, null, 2)}`);
    }
    
    // Test data discovery
    console.log('\n🔍 Testing data type discovery...');
    const discovery = await bubbleService.discoverDataTypes();
    
    console.log(`📊 Discovery result:`);
    console.log(`  - Total types found: ${discovery.discoveredTypes.length}`);
    console.log(`  - Types with data: ${discovery.discoveredTypes.filter(t => t.hasData).length}`);
    console.log(`  - Success rate: ${discovery.successRate}%`);
    
    if (discovery.errors.length > 0) {
      console.log('\n⚠️  Discovery errors:');
      discovery.errors.slice(0, 5).forEach(error => {
        console.log(`  - ${error}`);
      });
      if (discovery.errors.length > 5) {
        console.log(`  ... and ${discovery.errors.length - 5} more errors`);
      }
    }
    
    if (discovery.discoveredTypes.length > 0) {
      console.log('\n📋 Sample discovered types:');
      discovery.discoveredTypes.slice(0, 5).forEach(type => {
        console.log(`  - ${type.name} (hasData: ${type.hasData}, count: ${type.count})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

testBubbleConnection()
  .then(() => {
    console.log('\n✅ Bubble connection test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Bubble connection test failed:', error.message);
    process.exit(1);
  });