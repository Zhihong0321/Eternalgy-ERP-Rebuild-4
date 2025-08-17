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
  RotateCcw,
  Network,
  Search,
} from 'lucide-react';
import { useEternalgyAPI } from '@/hooks/useEternalgyAPI';
import type { BubbleConnectionStatus, SyncTable } from '@/hooks/useEternalgyAPI';

const DataSync = () => {
  const {
    testBubbleConnection,
    getDataTypes,
    syncAllTables,
    syncTable,
    syncTableIncremental,
    scanRecordCount,
    getSyncTables,
    wipeAllData,
    createTables,
    recreateTable,
    discoverRelationships,
    discoverAllRelationships,
    getRelationshipStatus,
    getAllRelationshipStatusesCached,
    resetCursor,
    diagnoseCursor,
    skipCursor,
    loading,
    error,
    syncProgress,
    globalSyncLock
  } = useEternalgyAPI();
  
  const [connectionStatus, setConnectionStatus] = useState<BubbleConnectionStatus | null>(null);
  const [dataTypesCount, setDataTypesCount] = useState<number>(0);
  const [syncTables, setSyncTables] = useState<SyncTable[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncAllLimit, setSyncAllLimit] = useState<number>(3);
  const [tableLimits, setTableLimits] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});
  const [progressTimer, setProgressTimer] = useState<NodeJS.Timeout | null>(null);
  const [scannedTotals, setScannedTotals] = useState<Record<string, number>>({});

  const fetchSyncData = async () => {
    setIsRefreshing(true);
    
    // REMOVED: testBubbleConnection() - was costing money on every page load!
    // Set connection status to unknown instead of testing
    setConnectionStatus({
      connected: false,
      message: 'Connection not tested (click Test Connection button)',
      timestamp: new Date().toISOString(),
    });

    // Get data types count from PostgreSQL tables
    const typesData = await getDataTypes();
    if (typesData && typesData.tables) {
      setDataTypesCount(typesData.tables.length);
    }

    // Get sync tables from PostgreSQL
    const tablesData = await getSyncTables();
    if (tablesData && tablesData.tables) {
      const tables = tablesData.tables;
      
      // FAST READ: Get existing discovery status from database (no discovery, just read saved data)
      try {
        const allStatusesResult = await getAllRelationshipStatusesCached();
        const statusMap = allStatusesResult?.statuses || {};
        
        // Map relationship statuses to tables - only shows saved status, no auto-discovery
        const tablesWithStatus = tables.map((table: any) => ({
          ...table,
          relationshipStatus: statusMap[table.tablename] || null
        }));
        
        setSyncTables(tablesWithStatus);
      } catch (error) {
        console.warn('Failed to load cached relationship statuses:', error);
        // Fallback: show tables without status if loading fails
        setSyncTables(tables.map((table: any) => ({
          ...table,
          relationshipStatus: null // Will show "Not Discovered" badge
        })));
      }
      
      // Initialize table limits with default value 3
      const initialLimits: Record<string, number> = {};
      tables.forEach((table: any) => {
        initialLimits[table.tablename] = tableLimits[table.tablename] || 3;
      });
      setTableLimits(initialLimits);
    }
    
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchSyncData();
    
    // FIXED: Reduced auto-refresh to every 5 minutes to prevent excessive API calls
    const interval = setInterval(fetchSyncData, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Progress timer for sync operations
  useEffect(() => {
    if (syncProgress.isActive) {
      const timer = setInterval(() => {
        // Force re-render to update timer display
        setProgressTimer(prev => prev);
      }, 1000);
      setProgressTimer(timer);
      
      return () => {
        if (timer) clearInterval(timer);
        setProgressTimer(null);
      };
    } else {
      if (progressTimer) {
        clearInterval(progressTimer);
        setProgressTimer(null);
      }
    }
  }, [syncProgress.isActive, progressTimer]);

  const handleWipeAllData = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL data from PostgreSQL database. Are you sure?')) {
      return;
    }
    
    const result = await wipeAllData();
    if (result) {
      setTimeout(fetchSyncData, 2000);
    }
  };

  const handleCreateTables = async () => {
    const result = await createTables();
    if (result) {
      setTimeout(fetchSyncData, 2000);
    }
  };

  const handleSyncAllTables = async () => {
    setIsSyncing(prev => ({ ...prev, 'all': true }));
    
    try {
      const result = await syncAllTables(syncAllLimit);
      if (result) {
        setTimeout(fetchSyncData, 2000);
      }
    } finally {
      setIsSyncing(prev => ({ ...prev, 'all': false }));
    }
  };

  const handleSyncTable = async (tableName: string) => {
    const limit = tableLimits[tableName] || 3;
    setIsSyncing(prev => ({ ...prev, [tableName]: true }));
    
    try {
      const result = await syncTable(tableName, limit);
      // Refresh table data to update record counts after successful sync
      if (result) {
        setTimeout(fetchSyncData, 1500); // Refresh after 1.5 seconds to show updated counts
      }
    } finally {
      setIsSyncing(prev => ({ ...prev, [tableName]: false }));
    }
  };

  const handleSyncTableIncremental = async (tableName: string) => {
    const limit = tableLimits[tableName] || 100; // Default 100 for SYNC+
    setIsSyncing(prev => ({ ...prev, [`${tableName}_plus`]: true }));
    
    try {
      const result = await syncTableIncremental(tableName, limit);
      // Refresh table data to update record counts after successful incremental sync
      if (result) {
        setTimeout(fetchSyncData, 1500); // Refresh after 1.5 seconds to show updated counts
      }
    } finally {
      setIsSyncing(prev => ({ ...prev, [`${tableName}_plus`]: false }));
    }
  };

  const handleScanRecordCount = async (tableName: string) => {
    setIsSyncing(prev => ({ ...prev, [`${tableName}_scan`]: true }));
    
    try {
      const result = await scanRecordCount(tableName);
      if (result && result.totalRecords !== undefined) {
        setScannedTotals(prev => ({
          ...prev,
          [tableName]: result.totalRecords
        }));
      }
    } finally {
      setIsSyncing(prev => ({ ...prev, [`${tableName}_scan`]: false }));
    }
  };

  const handleRecreateTable = async (tableName: string) => {
    const confirmRecreate = confirm(
      `Are you sure you want to RECREATE table "${tableName}"?\n\nThis will:\n1. Drop the existing table and all its data\n2. Recreate the table with current Bubble schema\n\nThis action cannot be undone.`
    );
    
    if (!confirmRecreate) return;
    
    setIsSyncing(prev => ({ ...prev, [`recreate_${tableName}`]: true }));
    
    try {
      await recreateTable(tableName);
      setTimeout(fetchSyncData, 2000); // Refresh to show updated table
    } finally {
      setIsSyncing(prev => ({ ...prev, [`recreate_${tableName}`]: false }));
    }
  };

  const handleDiscoverRelationships = async (tableName: string) => {
    setIsSyncing(prev => ({ ...prev, [`discover_${tableName}`]: true }));
    
    try {
      const result = await discoverRelationships(tableName);
      if (result) {
        // Refresh the relationship status for this table
        const statusResult = await getRelationshipStatus(tableName);
        if (statusResult && statusResult.result && statusResult.result.summary) {
          setSyncTables(prev => prev.map(table => 
            table.tablename === tableName 
              ? { ...table, relationshipStatus: statusResult.result.summary }
              : table
          ));
        }
      }
    } catch (error) {
      console.error(`Failed to discover relationships for ${tableName}:`, error);
    } finally {
      setIsSyncing(prev => ({ ...prev, [`discover_${tableName}`]: false }));
    }
  };

  const handleDiscoverAllRelationships = async () => {
    setIsSyncing(prev => ({ ...prev, 'discover_all': true }));
    
    try {
      const result = await discoverAllRelationships();
      if (result) {
        // Refresh all table relationship statuses
        setTimeout(fetchSyncData, 2000); // Refresh to show updated statuses
      }
    } catch (error) {
      console.error('Failed to discover all relationships:', error);
    } finally {
      setIsSyncing(prev => ({ ...prev, 'discover_all': false }));
    }
  };

  const handleResetCursor = async (tableName: string) => {
    const confirmReset = confirm(
      `Are you sure you want to RESET the SYNC+ cursor for "${tableName}"?\n\nThis will:\n1. Reset cursor to position 0\n2. Next SYNC+ will start from the beginning\n3. May re-sync existing records (but won't duplicate)\n\nThis is useful for fixing stuck SYNC+ operations.`
    );
    
    if (!confirmReset) return;
    
    setIsSyncing(prev => ({ ...prev, [`reset_cursor_${tableName}`]: true }));
    
    try {
      const result = await resetCursor(tableName);
      if (result) {
        setTimeout(fetchSyncData, 1500); // Refresh to show updated status
        alert(`✅ Cursor reset for ${tableName}. You can now run SYNC+ to fetch all records from the beginning.`);
      }
    } catch (error) {
      console.error(`Failed to reset cursor for ${tableName}:`, error);
      alert(`❌ Failed to reset cursor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(prev => ({ ...prev, [`reset_cursor_${tableName}`]: false }));
    }
  };

  const handleDiagnoseCursor = async (tableName: string) => {
    const position = prompt(`Enter cursor position to diagnose for ${tableName}:`, '6176');
    if (!position) return;
    
    const positionNum = parseInt(position);
    if (isNaN(positionNum) || positionNum < 0) {
      alert('Please enter a valid position number (0 or greater)');
      return;
    }
    
    setIsSyncing(prev => ({ ...prev, [`diagnose_${tableName}`]: true }));
    
    try {
      const result = await diagnoseCursor(tableName, positionNum, 10);
      if (result) {
        const { diagnostics, analysis, targetPosition, currentCursor } = result;
        
        let message = `🔍 Cursor Diagnosis for ${tableName}\n\n`;
        message += `Target Position: ${targetPosition}\n`;
        message += `Current Cursor: ${currentCursor}\n\n`;
        
        // Show problematic positions
        const problems = diagnostics?.filter((d: any) => d.status !== 'success') || [];
        if (problems.length > 0) {
          message += `❌ Problems found:\n`;
          problems.forEach((p: any) => {
            message += `  Position ${p.position}: ${p.error || p.status}\n`;
          });
        }
        
        message += `\n💡 Recommendation: ${analysis?.recommendation || 'No specific recommendation'}`;
        
        alert(message);
      }
    } catch (error) {
      console.error(`Failed to diagnose cursor for ${tableName}:`, error);
      alert(`❌ Failed to diagnose cursor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(prev => ({ ...prev, [`diagnose_${tableName}`]: false }));
    }
  };

  const handleSkipCursor = async (tableName: string) => {
    const input = prompt(`Skip cursor for ${tableName}:\n\nEnter position to advance to (e.g., 6177) or positions to skip (e.g., 6176,6177):`);
    if (!input) return;
    
    try {
      let skipPositions: number[] = [];
      let advanceTo: number | undefined;
      
      if (input.includes(',')) {
        // Multiple positions to skip
        skipPositions = input.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
      } else {
        // Single position to advance to
        advanceTo = parseInt(input.trim());
        if (isNaN(advanceTo)) {
          alert('Please enter a valid number or comma-separated numbers');
          return;
        }
      }
      
      setIsSyncing(prev => ({ ...prev, [`skip_${tableName}`]: true }));
      
      const result = await skipCursor(tableName, skipPositions, advanceTo);
      if (result) {
        setTimeout(fetchSyncData, 1500);
        alert(`✅ Cursor advanced for ${tableName}. Previous: ${result.previousCursor}, New: ${result.newCursor}. Run SYNC+ to continue from new position.`);
      }
    } catch (error) {
      console.error(`Failed to skip cursor for ${tableName}:`, error);
      alert(`❌ Failed to skip cursor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(prev => ({ ...prev, [`skip_${tableName}`]: false }));
    }
  };

  const updateTableLimit = (tableName: string, limit: number) => {
    setTableLimits(prev => ({
      ...prev,
      [tableName]: Math.max(1, Math.min(99999, limit))
    }));
  };


  const getSyncStatusBadge = () => {
    if (syncProgress.isActive) {
      return <Badge className="bg-blue-500">Running</Badge>;
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

  const getRelationshipStatusBadge = (table: SyncTable) => {
    if (!table.relationshipStatus) {
      return <Badge variant="outline" className="text-gray-500">Not Discovered</Badge>;
    }

    const status = table.relationshipStatus;
    
    if (status.isRelationalReady) {
      return <Badge className="bg-green-500">RELATIONAL READY</Badge>;
    } else if (status.pendingLink > 0) {
      return <Badge className="bg-yellow-500">Pending ({status.pendingLink})</Badge>;
    } else if (status.total === 0) {
      return <Badge variant="outline" className="text-gray-500">No Fields</Badge>;
    } else {
      return <Badge variant="outline" className="text-blue-600">Discovering</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Sync</h1>
          <p className="text-muted-foreground">
            Control and monitor Bubble.io data synchronization • Now with SYNC+ and SCAN
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

      {/* Enhanced Sync Progress Display */}
      {(syncProgress.isActive || globalSyncLock) && (
        <Alert className="border-blue-200 bg-blue-50">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="font-semibold">🔒 SYNC OPERATION ACTIVE</span>
                <span>{syncProgress.message}</span>
              </div>
              <div className="flex items-center space-x-3">
                {syncProgress.startTime && (
                  <span className="text-sm text-blue-600 font-mono">
                    {Math.floor((Date.now() - syncProgress.startTime) / 1000)}s
                  </span>
                )}
                <Badge className="bg-orange-500 text-white animate-pulse">
                  All buttons disabled
                </Badge>
              </div>
            </div>
            <div className="mt-2 text-sm text-blue-700">
              ⚠️ Please wait for the current operation to complete before starting another sync operation.
            </div>
          </AlertDescription>
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
                {syncProgress.isActive ? `Operation: ${syncProgress.operation}` : 'Ready for sync operations'}
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
              <Button 
                size="sm" 
                variant="outline" 
                onClick={async () => {
                  const connectionData = await testBubbleConnection();
                  if (connectionData) {
                    setConnectionStatus({
                      connected: connectionData.success || false,
                      message: connectionData.message || 'Connection test completed',
                      timestamp: new Date().toISOString(),
                    });
                  }
                }}
                disabled={loading}
              >
                Test
              </Button>
            </div>
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <p className="text-xs text-muted-foreground">
                {connectionStatus?.message || 'Click Test to check connection'}
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
      <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
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
              <Database className="mr-2 h-5 w-5 text-green-500" />
              Create Tables
            </CardTitle>
            <CardDescription>
              Create all tables from Bubble discovery (skip existing)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                <div className="space-y-2">
                  <h3 className="font-medium text-green-900">📋 Table Creation</h3>
                  <p className="text-sm text-green-700">
                    Creates database tables from Bubble.io discovery. Existing tables are skipped.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleCreateTables}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Database className="mr-2 h-4 w-4" />
                Create Tables
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5 text-blue-500" />
              Sync All Data
            </CardTitle>
            <CardDescription>
              Sync data into existing PostgreSQL tables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Global Limit:</label>
                <Input
                  type="number"
                  value={syncAllLimit}
                  onChange={(e) => setSyncAllLimit(Math.max(1, Math.min(99999, parseInt(e.target.value) || 3)))}
                  className="w-20"
                  min="1"
                  max="99999"
                />
                <span className="text-sm text-muted-foreground">records per table</span>
              </div>
              <Button
                onClick={handleSyncAllTables}
                disabled={loading || isSyncing['all'] || globalSyncLock}
                className="w-full"
              >
                {isSyncing['all'] || (syncProgress.isActive && syncProgress.operation === 'batch_sync') ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing All Data...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Sync All Data
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Network className="mr-2 h-5 w-5 text-purple-500" />
              Discover All Relationships
            </CardTitle>
            <CardDescription>
              Analyze all tables for relational data relationships
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
                <div className="space-y-2">
                  <h3 className="font-medium text-purple-900">🔍 Relationship Discovery</h3>
                  <p className="text-sm text-purple-700">
                    Analyzes all table fields to identify Bubble ID relationships and mark tables as "RELATIONAL READY".
                  </p>
                </div>
              </div>
              <Button
                onClick={handleDiscoverAllRelationships}
                disabled={loading || isSyncing['discover_all'] || globalSyncLock}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isSyncing['discover_all'] || (syncProgress.isActive && syncProgress.operation === 'discover_all') ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Discovering All...
                  </>
                ) : (
                  <>
                    <Network className="mr-2 h-4 w-4" />
                    Discover All
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
                        {scannedTotals[table.tablename] 
                          ? `${table.recordCount}/${scannedTotals[table.tablename]}` 
                          : `${table.recordCount} records`}
                      </Badge>
                      {!table.withData && (
                        <Badge variant="outline" className="text-orange-600">
                          No Data
                        </Badge>
                      )}
                      {/* Relationship Status Badge */}
                      {getRelationshipStatusBadge(table)}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={tableLimits[table.tablename] || 3}
                      onChange={(e) => updateTableLimit(table.tablename, parseInt(e.target.value) || 3)}
                      className="w-16 text-center"
                      min="1"
                      max="99999"
                      disabled={isSyncing[table.tablename] || isSyncing[`recreate_${table.tablename}`] || isSyncing[`discover_${table.tablename}`] || globalSyncLock}
                    />
                    <Button
                      onClick={() => handleSyncTable(table.tablename)}
                      disabled={loading || isSyncing[table.tablename] || isSyncing[`recreate_${table.tablename}`] || isSyncing[`discover_${table.tablename}`] || globalSyncLock}
                      size="sm"
                      className="w-20"
                    >
                      {isSyncing[table.tablename] || (syncProgress.isActive && syncProgress.operation === `sync_${table.tablename}`) ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="mr-1 h-3 w-3" />
                          SYNC
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleSyncTableIncremental(table.tablename)}
                      disabled={loading || isSyncing[`${table.tablename}_plus`] || isSyncing[table.tablename] || isSyncing[`recreate_${table.tablename}`] || isSyncing[`discover_${table.tablename}`] || globalSyncLock}
                      size="sm"
                      variant="outline"
                      className="w-20 border-green-200 text-green-600 hover:bg-green-50 font-semibold"
                      title="Incremental sync - only fetches NEW records since last sync"
                    >
                      {isSyncing[`${table.tablename}_plus`] || (syncProgress.isActive && syncProgress.operation === `sync_plus_${table.tablename}`) ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="mr-1 h-3 w-3" />
                          SYNC+
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleScanRecordCount(table.tablename)}
                      disabled={loading || isSyncing[`${table.tablename}_scan`] || globalSyncLock}
                      size="sm"
                      variant="outline"
                      className="w-20 border-orange-200 text-orange-600 hover:bg-orange-50"
                      title="Scan total record count from Bubble API"
                    >
                      {isSyncing[`${table.tablename}_scan`] ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="mr-1 h-3 w-3" />
                          SCAN
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDiscoverRelationships(table.tablename)}
                      disabled={loading || isSyncing[table.tablename] || isSyncing[`recreate_${table.tablename}`] || isSyncing[`discover_${table.tablename}`] || globalSyncLock}
                      size="sm"
                      variant="outline"
                      className="w-24 border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      {isSyncing[`discover_${table.tablename}`] || (syncProgress.isActive && syncProgress.operation === `discover_${table.tablename}`) ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Network className="mr-1 h-3 w-3" />
                          DISCOVER
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleRecreateTable(table.tablename)}
                      disabled={loading || isSyncing[table.tablename] || isSyncing[`recreate_${table.tablename}`] || isSyncing[`discover_${table.tablename}`] || globalSyncLock}
                      size="sm"
                      variant="outline"
                      className="w-24 border-orange-200 text-orange-600 hover:bg-orange-50"
                    >
                      {isSyncing[`recreate_${table.tablename}`] ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="mr-1 h-3 w-3" />
                          RECREATE
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleResetCursor(table.tablename)}
                      disabled={loading || isSyncing[`reset_cursor_${table.tablename}`] || globalSyncLock}
                      size="sm"
                      variant="outline"
                      className="w-24 border-red-200 text-red-600 hover:bg-red-50"
                      title="Reset SYNC+ cursor to 0 - useful when SYNC+ gets stuck"
                    >
                      {isSyncing[`reset_cursor_${table.tablename}`] ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="mr-1 h-3 w-3" />
                          RESET+
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDiagnoseCursor(table.tablename)}
                      disabled={loading || isSyncing[`diagnose_${table.tablename}`] || globalSyncLock}
                      size="sm"
                      variant="outline"
                      className="w-24 border-purple-200 text-purple-600 hover:bg-purple-50"
                      title="Diagnose stuck cursor position - check what's happening at specific position"
                    >
                      {isSyncing[`diagnose_${table.tablename}`] ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="mr-1 h-3 w-3" />
                          DIAGNOSE
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleSkipCursor(table.tablename)}
                      disabled={loading || isSyncing[`skip_${table.tablename}`] || globalSyncLock}
                      size="sm"
                      variant="outline"
                      className="w-20 border-yellow-200 text-yellow-600 hover:bg-yellow-50"
                      title="Skip problematic cursor position - advance to next position"
                    >
                      {isSyncing[`skip_${table.tablename}`] ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="mr-1 h-3 w-3" />
                          SKIP
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