import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Loader, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useGetPlatformRoleStartDefaultsQuery,
  useUpdatePlatformRoleStartDefaultsMutation,
  type IRoleStartRow,
} from '@/shared/api/endpoints/cloudAdminApi';
import { ROLE_START_LEVELS } from '../lib/roleStartLevels';
import { HUB_PAGE_OPTIONS, pathForPageCode } from '../lib/hubPageOptions';

/**
 * Platform role→start defaults matrix — SuperAdmin PUT /cloud-admin/role-start (D-04 / D-16).
 */
export function PlatformRoleStartEditor() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetPlatformRoleStartDefaultsQuery();
  const [save, { isLoading: saving }] = useUpdatePlatformRoleStartDefaultsMutation();
  const [paths, setPaths] = useState<Record<number, string>>({});

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const row of ROLE_START_LEVELS) {
      const hit = data?.find((r) => r.user_level === row.level);
      next[row.level] = hit?.start_path ?? '/';
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
    <VStack gap="16" max data-testid="platform-role-start-editor">
      <Text as="h1">{t('platform.roleStartTitle', 'Role → start')}</Text>
      <Text variant="muted">{t('platform.roleStartPrecedenceHint')}</Text>

      <VStack gap="12" max>
        {ROLE_START_LEVELS.map(({ level, labelKey }) => (
          <HStack key={level} gap="12" align="center" max>
            <Text style={{ minWidth: 120 }}>{t(labelKey)}</Text>
            <Input
              value={paths[level] ?? '/'}
              onChange={(e) =>
                setPaths((prev) => ({ ...prev, [level]: e.target.value }))
              }
              id={`role-start-path-${level}`}
              aria-label={t(labelKey)}
              list="platform-role-start-path-suggestions"
            />
          </HStack>
        ))}
      </VStack>

      <datalist id="platform-role-start-path-suggestions">
        {HUB_PAGE_OPTIONS.map((opt) => {
          const path = pathForPageCode(opt.value);
          return path ? <option key={opt.value} value={path} /> : null;
        })}
      </datalist>

      <Button type="button" onClick={handleSave} disabled={saving} id="platform-role-start-save">
        {t('platform.roleStartSave')}
      </Button>
    </VStack>
  );
}
