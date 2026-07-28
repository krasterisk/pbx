import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Label, Switch, Text, Skeleton } from '@/shared/ui';
import type {
  IEffectivePermissions,
  ITenantPermissionsDefaults,
  SpyMode,
} from '@/shared/api/endpoints/callCenterApi';
import {
  ALL_SPY_MODES,
  EMPTY_PERMISSIONS,
  PERMISSION_BOOL_KEYS,
  ROLE_DEFAULT_LEVELS,
  type PermissionBoolKey,
} from './permissionRights';
import styles from './PermissionsMatrix.module.scss';

type RoleDefaultsState = Record<string, Partial<IEffectivePermissions>>;
type RoleLocksState = Record<string, Partial<Record<keyof IEffectivePermissions, boolean>>>;

export interface RolePermissionsDefaultsFormProps {
  data?: ITenantPermissionsDefaults;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSave: (payload: ITenantPermissionsDefaults) => Promise<void>;
  saving?: boolean;
}

function ensureLevel(
  defaults: RoleDefaultsState,
  locks: RoleLocksState,
  level: number,
): { defaults: RoleDefaultsState; locks: RoleLocksState } {
  const key = String(level);
  return {
    defaults: {
      ...defaults,
      [key]: { ...EMPTY_PERMISSIONS, ...(defaults[key] ?? {}) },
    },
    locks: {
      ...locks,
      [key]: { ...(locks[key] ?? {}) },
    },
  };
}

/**
 * D-39/D-40: role permission defaults + per-right locks (supervisor/admin).
 */
export function RolePermissionsDefaultsForm({
  data,
  isLoading,
  isError,
  onRetry,
  onSave,
  saving,
}: RolePermissionsDefaultsFormProps) {
  const { t } = useTranslation();
  const [defaults, setDefaults] = useState<RoleDefaultsState>({});
  const [locks, setLocks] = useState<RoleLocksState>({});

  useEffect(() => {
    if (!data) return;
    let nextDefaults = { ...(data.role_permission_defaults ?? {}) };
    let nextLocks = { ...(data.permission_locks ?? {}) };
    for (const { level } of ROLE_DEFAULT_LEVELS) {
      const ensured = ensureLevel(nextDefaults, nextLocks, level);
      nextDefaults = ensured.defaults;
      nextLocks = ensured.locks;
    }
    setDefaults(nextDefaults);
    setLocks(nextLocks);
  }, [data]);

  const setDefaultBool = (level: number, key: PermissionBoolKey, value: boolean) => {
    const k = String(level);
    setDefaults((prev) => ({
      ...prev,
      [k]: { ...EMPTY_PERMISSIONS, ...(prev[k] ?? {}), [key]: value },
    }));
  };

  const setLock = (level: number, key: keyof IEffectivePermissions, value: boolean) => {
    const k = String(level);
    setLocks((prev) => ({
      ...prev,
      [k]: { ...(prev[k] ?? {}), [key]: value },
    }));
  };

  const toggleSpyDefault = (level: number, mode: SpyMode, enabled: boolean) => {
    const k = String(level);
    setDefaults((prev) => {
      const cur = { ...EMPTY_PERMISSIONS, ...(prev[k] ?? {}) };
      const set = new Set(cur.spy_modes ?? []);
      if (enabled) set.add(mode);
      else set.delete(mode);
      return {
        ...prev,
        [k]: { ...cur, spy_modes: ALL_SPY_MODES.filter((m) => set.has(m)) },
      };
    });
  };

  const handleSave = async () => {
    await onSave({
      role_permission_defaults: defaults,
      permission_locks: locks,
    });
  };

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorCard}>
        <Text>{t('callcenter.settings.loadError')}</Text>
        {onRetry && (
          <Button type="button" variant="outline" onClick={onRetry}>
            {t('callcenter.settings.retry')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-testid="role-permissions-defaults">
      <Text className={styles.sectionTitle}>
        {t('callcenter.settings.permissions.roleDefaultsTitle', 'Role defaults and locks')}
      </Text>
      <Text className={styles.hint}>
        {t(
          'callcenter.settings.permissions.roleDefaultsHint',
          'Locked rights always use the role default and cannot be overridden per operator.',
        )}
      </Text>

      <div className={styles.roleGrid}>
        {ROLE_DEFAULT_LEVELS.map(({ level, key: levelKey }) => {
          const k = String(level);
          const entry = { ...EMPTY_PERMISSIONS, ...(defaults[k] ?? {}) };
          const levelLocks = locks[k] ?? {};
          return (
            <div key={level} className={styles.roleCard}>
              <Text className={styles.sectionTitle}>
                {t(`callcenter.settings.permissions.levels.${levelKey}`)}
              </Text>
              {PERMISSION_BOOL_KEYS.map((right) => (
                <div key={right} className={styles.roleRow}>
                  <div className={styles.formLabel}>
                    <Label>{t(`callcenter.settings.permissions.rights.${right}`)}</Label>
                    {right === 'click_to_call' && (
                      <Text className={styles.hint}>
                        {t(
                          'callcenter.settings.permissions.clickToCallHint',
                          'Required for SIP softphone outbound (AMI Originate). Not used in WebRTC mode.',
                        )}
                      </Text>
                    )}
                  </div>
                  <div className={styles.lockRow}>
                    <Switch
                      checked={!!entry[right]}
                      disabled={saving}
                      onCheckedChange={(next) => setDefaultBool(level, right, next)}
                    />
                    <Label className={styles.hint}>
                      <Switch
                        checked={!!levelLocks[right]}
                        disabled={saving}
                        onCheckedChange={(next) => setLock(level, right, next)}
                      />
                      {t('callcenter.settings.permissions.lockLabel', 'Lock')}
                    </Label>
                  </div>
                </div>
              ))}

              <div className={styles.roleRow}>
                <Label>{t('callcenter.settings.permissions.rights.spy_modes')}</Label>
                <div className={styles.lockRow}>
                  <div className={styles.spyModes}>
                    {ALL_SPY_MODES.map((mode) => (
                      <label key={mode} className={styles.spyChip}>
                        <Switch
                          checked={(entry.spy_modes ?? []).includes(mode)}
                          disabled={saving}
                          onCheckedChange={(next) => toggleSpyDefault(level, mode, next)}
                        />
                        {t(`callcenter.settings.permissions.spyModes.${mode}`, mode)}
                      </label>
                    ))}
                  </div>
                  <Label className={styles.hint}>
                    <Switch
                      checked={!!levelLocks.spy_modes}
                      disabled={saving}
                      onCheckedChange={(next) => setLock(level, 'spy_modes', next)}
                    />
                    {t('callcenter.settings.permissions.lockLabel', 'Lock')}
                  </Label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.actions}>
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          {t('callcenter.settings.save')}
        </Button>
      </div>
    </div>
  );
}
