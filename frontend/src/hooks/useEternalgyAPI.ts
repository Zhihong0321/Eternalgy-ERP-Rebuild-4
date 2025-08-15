import { useState } from 'react';
import axios from 'axios';
import type { AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://eternalgy-erp-retry3-production.up.railway.app';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 0, // No timeout - let operations run as long as needed
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ApiResponse<T = any> {
  data: T;
  loading: boolean;
  error: string | null;
}

export interface DataType {
  name: string;
  fields: Record<string, any>;
  recordCount: number;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync: string;
  totalRecords: number;
  errors: string[];
}

export interface SyncTable {
  name: string;
  tablename: string;
  recordCount: number;
  withData: boolean;
  relationshipStatus?: RelationshipStatus;
}

export interface BubbleConnectionStatus {
  connected: boolean;
  message: string;
  timestamp: string;
}

export interface RelationshipStatus {
  total: number;
  relationalConfirmed: number;
  textOnly: number;
  linked: number;
  pendingLink: number;
  isRelationalReady: boolean;
}

export const useEternalgyAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    isActive: boolean;
    message: string;
    operation: string;
    startTime?: number;
  }>({
    isActive: false,
    message: '',
    operation: ''
  });

  // Global sync lock to prevent multiple simultaneous operations
  const [globalSyncLock, setGlobalSyncLock] = useState(false);

  // Helper to wrap sync operations with global lock
  const withSyncLock = async <T>(
    operation: string,
    message: string,
    syncFn: () => Promise<T | null>
  ): Promise<T | null> => {
    if (globalSyncLock) {
      setError('Another sync operation is already running. Please wait for it to complete.');
      return null;
    }

    setGlobalSyncLock(true);
    setSyncProgress({
      isActive: true,
      message,
      operation,
      startTime: Date.now()
    });

    try {
      const result = await syncFn();
      setSyncProgress({
        isActive: false,
        message: result ? `${operation} completed!` : `${operation} failed`,
        operation
      });
      return result;
    } catch (error: any) {
      setSyncProgress({
        isActive: false,
        message: `${operation} failed: ${error.message || error}`,
        operation
      });
      setError(`${operation} failed: ${error.message || error}`);
      return null;
    } finally {
      setGlobalSyncLock(false);
    }
  };

  const handleRequest = async <T>(
    requestFn: () => Promise<AxiosResponse<T>>
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await requestFn();
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'An error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Health check
  const checkHealth = () => handleRequest(() => api.get('/health'));

  // Data types (for Data Browser - reads from PostgreSQL)
  const getDataTypes = () => handleRequest(() => api.get('/api/database/tables'));

  // Data fetching (for Data Browser - reads from PostgreSQL)
  const getData = (dataType: string, params?: { page?: number; limit?: number; search?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page && params.page > 1) {
      const offset = (params.page - 1) * (params.limit || 50);
      queryParams.append('offset', offset.toString());
    }
    const queryString = queryParams.toString();
    return handleRequest(() => api.get(`/api/database/data/${dataType}${queryString ? `?${queryString}` : ''}`));
  };

  // Data structure analysis (for Data Browser - reads from PostgreSQL)
  const getDataStructure = (dataType: string) => 
    handleRequest(() => api.get(`/api/database/structure/${dataType}`));

  // Bubble.io specific methods (for sync operations)
  const getBubbleDataTypes = () => handleRequest<DataType[]>(() => api.get('/api/bubble/discover-types'));
  
  const getBubbleData = (dataType: string, params?: { limit?: number; search?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    const queryString = queryParams.toString();
    return handleRequest(() => api.get(`/api/bubble/fetch/${dataType}${queryString ? `?${queryString}` : ''}`));
  };

  const scanRecordCount = (tableName: string) =>
    handleRequest(() => api.get(`/api/bubble/scan/${tableName}`));
    
  // Alias for compatibility
  const analyzeDataStructure = getDataStructure;

  // Sync operations (removed non-existent endpoints that were triggering operations)
  
  // Enhanced sync operations with progress tracking
  const syncAllTables = async (globalLimit: number = 3) => {
    return await withSyncLock(
      'batch_sync',
      `Starting batch sync of all tables (limit: ${globalLimit})...`,
      () => handleRequest(() => api.post(`/api/sync/batch?globalLimit=${globalLimit}`))
    );
  };
  
  const syncTable = async (tableName: string, limit: number = 3) => {
    return await withSyncLock(
      `sync_${tableName}`,
      `Syncing ${tableName} table (${limit} records)...`,
      () => handleRequest(() => api.post(`/api/sync/table/${tableName}?limit=${limit}`))
    );
  };

  const syncTableIncremental = async (tableName: string, limit: number = 100) => {
    return await withSyncLock(
      `sync_plus_${tableName}`,
      `SYNC+ ${tableName} (${limit} new records)...`,
      () => handleRequest(() => api.post(`/api/sync/table/${tableName}/plus?limit=${limit}`))
    );
  };
  
  const getSyncTables = () => handleRequest(() => api.get('/api/database/tables'));
  
  const wipeAllData = () => 
    handleRequest(() => api.delete('/api/schema/drop-all?confirm=yes-drop-all-tables'));

  const createTables = () =>
    handleRequest(() => api.post('/api/schema/create-tables'));

  const recreateTable = (tableName: string) =>
    handleRequest(() => api.post(`/api/schema/recreate-table/${tableName}`));

  // Bubble connection test  
  const testBubbleConnection = () => handleRequest(() => api.get('/api/bubble/test-connection'));

  // Relationship discovery methods
  const discoverRelationships = async (tableName: string) => {
    setSyncProgress({
      isActive: true,
      message: `Discovering relationships for ${tableName}...`,
      operation: `discover_${tableName}`,
      startTime: Date.now()
    });
    
    try {
      const result = await handleRequest(() => api.post(`/api/sync/discover/${tableName}`));
      setSyncProgress({
        isActive: false,
        message: result ? `${tableName} relationship discovery completed!` : `${tableName} discovery failed`,
        operation: `discover_${tableName}`
      });
      return result;
    } catch (error) {
      setSyncProgress({
        isActive: false,
        message: `${tableName} discovery failed: ${error}`,
        operation: `discover_${tableName}`
      });
      throw error;
    }
  };

  const getRelationshipStatus = (tableName: string) => 
    handleRequest(() => api.get(`/api/sync/relationship-status/${tableName}`));

  const getAllRelationshipStatuses = () => 
    handleRequest(() => api.get('/api/sync/relationship-statuses'));

  const discoverAllRelationships = async () => {
    return await withSyncLock(
      'discover_all',
      'Discovering relationships for all tables...',
      () => handleRequest(() => api.post('/api/sync/discover-all'))
    );
  };

  return {
    loading,
    error,
    syncProgress,
    globalSyncLock,
    checkHealth,
    getDataTypes,
    getData,
    getDataStructure,
    analyzeDataStructure,
    syncAllTables,
    syncTable,
    syncTableIncremental,
    getSyncTables,
    wipeAllData,
    createTables,
    recreateTable,
    testBubbleConnection,
    discoverRelationships,
    discoverAllRelationships,
    getRelationshipStatus,
    getAllRelationshipStatuses,
    // Bubble.io specific methods
    getBubbleDataTypes,
    getBubbleData,
    scanRecordCount,
  };
};

export default useEternalgyAPI;