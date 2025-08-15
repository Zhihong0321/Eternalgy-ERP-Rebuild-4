import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Clock, Database, AlertTriangle, RefreshCw } from 'lucide-react';

// TypeScript interfaces for patch requests
interface PatchRequest {
  id: number;
  table_name: string;
  field_name: string;
  original_field_name?: string;
  suggested_type: string;
  error_message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed';
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  executed_at?: string;
  execution_result?: string;
  sync_run_id?: string;
}

interface Message {
  type: 'success' | 'error' | 'info';
  text: string;
}

/**
 * Pending Patches Page - Simple approval interface for missing schema fields
 * 
 * Workflow:
 * 1. Sync fails → Creates pending request
 * 2. User visits this page → Reviews requests  
 * 3. User clicks Approve → Adds missing column
 * 4. User retries sync → Works!
 */
const PendingPatches: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<PatchRequest[]>([]);
  const [history, setHistory] = useState<PatchRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  // Fetch pending requests and history
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch pending requests
      const pendingResponse = await fetch('/api/pending-patches/list');
      const pendingData = await pendingResponse.json();
      
      if (pendingData.success) {
        setPendingRequests(pendingData.requests || []);
      }

      // Fetch history
      const historyResponse = await fetch('/api/pending-patches/history');
      const historyData = await historyResponse.json();
      
      if (historyData.success) {
        setHistory(historyData.requests || []);
      }

    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMessage({ type: 'error', text: 'Failed to load data. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Approve a pending request
  const handleApprove = async (id: number) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/pending-patches/approve/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'frontend_user' })
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `✅ Column '${result.field}' added to table '${result.table}'. You can now retry your sync!` 
        });
        fetchData(); // Refresh data
      } else {
        setMessage({ type: 'error', text: `Failed to approve: ${result.error}` });
      }

    } catch (error) {
      console.error('Failed to approve:', error);
      setMessage({ type: 'error', text: 'Failed to approve request. Please try again.' });
    } finally {
      setProcessingId(null);
    }
  };

  // Reject a pending request  
  const handleReject = async (id: number) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/pending-patches/reject/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rejectedBy: 'frontend_user',
          reason: 'Rejected from frontend interface'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'info', text: 'Request rejected successfully.' });
        fetchData(); // Refresh data
      } else {
        setMessage({ type: 'error', text: `Failed to reject: ${result.error}` });
      }

    } catch (error) {
      console.error('Failed to reject:', error);
      setMessage({ type: 'error', text: 'Failed to reject request. Please try again.' });
    } finally {
      setProcessingId(null);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get status badge
  const getStatusBadge = (status: PatchRequest['status']) => {
    const styles = {
      pending: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600' },
      approved: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      rejected: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
      failed: { variant: 'destructive' as const, icon: AlertTriangle, color: 'text-red-600' }
    };

    const style = styles[status] || styles.pending;
    const Icon = style.icon;

    return (
      <Badge variant={style.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${style.color}`} />
        {status.toUpperCase()}
      </Badge>
    );
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pending Alter Table Requests</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve missing schema fields from sync operations
          </p>
        </div>
        <Button onClick={fetchData} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Message Alert */}
      {message && (
        <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 
                          message.type === 'success' ? 'border-green-200 bg-green-50' : 
                          'border-blue-200 bg-blue-50'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Pending Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>
            These fields need approval to be added to your database tables
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading pending requests...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg">No pending requests!</p>
              <p>All schema fields are up to date.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">
                          Table: <code className="bg-blue-100 px-2 py-1 rounded">{request.table_name}</code>
                        </h3>
                        {getStatusBadge(request.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Missing Field:</span>
                          <code className="ml-2 bg-red-100 px-2 py-1 rounded">{request.field_name}</code>
                        </div>
                        <div>
                          <span className="font-medium">Original Name:</span>
                          <span className="ml-2">{request.original_field_name || 'Unknown'}</span>
                        </div>
                        <div>
                          <span className="font-medium">Suggested Type:</span>
                          <code className="ml-2 bg-green-100 px-2 py-1 rounded">{request.suggested_type}</code>
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>
                          <span className="ml-2">{formatTime(request.created_at)}</span>
                        </div>
                      </div>

                      {request.error_message && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm font-medium text-red-800">Original Error:</p>
                          <code className="text-xs text-red-700">{request.error_message}</code>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => handleApprove(request.id)}
                        disabled={processingId === request.id}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {processingId === request.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      
                      <Button
                        onClick={() => handleReject(request.id)}
                        disabled={processingId === request.id}
                        variant="destructive"
                        size="sm"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Request History ({history.length})</CardTitle>
          <CardDescription>
            Previously processed alter table requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No history available</p>
          ) : (
            <div className="space-y-3">
              {history.slice(0, 10).map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {getStatusBadge(request.status)}
                    <div>
                      <span className="font-medium">{request.table_name}</span>
                      <span className="mx-2">→</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">{request.field_name}</code>
                      <span className="ml-2 text-sm text-muted-foreground">({request.suggested_type})</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatTime(request.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">How It Works</h3>
              <div className="text-sm text-blue-800 mt-2 space-y-1">
                <p>1. <strong>Sync fails</strong> → System detects missing field and creates pending request</p>
                <p>2. <strong>You review</strong> → Check the field details and decide to approve or reject</p>
                <p>3. <strong>You approve</strong> → System safely adds the column using ALTER TABLE</p>
                <p>4. <strong>Retry sync</strong> → Should now work with the new field!</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingPatches;