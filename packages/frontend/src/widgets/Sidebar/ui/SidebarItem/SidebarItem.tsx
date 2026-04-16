import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { classNames } from '@/shared/lib/classNames/classNames';
import { HStack } from '@/shared/ui/Stack';
import cls from './SidebarItem.module.scss';

export interface SidebarItemType {
  name: string;
  path: string;
  icon: LucideIcon;
}

interface SidebarItemProps {
  item: SidebarItemType;
  isActive: boolean;
  isVisuallyExpanded: boolean;
  collapsed: boolean;
}

export const SidebarItem = memo(({ item, isActive, isVisuallyExpanded, collapsed }: SidebarItemProps) => {
  const { t } = useTranslation();
  const { path, icon: Icon, name } = item;

  return (
    <NavLink to={path} className={cls.linkWrapper} title={!isVisuallyExpanded ? t(name, name) : undefined}>
      <HStack
        gap="12"
        justify={!isVisuallyExpanded ? 'center' : 'start'}
        className={classNames(
          cls.item,
          { [cls.active]: isActive, [cls.collapsed]: !isVisuallyExpanded },
          []
        )}
      >
        <Icon className={classNames(cls.icon, { [cls.activeIcon]: isActive }, [])} />
        
        <AnimatePresence>
          {isVisuallyExpanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className={cls.text}
            >
              {t(name, name)}
            </motion.span>
          )}
        </AnimatePresence>

        {isActive && (
          <motion.div
            layoutId="sidebar-active"
            className={cls.activeIndicator}
          />
        )}
      </HStack>
    </NavLink>
  );
});
