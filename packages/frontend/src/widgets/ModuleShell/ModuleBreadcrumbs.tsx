import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Button, Text, Flex, NavItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui';
import { classNames } from '@/shared/lib/classNames/classNames';
import cls from './ModuleShell.module.scss';

export interface BreadcrumbMenuItem {
  id: string;
  label: string;
  onSelect?: () => void;
  to?: string;
}

interface ModuleBreadcrumbsProps {
  /** Hub route: single static label */
  hubLabel?: string;
  moduleLabel?: string;
  moduleCurrent?: boolean;
  moduleItems?: BreadcrumbMenuItem[];
  pageLabel?: string;
  pageItems?: BreadcrumbMenuItem[];
}

function CrumbMenu({
  label,
  items,
  current,
  testId,
}: {
  label: string;
  items: BreadcrumbMenuItem[];
  current?: boolean;
  testId: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost"
          type="button"
          className={classNames(
            cls.crumbBtn,
            { [cls.crumbCurrent]: !!current },
            [],
          )}
          aria-current={current ? "page" : undefined}
          data-testid={testId}
        >
          <Text as="span" className={cls.crumbBtnLabel}>{label}</Text>
          <ChevronDown className={cls.crumbChevron} size={14} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" data-testid={`${testId}-menu`}>
        {items.map((item) => (
          item.to ? <DropdownMenuItem key={item.id} asChild>
            <NavItem to={item.to}>{item.label}</NavItem>
          </DropdownMenuItem> : <DropdownMenuItem key={item.id} onClick={item.onSelect}>{item.label}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Topbar crumbs: Module ▾ → Page ▾ (menus). Not Home → Module → Page links.
 */
export const ModuleBreadcrumbs = memo(function ModuleBreadcrumbs({
  hubLabel,
  moduleLabel,
  moduleCurrent = true,
  moduleItems,
  pageLabel,
  pageItems,
}: ModuleBreadcrumbsProps) {
  const { t } = useTranslation();

  if (hubLabel) {
    return (
      <Flex as="nav"
        className={cls.crumbs}
        aria-label={t('hub.breadcrumbLabel')}
        data-testid="module-breadcrumbs"
      >
        <Text as="span" aria-current="page" className={classNames(cls.crumbText, { [cls.crumbCurrent]: true }, [])}>
          {hubLabel}
        </Text>
      </Flex>
    );
  }

  if (!moduleLabel) return null;

  const hasPages = !!pageLabel && !!pageItems?.length;

  return (
    <Flex as="nav"
      className={cls.crumbs}
      aria-label={t('hub.breadcrumbLabel')}
      data-testid="module-breadcrumbs"
    >
      {moduleItems && moduleItems.length > 0 ? (
        <CrumbMenu
          label={moduleLabel}
          items={moduleItems}
          current={!hasPages && moduleCurrent}
          testId="crumb-module"
        />
      ) : (
        <Text as="span"
          className={classNames(cls.crumbText, { [cls.crumbCurrent]: !hasPages }, [])}
        >
          {moduleLabel}
        </Text>
      )}

      {hasPages && (
        <Text as="span" className={cls.crumbItem}>
          <ChevronRight className={cls.crumbSep} size={14} aria-hidden />
          <CrumbMenu
            label={pageLabel}
            items={pageItems}
            current
            testId="crumb-page"
          />
        </Text>
      )}
    </Flex>
  );
});
