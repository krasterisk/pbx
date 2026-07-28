import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Text, VStack } from '@/shared/ui';
import {
  useGetPermissionsMatrixQuery,
  useUpdateOperatorPermissionsMutation,
  useGetTenantPermissionsDefaultsQuery,
  useUpdateTenantPermissionsDefaultsMutation,
  type IEffectivePermissions,
  type IPermissionsMatrixRow,
  type ITenantPermissionsDefaults,
  type SpyMode,
} from '@/shared/api/endpoints/callCenterApi';
import { PermissionsMatrix } from './PermissionsMatrix';
import { OperatorPermissionsForm } from './OperatorPermissionsForm';
import { RolePermissionsDefaultsForm } from './RolePermissionsDefaultsForm';
import { ALL_SPY_MODES, type PermissionBoolKey } from './permissionRights';
import styles from './PermissionsMatrix.module.scss';

/**
 * Supervisor settings panel: bulk matrix + role defaults (D-40).
 */
export function PermissionsSettingsPanel() {
  const { t } = useTranslation();
  const matrixQuery = useGetPermissionsMatrixQuery();
  const defaultsQuery = useGetTenantPermissionsDefaultsQuery();
  const [updateOperator, { isLoading: savingOp }] = useUpdateOperatorPermissionsMutation();
  const [updateDefaults, { isLoading: savingDefaults }] = useUpdateTenantPermissionsDefaultsMutation();

  const [selected, setSelected] = useState<IPermissionsMatrixRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const locksByLevel = defaultsQuery.data?.permission_locks ?? {};

  const onToggleBool = useCallback(
    async (operatorId: number, key: PermissionBoolKey, value: boolean) => {
      try {
        await updateOperator({ operatorId, body: { [key]: value } }).unwrap();
      } catch {
        toast.error(t('common.error', 'Save failed'));
      }
    },
    [updateOperator, t],
  );

  const onToggleSpyMode = useCallback(
    async (operatorId: number, mode: SpyMode, enabled: boolean) => {
      const row = matrixQuery.data?.find((r) => r.operator_user_id === operatorId);
      if (!row) return;
      const set = new Set(row.permissions.spy_modes);
      if (enabled) set.add(mode);
      else set.delete(mode);
      try {
        await updateOperator({
          operatorId,
          body: { spy_modes: ALL_SPY_MODES.filter((m) => set.has(m)) },
        }).unwrap();
      } catch {
        toast.error(t('common.error', 'Save failed'));
      }
    },
    [matrixQuery.data, updateOperator, t],
  );

  const onOpenOperator = useCallback((row: IPermissionsMatrixRow) => {
    setSelected(row);
    setSheetOpen(true);
  }, []);

  const onSaveOperator = useCallback(
    async (patch: Partial<IEffectivePermissions>) => {
      if (!selected) return;
      try {
        await updateOperator({ operatorId: selected.operator_user_id, body: patch }).unwrap();
        toast.success(t('callcenter.settings.permissions.saved', 'Permissions saved'));
      } catch {
        toast.error(t('common.error', 'Save failed'));
        throw new Error('save failed');
      }
    },
    [selected, updateOperator, t],
  );

  const onSaveDefaults = useCallback(
    async (payload: ITenantPermissionsDefaults) => {
      try {
        await updateDefaults(payload).unwrap();
        toast.success(t('callcenter.settings.permissions.saved', 'Permissions saved'));
      } catch {
        toast.error(t('common.error', 'Save failed'));
        throw new Error('save failed');
      }
    },
    [updateDefaults, t],
  );

  const selectedLocks =
    selected
      ? (locksByLevel[String(selected.level)] ?? {})
      : {};

  // Keep sheet permissions in sync with matrix cache after optimistic updates
  const selectedPermissions =
    matrixQuery.data?.find((r) => r.operator_user_id === selected?.operator_user_id)?.permissions
    ?? selected?.permissions;

  return (
    <VStack gap="24" max>
      <div>
        <Text className={styles.sectionTitle}>
          {t('callcenter.settings.permissions.matrixTitle', 'Operator permissions')}
        </Text>
        <PermissionsMatrix
          rows={matrixQuery.data ?? []}
          locksByLevel={locksByLevel}
          onToggleBool={(id, key, value) => void onToggleBool(id, key, value)}
          onToggleSpyMode={(id, mode, enabled) => void onToggleSpyMode(id, mode, enabled)}
          onOpenOperator={onOpenOperator}
          disabled={savingOp}
          isLoading={matrixQuery.isLoading}
          isError={matrixQuery.isError}
          onRetry={() => void matrixQuery.refetch()}
        />
      </div>

      <RolePermissionsDefaultsForm
        data={defaultsQuery.data}
        isLoading={defaultsQuery.isLoading}
        isError={defaultsQuery.isError}
        onRetry={() => void defaultsQuery.refetch()}
        onSave={onSaveDefaults}
        saving={savingDefaults}
      />

      {selected && selectedPermissions && (
        <OperatorPermissionsForm
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          operatorName={selected.name || `#${selected.operator_user_id}`}
          permissions={selectedPermissions}
          locks={selectedLocks}
          onSave={onSaveOperator}
          saving={savingOp}
        />
      )}
    </VStack>
  );
}
