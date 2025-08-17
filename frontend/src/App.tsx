import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import DataSync from '@/pages/DataSync';
import DataBrowser from '@/pages/DataBrowser';
import SchemaDescription from '@/pages/SchemaDescription';
import PendingPatches from '@/pages/PendingPatches';
import DiscoveryLogs from '@/pages/DiscoveryLogs';
import './App.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Placeholder components for future modules
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center h-96">
    <div className="text-center">
      <h1 className="text-3xl font-bold tracking-tight mb-4">{title}</h1>
      <p className="text-muted-foreground">
        This module is coming soon. Stay tuned for updates!
      </p>
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            {/* Dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Data Management */}
            <Route path="data-sync" element={<DataSync />} />
            <Route path="data-browser" element={<DataBrowser />} />
            <Route path="schema-description" element={<SchemaDescription />} />
            <Route path="pending-patches" element={<PendingPatches />} />
            <Route path="discovery-logs" element={<DiscoveryLogs />} />
            <Route path="system-status" element={<PlaceholderPage title="System Status" />} />
            
            {/* Sales Module */}
            <Route path="sales" element={<PlaceholderPage title="Sales" />} />
            <Route path="sales/orders" element={<PlaceholderPage title="Sales Orders" />} />
            <Route path="sales/customers" element={<PlaceholderPage title="Customers" />} />
            <Route path="sales/quotes" element={<PlaceholderPage title="Quotes" />} />
            <Route path="sales/reports" element={<PlaceholderPage title="Sales Reports" />} />
            
            {/* Inventory Module */}
            <Route path="inventory" element={<PlaceholderPage title="Inventory" />} />
            <Route path="inventory/products" element={<PlaceholderPage title="Products" />} />
            <Route path="inventory/stock" element={<PlaceholderPage title="Stock Management" />} />
            <Route path="inventory/suppliers" element={<PlaceholderPage title="Suppliers" />} />
            <Route path="inventory/reports" element={<PlaceholderPage title="Inventory Reports" />} />
            
            {/* Finance Module */}
            <Route path="finance" element={<PlaceholderPage title="Finance" />} />
            <Route path="finance/invoices" element={<PlaceholderPage title="Invoices" />} />
            <Route path="finance/payments" element={<PlaceholderPage title="Payments" />} />
            <Route path="finance/expenses" element={<PlaceholderPage title="Expenses" />} />
            <Route path="finance/reports" element={<PlaceholderPage title="Financial Reports" />} />
            
            {/* HR Module */}
            <Route path="hr" element={<PlaceholderPage title="Human Resources" />} />
            <Route path="hr/employees" element={<PlaceholderPage title="Employees" />} />
            <Route path="hr/payroll" element={<PlaceholderPage title="Payroll" />} />
            <Route path="hr/attendance" element={<PlaceholderPage title="Attendance" />} />
            <Route path="hr/reports" element={<PlaceholderPage title="HR Reports" />} />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
