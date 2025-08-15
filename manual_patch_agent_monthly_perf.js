// Manual patch for agent_monthly_perf ultra-sparse fields
// These fields appear in < 0.1% of records, so automated discovery can't find them

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function manualPatchAgentMonthlyPerf() {
  console.log('🔧 Manual patch: Adding ultra-sparse fields to agent_monthly_perf');
  
  try {
    // Add "achieved_tier_bonus__" column (from "Achieved Tier Bonus %")
    console.log('Adding achieved_tier_bonus__ column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "agent_monthly_perf" 
      ADD COLUMN IF NOT EXISTS "achieved_tier_bonus__" DECIMAL
    `);
    console.log('✅ Added achieved_tier_bonus__ column');
    
    // Add "all_full_on_date" column (from "All Full On Date")  
    console.log('Adding all_full_on_date column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "agent_monthly_perf" 
      ADD COLUMN IF NOT EXISTS "all_full_on_date" TIMESTAMPTZ
    `);
    console.log('✅ Added all_full_on_date column');
    
    // Verify the columns were added
    console.log('🔍 Verifying columns were added...');
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agent_monthly_perf'
      AND column_name IN ('achieved_tier_bonus__', 'all_full_on_date')
      ORDER BY column_name
    `);
    
    console.log('✅ Verification complete:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    console.log('🎉 Manual patch completed successfully!');
    console.log('🔄 You can now retry your agent_monthly_perf sync');
    
  } catch (error) {
    console.error('❌ Manual patch failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

manualPatchAgentMonthlyPerf();