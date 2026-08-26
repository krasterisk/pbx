import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Loader, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useGetTenantRoleStartOverridesQuery,
  useUpdateTenantRoleStartMutation,
  type IRoleStartRow,
} from '@/shared/api/endpoints/cloudAdminApi';
import { ROLE_START_LEVELS } from '@/features/platform-admin';
import { pathForPageCode, HUB_PAGE_OPTIONS } from '@/features/platform-admin/lib/hubPageOptions';

/**
 * Tenant ADMIN editor for tenant_role_start overrides (D-04).
 * Own tenant only - API binds tenant_id from JWT.
 */
export function TenantRoleStartEditor() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetTenantRoleStartOverridesQuery();
  const [save, { isLoading: saving }] = useUpdateTenantRoleStartMutation();
  const [paths, setPaths] = useState<Record<number, string>>({});

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const row of ROLE_START_LEVELS) {
      const hit = data?.find((r) => r.user_level === row.level);
      next[row.level] = hit?.start_path ?? '';
    }
    setPaths(next);
  }, [data]);

  const handleSave = async () => {
    const rows: IRoleStartRow[] = ROLE_START_LEVELS.map(({ level }) => ({
      user_level: level,
      start_path: (paths[level] || '/').trim() || '/',
    }));
    await save({ rows });
  };

  if (isLoading) {
    return (
      <HStack justify="center" className="py-16">
        <Loader size={40} />
      </HStack>
    );
  }

  return (
    <VStack gap="16" max data-testid="tenant-role-start-editor">
      <Text as="h2">{t('system.roleStartTitle')}</Text>
      <Text variant="muted" className="text-sm">
        {t('system.roleStartPrecedenceHint')}
      </Text>

      <VStack gap="12" max>
        {ROLE_START_LEVELS.map(({ level, labelKey }) => (
          <VStack key={level} gap="4" max>
            <HStack gap="12" align="center" max>
              <Text style={{ minWidth: 120 }}>{t(labelKey)}</Text>
              <Input
                value={paths[level] ?? ''}
                onChange={(e) =>
                  setPaths((prev) => ({ ...prev, [level]: e.target.value }))
                }
                id={`tenant-role-start-path-${level}`}
                aria-label={t(labelKey)}
                placeholder="/"
                list="tenant-role-start-path-suggestions"
              />
            </HStack>
          </VStack>
        ))}
      </VStack>

      <datalist id="tenant-role-start-path-suggestions">
        {HUB_PAGE_OPTIONS.map((opt) => {
          const path = pathForPageCode(opt.value);
          return path ? <option key={opt.value} value={path} /> : null;
        })}
      </datalist>

      <Button type="button" onClick={handleSave} disabled={saving} id="tenant-role-start-save">
        {t('system.roleStartSave')}
      </Button>
    </VStack>
  );
}
