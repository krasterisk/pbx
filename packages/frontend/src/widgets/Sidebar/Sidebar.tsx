import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import {
  LayoutDashboard,
  Users,
  Phone,
  Route,
  ListOrdered,
  BarChart3,
  Headphones,
  Settings,
  ChevronLeft,
  Waypoints,
  Shield,
  List,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();

  const navigation = [
    { name: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
    { type: 'divider' as const, label: t('nav.pbx') },
    { name: t('nav.peers'), path: '/peers', icon: Phone },
    { name: t('nav.trunks'), path: '/trunks', icon: Waypoints },
    { name: t('nav.routes'), path: '/routes', icon: Route },
    { name: t('nav.queues'), path: '/queues', icon: ListOrdered },
    { type: 'divider' as const, label: t('nav.callcenter') },
    { name: t('nav.operator'), path: '/operator', icon: Headphones },
    { type: 'divider' as const, label: t('nav.analytics') },
    { name: t('nav.reports'), path: '/reports', icon: BarChart3 },
    { type: 'divider' as const, label: t('nav.system') },
    { name: t('nav.users'), path: '/users', icon: Users },
    { name: t('nav.roles' as any) || 'Интерфейсы', path: '/roles', icon: Shield },
    { name: t('nav.numbers' as any) || 'Списки доступа', path: '/numbers', icon: List },
    { name: t('nav.settings'), path: '/settings', icon: Settings },
  ] as const;

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-sidebar border-r border-sidebar-border"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-lg whitespace-nowrap gradient-text"
              >
                Krasterisk
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navigation.map((item, i) => {
          if ('type' in item && item.type === 'divider') {
            return (
              <div key={i} className="pt-4 pb-2">
                <AnimatePresence>
                  {!collapsed && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50"
                    >
                      {item.label}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          if (!('path' in item)) return null;

          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path}>
              <div
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  'hover:bg-sidebar-accent hover:text-foreground',
                  isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground',
                  collapsed && 'justify-center px-0',
                )}
              >
                <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary')} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 w-0.5 h-6 bg-primary rounded-r-full"
                  />
                )}
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse button */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          id="sidebar-toggle"
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-sidebar-accent text-muted-foreground transition-colors cursor-pointer"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronLeft className="w-5 h-5" />
          </motion.div>
        </button>
      </div>
    </motion.aside>
  );
};
