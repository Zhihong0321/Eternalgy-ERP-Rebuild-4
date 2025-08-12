import * as React from 'react';

// Data Types
export interface DataType {
  name: string;
  fields: Record<string, any>;
  recordCount: number;
  lastUpdated?: string;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync: string;
  totalRecords: number;
  errors: string[];
  progress?: number;
}

export interface BubbleConnectionStatus {
  connected: boolean;
  message: string;
  timestamp: string;
}

// Table and Column Types
export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean';
}

export interface TableData {
  data: Record<string, any>[];
  columns: DataTableColumn[];
  total: number;
  page: number;
  limit: number;
}

// Navigation Types
export interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  href: string;
  children?: NavigationItem[];
}

// Application Types
export interface BuildInfo {
  timestamp: string;
  commit: string;
  branch: string;
  version: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}