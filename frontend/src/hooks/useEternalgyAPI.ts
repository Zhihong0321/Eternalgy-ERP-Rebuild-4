import { useState } from 'react';
import axios from 'axios';
import type { AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://eternalgy-erp-retry3-production.up.railway.app';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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

  // Data types
  const getDataTypes = () => handleRequest<DataType[]>(() => api.get('/api/data-types'));

  // Data fetching
  const getData = (dataType: string, params?: { page?: number; limit?: number; search?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    const queryString = queryParams.toString();
    return handleRequest(() => api.get(`/api/data/${dataType}${queryString ? `?${queryString}` : ''}`));
  };

  // Data structure analysis
  const getDataStructure = (dataType: string) => 
    handleRequest(() => api.get(`/api/structure/${dataType}`));
    
  // Alias for compatibility
  const analyzeDataStructure = getDataStructure;

  // Sync operations
  const triggerSync = () => handleRequest(() => api.post('/api/sync/trigger'));
  const getSyncStatus = () => handleRequest<SyncStatus>(() => api.get('/api/sync/status'));
  
  // New sync operations
  const syncAllTables = (globalLimit: number = 3) => 
    handleRequest(() => api.post(`/api/sync/batch?globalLimit=${globalLimit}`));
  
  const syncTable = (tableName: string, limit: number = 3) =>
    handleRequest(() => api.post(`/api/sync/table/${tableName}?limit=${limit}`));
  
  const getSyncTables = () => handleRequest<{ tables: SyncTable[] }>(() => api.get('/api/sync/tables'));
  
  const wipeAllData = () => 
    handleRequest(() => api.delete('/api/schema/drop-all?confirm=yes-drop-all-tables'));

  // Bubble connection test
  const testBubbleConnection = () => handleRequest(() => api.get('/api/bubble/test'));

  return {
    loading,
    error,
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
  };
};

export default useEternalgyAPI;