import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type {
  UseSchemaResult,
  UseTableSchemaResult,
  UseTablesResult,
  UseDocumentationResult,
  UseDocumentedTablesResult,
  SchemaResponse,
  TableResponse,
  TablesListResponse,
  DocumentationResponse,
  SaveDocumentationResponse,
  DocumentedTablesResponse,
  ExportResponse,
  FieldDescriptions,
  ApiError,
  DatabaseSchema,
  DatabaseTable,
} from '@/types/schema';

const API_BASE_URL = '/api/docs';

// Helper function to handle API errors
const handleApiError = (error: any): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError;
    if (apiError?.error) {
      return apiError.error;
    }
    return error.message || 'API request failed';
  }
  return error.message || 'Unknown error occurred';
};

/**
 * Hook to fetch full database schema
 */
export const useSchema = (): UseSchemaResult => {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchema = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get<SchemaResponse>(`${API_BASE_URL}/schema`);
      
      if (response.data.success) {
        setSchema(response.data.schema);
      } else {
        throw new Error('Failed to fetch schema');
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      setSchema(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  return {
    schema,
    isLoading,
    error,
    refetch: fetchSchema,
  };
};

/**
 * Hook to fetch schema for a specific table
 */
export const useTableSchema = (tableName: string | null): UseTableSchemaResult => {
  const [table, setTable] = useState<DatabaseTable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTableSchema = useCallback(async () => {
    if (!tableName) {
      setTable(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get<TableResponse>(
        `${API_BASE_URL}/schema/${encodeURIComponent(tableName)}`
      );
      
      if (response.data.success) {
        setTable(response.data.table);
      } else {
        throw new Error('Failed to fetch table schema');
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      setTable(null);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    fetchTableSchema();
  }, [fetchTableSchema]);

  return {
    table,
    isLoading,
    error,
    refetch: fetchTableSchema,
  };
};

/**
 * Hook to fetch list of all table names
 */
export const useTables = (): UseTablesResult => {
  const [tables, setTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get<TablesListResponse>(`${API_BASE_URL}/tables`);
      
      if (response.data.success) {
        setTables(response.data.tables);
      } else {
        throw new Error('Failed to fetch tables list');
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      setTables([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  return {
    tables,
    isLoading,
    error,
    refetch: fetchTables,
  };
};

/**
 * Hook to manage documentation for a specific table
 */
export const useDocumentation = (tableName: string | null): UseDocumentationResult => {
  const [documentation, setDocumentation] = useState<{
    tableName: string;
    descriptions: FieldDescriptions;
    metadata: {
      totalFields: number;
      documentedFields: number;
    };
    lastUpdated: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentation = useCallback(async () => {
    if (!tableName) {
      setDocumentation(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get<DocumentationResponse>(
        `${API_BASE_URL}/descriptions/${encodeURIComponent(tableName)}`
      );
      
      if (response.data.success) {
        setDocumentation({
          tableName: response.data.tableName,
          descriptions: response.data.descriptions,
          metadata: response.data.metadata,
          lastUpdated: response.data.lastUpdated,
        });
      } else {
        throw new Error('Failed to fetch documentation');
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      setDocumentation(null);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  const saveDocumentation = useCallback(async (descriptions: FieldDescriptions): Promise<boolean> => {
    if (!tableName) {
      throw new Error('No table selected');
    }

    try {
      const response = await axios.post<SaveDocumentationResponse>(
        `${API_BASE_URL}/descriptions/${encodeURIComponent(tableName)}`,
        { descriptions }
      );

      if (response.data.success) {
        // Refresh documentation after successful save
        await fetchDocumentation();
        return true;
      } else {
        throw new Error('Failed to save documentation');
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      return false;
    }
  }, [tableName, fetchDocumentation]);

  useEffect(() => {
    fetchDocumentation();
  }, [fetchDocumentation]);

  return {
    documentation,
    isLoading,
    error,
    save: saveDocumentation,
    refetch: fetchDocumentation,
  };
};

/**
 * Hook to fetch list of documented tables
 */
export const useDocumentedTables = (): UseDocumentedTablesResult => {
  const [documentedTables, setDocumentedTables] = useState({});
  const [metadata, setMetadata] = useState({ totalTables: 0, lastUpdated: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentedTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get<DocumentedTablesResponse>(
        `${API_BASE_URL}/documented-tables`
      );
      
      if (response.data.success) {
        setDocumentedTables(response.data.tables);
        setMetadata(response.data.metadata);
      } else {
        throw new Error('Failed to fetch documented tables');
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      setDocumentedTables({});
      setMetadata({ totalTables: 0, lastUpdated: '' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocumentedTables();
  }, [fetchDocumentedTables]);

  return {
    documentedTables,
    metadata,
    isLoading,
    error,
    refetch: fetchDocumentedTables,
  };
};

/**
 * Hook to export schema documentation
 */
export const useExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportDocumentation = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await axios.get<ExportResponse>(`${API_BASE_URL}/export`);
      
      if (response.data.success) {
        // Create and trigger download
        const blob = new Blob([JSON.stringify(response.data.data, null, 2)], {
          type: 'application/json',
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const filename = `schema_documentation_${new Date().toISOString().split('T')[0]}.json`;
        link.download = filename;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        return true;
      } else {
        throw new Error('Failed to export documentation');
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      return false;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    exportDocumentation,
    isExporting,
    error,
  };
};

/**
 * Hook to delete table documentation
 */
export const useDeleteDocumentation = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteDocumentation = useCallback(async (tableName: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await axios.delete(
        `${API_BASE_URL}/descriptions/${encodeURIComponent(tableName)}`
      );
      
      if (response.data.success) {
        return true;
      } else {
        throw new Error('Failed to delete documentation');
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    deleteDocumentation,
    isDeleting,
    error,
  };
};
