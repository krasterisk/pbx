import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '@/widgets/Sidebar';
import { Header } from '@/widgets/Header';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

export const AppLayout = () => {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);

  // Auto-collapse when switching to mobile
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [isMobile]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const sidebarWidth = isMobile ? 0 : (collapsed ? 72 : 260);

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      {/* Mobile backdrop */}
      {isMobile && !collapsed && (
        <div 
          className="fixed inset-0 bg-black/60 transition-opacity layer-backdrop"
          onClick={() => setCollapsed(true)}
        />
      )}

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} isMobile={isMobile} />
      <Header sidebarWidth={sidebarWidth} onMenuToggle={() => setCollapsed(!collapsed)} isMobile={isMobile} />

      {/* Main content */}
      <main
        className="pt-16 flex-1 transition-all duration-300"
        style={{ paddingLeft: sidebarWidth }}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
