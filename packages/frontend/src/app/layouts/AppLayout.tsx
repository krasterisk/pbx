import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '@/widgets/Sidebar/Sidebar';
import { Header } from '@/widgets/Header/Header';
import { useAppSelector } from '@/shared/hooks/useAppStore';

export const AppLayout = () => {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const [collapsed, setCollapsed] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const sidebarWidth = collapsed ? 72 : 260;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Header sidebarWidth={sidebarWidth} />

      {/* Main content */}
      <main
        className="pt-16 transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
