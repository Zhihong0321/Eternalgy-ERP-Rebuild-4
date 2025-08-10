// Quick test of schema generation locally
import SchemaGenerationService from './src/services/schemaGenerationService.js';

const schemaService = new SchemaGenerationService();

console.log('🧪 Testing schema generation service locally...');

try {
  // Test the analysis function for invoice data type
  const analysis = await schemaService.analyzeDataTypeStructure('invoice', 3);
  console.log('✅ Analysis result:', {
    hasData: analysis.hasData,
    fieldCount: Object.keys(analysis.fields).length,
    sampleCount: analysis.sampleCount
  });

  // Test model generation
  const model = schemaService.generateModelDefinition('invoice', analysis);
  console.log('✅ Model generation successful:', {
    modelName: model.modelName,
    tableName: model.tableName,
    fieldCount: model.fieldCount
  });

  console.log('📝 Sample model definition:\n', model.definition);

} catch (error) {
  console.error('❌ Local test failed:', error.message);
}
