import { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Table2, Code2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useCreateRouteMutation,
  useUpdateRouteMutation,
  useLazyPreviewDialplanQuery,
  type IRoute,
  type IRouteAction,
  type IRouteOptions,
  type IRouteWebhooks,
} from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '../../model/slice/routesSlice';
import { ExtensionChips } from '../ExtensionChips/ExtensionChips';
import { ActionsTableEditor } from '../ActionsTableEditor/ActionsTableEditor';
import { RawDialplanEditor } from '../RawDialplanEditor/RawDialplanEditor';
import styles from './RouteFormModal.module.scss';

const TABS = ['general', 'webhooks', 'actions'] as const;

export const RouteFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isModalOpen, selectedRoute, selectedContextUid, editorMode } = useAppSelector((s) => s.routes);

  const [createRoute, { isLoading: isCreating }] = useCreateRouteMutation();
  const [updateRoute, { isLoading: isUpdating }] = useUpdateRouteMutation();
  const [triggerPreview] = useLazyPreviewDialplanQuery();

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
  const [whBefore, setWhBefore] = useState('');
  const [whAnswer, setWhAnswer] = useState('');
  const [whHangup, setWhHangup] = useState('');
  const [whCustom, setWhCustom] = useState('');

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
      setWhBefore(wh.before_dial || '');
      setWhAnswer(wh.on_answer || '');
      setWhHangup(wh.on_hangup || '');
      setWhCustom(wh.custom || '');
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
    setWhBefore('');
    setWhAnswer('');
    setWhHangup('');
    setWhCustom('');
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

    const webhooks: IRouteWebhooks = {
      before_dial: whBefore || undefined, on_answer: whAnswer || undefined,
      on_hangup: whHangup || undefined, custom: whCustom || undefined,
    };

    const data = {
      name, extensions, active: active ? 1 : 0,
      options, webhooks, actions,
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
      <DialogContent className={styles.modal}>
        <DialogHeader>
          <DialogTitle>
            {selectedRoute ? t('routes.editRoute', 'Редактировать маршрут') : t('routes.addRoute', 'Новый маршрут')}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {t(`routes.tab.${tab}`, tab)}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {/* General Tab */}
          {activeTab === 'general' && (
            <VStack gap="16">
              <HStack gap="12" align="center">
                <label className={styles.check}>
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  {t('common.active', 'Активен')}
                </label>
              </HStack>

              <VStack gap="4">
                <label className={styles.label}>{t('routes.name', 'Наименование маршрута')}</label>
                <Input id="route-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('routes.namePlaceholder', 'Входящий городской')} />
              </VStack>

              <ExtensionChips value={extensions} onChange={setExtensions} />

              <VStack gap="4">
                <label className={styles.label}>{t('routes.routeType', 'Тип маршрута (права доступа)')}</label>
                <select className={styles.selectFull} value={routeType} onChange={(e) => setRouteType(Number(e.target.value))}>
                  <option value={0}>Не использовать</option>
                  <option value={1}>Локальные вызовы</option>
                  <option value={2}>Местные вызовы</option>
                  <option value={3}>Мобильные вызовы</option>
                  <option value={4}>Междугородние вызовы</option>
                  <option value={5}>Международные вызовы</option>
                </select>
              </VStack>

              <div className={styles.optionsGrid}>
                <label className={styles.check}>
                  <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} />
                  {t('routes.record', 'Записывать разговоры')}
                </label>
                <label className={styles.check}>
                  <input type="checkbox" checked={recordAll} onChange={(e) => setRecordAll(e.target.checked)} />
                  {t('routes.recordAll', 'Запись без соединения')}
                </label>
                <label className={styles.check}>
                  <input type="checkbox" checked={checkBlacklist} onChange={(e) => setCheckBlacklist(e.target.checked)} />
                  {t('routes.checkBlacklist', 'Проверять Blacklist')}
                </label>
                <label className={styles.check}>
                  <input type="checkbox" checked={checkListbook} onChange={(e) => setCheckListbook(e.target.checked)} />
                  {t('routes.checkListbook', 'Имя из справочника')}
                </label>
              </div>

              <VStack gap="4">
                <label className={styles.label}>{t('routes.preCommand', 'Предварительная команда')}</label>
                <Input id="route-precmd" value={preCommand} onChange={(e) => setPreCommand(e.target.value)} 
                  placeholder="Set(CALLERID(num)=8${CALLERID(num)})" className={styles.mono} />
              </VStack>
            </VStack>
          )}

          {/* Webhooks Tab */}
          {activeTab === 'webhooks' && (
            <VStack gap="12">
              <VStack gap="4">
                <label className={styles.label}>{t('routes.whBefore', 'Перед вызовом')}</label>
                <Input id="wh-before" value={whBefore} onChange={(e) => setWhBefore(e.target.value)} placeholder="https://..." />
              </VStack>
              <VStack gap="4">
                <label className={styles.label}>{t('routes.whAnswer', 'При ответе')}</label>
                <Input id="wh-answer" value={whAnswer} onChange={(e) => setWhAnswer(e.target.value)} placeholder="https://..." />
              </VStack>
              <VStack gap="4">
                <label className={styles.label}>{t('routes.whHangup', 'При завершении')}</label>
                <Input id="wh-hangup" value={whHangup} onChange={(e) => setWhHangup(e.target.value)} placeholder="https://..." />
              </VStack>
              <VStack gap="4">
                <label className={styles.label}>{t('routes.whCustom', 'Запрос номера ответственного')}</label>
                <Input id="wh-custom" value={whCustom} onChange={(e) => setWhCustom(e.target.value)} placeholder="https://..." />
              </VStack>
            </VStack>
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <VStack gap="12">
              {/* Editor mode switcher */}
              <HStack gap="8">
                <button
                  type="button"
                  className={`${styles.modeBtn} ${editorMode === 'table' ? styles.modeBtnActive : ''}`}
                  onClick={() => dispatch(routesActions.setEditorMode('table'))}
                >
                  <Table2 className="w-4 h-4" />
                  {t('routes.modeTable', 'Таблица')}
                </button>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${editorMode === 'raw' ? styles.modeBtnActive : ''}`}
                  onClick={() => dispatch(routesActions.setEditorMode('raw'))}
                >
                  <Code2 className="w-4 h-4" />
                  {t('routes.modeRaw', 'Dialplan')}
                </button>
              </HStack>

              {editorMode === 'table' && (
                <ActionsTableEditor actions={actions} onChange={setActions} />
              )}
              {editorMode === 'raw' && (
                <RawDialplanEditor value={rawDialplan} onChange={setRawDialplan} />
              )}
            </VStack>
          )}
        </div>

        <DialogFooter>
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
