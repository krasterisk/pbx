import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import { Button, Text, Flex, NavItem } from '@/shared/ui';
import { filterPagesByLevel, isHubModuleShown } from '@/features/modules/lib/moduleRegistry';
import { moduleHubPath, resolveNavigation } from '@/features/modules/lib/navigation';
import type { HubModuleRow } from '@/features/modules/types';
import type { UserLevel } from '@krasterisk/shared';
import cls from './ModuleNavigation.module.scss';

interface ModuleNavigationProps {
  rows: HubModuleRow[];
  level?: UserLevel;
  compact?: boolean;
  onExpand?: () => void;
  onNavigate?: (event: React.MouseEvent) => void;
  testIdPrefix: string;
  includeHub?: boolean;
  className?: string;
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => unknown;
}

export function ModuleNavigation({ rows, level, compact = false, onExpand, onNavigate, testIdPrefix, includeHub = true, className, isLoading, isError, refetch }: ModuleNavigationProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const groupId = useId();
  const modules = useMemo(() => rows.filter(isHubModuleShown)
    .map((row) => ({ ...row, pages: filterPagesByLevel(row.pages, level) }))
    .filter((row) => row.pages.length > 0), [rows, level]);
  const current = resolveNavigation(pathname, modules.filter((row) => row.licenseStatus === 'active'));
  const currentCode = current?.module.code;
  const [expandedCodes, setExpandedCodes] = useState<string[]>(() => currentCode ? [currentCode] : []);
  useEffect(() => {
    if (currentCode) setExpandedCodes((codes) => codes.includes(currentCode) ? codes : [...codes, currentCode]);
  }, [currentCode, pathname]);
  const toggleSection = (code: string) => {
    if (compact) onExpand?.();
    setExpandedCodes((codes) => compact
      ? codes.includes(code) ? codes : [...codes, code]
      : codes.includes(code) ? codes.filter((item) => item !== code) : [...codes, code]);
  };
  const closeAfterNavigation = onNavigate;
  return <Flex as='nav' direction='column' align='stretch' className={cls.list + (compact ? ' ' + cls.compact : '') + (className ? ' ' + className : '')}
    aria-label={t('hub.catalog')} data-testid={testIdPrefix + '-navigation'}>
    {isLoading && <Text role='status' variant='muted'>{t('common.loading')}</Text>}
    {isError && <Button variant='ghost' onClick={() => refetch?.()}>{t('common.retry')}</Button>}
        {[true, false].map((available) => <Flex key={String(available)} direction='column' align='stretch' gap='4' className={cls.group}>
          {!available && modules.some((row) => row.licenseStatus !== 'active') && <Text className={cls.groupLabel}>{t('hub.unavailableSections')}</Text>}
          {modules.filter((row) => (row.licenseStatus === 'active') === available).map((row) => {
            const Icon = row.pages[0]?.icon ?? LayoutGrid;
            if (!available) return <NavItem key={row.code} to={moduleHubPath(row.code)} className={cls.row} aria-label={t(row.labelKey) + ' — ' + t(row.licenseStatus === 'locked' ? 'hub.notConnected' : 'license.disabled')} title={t(row.labelKey)}
              data-testid={testIdPrefix + '-' + row.code} onClick={closeAfterNavigation}>
              <Icon size={18} aria-hidden />
              <Flex direction='column' align='start' className={cls.label}>
                <Text as='span'>{t(row.labelKey)}</Text>
                <Text as='span' className={cls.status}>{t(row.licenseStatus === 'locked' ? 'hub.notConnected' : 'license.disabled')}</Text>
              </Flex>
            </NavItem>;
            if (row.pages.length === 1) return <NavItem key={row.code} to={row.pages[0].path}
              className={cls.row + (current?.module.code === row.code ? ' ' + cls.current : '')}
              data-testid={testIdPrefix + '-' + row.code} title={t(row.labelKey)} aria-label={t(row.labelKey)}
              aria-current={current?.module.code === row.code ? 'page' : undefined} onClick={closeAfterNavigation}>
              <Icon size={18} aria-hidden /><Text as='span' className={cls.label}>{t(row.labelKey)}</Text>
            </NavItem>;
            const expanded = expandedCodes.includes(row.code);
            const pagesId = groupId + '-pages-' + encodeURIComponent(row.code);
            return <Flex key={row.code} direction='column' align='stretch' className={cls.group}>
              <Button type='button' variant='ghost' className={cls.row + (current?.module.code === row.code ? ' ' + cls.currentSection : '')}
                data-testid={testIdPrefix + '-' + row.code} title={t(row.labelKey)} aria-label={t(row.labelKey)} aria-expanded={!compact && expanded} aria-controls={pagesId}
                onClick={() => toggleSection(row.code)}>
                <Icon size={18} aria-hidden /><Text as='span' className={cls.label}>{t(row.labelKey)}</Text>
                <ChevronDown size={16} aria-hidden className={cls.chevron + (expanded ? ' ' + cls.expandedChevron : '')} />
              </Button>
              <Flex id={pagesId} hidden={compact || !expanded} direction='column' align='stretch' className={cls.pages}>
                {row.pages.map((page) => {
                  const PageIcon = page.icon;
                  return <NavItem key={page.id} to={page.path} className={cls.row + ' ' + cls.pageRow + (current?.module.code === row.code && current.page.id === page.id ? ' ' + cls.current : '')}
                    data-testid={testIdPrefix + '-page-' + row.code + '-' + page.id}
                    aria-current={current?.module.code === row.code && current.page.id === page.id ? 'page' : undefined} onClick={closeAfterNavigation}>
                    <PageIcon size={18} aria-hidden /><Text as='span' className={cls.label}>{t(page.labelKey)}</Text>
                  </NavItem>;
                })}
              </Flex>
            </Flex>;
          })}
        </Flex>)}
        {includeHub && <NavItem to='/modules' className={cls.row} data-testid={testIdPrefix + '-hub'} aria-current={pathname === '/modules' ? 'page' : undefined} onClick={closeAfterNavigation}>
          <LayoutGrid size={18} aria-hidden /><Text as='span'>{t('hub.title')}</Text>
        </NavItem>}

  </Flex>;
}
