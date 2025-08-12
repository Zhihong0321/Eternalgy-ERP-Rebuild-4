import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful:', result);
    
    // Check existing tables
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
    
    // Check environment variables
    console.log('\n🔧 Environment check:');
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}`);
    console.log(`BUBBLE_API_KEY: ${process.env.BUBBLE_API_KEY ? 'Set' : 'Missing'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testConnection()
  .then(() => {
    console.log('\n✅ Database test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database test failed:', error.message);
    process.exit(1);
  });