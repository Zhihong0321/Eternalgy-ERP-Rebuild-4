import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  Database,
  RefreshCw,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useEternalgyAPI } from '@/hooks/useEternalgyAPI';
import type { DataType, TableData } from '@/types';

const DataBrowser = () => {
  const {
    getDataTypes,
    getData,
    analyzeDataStructure,
    loading,
    error
  } = useEternalgyAPI();
  
  const [dataTypes, setDataTypes] = useState<DataType[]>([]);
  const [selectedDataType, setSelectedDataType] = useState<string>('');
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataStructure, setDataStructure] = useState<any>(null);

  const fetchDataTypes = async () => {
    const response = await getDataTypes() as any;
    if (response && response.tables) {
      // Database API returns { tables: [...] } format
      const types: DataType[] = response.tables.map((table: any) => ({
        name: table.name || table.tablename,
        fields: {},
        recordCount: table.recordCount || 0
      }));
      setDataTypes(types);
      if (types.length > 0 && !selectedDataType) {
        setSelectedDataType(types[0].name);
      }
    }
  };

  const fetchTableData = async () => {
    if (!selectedDataType) return;
    
    setIsRefreshing(true);
    
    const params = {
      page: currentPage,
      limit: pageSize,
      search: searchTerm || undefined,
    };
    
    const response = await getData(selectedDataType, params) as any;
    if (response && response.data) {
      // Database API returns different format
      const tableData: TableData = {
        data: response.data,
        columns: response.columns || [],
        total: response.pagination?.total || 0,
        page: response.pagination?.page || 1,
        limit: pageSize,
        totalPages: response.pagination?.totalPages || 1
      };
      setTableData(tableData);
    }
    
    setIsRefreshing(false);
  };

  const fetchDataStructure = async () => {
    if (!selectedDataType) return;
    
    const structure = await analyzeDataStructure(selectedDataType);
    if (structure) {
      setDataStructure(structure);
    }
  };

  useEffect(() => {
    fetchDataTypes();
  }, []);

  useEffect(() => {
    if (selectedDataType) {
      setCurrentPage(1);
      fetchTableData();
      fetchDataStructure();
    }
  }, [selectedDataType]);

  useEffect(() => {
    if (selectedDataType) {
      fetchTableData();
    }
  }, [currentPage, pageSize, searchTerm]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleDataTypeChange = (value: string) => {
    setSelectedDataType(value);
    setTableData(null);
    setDataStructure(null);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value));
    setCurrentPage(1);
  };

  const renderTableCell = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">null</span>;
    }
    
    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? 'default' : 'secondary'}>
          {value.toString()}
        </Badge>
      );
    }
    
    if (typeof value === 'object') {
      return (
        <span className="text-xs text-muted-foreground">
          {JSON.stringify(value).substring(0, 50)}...
        </span>
      );
    }
    
    const stringValue = String(value);
    if (stringValue.length > 100) {
      return (
        <span title={stringValue}>
          {stringValue.substring(0, 100)}...
        </span>
      );
    }
    
    return stringValue;
  };

  const totalPages = tableData ? Math.ceil(tableData.total / pageSize) : 0;
  const startRecord = tableData ? (currentPage - 1) * pageSize + 1 : 0;
  const endRecord = tableData ? Math.min(currentPage * pageSize, tableData.total) : 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Browser</h1>
          <p className="text-muted-foreground">
            Explore and analyze your synchronized data
          </p>
        </div>
        <Button
          onClick={fetchTableData}
          disabled={isRefreshing || !selectedDataType}
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

      {/* Data Type Selection and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Data Selection</CardTitle>
          <CardDescription>
            Choose a data type to explore and search through records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Data Type</label>
              <Select value={selectedDataType} onValueChange={handleDataTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a data type" />
                </SelectTrigger>
                <SelectContent>
                  {dataTypes.map((type) => (
                    <SelectItem key={type.name} value={type.name}>
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4" />
                        <span>{type.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {type.recordCount?.toLocaleString() || '0'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Structure Info */}
      {dataStructure && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Data Structure</span>
            </CardTitle>
            <CardDescription>
              Schema and field information for {selectedDataType}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium">Total Fields</h4>
                <p className="text-2xl font-bold">{dataStructure.fieldCount || 0}</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Record Count</h4>
                <p className="text-2xl font-bold">
                  {dataStructure.recordCount?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Last Updated</h4>
                <p className="text-sm text-muted-foreground">
                  {dataStructure.lastUpdated ? 
                    new Date(dataStructure.lastUpdated).toLocaleString() : 
                    'Unknown'
                  }
                </p>
              </div>
            </div>
            
            {dataStructure.fields && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Fields</h4>
                <div className="flex flex-wrap gap-2">
                  {dataStructure.fields.map((field: any, index: number) => (
                    <Badge key={index} variant="outline">
                      {field.name || field}
                      {field.type && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({field.type})
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Records</CardTitle>
              <CardDescription>
                {tableData ? (
                  `Showing ${startRecord}-${endRecord} of ${tableData.total.toLocaleString()} records`
                ) : (
                  'Select a data type to view records'
                )}
              </CardDescription>
            </div>
            
            <div className="flex items-center space-x-2">
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading || isRefreshing ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tableData && tableData.data.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {tableData.columns.map((column) => (
                        <TableHead key={column.key} className="whitespace-nowrap">
                          {column.label}
                        </TableHead>
                      ))}
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.data.map((row, index) => (
                      <TableRow key={index}>
                        {tableData.columns.map((column) => (
                          <TableCell key={column.key} className="max-w-xs">
                            {renderTableCell(row[column.key])}
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const pageNum = Math.max(1, currentPage - 2) + i;
                        if (pageNum > totalPages) return null;
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : selectedDataType ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No data found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 
                  `No records match your search "${searchTerm}"` : 
                  `No records available for ${selectedDataType}`
                }
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a data type</h3>
              <p className="text-muted-foreground">
                Choose a data type from the dropdown above to start exploring your data
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataBrowser;