import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  DollarSign,
  Users,
  Database,
  Search,
  Settings,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Activity,
  BarChart3,
  FileText,
  Calendar,
  UserCheck,
  Briefcase,
} from 'lucide-react';
import type { NavigationItem } from '@/types/index';

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingCart,
    href: '/sales',
    children: [
      { id: 'leads', label: 'Leads', icon: Users, href: '/sales/leads' },
      { id: 'opportunities', label: 'Opportunities', icon: Briefcase, href: '/sales/opportunities' },
      { id: 'quotes', label: 'Quotes', icon: FileText, href: '/sales/quotes' },
      { id: 'orders', label: 'Orders', icon: ShoppingCart, href: '/sales/orders' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    href: '/inventory',
    children: [
      { id: 'products', label: 'Products', icon: Package, href: '/inventory/products' },
      { id: 'stock', label: 'Stock Levels', icon: BarChart3, href: '/inventory/stock' },
      { id: 'suppliers', label: 'Suppliers', icon: Users, href: '/inventory/suppliers' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    href: '/finance',
    children: [
      { id: 'invoices', label: 'Invoices', icon: FileText, href: '/finance/invoices' },
      { id: 'payments', label: 'Payments', icon: DollarSign, href: '/finance/payments' },
      { id: 'reports', label: 'Reports', icon: BarChart3, href: '/finance/reports' },
    ],
  },
  {
    id: 'hr',
    label: 'Human Resources',
    icon: Users,
    href: '/hr',
    children: [
      { id: 'employees', label: 'Employees', icon: Users, href: '/hr/employees' },
      { id: 'attendance', label: 'Attendance', icon: UserCheck, href: '/hr/attendance' },
      { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/hr/calendar' },
    ],
  },
];

const dataManagementItems: NavigationItem[] = [
  {
    id: 'data-sync',
    label: 'Data Sync',
    icon: RefreshCw,
    href: '/data-sync',
  },
  {
    id: 'data-browser',
    label: 'Data Browser',
    icon: Search,
    href: '/data-browser',
  },
  {
    id: 'system-status',
    label: 'System Status',
    icon: Activity,
    href: '/system-status',
  },
];

interface SidebarProps {
  className?: string;
}

const Sidebar = ({ className }: SidebarProps) => {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(['dashboard']);

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const active = isActive(item.href);

    return (
      <div key={item.id}>
        <div
          className={cn(
            "flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
            "hover:bg-slate-100 text-slate-700",
            active && "bg-slate-200 ring-1 ring-slate-300 text-slate-900",
            level > 0 && "ml-6"
          )}
        >
          <Link to={item.href} className="flex items-center gap-3 flex-1">
            <item.icon className="h-4 w-4 opacity-70" />
            <span className="truncate">{item.label}</span>
          </Link>
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
              onClick={() => toggleExpanded(item.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1 border-l border-slate-200 ml-6 pl-3">
            {item.children!.map(child => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get build info - use build time from vite define
  const buildDate = new Date(__BUILD_TIME__ || new Date().toISOString());
  const buildTime = buildDate.toLocaleString('en-US', {
    timeZone: 'Asia/Shanghai', // GMT+8
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  const version = import.meta.env.VITE_APP_VERSION || 'v1.0.0';

  return (
    <div className={cn("flex h-full w-[280px] flex-col bg-white/45 backdrop-blur-xl", className)}>
      <div className="flex h-16 items-center border-b border-slate-200 px-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100">
            <Database className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <span className="font-heading font-bold text-slate-900">Eternalgy ERP</span>
            <div className="text-[11px] text-slate-500 font-medium">Operations Suite</div>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-auto py-5">
        <div className="space-y-6 px-3">
          <div>
            <h3 className="mb-2 px-3 text-[11px] font-heading font-semibold text-slate-500 uppercase tracking-wider">
              Main Navigation
            </h3>
            <div className="space-y-1">
              {navigationItems.map(item => renderNavigationItem(item))}
            </div>
          </div>

          <Separator className="my-2 bg-slate-200" />

          <div>
            <h3 className="mb-2 px-3 text-[11px] font-heading font-semibold text-slate-500 uppercase tracking-wider">
              Data Management
            </h3>
            <div className="space-y-1">
              {dataManagementItems.map(item => renderNavigationItem(item))}
            </div>
          </div>

          <Separator className="my-2 bg-slate-200" />

          <div>
            <Link
              to="/settings"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100",
                isActive('/settings') && "bg-slate-200 ring-1 ring-slate-300 text-slate-900"
              )}
            >
              <Settings className="h-4 w-4 opacity-70" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Build Info Footer */}
      <div className="border-t border-slate-200/50 px-4 py-3">
        <div className="text-[10px] text-slate-500 font-medium">
          <div className="flex items-center justify-between">
            <span>Build</span>
            <span className="text-slate-400">{version}</span>
          </div>
          <div className="mt-1 text-slate-400">
            {buildTime}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;