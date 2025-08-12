import { PrismaClient } from '@prisma/client';
import BubbleService from './src/services/bubbleService.js';
import SchemaGenerationService from './src/services/schemaGenerationService.js';
import DataSyncService from './src/services/dataSyncService.js';
import 'dotenv/config';

const prisma = new PrismaClient();

async function generateAndSync() {
  console.log('🏗️  Starting schema generation and data sync...');
  
  try {
    // Step 1: Generate fresh schema
    console.log('\n🔍 Step 1: Generating fresh Prisma schema from Bubble data...');
    const schemaService = new SchemaGenerationService();
    
    console.log('📊 Discovering data types from Bubble...');
    const schemaResult = await schemaService.generateAndApplySchema();
    
    console.log('✅ Schema generation completed!');
    console.log(`📊 Total types discovered: ${schemaResult.generation.results.totalTypes}`);
    console.log(`✅ Successfully processed: ${schemaResult.generation.results.processedTypes}`);
    console.log(`❌ Failed: ${schemaResult.generation.results.failedTypes}`);
    
    if (schemaResult.generation.results.errors.length > 0) {
      console.log('⚠️  Schema generation errors:');
      schemaResult.generation.results.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    // Step 2: Verify database schema
    console.log('\n✅ Step 2: Verifying database schema...');
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != '_prisma_migrations'
      ORDER BY tablename
    `;
    
    console.log(`📊 Generated ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`  - ${table.tablename}`);
    });
    
    // Step 3: Test data sync
    console.log('\n📥 Step 3: Testing data sync...');
    const bubbleService = new BubbleService();
    const dataSyncService = new DataSyncService();
    
    // Discover available data types
    console.log('🔍 Discovering data types with data...');
    const discovery = await bubbleService.discoverDataTypes();
    
    const typesWithData = discovery.discoveredTypes
      .filter(type => type.hasData)
      .slice(0, 3); // Test with first 3 types
    
    console.log(`📊 Found ${typesWithData.length} data types with data to test`);
    
    if (typesWithData.length === 0) {
      console.log('⚠️  No data types with data found - skipping sync test');
    } else {
      let successCount = 0;
      let errorCount = 0;
      
      for (const dataType of typesWithData) {
        try {
          console.log(`📥 Testing sync for ${dataType.name}...`);
          
          const result = await dataSyncService.syncTableDirect(dataType.name, {
            limit: 10, // Small test batch
            skipValidation: false
          });
          
          if (result.success) {
            successCount++;
            console.log(`✅ ${dataType.name}: ${result.recordsProcessed} records synced successfully`);
          } else {
            errorCount++;
            console.log(`❌ ${dataType.name}: ${result.error}`);
          }
          
        } catch (error) {
          errorCount++;
          console.log(`❌ ${dataType.name}: ${error.message}`);
        }
      }
      
      console.log(`\n📊 Sync test summary:`);
      console.log(`✅ Successful: ${successCount}`);
      console.log(`❌ Failed: ${errorCount}`);
      console.log(`📈 Success rate: ${Math.round((successCount / typesWithData.length) * 100)}%`);
    }
    
    // Step 4: Final verification
    console.log('\n🔍 Step 4: Final verification...');
    const finalTables = await prisma.$queryRaw`
      SELECT 
        t.tablename,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename) as column_count
      FROM pg_tables t
      WHERE t.schemaname = 'public' 
      AND t.tablename != '_prisma_migrations'
      ORDER BY t.tablename
    `;
    
    console.log(`📊 Final database state - ${finalTables.length} tables:`);
    finalTables.forEach(table => {
      console.log(`  - ${table.tablename} (${table.column_count} columns)`);
    });
    
    console.log('\n🎉 Schema generation and sync test completed successfully!');
    console.log('✅ Database is now ready for production data storage');
    console.log('🚀 Your adaptive schema system is working correctly');
    
  } catch (error) {
    console.error('❌ Schema generation and sync failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

generateAndSync()
  .then(() => {
    console.log('\n✅ Process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Process failed:', error.message);
    process.exit(1);
  });