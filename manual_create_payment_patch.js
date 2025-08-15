// Manual script to create pending request for Payment.linked_invoice field
// This bypasses the automatic detection and directly creates the request

async function createPaymentPatch() {
  console.log('🔧 Creating pending patch request for Payment.linked_invoice');
  console.log('===========================================================');
  
  try {
    const response = await fetch('https://eternalgy-erp-retry3-production.up.railway.app/api/pending-patches/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: 'payment',
        fieldName: 'linked_invoice',
        originalFieldName: 'Linked Invoice',
        suggestedType: 'TEXT',
        reason: 'Manual creation for Payment sync error - linked_invoice column missing'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Pending request created successfully!');
      console.log('📝 Request details:');
      console.log('   ID:', result.request.id);
      console.log('   Table:', result.request.table_name);
      console.log('   Field:', result.request.field_name);
      console.log('   Type:', result.request.suggested_type);
      console.log('   Status:', result.request.status);
      console.log('');
      console.log('🎯 NEXT STEPS:');
      console.log('1. Visit your Railway frontend');
      console.log('2. Go to "Data Management" > "Pending Patches"');
      console.log('3. You should see the Payment.linked_invoice request');
      console.log('4. Click "Approve" to add the column');
      console.log('5. Retry your Payment sync - should work!');
      console.log('');
      console.log('API Commands:');
      console.log(`   - Check: GET /api/pending-patches/list`);
      console.log(`   - Approve: POST /api/pending-patches/approve/${result.request.id}`);
    } else {
      console.log('❌ Failed to create request:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Script error:', error.message);
  }
}

createPaymentPatch();