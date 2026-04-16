import { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useCreateRouteMutation,
  useUpdateRouteMutation,
  type IRouteOptions,
} from '@/shared/api/api';
import { type IRouteAction } from '@krasterisk/shared';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '../../model/slice/routesSlice';

import { RouteGeneralTab } from './RouteGeneralTab';
import { RouteWebhooksTab, WebhookItem } from './RouteWebhooksTab';
import { RouteActionsTab } from './RouteActionsTab';

const TABS = ['general', 'actions', 'webhooks'] as const;

export const RouteFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isModalOpen, selectedRoute, selectedContextUid } = useAppSelector((s) => s.routes);

  const [createRoute, { isLoading: isCreating }] = useCreateRouteMutation();
  const [updateRoute, { isLoading: isUpdating }] = useUpdateRouteMutation();

  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('general');
  const [name, setName] = useState('');
  const [extensions, setExtensions] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [actions, setActions] = useState<IRouteAction[]>([]);
  const [rawDialplan, setRawDialplan] = useState('');

  // Options
  const [record, setRecord] = useState(false);
  const [recordAll, setRecordAll] = useState(false);
  const [checkBlacklist, setCheckBlacklist] = useState(false);
  const [checkListbook, setCheckListbook] = useState(false);
  const [preCommand, setPreCommand] = useState('');
  const [routeType, setRouteType] = useState(0);

  // Webhooks
  const [webhooksList, setWebhooksList] = useState<WebhookItem[]>([]);

  // Initialize form when editing
  useEffect(() => {
    if (selectedRoute) {
      setName(selectedRoute.name);
      setExtensions(selectedRoute.extensions || []);
      setActive(!!selectedRoute.active);
      setActions(selectedRoute.actions || []);
      setRawDialplan(selectedRoute.raw_dialplan || '');
      const opts = selectedRoute.options || {};
      setRecord(!!opts.record);
      setRecordAll(!!opts.record_all);
      setCheckBlacklist(!!opts.check_blacklist);
      setCheckListbook(!!opts.check_listbook);
      setPreCommand(opts.pre_command || '');
      setRouteType(opts.route_type || 0);
      const wh = selectedRoute.webhooks || {};
      const list: WebhookItem[] = [];
      const addToList = (evnt: string, value: any) => {
        if (Array.isArray(value)) {
          value.forEach((url: string) => list.push({ id: Math.random().toString(), event: evnt, url }));
        } else if (typeof value === 'string' && value) {
          list.push({ id: Math.random().toString(), event: evnt, url: value });
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
  }, [selectedRoute]);

  const resetForm = () => {
    setName('');
    setExtensions([]);
    setActive(true);
    setActions([]);
    setRawDialplan('');
    setRecord(false);
    setRecordAll(false);
    setCheckBlacklist(false);
    setCheckListbook(false);
    setPreCommand('');
    setRouteType(0);
    setWebhooksList([]);
    setActiveTab('general');
  };

  const handleClose = useCallback(() => {
    dispatch(routesActions.closeModal());
    resetForm();
  }, [dispatch]);

  const handleSave = async () => {
    if (!selectedContextUid) return;

    const options: IRouteOptions = {
      record, record_all: recordAll, check_blacklist: checkBlacklist,
      check_listbook: checkListbook, pre_command: preCommand || undefined,
      route_type: routeType || undefined,
    };

    const webhooksPayload: any = {};
    webhooksList.forEach(w => {
      const u = w.url.trim();
      if (u) {
        if (!webhooksPayload[w.event]) webhooksPayload[w.event] = [];
        webhooksPayload[w.event].push(u);
      }
    });

    const data = {
      name, extensions, active: active ? 1 : 0,
      options, webhooks: webhooksPayload, actions,
      raw_dialplan: rawDialplan || undefined,
      context_uid: selectedContextUid,
    };

    try {
      if (selectedRoute) {
        await updateRoute({ uid: selectedRoute.uid, data }).unwrap();
      } else {
        await createRoute(data as any).unwrap();
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save route:', err);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="large">
        <DialogHeader className="mb-4 shrink-0">
          <DialogTitle className="text-xl font-bold">
            {selectedRoute ? t('routes.editRoute', 'Редактировать маршрут') : t('routes.addRoute', 'Новый маршрут')}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <VStack className="border-b border-border/50 mb-6 shrink-0" max>
          <HStack gap="8" className="-mb-[1px] flex overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {TABS.map((tab) => (
              <Button
                key={tab}
                variant="ghost"
                onClick={() => setActiveTab(tab)}
                className={`relative py-3 px-1 rounded-none text-sm font-medium transition-colors whitespace-nowrap shrink-0 outline-none ${
                    activeTab === tab ? 'text-primary bg-transparent hover:bg-transparent hover:text-primary' : 'text-muted-foreground bg-transparent hover:text-foreground hover:bg-transparent'
                }`}
              >
                {t(`routes.tab.${tab}`, tab)}
                {activeTab === tab && (
                  <VStack className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary rounded-t-[1px]">{''}</VStack>
                )}
              </Button>
            ))}
          </HStack>
        </VStack>

        <VStack className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'general' && (
            <RouteGeneralTab
              name={name} setName={setName}
              extensions={extensions} setExtensions={setExtensions}
              active={active} setActive={setActive}
              routeType={routeType} setRouteType={setRouteType}
              record={record} setRecord={setRecord}
              recordAll={recordAll} setRecordAll={setRecordAll}
              checkBlacklist={checkBlacklist} setCheckBlacklist={setCheckBlacklist}
              checkListbook={checkListbook} setCheckListbook={setCheckListbook}
              preCommand={preCommand} setPreCommand={setPreCommand}
            />
          )}

          {activeTab === 'actions' && (
            <RouteActionsTab
              actions={actions} setActions={setActions}
              rawDialplan={rawDialplan} setRawDialplan={setRawDialplan}
            />
          )}

          {activeTab === 'webhooks' && (
            <RouteWebhooksTab
              webhooksList={webhooksList}
              setWebhooksList={setWebhooksList}
            />
          )}
        </VStack>

        <DialogFooter className="mt-6 pt-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button onClick={handleSave} disabled={isCreating || isUpdating || !name || extensions.length === 0}>
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

RouteFormModal.displayName = 'RouteFormModal';
