// Schema Documentation Types

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
  position: number;
  comment: string | null;
  businessDescription?: string | null;
}

export interface DatabaseTable {
  tableName: string;
  tableType: string;
  tableComment: string | null;
  columns: DatabaseColumn[];
}

export interface DatabaseSchema {
  [tableName: string]: DatabaseTable;
}

export interface SchemaMetadata {
  introspectedAt: string;
  totalTables: number;
  totalColumns: number;
}

export interface SchemaResponse {
  success: boolean;
  schema: DatabaseSchema;
  metadata: SchemaMetadata;
  runId: string;
  endpoint: string;
  duration: number;
  timestamp: string;
}

export interface TableResponse {
  success: boolean;
  table: DatabaseTable;
  runId: string;
  endpoint: string;
  duration: number;
  timestamp: string;
}

export interface TablesListResponse {
  success: boolean;
  tables: string[];
  count: number;
  runId: string;
  endpoint: string;
  duration: number;
  timestamp: string;
}

// Documentation Types

export interface FieldDescriptions {
  [fieldName: string]: string;
}

export interface DocumentationMetadata {
  totalFields: number;
  documentedFields: number;
}

export interface TableDocumentation {
  tableName: string;
  descriptions: FieldDescriptions;
  metadata: DocumentationMetadata;
  lastUpdated: string | null;
}

export interface DocumentationResponse {
  success: boolean;
  tableName: string;
  descriptions: FieldDescriptions;
  metadata: DocumentationMetadata;
  lastUpdated: string | null;
  runId: string;
  endpoint: string;
  duration: number;
  timestamp: string;
}

export interface SaveDocumentationResponse {
  success: boolean;
  tableName: string;
  saved: number;
  documented: number;
  runId: string;
  endpoint: string;
  duration: number;
  timestamp: string;
}

export interface DocumentedTablesResponse {
  success: boolean;
  tables: {
    [tableName: string]: DocumentationMetadata & {
      lastUpdated: string;
    };
  };
  metadata: {
    totalTables: number;
    lastUpdated: string;
  };
  runId: string;
  endpoint: string;
  duration: number;
  timestamp: string;
}

// Export Types

export interface ExportColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
  position: number;
  comment: string | null;
  businessDescription: string | null;
}

export interface ExportTable {
  tableName: string;
  tableType: string;
  tableComment: string | null;
  columns: ExportColumn[];
  documentation: {
    lastUpdated: string | null;
    totalFields: number;
    documentedFields: number;
  };
}

export interface ExportData {
  exportedAt: string;
  version: string;
  metadata: {
    schemaIntrospectedAt: string;
    documentationExportedAt: string;
    totalTables: number;
    totalColumns: number;
    documentedTables: number;
  };
  tables: {
    [tableName: string]: ExportTable;
  };
}

export interface ExportResponse {
  success: boolean;
  data: ExportData;
  runId: string;
  endpoint: string;
  duration: number;
  timestamp: string;
}

// API Error Response

export interface ApiError {
  success: false;
  error: string;
  runId: string;
  endpoint: string;
  duration: number;
  timestamp: string;
}

// Hook Types

export interface UseSchemaResult {
  schema: DatabaseSchema | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseTableSchemaResult {
  table: DatabaseTable | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseTablesResult {
  tables: string[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseDocumentationResult {
  documentation: TableDocumentation | null;
  isLoading: boolean;
  error: string | null;
  save: (descriptions: FieldDescriptions) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export interface UseDocumentedTablesResult {
  documentedTables: DocumentedTablesResponse['tables'];
  metadata: DocumentedTablesResponse['metadata'];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Component Props Types

export interface TableSelectorProps {
  tables: string[];
  selectedTable: string | null;
  onTableSelect: (tableName: string) => void;
  isLoading?: boolean;
  className?: string;
}

export interface FieldEditorProps {
  table: DatabaseTable;
  descriptions: FieldDescriptions;
  onDescriptionChange: (fieldName: string, description: string) => void;
  isLoading?: boolean;
  className?: string;
}

export interface ExportButtonProps {
  onExport: () => Promise<void>;
  isExporting?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface SchemaPreviewProps {
  table: DatabaseTable;
  descriptions: FieldDescriptions;
  className?: string;
}

// Form Types for validation (using zod if needed)

export interface FieldDescriptionForm {
  fieldName: string;
  description: string;
}

export interface TableDocumentationForm {
  tableName: string;
  descriptions: FieldDescriptionForm[];
}

// Status and Loading States

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: LoadingState;
  error: string | null;
}

// Utility Types

export type TableName = string;
export type FieldName = string;
export type Description = string;

export interface TableStats {
  totalFields: number;
  documentedFields: number;
  completionPercentage: number;
}

export interface SchemaStats {
  totalTables: number;
  documentedTables: number;
  totalFields: number;
  documentedFields: number;
  overallCompletion: number;
}
