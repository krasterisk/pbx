import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui';
import type { HubModuleRow } from '@/features/modules/types';
import { getModuleEntryPath } from '@/features/modules/lib/moduleRegistry';
import { UserLevel } from '@krasterisk/shared';
import cls from './ModuleShell.module.scss';

interface ModuleChipProps {
  currentLabel: string;
  modules: HubModuleRow[];
  level: UserLevel | undefined;
}

export const ModuleChip = memo(function ModuleChip({
  currentLabel,
  modules,
  level,
}: ModuleChipProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Licensed switcher — active only (disabled stay in Hub, not Buy targets)
  const switchable = modules.filter((m) => m.licenseStatus === 'active');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={cls.chip} id="module-chip-trigger">
          <LayoutGrid className={cls.chipIcon} aria-hidden />
          <span>{currentLabel}</span>
          <ChevronDown size={14} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => navigate('/modules')}>
          {t('hub.chipEmpty')}
        </DropdownMenuItem>
        {switchable.map((mod) => {
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
