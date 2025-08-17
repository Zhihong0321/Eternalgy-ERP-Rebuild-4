import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  Filter,
  Database,
  Link
} from 'lucide-react';
import { useEternalgyAPI } from '@/hooks/useEternalgyAPI';

interface DiscoveryLog {
  id: number;
  run_id: string;
  table_name: string;
  field_name: string;
  field_type: string;
  link_status: string | null;
  target_table: string | null;
  sample_value: string | null;
  reason: string | null;
  bubble_id_count: number | null;
  discovered_at: string;
}

interface DiscoverySummary {
  table_name: string;
  run_id: string;
  discovered_at: string;
  total_fields: number;
  linked_fields: number;
  pending_fields: number;
  text_fields: number;
}

const DiscoveryLogs = () => {
  const { getDiscoveryLogs, loading, error } = useEternalgyAPI();
  
  const [logs, setLogs] = useState<DiscoveryLog[]>([]);
  const [summary, setSummary] = useState<DiscoverySummary[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tableFilter, setTableFilter] = useState('');
  const [runIdFilter, setRunIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
  });

  const fetchLogs = async (resetOffset = true) => {
    setIsRefreshing(true);
    
    try {
      const filters: any = {
        limit: pagination.limit,
        offset: resetOffset ? 0 : pagination.offset
      };
      
      if (tableFilter) filters.table = tableFilter;
      if (runIdFilter) filters.run_id = runIdFilter;
      
      const result = await getDiscoveryLogs(filters);
      
      if (result && result.logs) {
        setLogs(result.logs);
        setSummary(result.summary || []);
        setPagination(result.pagination || pagination);
      }
    } catch (error) {
      console.error('Failed to fetch discovery logs:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSearch = () => {
    fetchLogs(true); // Reset to first page
  };

  const handleClearFilters = () => {
    setTableFilter('');
    setRunIdFilter('');
    setStatusFilter('all');
    // Fetch without filters
    setTimeout(() => fetchLogs(true), 100);
  };

  const getStatusBadge = (log: DiscoveryLog) => {
    if (log.field_type === 'TEXT_ONLY') {
      return <Badge variant="outline" className="text-gray-600">Text Field</Badge>;
    } else if (log.link_status === 'LINKED') {
      return <Badge className="bg-green-500">Linked</Badge>;
    } else if (log.link_status === 'PENDING_LINK') {
      return <Badge className="bg-yellow-500">Pending</Badge>;
    } else {
      return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getReasonColor = (log: DiscoveryLog) => {
    if (log.field_type === 'TEXT_ONLY') return 'text-gray-600';
    if (log.link_status === 'LINKED') return 'text-green-600';
    if (log.link_status === 'PENDING_LINK') return 'text-yellow-600';
    return 'text-gray-600';
  };

  const filteredLogs = logs.filter(log => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'text' && log.field_type === 'TEXT_ONLY') return true;
    if (statusFilter === 'linked' && log.link_status === 'LINKED') return true;
    if (statusFilter === 'pending' && log.link_status === 'PENDING_LINK') return true;
    return false;
  });

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discovery Logs</h1>
          <p className="text-muted-foreground">
            Detailed field-level relationship discovery results
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
            variant="outline"
          >
            <Eye className="mr-2 h-4 w-4" />
            {viewMode === 'summary' ? 'Detailed View' : 'Summary View'}
          </Button>
          <Button
            onClick={() => fetchLogs()}
            disabled={isRefreshing}
            variant="outline"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium">Table Name</label>
              <Input
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="Filter by table name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Run ID</label>
              <Input
                value={runIdFilter}
                onChange={(e) => setRunIdFilter(e.target.value)}
                placeholder="Filter by run ID"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  <SelectItem value="linked">Linked Fields</SelectItem>
                  <SelectItem value="pending">Pending Fields</SelectItem>
                  <SelectItem value="text">Text Fields</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end space-x-2">
              <Button onClick={handleSearch} className="w-full">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button onClick={handleClearFilters} variant="outline">
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary View */}
      {viewMode === 'summary' && (
        <Card>
          <CardHeader>
            <CardTitle>Discovery Summary</CardTitle>
            <CardDescription>
              Overview of discovery runs by table and run ID
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && summary.length === 0 ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : summary.length === 0 ? (
              <div className="text-center py-8">
                <Database className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-muted-foreground">No discovery logs found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Run relationship discovery to see logs here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {summary.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{item.table_name}</h3>
                        <p className="text-sm text-gray-600">Run ID: {item.run_id}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(item.discovered_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{item.linked_fields}</div>
                          <div className="text-xs text-gray-500">Linked</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-yellow-600">{item.pending_fields}</div>
                          <div className="text-xs text-gray-500">Pending</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-600">{item.text_fields}</div>
                          <div className="text-xs text-gray-500">Text</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold">{item.total_fields}</div>
                          <div className="text-xs text-gray-500">Total</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed View */}
      {viewMode === 'detailed' && (
        <Card>
          <CardHeader>
            <CardTitle>Field-Level Discovery Details</CardTitle>
            <CardDescription>
              Detailed information for each field discovered ({filteredLogs.length} results)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && filteredLogs.length === 0 ? (
              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <Database className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-muted-foreground">No discovery logs match your filters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold">{log.table_name}.{log.field_name}</h3>
                          {getStatusBadge(log)}
                          {log.target_table && (
                            <Badge variant="outline" className="text-blue-600">
                              <Link className="mr-1 h-3 w-3" />
                              → {log.target_table}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="text-gray-500 w-20">Run ID:</span>
                            <span className="font-mono text-xs">{log.run_id}</span>
                          </div>
                          
                          {log.sample_value && (
                            <div className="flex items-start space-x-4">
                              <span className="text-gray-500 w-20">Sample:</span>
                              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                {log.sample_value}
                              </span>
                            </div>
                          )}
                          
                          {log.reason && (
                            <div className="flex items-start space-x-4">
                              <span className="text-gray-500 w-20">Reason:</span>
                              <span className={`text-sm ${getReasonColor(log)}`}>
                                {log.reason}
                              </span>
                            </div>
                          )}
                          
                          {log.bubble_id_count !== null && (
                            <div className="flex items-center space-x-4">
                              <span className="text-gray-500 w-20">Count:</span>
                              <span className="text-sm">{log.bubble_id_count} Bubble IDs</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {new Date(log.discovered_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DiscoveryLogs;