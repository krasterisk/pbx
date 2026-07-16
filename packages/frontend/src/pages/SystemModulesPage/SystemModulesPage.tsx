import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { TenantModulesPanel } from '@/features/modules/ui/TenantModulesPanel/TenantModulesPanel';
import { TenantRoleStartEditor } from '@/features/modules/ui/TenantRoleStartEditor/TenantRoleStartEditor';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { UserLevel } from '@krasterisk/shared';
import cls from './SystemModulesPage.module.scss';

type SystemTab = 'modules' | 'role-start';

/** System → Modules — tenant enable/disable + Buy (D-22) and role→start overrides (D-04). */
export const SystemModulesPage = memo(function SystemModulesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SystemTab>('modules');
  const user = useAppSelector((s) => s.auth.user);
  const canEditRoleStart =
    user?.level === UserLevel.ADMIN || user?.level === UserLevel.SUPERADMIN;

  return (
    <VStack
      gap="16"
      max
      className={cls.page}
      data-testid="system-modules-page-responsive"
    >
      <HStack gap="0" className={cls.tabsRow} max>
        <button
          type="button"
          id="system-tab-modules"
          className={`${cls.tab} ${tab === 'modules' ? cls.tabActive : ''}`}
          onClick={() => setTab('modules')}
        >
          {t('nav.modules', 'Modules')}
        </button>
        {canEditRoleStart && (
          <button
            type="button"
            id="system-tab-role-start"
            className={`${cls.tab} ${tab === 'role-start' ? cls.tabActive : ''}`}
            onClick={() => setTab('role-start')}
          >
            {t('system.roleStartTab')}
          </button>
        )}
      </HStack>

      <div
        className={`${cls.contentScroll} overflow-x-auto`}
        data-testid="hybrid-table"
        data-hybrid="overflow-x-auto"
      >
        {tab === 'modules' ? (
          <TenantModulesPanel />
        ) : canEditRoleStart ? (
          <TenantRoleStartEditor />
        ) : (
          <Text variant="muted">{t('system.roleStartAdminOnly')}</Text>
        )}
      </div>
    </VStack>
  );
});
