import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  useDisableTenantHubModuleMutation,
  useEnableTenantHubModuleMutation,
  useGetTenantHubCatalogQuery,
  useGrantTenantHubModuleMutation,
  useReorderTenantHubModulesMutation,
  useSetTenantHubVisibilityMutation,
  type IHubCatalogItem,
} from '@/shared/api/endpoints/cloudAdminApi';
import { Button, Input, Select, Switch, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import cls from './TenantHubModulesEditor.module.scss';

function hubModuleErrorMessage(
  err: unknown,
  t: (key: string, fallback?: string) => string,
): string {
  const data = (err as { data?: { code?: string } })?.data
    ?? (err as { error?: { data?: { code?: string } } })?.error?.data;
  const code = data?.code;
  if (code === 'sku_not_found' || code === 'trial_days_invalid' || code === 'grant_invalid') {
    return t(`cloudAdmin.drawer.grantError.${code}`, code);
  }
  if (code === 'license_invalid' || code === 'license_expired'
    || code === 'not_entitled' || code === 'product_disabled'
    || code === 'entitlement_expired') {
    return t(`aiProducts.access.reasons.${code}`, code);
  }
  return t('common.error', 'Ошибка');
}

function DragHandle({
  label,
  attributes,
  listeners,
}: {
  label: string;
  attributes: DraggableAttributes;
  listeners?: DraggableSyntheticListeners;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cls.dragHandle}
      {...attributes}
      {...(listeners ?? {})}
      aria-label={label}
    >
      <GripVertical size={16} />
    </Button>
  );
}

