import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { TenantModulesPanel } from '@/features/modules/ui/TenantModulesPanel/TenantModulesPanel';
import { TenantRoleStartEditor } from '@/features/modules/ui/TenantRoleStartEditor/TenantRoleStartEditor';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { UserLevel } from '@krasterisk/shared';

type SystemTab = 'modules' | 'role-start';

/** System → Modules — tenant enable/disable + Buy (D-22) and role→start overrides (D-04). */
export const SystemModulesPage = memo(function SystemModulesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SystemTab>('modules');
  const user = useAppSelector((s) => s.auth.user);
  const canEditRoleStart =
    user?.level === UserLevel.ADMIN || user?.level === UserLevel.SUPERADMIN;

  return (
    <VStack gap="16" max data-testid="system-modules-page">
      <HStack gap="0" className="border-b border-border" max>
        <button
          type="button"
          id="system-tab-modules"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'modules'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('modules')}
        >
          {t('nav.modules', 'Modules')}
        </button>
        {canEditRoleStart && (
          <button
            type="button"
            id="system-tab-role-start"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'role-start'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab('role-start')}
          >
            {t('system.roleStartTab')}
          </button>
        )}
      </HStack>

      {tab === 'modules' ? (
        <TenantModulesPanel />
      ) : canEditRoleStart ? (
        <TenantRoleStartEditor />
      ) : (
        <Text variant="muted">{t('system.roleStartAdminOnly')}</Text>
      )}
    </VStack>
  );
});
