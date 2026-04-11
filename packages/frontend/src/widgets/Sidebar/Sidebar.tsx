import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
import { classNames } from '@/shared/lib/classNames/classNames';
import { VStack, Flex } from '@/shared/ui/Stack';
import { SidebarItem, SidebarItemType } from './ui/SidebarItem/SidebarItem';
import { SidebarLogo } from './ui/SidebarLogo/SidebarLogo';
import cls from './Sidebar.module.scss';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}

export const Sidebar = ({ collapsed, onToggle, isMobile }: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();

  const navigation = [
    { name: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
    { type: 'divider' as const, label: t('nav.pbx') },
    { name: t('endpoints.title'), path: '/endpoints', icon: Phone },
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

  const isVisuallyExpanded = isMobile ? true : !collapsed;

  return (
    <motion.aside
      initial={false}
      animate={
        isMobile
          ? { x: collapsed ? '-100%' : 0, width: 260 }
          : { x: 0, width: collapsed ? 72 : 260 }
      }
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cls.sidebar}
    >
      <VStack max style={{ height: '100%' }}>
        <SidebarLogo isVisuallyExpanded={isVisuallyExpanded} />

        <nav className={cls.nav}>
          <VStack gap="4" max>
            {navigation.map((item, i) => {
              if ('type' in item && item.type === 'divider') {
                return (
                  <Flex key={i} className={cls.dividerBox}>
                    <AnimatePresence>
                      {isVisuallyExpanded && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={cls.dividerText}
                        >
                          {item.label}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </Flex>
                );
              }

              if (!('path' in item)) return null;

              return (
                <SidebarItem
                  key={item.path}
                  item={item as SidebarItemType}
                  isActive={location.pathname === item.path}
                  isVisuallyExpanded={isVisuallyExpanded}
                  collapsed={collapsed}
                />
              );
            })}
          </VStack>
        </nav>

        {!isMobile && (
          <Flex className={cls.footer} justify="center">
            <button
              onClick={onToggle}
              className={cls.collapseBtn}
            >
              <Flex align="center" justify="center">
                <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <ChevronLeft className={cls.collapseIcon} />
                </motion.div>
              </Flex>
            </button>
          </Flex>
        )}
      </VStack>
    </motion.aside>
  );
};