function SortableTenantModule({
  mod,
  tenantName,
  trialDays,
  onTrialDays,
  onToggle,
  onGrant,
  onVisibility,
  granting,
  toggling,
}: {
  mod: IHubCatalogItem;
  tenantName: string;
  trialDays: string;
  onTrialDays: (value: string) => void;
  onToggle: (item: IHubCatalogItem, nextOn: boolean) => void;
  onGrant: (item: IHubCatalogItem, access: 'open' | 'trial') => void;
  onVisibility: (code: string, visible: boolean) => void;
  granting: boolean;
  toggling: boolean;
}) {
  const { t } = useTranslation();
  const sortable = useSortable({ id: mod.code });
  const visible = mod.tenantVisible !== false;
  const locked = mod.licenseStatus === 'locked';
  const active = mod.licenseStatus === 'active';
  const until = mod.accessUntil ? new Date(mod.accessUntil).toLocaleDateString('ru-RU') : null;

  return (
    <Flex
      ref={sortable.setNodeRef}
      align="center"
      gap="8"
      max
      wrap="wrap"
      className={[cls.row, !visible ? cls.rowHidden : '', sortable.isDragging ? cls.rowDragging : ''].filter(Boolean).join(' ')}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      data-testid={`platform-tenant-module-${mod.code}`}
    >
      <DragHandle
        label={`${t('platform.dragHandle')} ${mod.code}`}
        attributes={sortable.attributes}
        listeners={sortable.listeners}
      />
      <VStack gap="2" className={cls.nameBlock}>
        <Text variant="small" className={cls.name}>{mod.name}</Text>
        <Text variant="xs">
          {t(`cloudAdmin.drawer.licenseStatus.${mod.licenseStatus}`, mod.licenseStatus)}
          {until ? ` · ${t('cloudAdmin.drawer.accessUntil', 'до {{date}}', { date: until })}` : ''}
        </Text>
      </VStack>
      <Select
        className={cls.visibility}
        value={visible ? 'on' : 'off'}
        aria-label={`${t('cloudAdmin.drawer.visibility', 'Видимость')} ${mod.code}`}
        onChange={(event) => onVisibility(mod.code, event.target.value === 'on')}
      >
        <option value="on">{t('cloudAdmin.drawer.visibleOn', 'Включён')}</option>
        <option value="off">{t('cloudAdmin.drawer.visibleOff', 'Выключен')}</option>
      </Select>
      {visible && locked ? (
        <HStack gap="4" align="center">
          <Input
            className={cls.trialDays}
            type="number"
            min={1}
            max={365}
            aria-label={t('cloudAdmin.drawer.trialDays', 'Дней триала')}
            data-testid={`platform-tenant-trial-days-${mod.code}`}
            value={trialDays}
            onChange={(event) => onTrialDays(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid={`platform-tenant-trial-${mod.code}`}
            disabled={granting}
            onClick={() => onGrant(mod, 'trial')}
          >
            {t('cloudAdmin.drawer.trial', 'Триал')}
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid={`platform-tenant-grant-${mod.code}`}
            disabled={granting}
            onClick={() => onGrant(mod, 'open')}
          >
            {t('cloudAdmin.drawer.openAccess', 'Открыть')}
          </Button>
        </HStack>
      ) : null}
      {visible && !locked ? (
        <Switch
          checked={active}
          disabled={mod.kind === 'base' || toggling}
          onCheckedChange={(checked) => onToggle(mod, checked)}
          aria-label={`${mod.name} ${tenantName}`}
        />
      ) : null}
    </Flex>
  );
}

/**
 * Cabinet module order and visibility. Page membership stays on /platform/modules.
 */
export function TenantHubModulesEditor({
  tenantId,
  tenantName,
  enabled,
}: {
  tenantId: number;
  tenantName: string;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const { data: modules, isLoading } = useGetTenantHubCatalogQuery(tenantId, { skip: !enabled || tenantId <= 0 });
  const [enableHubModule, { isLoading: enablingHub }] = useEnableTenantHubModuleMutation();
  const [disableHubModule, { isLoading: disablingHub }] = useDisableTenantHubModuleMutation();
  const [grantHubModule, { isLoading: grantingHub }] = useGrantTenantHubModuleMutation();
  const [reorderModules] = useReorderTenantHubModulesMutation();
  const [setVisibility] = useSetTenantHubVisibilityMutation();
  const [trialDaysByCode, setTrialDaysByCode] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<string[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const serverSorted = useMemo(
    () => [...(modules ?? [])]
      .filter((mod) => mod.kind !== 'off')
      .sort((a, b) => a.sort_order - b.sort_order),
    [modules],
  );

  const sorted = useMemo(() => {
    if (!order) return serverSorted;
    const byCode = new Map(serverSorted.map((mod) => [mod.code, mod]));
    const next = order.map((code) => byCode.get(code)).filter((mod): mod is IHubCatalogItem => mod != null);
    for (const mod of serverSorted) {
      if (!order.includes(mod.code)) next.push(mod);
    }
    return next;
  }, [order, serverSorted]);

  useEffect(() => {
    setOrder(null);
  }, [modules]);

  const onDragEnd = async (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (overId == null || event.active.id === overId) return;
    const codes = sorted.map((mod) => mod.code);
    const from = codes.indexOf(String(event.active.id));
    const to = codes.indexOf(String(overId));
    if (from < 0 || to < 0) return;
    const next = arrayMove(codes, from, to);
    setOrder(next);
    try {
      await reorderModules({ tenantId, codes: next }).unwrap();
    } catch (error) {
      setOrder(null);
      toast.error(hubModuleErrorMessage(error, t));
    }
  };

  const onToggle = async (item: IHubCatalogItem, nextOn: boolean) => {
    if (item.kind === 'base') return;
    if (!nextOn) {
      const ok = window.confirm(
        t('cloudAdmin.drawer.disableConfirm', 'Disable this module for {{name}}?', { name: tenantName }),
      );
      if (!ok) return;
    }
    try {
      if (nextOn) await enableHubModule({ tenantId, code: item.code }).unwrap();
      else await disableHubModule({ tenantId, code: item.code }).unwrap();
    } catch (error) {
      toast.error(hubModuleErrorMessage(error, t));
    }
  };

  const onGrant = async (item: IHubCatalogItem, access: 'open' | 'trial') => {
    const rawDays = Number(trialDaysByCode[item.code] ?? '14');
    try {
      await grantHubModule({
        tenantId,
        code: item.code,
        access,
        trialDays: access === 'trial' ? rawDays : undefined,
      }).unwrap();
    } catch (error) {
      toast.error(hubModuleErrorMessage(error, t));
    }
  };

  const onVisibility = async (code: string, visible: boolean) => {
    try {
      await setVisibility({ tenantId, code, visible }).unwrap();
    } catch (error) {
      toast.error(hubModuleErrorMessage(error, t));
    }
  };

  if (isLoading) {
    return (
      <HStack justify="center" className={cls.loader}>
        <Loader2 className={cls.spinner} />
      </HStack>
    );
  }

  return (
    <VStack gap="12" max data-testid="tenant-hub-modules-editor">
      <Text variant="muted">
        {t(
          'cloudAdmin.drawer.modulesHint',
          'Порядок и видимость модулей этого кабинета. Состав страниц задаётся в каталоге платформы.',
        )}
      </Text>
      {sorted.length === 0 ? (
        <Text variant="muted">{t('common.noData', 'Нет данных')}</Text>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sorted.map((mod) => mod.code)} strategy={verticalListSortingStrategy}>
            <VStack gap="8" max>
              {sorted.map((mod) => (
                <SortableTenantModule
                  key={mod.code}
                  mod={mod}
                  tenantName={tenantName}
                  trialDays={trialDaysByCode[mod.code] ?? '14'}
                  onTrialDays={(value) => setTrialDaysByCode((prev) => ({ ...prev, [mod.code]: value }))}
                  onToggle={onToggle}
                  onGrant={onGrant}
                  onVisibility={onVisibility}
                  granting={grantingHub}
                  toggling={enablingHub || disablingHub}
                />
              ))}
            </VStack>
          </SortableContext>
        </DndContext>
      )}
    </VStack>
  );
}
