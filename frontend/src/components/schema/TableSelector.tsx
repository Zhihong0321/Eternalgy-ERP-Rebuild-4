import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Database, ChevronDown } from 'lucide-react';
import type { TableSelectorProps } from '@/types/schema';

const TableSelector = ({
  tables,
  selectedTable,
  onTableSelect,
  isLoading = false,
  className
}: TableSelectorProps) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-100">
          <Database className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Select Table</h3>
          <p className="text-sm text-slate-600">
            Choose a table to add field descriptions
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Available Tables
          </span>
          <Badge variant="outline" className="text-xs">
            {tables.length} tables
          </Badge>
        </div>

        <Select
          value={selectedTable || undefined}
          onValueChange={onTableSelect}
          disabled={isLoading || tables.length === 0}
        >
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <SelectValue placeholder="Select a table to document..." />
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <div className="text-xs text-slate-500 mb-2 px-2">
                {tables.length} tables available
              </div>
              {tables.length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-4">
                  No tables found in database
                </div>
              ) : (
                tables.map((table) => (
                  <SelectItem key={table} value={table} className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <Database className="h-3 w-3 text-slate-400" />
                      <span>{table}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </div>
          </SelectContent>
        </Select>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
            Loading tables...
          </div>
        )}

        {selectedTable && (
          <div className="p-3 bg-slate-50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-600" />
              <span className="font-medium text-slate-900">Selected Table:</span>
              <code className="px-2 py-1 bg-slate-200 rounded text-sm font-mono">
                {selectedTable}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableSelector;
