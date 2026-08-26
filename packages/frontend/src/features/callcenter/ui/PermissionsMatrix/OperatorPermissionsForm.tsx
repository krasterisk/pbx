import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button, Label, Switch, Text, Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/shared/ui';
import type { IEffectivePermissions, SpyMode } from '@/shared/api/endpoints/callCenterApi';
import {
  ALL_SPY_MODES,
  EMPTY_PERMISSIONS,
  PERMISSION_BOOL_KEYS,
  type PermissionBoolKey,
} from './permissionRights';
import styles from './PermissionsMatrix.module.scss';

export interface OperatorPermissionsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatorName: string;
  permissions: IEffectivePermissions;
  locks: Partial<Record<keyof IEffectivePermissions, boolean>>;
  onSave: (patch: Partial<IEffectivePermissions>) => Promise<void>;
  saving?: boolean;
}

/**
 * D-40: per-operator permissions sheet - same rights as the bulk matrix.
 */
export function OperatorPermissionsForm({
  open,
  onOpenChange,
  operatorName,
  permissions,
  locks,
  onSave,
  saving,
}: OperatorPermissionsFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<IEffectivePermissions>(permissions ?? EMPTY_PERMISSIONS);

  useEffect(() => {
    if (open) setForm(permissions ?? EMPTY_PERMISSIONS);
  }, [open, permissions]);

  const setBool = (key: PermissionBoolKey) => (checked: boolean) => {
    if (locks[key]) return;
    setForm((prev) => ({ ...prev, [key]: checked }));
  };

  const toggleSpy = (mode: SpyMode, enabled: boolean) => {
    if (locks.spy_modes) return;
    setForm((prev) => {
      const set = new Set(prev.spy_modes);
      if (enabled) set.add(mode);
      else set.delete(mode);
      return { ...prev, spy_modes: ALL_SPY_MODES.filter((m) => set.has(m)) };
    });
  };

  const handleSave = async () => {
    await onSave(form);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {t('callcenter.settings.permissions.operatorFormTitle', 'Permissions')}: {operatorName}
          </SheetTitle>
        </SheetHeader>
        <div className={styles.form} data-testid="operator-permissions-form">
          {PERMISSION_BOOL_KEYS.map((key) => {
            const locked = !!locks[key];
            return (
              <div key={key} className={styles.formRow}>
                <div className={styles.formLabel}>
                  <Label>{t(`callcenter.settings.permissions.rights.${key}`)}</Label>
                  {key === 'click_to_call' && (
                    <Text className={styles.hint}>
                      {t(
                        'callcenter.settings.permissions.clickToCallHint',
                        'Required for SIP softphone outbound (AMI Originate). Not used in WebRTC mode.',
                      )}
                    </Text>
                  )}
                  {locked && (
                    <Text className={styles.hint}>
                      {t('callcenter.settings.lockedHint', 'Set by administrator')}
                    </Text>
                  )}
                </div>
                <Switch
                  checked={form[key]}
                  disabled={locked || saving}
                  onCheckedChange={setBool(key)}
                />
              </div>
            );
          })}

          <div className={styles.form}>
            <Text className={styles.sectionTitle}>
              {t('callcenter.settings.permissions.rights.spy_modes')}
            </Text>
            <div className={styles.spyModes}>
              {ALL_SPY_MODES.map((mode) => (
                <label key={mode} className={styles.spyChip}>
                  <Switch
                    checked={form.spy_modes.includes(mode)}
                    disabled={!!locks.spy_modes || !form.can_spy || saving}
                    onCheckedChange={(next) => toggleSpy(mode, next)}
                  />
                  {t(`callcenter.settings.permissions.spyModes.${mode}`, mode)}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {t('callcenter.settings.save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
