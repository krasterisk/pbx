import { ModalTabs } from '@/shared/ui';
import { ModalBody } from '@/shared/ui';
import { isRouteDialPattern, normalizeNotifyParams, directoryBindingsToSteps } from '@krasterisk/shared';
import { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  FormDialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Text,
} from '@/shared/ui';
import {
  useCreateRouteMutation,
  useUpdateRouteMutation,
  type IRouteOptions,
} from '@/shared/api/api';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { type IRouteAction } from '@krasterisk/shared';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { selectCurrentUser } from '@/entities/User';
import { ensureCdrVpbxUserUidInDialplan } from '@krasterisk/shared';
import { routesActions } from '../../model/slice/routesSlice';
import { resolveRouteRawDialplanPayload } from '../../model/lib/resolveRouteRawDialplanPayload';

import { isValueSourceComplete } from '@/features/dialplan-apps/ui/ValueSourceField/ValueSourceField';
import { useGetTenantSettingsQuery } from '@/entities/tenantSettings';
import { RouteGeneralTab, decodeRecordMode } from './RouteGeneralTab';
import { RouteWebhooksTab, WebhookItem } from './RouteWebhooksTab';
import { RouteActionsTab } from './RouteActionsTab';
import { ensureActionIds } from '@/features/dialplan-apps/model/actionIds';
import {
  mapStepErrors,
  localizeStepError,
  clientStepFieldErrors,
  resolveClientFieldError,
} from '@/features/dialplan-apps';
import type { MappedStepErrors } from '@/features/dialplan-apps/model/stepErrors';
import { RouteFlowchartTab } from './RouteFlowchartTab';
import styles from './RouteFormModal.module.scss';

function hasIncompleteQueueAction(list: IRouteAction[]): boolean {
  return list.some((a) => a.type === 'toqueue' && !isValueSourceComplete(a.params?.target as any));
}

const BASE_TABS = ['general', 'actions', 'webhooks'] as const;
type RouteTab = (typeof BASE_TABS)[number] | 'flowchart';
const TAB_FALLBACKS: Record<RouteTab, string> = {
  general: 'Основные',
  actions: 'Dialplan',
  webhooks: 'Вебхуки',
  flowchart: 'Схема',
};

