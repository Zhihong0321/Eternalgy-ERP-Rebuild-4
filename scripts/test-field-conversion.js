#!/usr/bin/env node

// Test field name conversion logic
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

  // Fix reserved words - check original field name, not converted
  if (fieldName === '_id') {
    safeName = 'bubbleId';
  } else if (fieldName === 'id') {
    safeName = 'recordId';
  }

  return safeName || 'unknownField';
}

// Test with problematic field names from previous analysis
const testFields = [
  '_id',
  'Customer Name',
  'customer-name',
  '2nd Payment %', 
  '1st Payment %',
  'Agent Name',
  'Total Amount',
  'Payment Status',
  'Created Date',
  'Modified Date',
  'Email Address',
  'Phone Number',
  'Commission Rate',
  '123invalid',
  'special!@#chars',
  '',
  '   whitespace   ',
  'id',
  'select',
  'data'
];

console.log('🧪 Testing Field Name Conversion');
console.log('=================================\n');

testFields.forEach(field => {
  const converted = toSafeFieldName(field);
  const status = converted !== field ? '🔄' : '✅';
  console.log(`${status} "${field}" → "${converted}"`);
});

console.log('\n📊 Conversion Summary:');
const conversions = testFields.map(field => ({
  original: field,
  converted: toSafeFieldName(field),
  changed: field !== toSafeFieldName(field)
}));

const changedCount = conversions.filter(c => c.changed).length;
console.log(`Total fields tested: ${testFields.length}`);
console.log(`Fields requiring conversion: ${changedCount}`);
console.log(`Success rate: ${((testFields.length - changedCount) / testFields.length * 100).toFixed(1)}%`);

// Test for collisions
console.log('\n⚠️ Checking for collisions...');
const convertedNames = conversions.map(c => c.converted);
const uniqueNames = [...new Set(convertedNames)];

if (convertedNames.length !== uniqueNames.length) {
  console.log('🚨 Collision detected!');
  const collisions = convertedNames.filter((name, index) => 
    convertedNames.indexOf(name) !== index
  );
  console.log('Collisions:', [...new Set(collisions)]);
} else {
  console.log('✅ No collisions detected');
}

console.log('\n🎉 Field conversion test completed!');
