// Quick script to create pending request for your current error
// This simulates what the sync service will do automatically in the future

async function createPendingRequest() {
  try {
    console.log('📋 Creating pending request for achieved_tier_bonus__ field...');
    
    const response = await fetch('https://eternalgy-erp-retry3-production.up.railway.app/api/pending-patches/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: 'agent_monthly_perf',
        fieldName: 'achieved_tier_bonus__',
        originalFieldName: 'Achieved Tier Bonus %',
        suggestedType: 'DECIMAL',
        reason: 'Manual creation for current sync error'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Pending request created successfully!');
      console.log('📝 Request details:', result.request);
      console.log('');
      console.log('🎯 NEXT STEPS:');
      console.log('1. Check pending requests: GET /api/pending-patches/list');
      console.log('2. Approve the request: POST /api/pending-patches/approve/{id}');
      console.log('3. Retry your sync - should work!');
      console.log('');
      console.log('🌐 Or visit your frontend to review and approve');
    } else {
      console.log('❌ Failed to create request:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

createPendingRequest();