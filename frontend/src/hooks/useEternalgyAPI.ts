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
}

export interface BubbleConnectionStatus {
  connected: boolean;
  message: string;
  timestamp: string;
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
    
  // Alias for compatibility
  const analyzeDataStructure = getDataStructure;

  // Sync operations
  const triggerSync = () => handleRequest(() => api.post('/api/sync/trigger'));
  const getSyncStatus = () => handleRequest<SyncStatus>(() => api.get('/api/sync/status'));
  
  // Enhanced sync operations with progress tracking
  const syncAllTables = async (globalLimit: number = 3) => {
    setSyncProgress({
      isActive: true,
      message: `Starting batch sync of all tables (limit: ${globalLimit})...`,
      operation: 'batch_sync',
      startTime: Date.now()
    });
    
    try {
      const result = await handleRequest(() => api.post(`/api/sync/batch?globalLimit=${globalLimit}`));
      setSyncProgress({
        isActive: false,
        message: result ? 'Batch sync completed successfully!' : 'Batch sync failed',
        operation: 'batch_sync'
      });
      return result;
    } catch (error) {
      setSyncProgress({
        isActive: false,
        message: `Batch sync failed: ${error}`,
        operation: 'batch_sync'
      });
      throw error;
    }
  };
  
  const syncTable = async (tableName: string, limit: number = 3) => {
    setSyncProgress({
      isActive: true,
      message: `Syncing ${tableName} table (${limit} records)...`,
      operation: `sync_${tableName}`,
      startTime: Date.now()
    });
    
    try {
      const result = await handleRequest(() => api.post(`/api/sync/table/${tableName}?limit=${limit}`));
      setSyncProgress({
        isActive: false,
        message: result ? `${tableName} sync completed!` : `${tableName} sync failed`,
        operation: `sync_${tableName}`
      });
      return result;
    } catch (error) {
      setSyncProgress({
        isActive: false,
        message: `${tableName} sync failed: ${error}`,
        operation: `sync_${tableName}`
      });
      throw error;
    }
  };
  
  const getSyncTables = () => handleRequest(() => api.get('/api/database/tables'));
  
  const wipeAllData = () => 
    handleRequest(() => api.delete('/api/schema/drop-all?confirm=yes-drop-all-tables'));

  // Bubble connection test  
  const testBubbleConnection = () => handleRequest(() => api.get('/api/bubble/test-connection'));

  return {
    loading,
    error,
    syncProgress,
    checkHealth,
    getDataTypes,
    getData,
    getDataStructure,
    analyzeDataStructure,
    triggerSync,
    getSyncStatus,
    syncAllTables,
    syncTable,
    getSyncTables,
    wipeAllData,
    testBubbleConnection,
    // Bubble.io specific methods
    getBubbleDataTypes,
    getBubbleData,
  };
};

export default useEternalgyAPI;