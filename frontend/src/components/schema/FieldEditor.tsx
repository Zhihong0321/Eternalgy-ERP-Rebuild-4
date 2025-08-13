// React components for field editing
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  FileText, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  Database
} from 'lucide-react';
import type { FieldEditorProps } from '@/types/schema';

const FieldEditor = ({
  table,
  descriptions,
  onDescriptionChange,
  isLoading = false,
  className
}: FieldEditorProps) => {
  const handleDescriptionChange = (fieldName: string, value: string) => {
    onDescriptionChange(fieldName, value);
  };

  const getTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('numeric') || lowerType.includes('decimal')) {
      return <Hash className="h-3 w-3" />;
    }
    if (lowerType.includes('varchar') || lowerType.includes('text') || lowerType.includes('char')) {
      return <Type className="h-3 w-3" />;
    }
    if (lowerType.includes('timestamp') || lowerType.includes('date') || lowerType.includes('time')) {
      return <Calendar className="h-3 w-3" />;
    }
    if (lowerType.includes('boolean') || lowerType.includes('bool')) {
      return <ToggleLeft className="h-3 w-3" />;
    }
    return <Database className="h-3 w-3" />;
  };

  const getTypeBadgeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('numeric') || lowerType.includes('decimal')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (lowerType.includes('varchar') || lowerType.includes('text') || lowerType.includes('char')) {
      return 'bg-green-100 text-green-800';
    }
    if (lowerType.includes('timestamp') || lowerType.includes('date') || lowerType.includes('time')) {
      return 'bg-purple-100 text-purple-800';
    }
    if (lowerType.includes('boolean') || lowerType.includes('bool')) {
      return 'bg-orange-100 text-orange-800';
    }
    return 'bg-slate-100 text-slate-800';
  };

  const documentedCount = table.columns.filter(col => 
    descriptions[col.name] && descriptions[col.name].trim().length > 0
  ).length;

  const completionPercentage = table.columns.length > 0 
    ? Math.round((documentedCount / table.columns.length) * 100)
    : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100">
            <FileText className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Field Descriptions</h3>
            <p className="text-sm text-slate-600">
              Add business descriptions to clarify what each field represents
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Progress</span>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                completionPercentage === 100 ? "border-green-300 bg-green-50 text-green-800" :
                completionPercentage >= 50 ? "border-yellow-300 bg-yellow-50 text-yellow-800" :
                "border-slate-300 bg-slate-50 text-slate-800"
              )}
            >
              {documentedCount}/{table.columns.length} fields ({completionPercentage}%)
            </Badge>
          </div>
          
          {completionPercentage === 100 && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Complete</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              completionPercentage === 100 ? "bg-green-500" :
              completionPercentage >= 50 ? "bg-yellow-500" :
              "bg-slate-400"
            )}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Fields list */}
      <div className="space-y-3">
        {table.columns
          .sort((a, b) => a.position - b.position)
          .map((column) => {
            const hasDescription = descriptions[column.name] && descriptions[column.name].trim().length > 0;
            
            return (
              <Card key={column.name} className="p-4 space-y-3">
                {/* Field header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="font-mono text-sm font-medium text-slate-900">
                        {column.name}
                      </code>
                      {!column.nullable && (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                          Required
                        </Badge>
                      )}
                      {hasDescription && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs flex items-center gap-1", getTypeBadgeColor(column.type))}
                      >
                        {getTypeIcon(column.type)}
                        {column.type}
                        {column.maxLength && `(${column.maxLength})`}
                      </Badge>
                      
                      {column.default && (
                        <Badge variant="outline" className="text-xs text-slate-600">
                          Default: {column.default}
                        </Badge>
                      )}
                    </div>
                    
                    {column.comment && (
                      <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border-l-2 border-slate-300">
                        <strong>DB Comment:</strong> {column.comment}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    Business Description
                    {!hasDescription && (
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                    )}
                  </label>
                  <Input
                    value={descriptions[column.name] || ''}
                    onChange={(e) => handleDescriptionChange(column.name, e.target.value)}
                    placeholder={`Describe what "${column.name}" represents in your business...`}
                    disabled={isLoading}
                    className={cn(
                      "text-sm",
                      hasDescription && "border-green-300 bg-green-50/30"
                    )}
                  />
                </div>
              </Card>
            );
          })}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-slate-500 py-8">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading field data...</span>
        </div>
      )}
    </div>
  );
};

export default FieldEditor;
