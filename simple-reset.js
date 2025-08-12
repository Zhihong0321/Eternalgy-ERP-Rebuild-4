import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function simpleReset() {
  console.log('🔄 Starting simple database reset...');
  
  try {
    // Step 1: Test connection
    console.log('\n🔍 Testing database connection...');
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    
    // Step 2: List existing tables
    console.log('\n📋 Checking existing tables...');
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != '_prisma_migrations'
      ORDER BY tablename
    `;
    
    console.log(`📊 Found ${tables.length} existing tables:`);
    tables.forEach(table => {
      console.log(`  - ${table.tablename}`);
    });
    
    // Step 3: Drop existing tables
    if (tables.length > 0) {
      console.log('\n🗑️  Dropping existing tables...');
      
      for (const table of tables) {
        const tableName = table.tablename;
        console.log(`🗑️  Dropping table: ${tableName}`);
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      }
      
      console.log('✅ All existing tables dropped successfully');
    } else {
      console.log('📝 No existing tables to drop');
    }
    
    // Step 4: Verify clean state
    console.log('\n✅ Verifying clean database state...');
    const remainingTables = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name != '_prisma_migrations'
    `;
    
    const tableCount = parseInt(remainingTables[0].count);
    console.log(`📊 Remaining tables: ${tableCount}`);
    
    if (tableCount === 0) {
      console.log('✅ Database is now clean and ready for fresh schema');
    } else {
      console.log('⚠️  Some tables may still exist');
    }
    
    console.log('\n🎉 Simple reset completed successfully!');
    console.log('🚀 Database is ready for schema regeneration');
    
  } catch (error) {
    console.error('❌ Simple reset failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

simpleReset()
  .then(() => {
    console.log('\n✅ Reset process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Reset process failed:', error.message);
    process.exit(1);
  });