import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  ExternalLink
} from 'lucide-react';
import type { ExportButtonProps } from '@/types/schema';

const ExportButton = ({
  onExport,
  isExporting = false,
  disabled = false,
  className
}: ExportButtonProps) => {
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleExport = async () => {
    setExportStatus('idle');
    
    try {
      await onExport();
      setExportStatus('success');
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setExportStatus('idle');
      }, 3000);
    } catch (error) {
      setExportStatus('error');
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setExportStatus('idle');
      }, 3000);
    }
  };

  const getButtonContent = () => {
    if (isExporting) {
      return (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Exporting...
        </>
      );
    }

    if (exportStatus === 'success') {
      return (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Exported Successfully
        </>
      );
    }

    if (exportStatus === 'error') {
      return (
        <>
          <AlertCircle className="h-4 w-4 text-red-600" />
          Export Failed
        </>
      );
    }

    return (
      <>
        <Download className="h-4 w-4" />
        Export Documentation
      </>
    );
  };

  const getButtonVariant = () => {
    if (exportStatus === 'success') return 'outline';
    if (exportStatus === 'error') return 'destructive';
    return 'default';
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-100">
          <FileText className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Export Documentation</h3>
          <p className="text-sm text-slate-600">
            Download complete schema with business descriptions as JSON
          </p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="text-sm text-slate-700">
          <strong>Export includes:</strong>
        </div>
        <ul className="text-sm text-slate-600 space-y-1">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            Complete database schema structure
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            All field descriptions you've added
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            Data types, constraints, and metadata
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            Ready for AI analysis and data operations
          </li>
        </ul>

        <Button 
          onClick={handleExport}
          disabled={disabled || isExporting}
          variant={getButtonVariant()}
          className={cn(
            "w-full flex items-center gap-2",
            exportStatus === 'success' && "border-green-300 bg-green-50 text-green-800 hover:bg-green-100",
            exportStatus === 'error' && "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
          )}
        >
          {getButtonContent()}
        </Button>

        {exportStatus === 'success' && (
          <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded p-2">
            Schema documentation downloaded successfully! 
            The JSON file contains your complete documented database structure.
          </div>
        )}

        {exportStatus === 'error' && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
            Failed to export documentation. Please try again or check your connection.
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-3">
        <div className="flex items-start gap-2">
          <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <div>
            <strong>For AI Operations:</strong> Use this JSON file when asking AI to develop data operations. 
            It provides complete context about your database fields and their business meanings, 
            eliminating guesswork for tasks like commission calculations, reporting, and data analysis.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportButton;
