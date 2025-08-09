import { BubbleService } from './bubbleService.js';
import { PrismaClient } from '@prisma/client';

export class SimpleSyncService {
  constructor() {
    this.bubbleService = new BubbleService();
    this.prisma = new PrismaClient();
    this.rateLimitDelay = parseInt(process.env.SYNC_RATE_LIMIT_MS || '300'); // 300ms between requests
  }

  /**
   * Simple field name converter - fixes the main issues
   */
  toSafeFieldName(fieldName) {
    if (!fieldName || typeof fieldName !== 'string') {
      return 'unknownField';
    }

    let safeName = fieldName;
    
    // Remove special characters except spaces
    safeName = safeName.replace(/[^a-zA-Z0-9\s]/g, '');
    
    // Convert to camelCase
    safeName = safeName.split(' ')
      .map((word, index) => {
        if (index === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');

    // Fix numeric start
    if (/^[0-9]/.test(safeName)) {
      safeName = 'f' + safeName;
    }

    // Fix reserved words - check original field name
    if (fieldName === '_id') {
      safeName = 'bubbleId';
    } else if (fieldName === 'id') {
      safeName = 'recordId';
    }

    return safeName || 'unknownField';
  }

  /**
   * Rate limiting delay
   */
  async delay() {
    return new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }

  /**
   * Sync a single data type with record limit
   */
  async syncDataType(dataType, recordLimit = 10) {
    console.log(`Starting sync for ${dataType} (max ${recordLimit} records)...`);
    
    let cursor = 0;
    let totalRecords = 0;
    let hasMore = true;

    while (hasMore && totalRecords < recordLimit) {
      // Calculate how many records to fetch in this batch
      const remaining = recordLimit - totalRecords;
      const batchSize = Math.min(remaining, 100); // Max 100 per API call

      // Rate limiting
      await this.delay();

      // Fetch batch
      const result = await this.bubbleService.fetchDataType(dataType, { 
        cursor, 
        limit: batchSize
      });

      if (!result.success) {
        console.error(`Failed to fetch ${dataType} at cursor ${cursor}:`, result.error);
        break;
      }

      const records = result.data || [];
      console.log(`Fetched ${records.length} records from ${dataType} (${totalRecords}/${recordLimit})`);

      // Process each record (up to the limit)
      for (const record of records) {
        if (totalRecords >= recordLimit) break;
        
        await this.processRecord(dataType, record);
        totalRecords++;
      }

      // Stop if we've reached the limit
      if (totalRecords >= recordLimit) {
        console.log(`⏹️ Reached record limit of ${recordLimit} for ${dataType}`);
        break;
      }

      // Update cursor and check if more data
      cursor = result.cursor || cursor + records.length;
      hasMore = result.hasMore && records.length > 0;
    }

    console.log(`✅ Completed ${dataType}: ${totalRecords} records synced`);
    return totalRecords;
  }

  /**
   * Process a single record and save to database
   */
  async processRecord(dataType, record) {
    try {
      // Convert field names to safe versions
      const fields = Object.keys(record);
      const processedData = {};
      
      fields.forEach(field => {
        const safeName = this.toSafeFieldName(field);
        processedData[safeName] = record[field];
      });

      // Save to database using upsert (create or update)
      const syncedRecord = await this.prisma.syncedRecord.upsert({
        where: { bubbleId: record._id },
        update: {
          rawData: record,
          processedData: processedData,
          updatedAt: new Date()
        },
        create: {
          bubbleId: record._id,
          dataType: dataType,
          rawData: record,
          processedData: processedData
        }
      });

      console.log(`✅ Saved ${dataType} record:`, {
        id: syncedRecord.id,
        bubbleId: record._id,
        fields: fields.length,
        sampleFields: Object.keys(processedData).slice(0, 3)
      });
      
    } catch (error) {
      console.error(`❌ Failed to save ${dataType} record:`, error.message);
      throw error;
    }
  }

  /**
   * Sync all discovered data types
   */
  async syncAll(recordLimit = 100) {
    console.log('🚀 Starting simple sync...');
    
    // Update sync status
    await this.updateSyncStatus(true, 0, 'Discovering data types');

    // Discover what data types exist
    const dataTypes = await this.bubbleService.discoverDataTypes();
    console.log(`📊 Found ${dataTypes.length} data types:`, dataTypes.map(dt => dt.name));

    let totalSynced = 0;
    let currentProgress = 0;

    // Sync each data type sequentially with rate limiting
    for (const [index, dataType] of dataTypes.entries()) {
      if (!dataType.hasData) {
        console.log(`⏭️ Skipping ${dataType.name} (no data)`);
        continue;
      }

      await this.updateSyncStatus(true, Math.round((index / dataTypes.length) * 100), dataType.name);
      
      try {
        const recordCount = await this.syncDataType(dataType.name, recordLimit);
        totalSynced += recordCount;
      } catch (error) {
        console.error(`❌ Error syncing ${dataType.name}:`, error.message);
        await this.updateSyncStatus(false, currentProgress, null, error.message);
      }

      currentProgress = Math.round(((index + 1) / dataTypes.length) * 100);
    }

    // Mark sync complete
    await this.updateSyncStatus(false, 100, null);
    console.log(`🎉 Sync completed! Total records: ${totalSynced}`);
    
    return totalSynced;
  }

  /**
   * Update sync status in database
   */
  async updateSyncStatus(running, progress = 0, currentTable = null, error = null) {
    try {
      // Get or create sync status record
      let status = await this.prisma.syncStatus.findFirst();
      
      if (!status) {
        status = await this.prisma.syncStatus.create({
          data: {
            running,
            progress,
            currentTable,
            error,
            lastSync: new Date()
          }
        });
      } else {
        await this.prisma.syncStatus.update({
          where: { id: status.id },
          data: {
            running,
            progress,
            currentTable,
            error,
            lastSync: new Date()
          }
        });
      }
    } catch (err) {
      console.error('Failed to update sync status:', err.message);
    }
  }

  /**
   * Get current sync status
   */
  async getSyncStatus() {
    try {
      const status = await this.prisma.syncStatus.findFirst();
      return status || {
        running: false,
        progress: 0,
        currentTable: null,
        lastSync: null,
        error: null
      };
    } catch (error) {
      console.error('Failed to get sync status:', error.message);
      return null;
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
