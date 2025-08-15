// Test script to verify automatic pending request creation
// This will trigger the same error you experienced and verify the pending request is created

async function testAutoPendingRequest() {
  const baseUrl = 'https://eternalgy-erp-retry3-production.up.railway.app';
  
  console.log('🧪 Testing Automatic Pending Request Creation');
  console.log('================================================');
  console.log('');
  
  try {
    // Step 1: Clear any existing pending requests for payment table
    console.log('Step 1: Check existing pending requests...');
    const existingResponse = await fetch(`${baseUrl}/api/pending-patches/list`);
    const existingData = await existingResponse.json();
    
    if (existingData.success && existingData.requests.length > 0) {
      console.log(`Found ${existingData.requests.length} existing pending requests:`);
      existingData.requests.forEach(req => {
        console.log(`  - ${req.table_name}.${req.field_name} (${req.status})`);
      });
    } else {
      console.log('  No existing pending requests found.');
    }
    console.log('');
    
    // Step 2: Trigger sync that should fail and create pending request
    console.log('Step 2: Triggering Payment sync that should fail...');
    console.log('Expected: "column linked_invoice of relation payment does not exist"');
    console.log('');
    
    try {
      const syncResponse = await fetch(`${baseUrl}/api/sync/table/Payment?limit=500`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const syncResult = await syncResponse.json();
      console.log('❌ Sync Result (Expected to fail):');
      console.log('Status:', syncResponse.status);
      console.log('Response:', JSON.stringify(syncResult, null, 2));
      
    } catch (syncError) {
      console.log('❌ Sync failed as expected:', syncError.message);
    }
    console.log('');
    
    // Step 3: Check if pending request was created automatically
    console.log('Step 3: Checking if pending request was auto-created...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const newResponse = await fetch(`${baseUrl}/api/pending-patches/list`);
    const newData = await newResponse.json();
    
    if (newData.success && newData.requests.length > 0) {
      console.log('✅ SUCCESS! Pending requests found:');
      newData.requests.forEach(req => {
        console.log(`  📋 Request #${req.id}:`);
        console.log(`     Table: ${req.table_name}`);
        console.log(`     Field: ${req.field_name}`);
        console.log(`     Type: ${req.suggested_type}`);
        console.log(`     Status: ${req.status}`);
        console.log(`     Created: ${new Date(req.created_at).toLocaleString()}`);
        
        // Check if this is the payment.linked_invoice request
        if (req.table_name === 'payment' && req.field_name === 'linked_invoice') {
          console.log('     🎯 FOUND THE EXPECTED REQUEST! Auto-creation works!');
        }
        console.log('');
      });
    } else {
      console.log('❌ No pending requests found. Auto-creation may not be working.');
    }
    
    // Step 4: Show next steps
    console.log('Next Steps:');
    console.log('1. Visit your Railway frontend: ' + baseUrl);
    console.log('2. Navigate to "Data Management" > "Pending Patches"');
    console.log('3. Review and approve the pending requests');
    console.log('4. Retry the Payment sync - should work!');
    console.log('');
    console.log('API Endpoints:');
    console.log('- List requests: GET /api/pending-patches/list');
    console.log('- Approve request: POST /api/pending-patches/approve/{id}');
    console.log('- Frontend: /pending-patches');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAutoPendingRequest();