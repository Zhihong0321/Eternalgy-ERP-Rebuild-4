import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const AppLayout = () => {
  return (
<div className="flex h-screen w-full bg-[radial-gradient(1200px_600px_at_10%_10%,_#eaf2fb_0%,_#f7fafc_40%),_radial-gradient(1200px_700px_at_90%_90%,_#eef6f0_0%,_#f7fafc_45%)]">
      {/* Site-wide Left Navigation */}
      <aside className="hidden md:block border-r border-slate-200/50">
        <Sidebar className="w-[280px]" />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
