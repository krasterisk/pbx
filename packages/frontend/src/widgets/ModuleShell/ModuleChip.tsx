import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { HubModuleRow } from '@/features/modules/types';
import { getModuleEntryPath } from '@/features/modules/lib/moduleRegistry';
import { UserLevel } from '@krasterisk/shared';
import cls from './ModuleShell.module.scss';

interface ModuleChipProps {
  currentLabel: string;
  modules: HubModuleRow[];
  level: UserLevel | undefined;
}

function ModuleSwitcherList({
  modules,
  level,
  onSelect,
}: {
  modules: HubModuleRow[];
  level: UserLevel | undefined;
  onSelect: (path: string) => void;
}) {
  const { t } = useTranslation();
  // Licensed switcher — active only (disabled stay in Hub, not Buy targets)
  const switchable = modules.filter((m) => m.licenseStatus === 'active');

  return (
    <>
      <button
        type="button"
        className={cls.chipSheetRow}
        onClick={() => onSelect('/modules')}
      >
        <span className={cls.chipSheetIcon}>
          <LayoutGrid size={18} aria-hidden />
        </span>
        {t('hub.chipEmpty')}
      </button>
      {switchable.map((mod) => {
        const Icon = mod.pages[0]?.icon;
        return (
          <button
            key={mod.code}
            type="button"
            className={cls.chipSheetRow}
            onClick={() => onSelect(getModuleEntryPath(mod, level))}
          >
            <span className={cls.chipSheetIcon}>
              {Icon ? <Icon size={18} aria-hidden /> : <LayoutGrid size={18} aria-hidden />}
            </span>
            {mod.catalogName || t(mod.labelKey)}
          </button>
        );
      })}
    </>
  );
}

export const ModuleChip = memo(function ModuleChip({
  currentLabel,
  modules,
  level,
}: ModuleChipProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const [sheetOpen, setSheetOpen] = useState(false);

  const go = (path: string) => {
    setSheetOpen(false);
    navigate(path);
  };

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          className={cls.chip}
          id="module-chip-trigger"
          data-testid="module-chip-trigger"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <LayoutGrid className={cls.chipIcon} aria-hidden />
          <span>{currentLabel}</span>
          <ChevronDown size={14} aria-hidden />
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            data-testid="module-chip-sheet"
            className={`${cls.chipSheetContent} data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom`}
            aria-describedby={undefined}
          >
            <SheetHeader>
              <SheetTitle>{t('hub.chipEmpty')}</SheetTitle>
            </SheetHeader>
            <div className={cls.chipSheetList}>
              <ModuleSwitcherList modules={modules} level={level} onSelect={go} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cls.chip}
          id="module-chip-trigger"
          data-testid="module-chip-trigger"
        >
          <LayoutGrid className={cls.chipIcon} aria-hidden />
          <span>{currentLabel}</span>
          <ChevronDown size={14} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" data-testid="module-chip-menu">
        <DropdownMenuItem onClick={() => navigate('/modules')}>
          {t('hub.chipEmpty')}
        </DropdownMenuItem>
        {modules
          .filter((m) => m.licenseStatus === 'active')
          .map((mod) => {
            const Icon = mod.pages[0]?.icon;
            return (
              <DropdownMenuItem
                key={mod.code}
                onClick={() => navigate(getModuleEntryPath(mod, level))}
              >
                {Icon ? <Icon size={14} aria-hidden /> : null}
                {mod.catalogName || t(mod.labelKey)}
              </DropdownMenuItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
