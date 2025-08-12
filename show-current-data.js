import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

/**
 * Display all current data in the PostgreSQL database
 */

async function showCurrentData() {
  console.log('📊 Current Data in PostgreSQL Database');
  console.log('=' .repeat(50));
  
  try {
    // Show all tables
    console.log('\n🏗️  Database Schema:');
    const tables = await prisma.$queryRaw`
      SELECT tablename, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) as columns
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != '_prisma_migrations'
      ORDER BY tablename
    `;
    
    tables.forEach(table => {
      console.log(`   📋 ${table.tablename}: ${table.columns} columns`);
    });
    
    // Show Agents data
    console.log('\n👥 AGENTS TABLE:');
    const agents = await prisma.$queryRaw`
      SELECT bubble_id, name, email, phone, commission_rate, status, data
      FROM agents
      ORDER BY created_date
    `;
    
    if (agents.length > 0) {
      agents.forEach((agent, index) => {
        console.log(`   ${index + 1}. ${agent.name}`);
        console.log(`      📧 Email: ${agent.email}`);
        console.log(`      📞 Phone: ${agent.phone}`);
        console.log(`      💰 Commission: ${agent.commission_rate}%`);
        console.log(`      🆔 Bubble ID: ${agent.bubble_id}`);
        console.log(`      📊 Extra Data: ${JSON.stringify(agent.data)}`);
        console.log('');
      });
    } else {
      console.log('   No agents found');
    }
    
    // Show Contacts data
    console.log('\n📞 CONTACTS TABLE:');
    const contacts = await prisma.$queryRaw`
      SELECT bubble_id, name, email, phone, company, status, data
      FROM contacts
      ORDER BY created_date
    `;
    
    if (contacts.length > 0) {
      contacts.forEach((contact, index) => {
        console.log(`   ${index + 1}. ${contact.name}`);
        console.log(`      📧 Email: ${contact.email}`);
        console.log(`      📞 Phone: ${contact.phone}`);
        console.log(`      🏢 Company: ${contact.company}`);
        console.log(`      🆔 Bubble ID: ${contact.bubble_id}`);
        console.log(`      📊 Extra Data: ${JSON.stringify(contact.data)}`);
        console.log('');
      });
    } else {
      console.log('   No contacts found');
    }
    
    // Show Products data
    console.log('\n🛍️  PRODUCTS TABLE:');
    const products = await prisma.$queryRaw`
      SELECT bubble_id, name, description, price, category, status, data
      FROM products
      ORDER BY created_date
    `;
    
    if (products.length > 0) {
      products.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name}`);
        console.log(`      📝 Description: ${product.description}`);
        console.log(`      💰 Price: $${product.price}`);
        console.log(`      📂 Category: ${product.category}`);
        console.log(`      🆔 Bubble ID: ${product.bubble_id}`);
        console.log(`      📊 Extra Data: ${JSON.stringify(product.data)}`);
        console.log('');
      });
    } else {
      console.log('   No products found');
    }
    
    // Show Sync Status
    console.log('\n📈 SYNC STATUS:');
    const syncStatus = await prisma.$queryRaw`
      SELECT table_name, total_records, sync_status, last_sync_timestamp
      FROM sync_status
      ORDER BY table_name
    `;
    
    if (syncStatus.length > 0) {
      syncStatus.forEach(status => {
        console.log(`   📊 ${status.table_name}: ${status.total_records} records (${status.sync_status})`);
        console.log(`      🕒 Last sync: ${status.last_sync_timestamp}`);
      });
    } else {
      console.log('   No sync status records found');
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY:');
    console.log(`   🏗️  Tables: ${tables.length}`);
    console.log(`   👥 Agents: ${agents.length}`);
    console.log(`   📞 Contacts: ${contacts.length}`);
    console.log(`   🛍️  Products: ${products.length}`);
    console.log(`   📈 Sync Records: ${syncStatus.length}`);
    
    const totalRecords = agents.length + contacts.length + products.length;
    console.log(`   📊 Total Business Records: ${totalRecords}`);
    
    if (totalRecords > 0) {
      console.log('\n✅ YES - Data is detected and stored in PostgreSQL!');
      console.log('🚀 The database is populated and ready for operations.');
    } else {
      console.log('\n❌ NO - No business data found in PostgreSQL.');
      console.log('🔧 Run the sync process to populate data from Bubble.');
    }
    
  } catch (error) {
    console.error('❌ Error reading database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

showCurrentData()
  .then(() => {
    console.log('\n✅ Data display completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });