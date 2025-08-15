import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * UDLS-Compliant Logger Service
 * Mandatory logging utility per project rules - all code must integrate this
 * 
 * LOG LEVEL FILTERING: Set LOG_LEVEL=INFO in production to reduce volume
 * - ERROR: Only errors
 * - WARN: Errors + warnings  
 * - INFO: Errors + warnings + info (default)
 * - DEBUG: All logs (development only)
 */
class Logger {
  constructor(context = 'general') {
    this.context = context;
    this.runtimeLogs = []; // In-memory logs (last 1000 entries)
    this.maxRuntimeLogs = 1000;
    this.batchSize = 100;
    this.batchTimeout = 30000; // 30 seconds
    this.pendingBatch = [];
    this.batchTimer = null;
    
    // Log level filtering for production (reduces volume)
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.logLevels = {
      'ERROR': 0,
      'WARN': 1, 
      'INFO': 2,
      'DEBUG': 3
    };
  }

  /**
   * Generate unique Run ID for tracking operations
   */
  generateRunId() {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Core logging method - handles both runtime and historical logging
   * Now includes log level filtering to reduce volume in production
   */
  async log(level, message, runId, metadata = {}) {
    const levelUpper = level.toUpperCase();
    
    // Filter out logs below configured level (reduces volume)
    const currentLevelNum = this.logLevels[this.logLevel] || 2;
    const messageLevelNum = this.logLevels[levelUpper] || 3;
    
    if (messageLevelNum > currentLevelNum) {
      return null; // Skip this log - below threshold
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      runId: runId || this.generateRunId(),
      level: levelUpper,
      context: this.context,
      message,
      metadata: {
        ...metadata,
        logger_version: '1.0'
      }
    };

    // Add to runtime logs (in-memory)
    this.addToRuntimeLogs(logEntry);

    // Add to historical batch (database) 
    this.addToHistoricalBatch(logEntry);

    // Console output for Railway logs
    this.logToConsole(logEntry);

    return logEntry;
  }

  /**
   * Convenience methods for different log levels
   */
  async info(message, runId, metadata = {}) {
    return this.log('INFO', message, runId, metadata);
  }

  async error(message, runId, metadata = {}) {
    return this.log('ERROR', message, runId, metadata);
  }

  async warn(message, runId, metadata = {}) {
    return this.log('WARN', message, runId, metadata);
  }

  async debug(message, runId, metadata = {}) {
    return this.log('DEBUG', message, runId, metadata);
  }

  /**
   * Add log to runtime memory (circular buffer)
   */
  addToRuntimeLogs(logEntry) {
    this.runtimeLogs.push(logEntry);
    
    // Keep only last N entries
    if (this.runtimeLogs.length > this.maxRuntimeLogs) {
      this.runtimeLogs = this.runtimeLogs.slice(-this.maxRuntimeLogs);
    }
  }

  /**
   * Add log to historical batch for database persistence
   */
  addToHistoricalBatch(logEntry) {
    this.pendingBatch.push(logEntry);

    // Flush batch if it reaches max size
    if (this.pendingBatch.length >= this.batchSize) {
      this.flushHistoricalBatch();
    } else {
      // Set timer for batch flush if not already set
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.flushHistoricalBatch();
        }, this.batchTimeout);
      }
    }
  }

  /**
   * Flush pending logs to database
   */
  async flushHistoricalBatch() {
    if (this.pendingBatch.length === 0) return;

    const batch = [...this.pendingBatch];
    this.pendingBatch = [];
    
    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      // Create system_logs table if it doesn't exist
      await this.ensureSystemLogsTable();

      // Insert batch using PostgreSQL-compatible VALUES syntax
      if (batch.length === 1) {
        // Single insert for performance
        const log = batch[0];
        await prisma.$executeRaw`
          INSERT INTO system_logs (timestamp, run_id, level, context, message, metadata)
          VALUES (
            ${new Date(log.timestamp)},
            ${log.runId},
            ${log.level},
            ${log.context},
            ${log.message},
            ${JSON.stringify(log.metadata)}::jsonb
          )
        `;
      } else {
        // Batch insert using multiple VALUES
        const values = batch.map(log => 
          `('${new Date(log.timestamp).toISOString()}', '${log.runId}', '${log.level}', '${log.context}', '${log.message.replace(/'/g, "''")}', '${JSON.stringify(log.metadata).replace(/'/g, "''")}'::jsonb)`
        ).join(',');
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO system_logs (timestamp, run_id, level, context, message, metadata)
          VALUES ${values}
        `);
      }

      console.log(`📝 UDLS: Flushed ${batch.length} logs to database`);
    } catch (error) {
      // Fallback: don't crash app if logging fails
      console.error('UDLS: Failed to flush logs to database:', error.message);
      
      // Add failed logs back to pending (with limit to prevent memory leak)
      this.pendingBatch = [...batch.slice(-50), ...this.pendingBatch];
    }
  }

  /**
   * Ensure system_logs table exists (UDLS requirement)
   */
  async ensureSystemLogsTable() {
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS system_logs (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMPTZ NOT NULL,
          run_id VARCHAR(50) NOT NULL,
          level VARCHAR(10) NOT NULL,
          context VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      // Create indexes if they don't exist
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_system_logs_run_id ON system_logs(run_id)
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC)
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_system_logs_context ON system_logs(context)
      `;
    } catch (error) {
      console.error('UDLS: Failed to ensure system_logs table:', error.message);
    }
  }

  /**
   * Console output for Railway logs
   */
  logToConsole(logEntry) {
    const { timestamp, runId, level, context, message, metadata } = logEntry;
    const prefix = `[${timestamp}] ${level} [${context}] [${runId}]`;
    
    switch (level) {
      case 'ERROR':
        console.error(`${prefix} ${message}`, metadata);
        break;
      case 'WARN':
        console.warn(`${prefix} ${message}`, metadata);
        break;
      case 'DEBUG':
        console.debug(`${prefix} ${message}`, metadata);
        break;
      default:
        console.log(`${prefix} ${message}`, metadata);
    }
  }

  /**
   * Get recent runtime logs
   */
  getRecentLogs(limit = 50) {
    const maxLimit = Math.min(limit, 500); // UDLS max limit
    return this.runtimeLogs.slice(-maxLimit);
  }

  /**
   * Get error logs only
   */
  getErrorLogs(limit = 25) {
    return this.runtimeLogs
      .filter(log => log.level === 'ERROR')
      .slice(-limit);
  }

  /**
   * Get logs for specific runId
   */
  getRunLogs(runId) {
    return this.runtimeLogs.filter(log => log.runId === runId);
  }

  /**
   * Get logging statistics
   */
  getStats() {
    const stats = {
      runtime: {
        total: this.runtimeLogs.length,
        byLevel: {}
      },
      pending: this.pendingBatch.length,
      lastFlush: this.batchTimer ? 'pending' : 'none'
    };

    // Count by level
    this.runtimeLogs.forEach(log => {
      stats.runtime.byLevel[log.level] = (stats.runtime.byLevel[log.level] || 0) + 1;
    });

    return stats;
  }

  /**
   * Graceful shutdown - flush any pending logs
   */
  async shutdown() {
    if (this.pendingBatch.length > 0) {
      await this.flushHistoricalBatch();
    }
    await prisma.$disconnect();
  }
}

// Global logger instances for different contexts
const loggers = {
  sync: new Logger('sync'),
  api: new Logger('api'),
  schema: new Logger('schema'),
  database: new Logger('database'),
  discovery: new Logger('discovery')
};

export default Logger;
export { loggers };
