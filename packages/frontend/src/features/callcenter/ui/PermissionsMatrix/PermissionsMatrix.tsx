import { useTranslation } from 'react-i18next';
import type { TranslateFn } from '@/shared/lib/translateFn';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Switch, Tooltip, Skeleton, Button, Text,
} from '@/shared/ui';
import type {
  IEffectivePermissions,
  IPermissionsMatrixRow,
  SpyMode,
} from '@/shared/api/endpoints/callCenterApi';
import {
  ALL_SPY_MODES,
  PERMISSION_BOOL_KEYS,
  type PermissionBoolKey,
} from './permissionRights';
import styles from './PermissionsMatrix.module.scss';

export interface PermissionsMatrixProps {
  rows: IPermissionsMatrixRow[];
  /** Locks keyed by UserLevel string/number → right → locked. */
  locksByLevel: Record<string, Partial<Record<keyof IEffectivePermissions, boolean>>>;
  onToggleBool: (operatorId: number, key: PermissionBoolKey, value: boolean) => void;
  onToggleSpyMode: (operatorId: number, mode: SpyMode, enabled: boolean) => void;
  onOpenOperator: (row: IPermissionsMatrixRow) => void;
  disabled?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function levelLabel(
  level: number,
  t: TranslateFn,
): string {
  const map: Record<number, string> = {
    0: t('callcenter.settings.permissions.levels.superadmin', 'Superadmin'),
    1: t('callcenter.settings.permissions.levels.admin', 'Admin'),
    2: t('callcenter.settings.permissions.levels.operator', 'Operator'),
    3: t('callcenter.settings.permissions.levels.supervisor', 'Supervisor'),
    5: t('callcenter.settings.permissions.levels.readonly', 'Readonly'),
  };
  return map[level] ?? String(level);
}

/**
 * D-40: operators × rights bulk table. Locked cells follow NotificationMatrix
 * pattern (disabled + "set by administrator" tooltip).
 */
export function PermissionsMatrix({
  rows,
  locksByLevel,
  onToggleBool,
  onToggleSpyMode,
  onOpenOperator,
  disabled,
  isLoading,
  isError,
  onRetry,
}: PermissionsMatrixProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
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
    <div className={styles.wrap} data-testid="permissions-matrix">
      <Text className={styles.hint}>
        {t(
          'callcenter.settings.permissions.matrixHint',
          'Click a name to edit all rights. Click-to-call is required for SIP softphone outbound; unused in WebRTC mode.',
        )}
      </Text>
      <div className={styles.scroll}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('callcenter.settings.permissions.operatorColumn', 'Operator')}</TableHead>
                  {PERMISSION_BOOL_KEYS.map((key) => (
                <TableHead key={key} className="text-center">
                  {t(`callcenter.settings.permissions.rights.${key}`, key)}
                </TableHead>
              ))}
              <TableHead>{t('callcenter.settings.permissions.rights.spy_modes', 'ChanSpy modes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const locks = locksByLevel[String(row.level)] ?? locksByLevel[row.level as unknown as string] ?? {};
              return (
                <TableRow key={row.operator_user_id}>
                  <TableCell>
                    <div className={styles.nameCell}>
                      <button
                        type="button"
                        className={styles.nameBtn}
                        onClick={() => onOpenOperator(row)}
                      >
                        {row.name || `#${row.operator_user_id}`}
                      </button>
                      <span className={styles.level}>{levelLabel(row.level, t)}</span>
                    </div>
                  </TableCell>
                  {PERMISSION_BOOL_KEYS.map((key) => {
                    const locked = !!locks[key];
                    const switchEl = (
                      <Switch
                        checked={row.permissions[key]}
                        disabled={disabled || locked}
                        onCheckedChange={(next) => onToggleBool(row.operator_user_id, key, next)}
                        aria-label={`${row.name}, ${t(`callcenter.settings.permissions.rights.${key}`, key)}`}
                        data-testid={`perm-${row.operator_user_id}-${key}`}
                      />
                    );
                    return (
                      <TableCell key={key} className="text-center">
                        {locked ? (
                          <Tooltip content={t('callcenter.settings.lockedHint', 'Set by administrator')}>
                            <span>{switchEl}</span>
                          </Tooltip>
                        ) : (
                          switchEl
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <div className={styles.spyModes}>
                      {ALL_SPY_MODES.map((mode) => {
                        const locked = !!locks.spy_modes;
                        const checked = row.permissions.spy_modes.includes(mode);
                        const chip = (
                          <label className={styles.spyChip}>
                            <Switch
                              checked={checked}
                              disabled={disabled || locked || !row.permissions.can_spy}
                              onCheckedChange={(next) => {
                                onToggleSpyMode(row.operator_user_id, mode, next);
                              }}
                              aria-label={`${row.name}, ${mode}`}
                            />
                            {t(`callcenter.settings.permissions.spyModes.${mode}`, mode)}
                          </label>
                        );
                        return locked ? (
                          <Tooltip
                            key={mode}
                            content={t('callcenter.settings.lockedHint', 'Set by administrator')}
                          >
                            <span>{chip}</span>
                          </Tooltip>
                        ) : (
                          <span key={mode}>{chip}</span>
                        );
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
