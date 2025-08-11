import { PrismaClient } from '@prisma/client';

async function checkTables() {
  const prisma = new PrismaClient();
  
  try {
    const result = await prisma.$queryRaw`
      SELECT tablename
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND tablename != '_prisma_migrations'
      ORDER BY tablename
    `;
    
    console.log(`Tables found: ${result.length}`);
    result.forEach(table => console.log(`- ${table.tablename}`));
    
    // Also check specifically for category table
    if (result.find(t => t.tablename === 'category')) {
      console.log('\n=== Category table structure ===');
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'category' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;
      columns.forEach(col => console.log(`${col.column_name}: ${col.data_type}`));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
