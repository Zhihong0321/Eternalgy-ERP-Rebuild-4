import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Play,
  RefreshCw,
  AlertCircle,
  Database,
  Zap,
  Trash2,
  Settings,
} from 'lucide-react';
import { useEternalgyAPI } from '@/hooks/useEternalgyAPI';
import type { SyncStatus, BubbleConnectionStatus, SyncTable } from '@/hooks/useEternalgyAPI';

const DataSync = () => {
  const {
    getSyncStatus,
    testBubbleConnection,
    getDataTypes,
    syncAllTables,
    syncTable,
    getSyncTables,
    wipeAllData,
    loading,
    error
  } = useEternalgyAPI();
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<BubbleConnectionStatus | null>(null);
  const [dataTypesCount, setDataTypesCount] = useState<number>(0);
  const [syncTables, setSyncTables] = useState<SyncTable[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncAllLimit, setSyncAllLimit] = useState<number>(3);
  const [tableLimits, setTableLimits] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});

  const fetchSyncData = async () => {
    setIsRefreshing(true);
    
    // Get sync status
    const syncData = await getSyncStatus();
    if (syncData) {
      setSyncStatus(syncData);
    }

    // Test Bubble connection
    const connectionData = await testBubbleConnection();
    if (connectionData) {
      setConnectionStatus({
        connected: connectionData.success || false,
        message: connectionData.message || 'Connection test completed',
        timestamp: new Date().toISOString(),
      });
    }

    // Get data types count
    const typesData = await getDataTypes();
    if (typesData) {
      setDataTypesCount(typesData.length);
    }

    // Get sync tables from PostgreSQL
    const tablesData = await getSyncTables();
    if (tablesData && tablesData.tables) {
      setSyncTables(tablesData.tables);
      
      // Initialize table limits with default value 3
      const initialLimits: Record<string, number> = {};
      tablesData.tables.forEach((table: any) => {
        initialLimits[table.tablename] = tableLimits[table.tablename] || 3;
      });
      setTableLimits(initialLimits);
    }
    
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchSyncData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSyncData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleWipeAllData = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL data from PostgreSQL database. Are you sure?')) {
      return;
    }
    
    const result = await wipeAllData();
    if (result) {
      setTimeout(fetchSyncData, 2000);
    }
  };

  const handleSyncAllTables = async () => {
    setIsSyncing(prev => ({ ...prev, 'all': true }));
    
    const result = await syncAllTables(syncAllLimit);
    if (result) {
      setTimeout(fetchSyncData, 2000);
    }
    
    setIsSyncing(prev => ({ ...prev, 'all': false }));
  };

  const handleSyncTable = async (tableName: string) => {
    const limit = tableLimits[tableName] || 3;
    setIsSyncing(prev => ({ ...prev, [tableName]: true }));
    
    const result = await syncTable(tableName, limit);
    if (result) {
      setTimeout(fetchSyncData, 1000);
    }
    
    setIsSyncing(prev => ({ ...prev, [tableName]: false }));
  };

  const updateTableLimit = (tableName: string, limit: number) => {
    setTableLimits(prev => ({
      ...prev,
      [tableName]: Math.max(1, Math.min(100, limit))
    }));
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return 'Never';
    }
  };

  const getSyncStatusBadge = () => {
    if (!syncStatus) return <Badge variant="secondary">Unknown</Badge>;
    
    if (syncStatus.isRunning) {
      return <Badge className="bg-blue-500">Running</Badge>;
    }
    
    if (syncStatus.errors && syncStatus.errors.length > 0) {
      return <Badge variant="destructive">Error</Badge>;
    }
    
    return <Badge className="bg-green-500">Idle</Badge>;
  };

  const getConnectionBadge = () => {
    if (!connectionStatus) return <Badge variant="secondary">Unknown</Badge>;
    
    return connectionStatus.connected ? (
      <Badge className="bg-green-500">Connected</Badge>
    ) : (
      <Badge variant="destructive">Disconnected</Badge>
    );
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Sync</h1>
          <p className="text-muted-foreground">
            Control and monitor Bubble.io data synchronization
          </p>
        </div>
        <Button
          onClick={fetchSyncData}
          disabled={isRefreshing}
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-2">
              {getSyncStatusBadge()}
            </div>
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <p className="text-xs text-muted-foreground">
                Last sync: {syncStatus ? formatTimestamp(syncStatus.lastSync) : 'Never'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bubble Connection</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-2">
              {getConnectionBadge()}
            </div>
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <p className="text-xs text-muted-foreground">
                {connectionStatus?.message || 'Testing connection...'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Types</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{dataTypesCount}</div>
            <p className="text-xs text-muted-foreground">
              Available for sync
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Control */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trash2 className="mr-2 h-5 w-5 text-red-500" />
              Wipe Data
            </CardTitle>
            <CardDescription>
              Delete all data from PostgreSQL database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <div className="space-y-2">
                  <h3 className="font-medium text-red-900">⚠️ Dangerous Operation</h3>
                  <p className="text-sm text-red-700">
                    This will permanently delete ALL data from the PostgreSQL database. This action cannot be undone.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleWipeAllData}
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Wipe All Data
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5 text-blue-500" />
              Sync All Tables
            </CardTitle>
            <CardDescription>
              Synchronize all tables from Bubble.io at once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Global Limit:</label>
                <Input
                  type="number"
                  value={syncAllLimit}
                  onChange={(e) => setSyncAllLimit(Math.max(1, Math.min(100, parseInt(e.target.value) || 3)))}
                  className="w-20"
                  min="1"
                  max="100"
                />
                <span className="text-sm text-muted-foreground">records per table</span>
              </div>
              <Button
                onClick={handleSyncAllTables}
                disabled={loading || isSyncing['all']}
                className="w-full"
              >
                {isSyncing['all'] ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing All Tables...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Sync All Tables
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Table Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5 text-gray-600" />
            Individual Table Sync
          </CardTitle>
          <CardDescription>
            Sync specific tables with custom limits - PostgreSQL tables available for sync
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && syncTables.length === 0 ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <Skeleton className="h-5 w-32" />
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : syncTables.length === 0 ? (
            <div className="text-center py-8">
              <Database className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-muted-foreground">No tables found in PostgreSQL database</p>
              <p className="text-sm text-muted-foreground mt-1">Tables will appear here after first sync</p>
            </div>
          ) : (
            <div className="space-y-3">
              {syncTables.map((table) => (
                <div key={table.tablename} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{table.name || table.tablename}</span>
                      <Badge variant={table.withData ? "default" : "secondary"}>
                        {table.recordCount} records
                      </Badge>
                      {!table.withData && (
                        <Badge variant="outline" className="text-orange-600">
                          No Data
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={tableLimits[table.tablename] || 3}
                      onChange={(e) => updateTableLimit(table.tablename, parseInt(e.target.value) || 3)}
                      className="w-16 text-center"
                      min="1"
                      max="100"
                      disabled={isSyncing[table.tablename]}
                    />
                    <Button
                      onClick={() => handleSyncTable(table.tablename)}
                      disabled={loading || isSyncing[table.tablename]}
                      size="sm"
                      className="w-20"
                    >
                      {isSyncing[table.tablename] ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="mr-1 h-3 w-3" />
                          SYNC
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataSync;