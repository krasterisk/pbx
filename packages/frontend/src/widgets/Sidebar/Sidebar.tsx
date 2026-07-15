import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { VStack, Flex } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectUserLevel } from '@/entities/User';
import { SidebarItem, SidebarItemType } from './ui/SidebarItem/SidebarItem';
import { SidebarLogo } from './ui/SidebarLogo/SidebarLogo';
import { buildNavigation } from './lib/buildNavigation';
import cls from './Sidebar.module.scss';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}

export const Sidebar = ({ collapsed, onToggle, isMobile }: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const level = useAppSelector(selectUserLevel);
  const navigation = buildNavigation(t, level);

  const isVisuallyExpanded = isMobile ? true : !collapsed;

  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    // Close on swipe left > 40px
    if (diff > 40 && isMobile && !collapsed) {
      onToggle();
    }
    touchStartX.current = null;
  };

  return (
    <motion.aside
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
