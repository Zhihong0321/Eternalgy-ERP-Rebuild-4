import { PrismaClient } from '@prisma/client';

/**
 * Global Prisma Instance
 * 
 * CRITICAL: Use this shared instance across all services to prevent
 * connection pool exhaustion. Do NOT create new PrismaClient() instances.
 * 
 * Connection pool settings optimized for Railway deployment.
 */

// Global variable to store the Prisma instance
let prisma;

// Function to get or create the Prisma instance
function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      // Optimize connection pooling for Railway
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      // Reduce connection pool size to prevent exhaustion
      __internal: {
        engine: {
          maxConnectionPool: 10, // Reduced from default 20
          idleTimeout: 30000,    // 30 seconds
          connectionTimeout: 5000 // 5 seconds
        }
      }
    });

    // Handle process termination gracefully
    process.on('beforeExit', async () => {
      await prisma.$disconnect();
    });

    process.on('SIGINT', async () => {
      await prisma.$disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await prisma.$disconnect();
      process.exit(0);
    });

    console.log('✅ Shared Prisma client initialized with optimized connection pool');
  }

  return prisma;
}

// Export the singleton instance
export default getPrismaClient();
export { getPrismaClient };