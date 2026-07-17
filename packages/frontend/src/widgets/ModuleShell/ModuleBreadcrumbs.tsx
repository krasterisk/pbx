import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
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
  onSelect: () => void;
}

interface ModuleBreadcrumbsProps {
  /** Hub route: single static label */
  hubLabel?: string;
  moduleLabel?: string;
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
        <button
          type="button"
          className={classNames(
            cls.crumbBtn,
            { [cls.crumbCurrent]: !!current },
            [],
          )}
          data-testid={testId}
        >
          <span className={cls.crumbBtnLabel}>{label}</span>
          <ChevronDown className={cls.crumbChevron} size={14} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" data-testid={`${testId}-menu`}>
        {items.map((item) => (
          <DropdownMenuItem key={item.id} onClick={item.onSelect}>
            {item.label}
          </DropdownMenuItem>
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
  moduleItems,
  pageLabel,
  pageItems,
}: ModuleBreadcrumbsProps) {
  const { t } = useTranslation();

  if (hubLabel) {
    return (
      <nav
        className={cls.crumbs}
        aria-label={t('hub.breadcrumbLabel')}
        data-testid="module-breadcrumbs"
      >
        <span className={classNames(cls.crumbText, { [cls.crumbCurrent]: true }, [])}>
          {hubLabel}
        </span>
      </nav>
    );
  }

  if (!moduleLabel) return null;

  const hasPages = !!pageLabel && !!pageItems?.length;

  return (
    <nav
      className={cls.crumbs}
      aria-label={t('hub.breadcrumbLabel')}
      data-testid="module-breadcrumbs"
    >
      {moduleItems && moduleItems.length > 0 ? (
        <CrumbMenu
          label={moduleLabel}
          items={moduleItems}
          current={!hasPages}
          testId="crumb-module"
        />
      ) : (
        <span
          className={classNames(cls.crumbText, { [cls.crumbCurrent]: !hasPages }, [])}
        >
          {moduleLabel}
        </span>
      )}

      {hasPages && (
        <span className={cls.crumbItem}>
          <ChevronRight className={cls.crumbSep} size={14} aria-hidden />
          <CrumbMenu
            label={pageLabel}
            items={pageItems}
            current
            testId="crumb-page"
          />
        </span>
      )}
    </nav>
  );
});