export const RouteFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isModalOpen, selectedRoute, selectedContextUids, modalMode, editorMode } = useAppSelector(
    (s) => s.routes,
  );
  const currentUser = useAppSelector(selectCurrentUser);
  const vpbxUserUid = currentUser?.vpbx_user_uid ?? 0;
  const { data: tenantSettings, isLoading: tenantSettingsLoading } = useGetTenantSettingsQuery();
  const showRawDialplan = tenantSettings?.['routes.show_raw_dialplan'] ?? true;
  const showFlowchart =
    !tenantSettingsLoading && (tenantSettings?.['routes.show_flowchart'] ?? true);

  const isCreateMode = modalMode === 'create' || modalMode === 'copy';

  const [createRoute, { isLoading: isCreating }] = useCreateRouteMutation();
  const [updateRoute, { isLoading: isUpdating }] = useUpdateRouteMutation();

  const [activeTab, setActiveTab] = useState<RouteTab>('general');
  const tabs: RouteTab[] = [
    ...BASE_TABS,
    ...(showFlowchart ? (['flowchart'] as const) : []),
  ];
  const [contextUid, setContextUid] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [extensions, setExtensions] = useState<string[]>([]);
  const [hasRuleDraft, setHasRuleDraft] = useState(false);
  const [active, setActive] = useState(true);
  const [actions, setActions] = useState<IRouteAction[]>([]);
  const [stepErrors, setStepErrors] = useState<MappedStepErrors | undefined>();
  const [saveError, setSaveError] = useState('');
  const [routeFieldErrors, setRouteFieldErrors] = useState<Record<string, string>>({});
  const [rawDialplan, setRawDialplan] = useState('');

  const { data: contexts = [] } = useGetContextsQuery();

  useEffect(() => {
    if (!showRawDialplan && editorMode === 'raw') {
      dispatch(routesActions.setEditorMode('table'));
    }
  }, [showRawDialplan, editorMode, dispatch]);

  // Options
  const [record, setRecord] = useState(false);
  const [recordAll, setRecordAll] = useState(false);
  const [recordStereo, setRecordStereo] = useState(false);
  const [analyticsMode, setAnalyticsMode] = useState<'inherit' | 'off' | 'on'>('inherit');
  const [analyticsProjectId, setAnalyticsProjectId] = useState('');

  // Webhooks
  const [webhooksList, setWebhooksList] = useState<WebhookItem[]>([]);

  // Initialize form when editing/copying
  useEffect(() => {
    setStepErrors(undefined);
    setSaveError('');
    setRouteFieldErrors({});
    if (selectedRoute) {
      setName(modalMode === 'copy' ? '' : selectedRoute.name);
      setContextUid(selectedRoute.context_uid);
      setExtensions(selectedRoute.extensions || []);
      setActive(!!selectedRoute.active);
      setActions(
        ensureActionIds([...directoryBindingsToSteps(selectedRoute.bindings || [],selectedRoute.actions || []),...(selectedRoute.actions || [])]).map((a) =>
          a.type === 'notify' ? { ...a, params: normalizeNotifyParams(a.params ?? {}) } : a,
        ),
      );
      setRawDialplan(ensureCdrVpbxUserUidInDialplan(selectedRoute.raw_dialplan || '', vpbxUserUid));
      const opts = selectedRoute.options || {};
      const recMode = decodeRecordMode(opts);
      setRecord(recMode !== 'off');
      setRecordAll(recMode === 'all');
      setRecordStereo(!!opts.record_stereo);
      setAnalyticsMode(opts.analytics?.mode ?? 'inherit');
      setAnalyticsProjectId(opts.analytics?.projectId ?? '');
      const wh = selectedRoute.webhooks || {};
      const list: WebhookItem[] = [];
      const addToList = (evnt: string, value: any) => {
        if (Array.isArray(value)) {
          value.forEach((item: any) => {
            if (typeof item === 'string') {
              list.push({
                id: Math.random().toString(),
                event: evnt,
                url: item,
                authMode: 'none',
                token: '',
                customHeaders: [],
              });
            } else if (item && typeof item === 'object') {
              list.push({
                id: Math.random().toString(),
                event: evnt,
                url: item.url || '',
                authMode: item.authMode || 'none',
                token: item.token || '',
                customHeaders: item.customHeaders || [],
              });
            }
          });
        } else if (typeof value === 'string' && value) {
          list.push({
            id: Math.random().toString(),
            event: evnt,
            url: value,
            authMode: 'none',
            token: '',
            customHeaders: [],
          });
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          list.push({
            id: Math.random().toString(),
            event: evnt,
            url: value.url || '',
            authMode: value.authMode || 'none',
            token: value.token || '',
            customHeaders: value.customHeaders || [],
          });
        }
      };
      addToList('before_dial', wh.before_dial);
      addToList('on_answer', wh.on_answer);
      addToList('on_hangup', wh.on_hangup);
      addToList('custom', wh.custom);
      setWebhooksList(list);
    } else {
      resetForm();
    }
  }, [selectedRoute, modalMode, vpbxUserUid]);

  const resetForm = () => {
    setName('');
    setContextUid(selectedContextUids.length === 1 ? selectedContextUids[0] : null);
    setExtensions([]);
    setActive(true);
    setActions([]);
    setRawDialplan('');
    setRecord(false);
    setRecordAll(false);
    setRecordStereo(false);
    setAnalyticsMode('inherit');
    setAnalyticsProjectId('');
    setWebhooksList([]);
    setActiveTab('general');
    setStepErrors(undefined);
    setSaveError('');
    setRouteFieldErrors({});
  };

  const handleClose = useCallback(() => {
    dispatch(routesActions.closeModal());
    resetForm();
  }, [dispatch]);

  const handleSave = async () => {
    if (!contextUid || hasRuleDraft || !extensions.every(isRouteDialPattern)) return;
    const byStep = new Map<string, Record<string, string>>();
    for (const action of actions) {
      const fields = clientStepFieldErrors(action);
      if (Object.keys(fields).length)
        byStep.set(
          action.id,
          Object.fromEntries(
            Object.entries(fields).map(([field, code]) => [
              field,
              resolveClientFieldError(code, t),
            ]),
          ),
        );
    }
    if (byStep.size) {
      setStepErrors({ byStep, orphans: [] });
      setSaveError(t('routes.chain.saveErrors'));
      setActiveTab('actions');
      return;
    }
    setSaveError('');
    setRouteFieldErrors({});

    if (hasIncompleteQueueAction(actions)) {
      const ok = window.confirm(
        t('routes.chain.confirmSaveWithoutQueue', 'Точно сохранить без выбора очереди?'),
      );
      if (!ok) return;
    }

    const options: IRouteOptions = {
      record: record || undefined,
      // Only persist record_all when recording is actually enabled - prevents record_all:true/record:false ghost state
      record_all: record && recordAll ? true : undefined,
      record_stereo: record && recordStereo ? true : undefined,
      analytics: analyticsProjectId ? { projectId: analyticsProjectId } : undefined,
      pre_command: selectedRoute?.options?.pre_command || undefined,
      dialplan_source: showRawDialplan && editorMode === 'raw' ? 'raw' : 'actions',
    };

    const webhooksPayload: any = {};
    webhooksList.forEach((w) => {
      const u = w.url.trim();
      if (u) {
        if (!webhooksPayload[w.event]) webhooksPayload[w.event] = [];
        if (w.authMode === 'none') {
          webhooksPayload[w.event].push(u);
        } else {
          webhooksPayload[w.event].push({
            url: u,
            authMode: w.authMode,
            token: w.authMode === 'bearer' ? w.token : undefined,
            customHeaders:
              w.authMode === 'custom' && w.customHeaders.length > 0
                ? w.customHeaders.filter((h) => h.key.trim())
                : undefined,
          });
        }
      }
    });

    const sanitizeActions = (list: IRouteAction[] | undefined) =>
      (list ?? []).map((a) => ({
        id: a.id,
        type: a.type,
        enabled: a.enabled === false ? false : undefined,
        params: a.type === 'notify' ? normalizeNotifyParams(a.params ?? {}) : a.params,
        condition:
          a.condition && typeof a.condition === 'object' && !Array.isArray(a.condition)
            ? a.condition
            : {},
      }));

    const nextActions = sanitizeActions(actions);
    // IDs identify editor rows; adding one to a legacy action does not change the dialplan.
    const dialplanActions = (list: IRouteAction[] | undefined) =>
      sanitizeActions(list).map(({ type, params, condition, enabled }) => ({
        enabled,
        type,
        params,
        condition,
      }));
    const actionsChanged =
      JSON.stringify(dialplanActions(actions)) !==
      JSON.stringify(dialplanActions([...directoryBindingsToSteps(selectedRoute?.bindings || [],selectedRoute?.actions || []),...(selectedRoute?.actions || [])]));

    const loadedRawSource = !!selectedRoute?.raw_dialplan && (selectedRoute.options?.dialplan_source === 'raw' || (selectedRoute.options?.dialplan_source !== 'actions' && !selectedRoute.actions?.length));
    const preserveHiddenRaw = !showRawDialplan && loadedRawSource && !actionsChanged;
    const preserveLegacyBindings = preserveHiddenRaw || (showRawDialplan && editorMode === 'raw' && !!rawDialplan.trim());
    if (preserveHiddenRaw) options.dialplan_source = 'raw';
    const data = {
      name,
      extensions,
      active: active ? 1 : 0,
      options,
      webhooks: webhooksPayload,
      actions: nextActions,
      bindings: preserveLegacyBindings ? undefined : [],
      raw_dialplan: resolveRouteRawDialplanPayload({
        showRawDialplan,
        editorMode,
        rawDialplan,
        loadedRawDialplan: selectedRoute?.raw_dialplan || '',
        vpbxUserUid,
        actionsChanged,
      }),
      context_uid: contextUid,
    };

    try {
      if (isCreateMode) {
        await createRoute(data as any).unwrap();
      } else if (selectedRoute) {
        await updateRoute({ uid: selectedRoute.uid, data }).unwrap();
      }
      setStepErrors(undefined);
      handleClose();
    } catch (err) {
      const body = (
        err as {
          data?: {
            errors?: Array<{
              actionId?: string;
              path: string;
              message: string;
            }>;
            message?: string | string[];
          };
        }
      )?.data;
      const mapped = mapStepErrors(body, actions);
      setStepErrors(mapped);
      if (mapped.byStep.size) {
        setSaveError(t('routes.chain.saveErrors'));
        setActiveTab('actions');
      } else {
        const fieldLabels: Record<string, string> = {
          name: t('routes.name', 'Наименование маршрута'),
          context_uid: t('routes.context', 'Контекст'),
          extensions: t('routes.extensions', 'Номера назначения'),
        };
        const known = mapped.orphans.filter((error) => fieldLabels[error.path.split('.')[0]]);
        setSaveError(
          known.length
            ? [
                ...new Set(
                  known.map(
                    (error) =>
                      fieldLabels[error.path.split('.')[0]] +
                      ': ' +
                      localizeStepError('', error.path, error.message, t),
                  ),
                ),
              ].join('; ')
            : t('routes.saveFailed'),
        );
        if (known.length) {
          setRouteFieldErrors(
            Object.fromEntries(
              known.map((error) => [
                error.path.split('.')[0],
                localizeStepError('', error.path, error.message, t),
              ]),
            ),
          );
          setActiveTab('general');
        }
      }
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <FormDialogContent size="large" className={styles.modal} aria-describedby={undefined}>
        <DialogHeader className={styles.modalHeader}>
          <DialogTitle className={styles.modalTitle}>
            {modalMode === 'edit'
              ? t('routes.editRoute', 'Редактировать маршрут')
              : modalMode === 'copy'
                ? t('routes.copyRoute', 'Копировать маршрут')
                : t('routes.addRoute', 'Новый маршрут')}
          </DialogTitle>
        </DialogHeader>

        {saveError && (
          <Text variant="error" role="alert" className={styles.saveError}>
            {saveError}
          </Text>
        )}
        {/* Tabs */}
        <ModalTabs items={tabs.map(tab=>({id:tab,label:t(`routes.tab.${tab}`, TAB_FALLBACKS[tab])}))} value={activeTab} onChange={(value)=>setActiveTab(value as RouteTab)} label={t("common.settings")} />

        <ModalBody className={styles.body}  >

          {activeTab === 'general' && (
            <RouteGeneralTab
              fieldErrors={routeFieldErrors}
              name={name}
              setName={(value) => {
                setName(value);
                setRouteFieldErrors({});
                setSaveError('');
              }}
              extensions={extensions}
              setExtensions={(value) => {
                setExtensions(value);
                setRouteFieldErrors({});
                setSaveError('');
              }}
              onRuleDraftChange={setHasRuleDraft}
              active={active}
              setActive={setActive}
              record={record}
              setRecord={setRecord}
              recordAll={recordAll}
              setRecordAll={setRecordAll}
              recordStereo={recordStereo}
              setRecordStereo={setRecordStereo}
              analyticsMode={analyticsMode}
              setAnalyticsMode={setAnalyticsMode}
              analyticsProjectId={analyticsProjectId}
              setAnalyticsProjectId={setAnalyticsProjectId}
              contextUid={contextUid}
              setContextUid={(value) => {
                setContextUid(value);
                setRouteFieldErrors({});
                setSaveError('');
              }}
              isCreateMode={isCreateMode}
              contexts={contexts}
            />
          )}

          {activeTab === 'actions' && (
            <RouteActionsTab
              actions={actions}
              setActions={(next) => {
                setActions(next);
                setStepErrors(undefined);
                setSaveError('');
                setRouteFieldErrors({});
              }}
              rawDialplan={rawDialplan}
              setRawDialplan={setRawDialplan}
              vpbxUserUid={vpbxUserUid}
              stepErrors={stepErrors}
              previewPatterns={extensions}
            />
          )}

          {activeTab === 'webhooks' && (
            <RouteWebhooksTab webhooksList={webhooksList} setWebhooksList={setWebhooksList} />
          )}

          {activeTab === 'flowchart' && showFlowchart && (
            <RouteFlowchartTab actions={actions} routeName={name} extensions={extensions} />
          )}

</ModalBody>

        <DialogFooter className={styles.modalFooter}>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isCreating ||
              isUpdating ||
              !name ||
              extensions.length === 0 ||
              !extensions.every(isRouteDialPattern) ||
              hasRuleDraft ||
              !contextUid
            }
          >
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </Dialog>
  );
});

RouteFormModal.displayName = 'RouteFormModal';
