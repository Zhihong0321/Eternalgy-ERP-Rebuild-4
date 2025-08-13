import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Save, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  FileText,
  Database,
  BookOpen
} from 'lucide-react';

// Import our new components and hooks
import TableSelector from '@/components/schema/TableSelector';
import FieldEditor from '@/components/schema/FieldEditor';
import ExportButton from '@/components/schema/ExportButton';
import { 
  useTables, 
  useTableSchema, 
  useDocumentation,
  useExport
} from '@/hooks/useSchema';
import type { FieldDescriptions } from '@/types/schema';

const SchemaDescription = () => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [descriptions, setDescriptions] = useState<FieldDescriptions>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Hooks for API interactions
  const { tables, isLoading: tablesLoading, error: tablesError } = useTables();
  const { table, error: tableError } = useTableSchema(selectedTable);
  const { 
    documentation, 
    isLoading: docLoading, 
    error: docError, 
    save: saveDocumentation 
  } = useDocumentation(selectedTable);
  const { exportDocumentation, isExporting, error: exportError } = useExport();

  // Load existing descriptions when documentation changes
  useEffect(() => {
    if (documentation) {
      setDescriptions(documentation.descriptions);
      setHasUnsavedChanges(false);
    }
  }, [documentation]);

  // Handle table selection
  const handleTableSelect = useCallback((tableName: string) => {
    if (hasUnsavedChanges) {
      const shouldContinue = confirm(
        'You have unsaved changes. Are you sure you want to switch tables?'
      );
      if (!shouldContinue) return;
    }

    setSelectedTable(tableName);
    setDescriptions({});
    setHasUnsavedChanges(false);
    setSaveStatus('idle');
  }, [hasUnsavedChanges]);

  // Handle description changes
  const handleDescriptionChange = useCallback((fieldName: string, description: string) => {
    setDescriptions(prev => ({
      ...prev,
      [fieldName]: description
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!selectedTable) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const success = await saveDocumentation(descriptions);
      
      if (success) {
        setHasUnsavedChanges(false);
        setSaveStatus('success');
        
        // Reset status after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [selectedTable, descriptions, saveDocumentation]);

  // Handle export
  const handleExport = useCallback(async () => {
    await exportDocumentation();
  }, [exportDocumentation]);

  // Check if there are any errors
  const hasErrors = tablesError || tableError || docError || exportError;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-slate-100">
              <BookOpen className="h-8 w-8 text-slate-700" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Schema Description
              </h1>
              <p className="text-slate-600 mt-1">
                Document your database fields to enable AI-powered data operations
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-slate-500" />
              <span className="text-slate-600">
                {tables.length} tables available
              </span>
            </div>
            
            {selectedTable && table && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="text-slate-600">
                  {table.columns.length} fields in {selectedTable}
                </span>
              </div>
            )}

            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Unsaved changes</span>
              </div>
            )}
          </div>
        </div>

        {/* Error alerts */}
        {hasErrors && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="space-y-1">
                {tablesError && <div>Tables: {tablesError}</div>}
                {tableError && <div>Table Schema: {tableError}</div>}
                {docError && <div>Documentation: {docError}</div>}
                {exportError && <div>Export: {exportError}</div>}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Table Selection */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
              <TableSelector
                tables={tables}
                selectedTable={selectedTable}
                onTableSelect={handleTableSelect}
                isLoading={tablesLoading}
              />
            </Card>

            {/* Save section */}
            {selectedTable && (
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <Save className="h-5 w-5 text-slate-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Save Changes</h3>
                      <p className="text-sm text-slate-600">
                        Save your field descriptions
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || isSaving}
                    className="w-full flex items-center gap-2"
                    variant={saveStatus === 'success' ? 'outline' : 'default'}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : saveStatus === 'success' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Saved Successfully
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Descriptions
                      </>
                    )}
                  </Button>

                  {saveStatus === 'error' && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                      Failed to save descriptions. Please try again.
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Export section */}
            <Card className="p-6">
              <ExportButton
                onExport={handleExport}
                isExporting={isExporting}
                disabled={!selectedTable}
              />
            </Card>
          </div>

          {/* Right column - Field Editor */}
          <div className="lg:col-span-2">
            {selectedTable && table ? (
              <Card className="p-6">
                <FieldEditor
                  table={table}
                  descriptions={descriptions}
                  onDescriptionChange={handleDescriptionChange}
                  isLoading={docLoading}
                />
              </Card>
            ) : (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <div className="p-4 rounded-full bg-slate-100 mx-auto w-fit">
                    <Database className="h-8 w-8 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">Select a Table</h3>
                    <p className="text-slate-500 text-sm mt-1">
                      Choose a table from the left panel to start documenting its fields
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaDescription;
