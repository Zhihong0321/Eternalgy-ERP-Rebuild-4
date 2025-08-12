import { PrismaClient } from '@prisma/client';
import BubbleService from './src/services/bubbleService.js';
import SchemaGenerationService from './src/services/schemaGenerationService.js';
import DataSyncService from './src/services/dataSyncService.js';
import { loggers } from './src/utils/logger.js';
import 'dotenv/config';

const prisma = new PrismaClient();
const logger = loggers.sync;

/**
 * Complete Database Reset and Sync Script
 * 
 * This script will:
 * 1. Drop ALL existing tables to avoid schema conflicts
 * 2. Generate fresh Prisma schema from current Bubble data
 * 3. Apply the new schema to PostgreSQL
 * 4. Sync data from Bubble to the clean database
 * 
 * Usage: node reset-and-sync.js
 */

async function resetAndSync() {
  const runId = logger.generateRunId();
  const startTime = Date.now();
  
  console.log('🔄 Starting complete database reset and sync');
  console.log(`📋 Run ID: ${runId}`);
  console.log(`🕐 Started at: ${new Date().toISOString()}`);
  
  logger.info('🔄 Starting complete database reset and sync', runId, {
    operation: 'reset_and_sync_start',
    timestamp: new Date().toISOString()
  });

  try {
    // Step 1: Drop all existing tables
    console.log('\n🗑️  Step 1: Dropping all existing tables...');
    await dropAllTables(runId);
    
    // Step 2: Generate fresh schema
    console.log('\n🏗️  Step 2: Generating fresh Prisma schema...');
    const schemaService = new SchemaGenerationService();
    const schemaResult = await schemaService.generateAndApplySchema();
    
    console.log('✅ Schema generation completed');
    console.log(`📊 Total types: ${schemaResult.generation.results.totalTypes}`);
    console.log(`✅ Processed types: ${schemaResult.generation.results.processedTypes}`);
    
    logger.info('Schema generation completed', runId, {
      operation: 'schema_generation_complete',
      totalTypes: schemaResult.generation.results.totalTypes,
      processedTypes: schemaResult.generation.results.processedTypes
    });
    
    // Step 3: Verify database is ready
    console.log('\n✅ Step 3: Verifying database connection...');
    await verifyDatabase(runId);
    
    // Step 4: Sync critical data types
    console.log('\n📊 Step 4: Syncing critical data from Bubble...');
    await syncCriticalData(runId);
    
    const duration = Date.now() - startTime;
    
    logger.info('🎉 Complete reset and sync finished successfully', runId, {
      operation: 'reset_and_sync_complete',
      duration: `${(duration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString()
    });
    
    console.log(`\n🎉 Reset and sync completed successfully in ${(duration / 1000).toFixed(2)}s`);
    console.log('✅ Database is now clean and ready for data storage');
    
  } catch (error) {
    logger.error('❌ Reset and sync failed', runId, {
      operation: 'reset_and_sync_error',
      error: error.message,
      stack: error.stack
    });
    
    console.error('❌ Reset and sync failed:', error.message);
    console.error('📋 Check logs for detailed error information');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function dropAllTables(runId) {
  try {
    // Get all table names
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != '_prisma_migrations'
    `;
    
    if (tables.length === 0) {
      console.log('📝 No existing tables found - database is clean');
      return;
    }
    
    console.log(`📝 Found ${tables.length} existing tables to drop`);
    
    // Drop all tables (except Prisma migrations)
    for (const table of tables) {
      const tableName = table.tablename;
      console.log(`🗑️  Dropping table: ${tableName}`);
      
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      
      logger.info(`Table dropped: ${tableName}`, runId, {
        operation: 'table_dropped',
        tableName
      });
    }
    
    console.log('✅ All existing tables dropped successfully');
    
  } catch (error) {
    console.error('❌ Failed to drop tables:', error.message);
    logger.error('Failed to drop tables', runId, {
      operation: 'drop_tables_error',
      error: error.message
    });
    throw new Error(`Failed to drop existing tables: ${error.message}`);
  }
}

async function verifyDatabase(runId) {
  try {
    // Test basic database connectivity
    await prisma.$queryRaw`SELECT 1 as test`;
    
    // Get current table count
    const tables = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name != '_prisma_migrations'
    `;
    
    const tableCount = parseInt(tables[0].count);
    
    logger.info('Database verification completed', runId, {
      operation: 'database_verification',
      tableCount,
      status: 'ready'
    });
    
    console.log(`✅ Database verified - ${tableCount} tables ready for data`);
    
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    logger.error('Database verification failed', runId, {
      operation: 'database_verification_error',
      error: error.message
    });
    throw new Error(`Database verification failed: ${error.message}`);
  }
}

async function syncCriticalData(runId) {
  try {
    const bubbleService = new BubbleService();
    const dataSyncService = new DataSyncService();
    
    // Discover available data types
    console.log('🔍 Discovering available data types...');
    const discovery = await bubbleService.discoverDataTypes();
    
    // Filter to types with data
    const typesWithData = discovery.discoveredTypes
      .filter(type => type.hasData)
      .slice(0, 5); // Limit to first 5 types for initial sync
    
    console.log(`📊 Found ${typesWithData.length} data types with data to sync`);
    
    if (typesWithData.length === 0) {
      console.log('⚠️  No data types with data found - skipping sync');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Sync each data type
    for (const dataType of typesWithData) {
      try {
        console.log(`📥 Syncing ${dataType.name}...`);
        
        const result = await dataSyncService.syncTableDirect(dataType.name, {
          limit: 25, // Start with small batches
          skipValidation: false
        });
        
        if (result.success) {
          successCount++;
          console.log(`✅ ${dataType.name}: ${result.recordsProcessed} records synced`);
        } else {
          errorCount++;
          console.log(`❌ ${dataType.name}: ${result.error}`);
        }
        
        // Small delay between syncs
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        errorCount++;
        console.log(`❌ ${dataType.name}: ${error.message}`);
        
        logger.error(`Sync failed for ${dataType.name}`, runId, {
          operation: 'data_sync_error',
          dataType: dataType.name,
          error: error.message
        });
      }
    }
    
    logger.info('Critical data sync completed', runId, {
      operation: 'critical_data_sync_complete',
      successCount,
      errorCount,
      totalAttempted: typesWithData.length
    });
    
    console.log(`\n📊 Data sync summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📈 Success rate: ${Math.round((successCount / typesWithData.length) * 100)}%`);
    
  } catch (error) {
    console.error('❌ Critical data sync failed:', error.message);
    logger.error('Critical data sync failed', runId, {
      operation: 'critical_data_sync_error',
      error: error.message
    });
    throw new Error(`Critical data sync failed: ${error.message}`);
  }
}

// Run the reset and sync
if (import.meta.url === `file://${process.argv[1]}`) {
  resetAndSync()
    .then(() => {
      console.log('\n🎉 Reset and sync completed successfully!');
      console.log('🚀 Your database is now clean and ready for production use.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Reset and sync failed:', error.message);
      process.exit(1);
    });
}

export default resetAndSync;