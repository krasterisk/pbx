import { memo, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell, ChevronDown, ChevronUp, MessageSquareText, Save, SlidersHorizontal, Tags, Webhook,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  SA_WEBHOOK_EVENTS,
  defaultSaProjectConfig,
  type SaAlertConfig,
  type SaCallTagDef,
  type SaDigestConfig,
  type SaProjectConfigV1,
  type SaProjectMetric,
  type SaWebhookEvent,
} from '@krasterisk/shared';
import {
  Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, Input, Label, Select, Text, Textarea,
  WebhookAuthConfig, type AuthMode, type WebhookHeader,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetNotificationsQuery } from '@/shared/api/endpoints/notificationApi';
import {
  useGetSaProjectsQuery,
  usePublishSaProjectMutation,
  useSendSaProjectDigestMutation,
  useTestSaProjectAlertMutation,
  useTestSaProjectWebhookMutation,
  useUpdateSaProjectDraftMutation,
} from '../../api/speechAnalyticsApi';
import cls from './ProjectSettingsForm.module.scss';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function notifyErrorCode(error: unknown): string | null {
  const code = (error as { data?: { code?: string } })?.data?.code;
  if (
    code === 'digest_recipient_required'
    || code === 'missing_credentials'
    || code === 'invalid_bot_token'
    || code === 'chat_not_found'
    || code === 'bot_blocked'
  ) return code;
  return null;
}

function authFromHeaders(headers: Record<string, string> | undefined): {
  mode: AuthMode;
  token: string;
  custom: WebhookHeader[];
} {
  const entries = Object.entries(headers ?? {});
  const authorization = entries.find(([key]) => key.toLowerCase() === 'authorization');
  const bearer = authorization?.[1].match(/^Bearer\s+(.+)$/i);
  if (bearer && entries.length === 1) {
    return { mode: 'bearer', token: bearer[1], custom: [] };
  }
  if (entries.length > 0) {
    return { mode: 'custom', token: '', custom: entries.map(([key, value]) => ({ key, value })) };
  }
  return { mode: 'none', token: '', custom: [] };
}

function headersFromAuth(mode: AuthMode, token: string, custom: WebhookHeader[]): Record<string, string> {
  if (mode === 'bearer' && token.trim()) return { Authorization: `Bearer ${token.trim()}` };
  if (mode === 'custom') {
    const out: Record<string, string> = {};
    custom.forEach((row) => {
      if (row.key.trim()) out[row.key.trim()] = row.value;
    });
    return out;
  }
  return {};
}
const EVENT_LABELS: Record<SaWebhookEvent, string> = {
  'analysis.completed': 'Событие: анализ завершён',
  'analysis.error': 'Событие: ошибка анализа',
  'budget.exceeded': 'Событие: превышен бюджет',
  'anomaly.detected': 'Событие: аномалия метрик',
};

type SectionProps = {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function Section({ title, icon, open, onToggle, children }: SectionProps) {
  return (
    <Card className={`${cls.section} ${open ? cls.sectionOpen : ''}`}>
      <button type="button" className={cls.sectionHead} onClick={onToggle} aria-expanded={open}>
        <span className={cls.sectionTitle}>
          <span className={cls.sectionIcon}>{icon}</span>
          <Text>{title}</Text>
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open ? <div className={cls.sectionBody}>{children}</div> : null}
    </Card>
  );
}

export type ProjectSettingsFormProps = {
  projectId: string;
  onSaved?: () => void;
};

export const ProjectSettingsForm = memo(({ projectId, onSaved }: ProjectSettingsFormProps) => {
  const { t } = useTranslation();
  const projectsQuery = useGetSaProjectsQuery();
  const project = (projectsQuery.data ?? []).find((row) => row.id === projectId);
  const [saveDraft, saveState] = useUpdateSaProjectDraftMutation();
  const [publishProject, publishState] = usePublishSaProjectMutation();
  const [testWebhook] = useTestSaProjectWebhookMutation();
  const [sendDigest] = useSendSaProjectDigestMutation();
  const [testAlert] = useTestSaProjectAlertMutation();
  const { data: integrations = [] } = useGetNotificationsQuery();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [metrics, setMetrics] = useState<SaProjectMetric[]>([]);
  const [topics, setTopics] = useState<SaCallTagDef[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [authToken, setAuthToken] = useState('');
  const [customHeaders, setCustomHeaders] = useState<WebhookHeader[]>([]);
  const [events, setEvents] = useState<SaWebhookEvent[]>([]);
  const [digest, setDigest] = useState<SaDigestConfig>(defaultSaProjectConfig().digest);
  const [alerts, setAlerts] = useState<SaAlertConfig>(defaultSaProjectConfig().alerts);
  const [budget, setBudget] = useState('');
  const [revision, setRevision] = useState(1);
  const [hydrated, setHydrated] = useState<string | null>(null);
  const [open, setOpen] = useState({ prompt: false, topics: false, metrics: false, webhook: false, notes: false });
  const [pendingTopic, setPendingTopic] = useState<number | null>(null);
  const [pendingMetric, setPendingMetric] = useState<number | null>(null);

  useEffect(() => {
    if (!project || hydrated === `${project.id}:${project.draft_revision}`) return;
    const cfg = project.draft_config ?? defaultSaProjectConfig();
    setName(project.name);
    setDescription(cfg.description ?? '');
    setSystemPrompt(cfg.systemPrompt ?? '');
    setMetrics((cfg.metrics ?? []).map((metric) => ({ ...metric, sourceScaleId: null })));
    setTopics(cfg.callTaxonomy ?? []);
    setWebhookUrl(cfg.eventWebhook?.url ?? '');
    const auth = authFromHeaders(cfg.eventWebhook?.headers);
    setAuthMode(auth.mode);
    setAuthToken(auth.token);
    setCustomHeaders(auth.custom);
    setEvents(cfg.eventWebhook?.events ?? []);
    setDigest({ ...defaultSaProjectConfig().digest, ...cfg.digest });
    setAlerts({ ...defaultSaProjectConfig().alerts, ...cfg.alerts });
    setBudget(cfg.budget?.softLimit ? String(cfg.budget.softLimit) : '');
    setRevision(project.draft_revision);
    setHydrated(`${project.id}:${project.draft_revision}`);
  }, [hydrated, project]);

  const buildConfig = (): SaProjectConfigV1 => {
    const headerMap = headersFromAuth(authMode, authToken, customHeaders);
    const parsedBudget = budget.trim() === '' ? 0 : Number(budget.replace(',', '.'));
    return {
      ...defaultSaProjectConfig(),
      ...(project?.draft_config ?? {}),
      description,
      systemPrompt,
      metrics: metrics.map((metric) => ({ ...metric, sourceScaleId: null })),
      callTaxonomy: topics,
      customMetrics: [],
      hiddenDefaultScales: [],
      eventWebhook: { url: webhookUrl.trim() || null, headers: headerMap, events },
      digest,
      alerts,
      budget: { softLimit: Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : 0 },
    };
  };

  const notifyToast = (error: unknown, fallback: string) => {
    const code = notifyErrorCode(error);
    if (code === 'digest_recipient_required') {
      toast.error(t('speechAnalytics.settingsIntegrationRequired', 'Выберите интеграцию'));
      return;
    }
    if (code === 'missing_credentials') {
      toast.error(t('speechAnalytics.notifyMissingCredentials', 'В интеграции не указан токен бота или chat id'));
      return;
    }
    if (code === 'invalid_bot_token') {
      toast.error(t('speechAnalytics.notifyInvalidToken', 'Токен бота неверный. Вставьте полный токен из BotFather'));
      return;
    }
    if (code === 'chat_not_found') {
      toast.error(t('speechAnalytics.notifyChatNotFound', 'Chat id не найден. Напишите боту в Telegram и укажите id этого чата'));
      return;
    }
    if (code === 'bot_blocked') {
      toast.error(t('speechAnalytics.notifyBotBlocked', 'Бот заблокирован в этом чате'));
      return;
    }
    toast.error(fallback);
  };

  const onSendDigest = async () => {
    if (!digest.integrationUids.length) {
      toast.error(t('speechAnalytics.settingsIntegrationRequired', 'Выберите интеграцию'));
      return;
    }
    try {
      const saved = await saveDraft({
        id: projectId,
        expectedRevision: revision,
        config: buildConfig(),
      }).unwrap();
      setRevision(saved.draft_revision);
      setHydrated(`${projectId}:${saved.draft_revision}`);
      await sendDigest({ id: projectId }).unwrap().then((sent) => {
        setRevision(sent.draftRevision);
        setHydrated(`${projectId}:${sent.draftRevision}`);
      });
      toast.success(t('speechAnalytics.settingsDigestSent', 'Тестовая сводка отправлена'));
    } catch (error) {
      notifyToast(error, t('speechAnalytics.settingsDigestFailed', 'Не удалось отправить сводку'));
    }
  };

  const onTestAlert = async () => {
    if (!digest.integrationUids.length) {
      toast.error(t('speechAnalytics.settingsIntegrationRequired', 'Выберите интеграцию'));
      return;
    }
    try {
      const saved = await saveDraft({
        id: projectId,
        expectedRevision: revision,
        config: buildConfig(),
      }).unwrap();
      setRevision(saved.draft_revision);
      setHydrated(`${projectId}:${saved.draft_revision}`);
      const sent = await testAlert({ id: projectId }).unwrap();
      setRevision(sent.draftRevision);
      setHydrated(`${projectId}:${sent.draftRevision}`);
      toast.success(t('speechAnalytics.settingsAlertSent', 'Тестовое уведомление отправлено'));
    } catch (error) {
      notifyToast(error, t('speechAnalytics.settingsAlertFailed', 'Не удалось отправить уведомление'));
    }
  };

  const onSave = async () => {
    try {
      const saved = await saveDraft({ id: projectId, expectedRevision: revision, config: buildConfig() }).unwrap();
      await publishProject({ id: projectId, operationKey: `settings-${saved.draft_revision}` }).unwrap();
      setRevision(saved.draft_revision);
      toast.success(t('speechAnalytics.draftSaved', 'Черновик сохранён'));
      onSaved?.();
    } catch {
      toast.error(t('speechAnalytics.saveFailed', 'Не удалось сохранить'));
    }
  };

  if (projectsQuery.isLoading && !project) return <Text>{t('common.loading', 'Загрузка')}</Text>;
  if (!project) return <Text>{t('speechAnalytics.projectNotFound', 'Проект не найден')}</Text>;

  const busy = saveState.isLoading || publishState.isLoading;

  return (
    <div className={cls.shell} data-testid="sa-project-settings">
      <DialogHeader className={cls.header}>
        <DialogTitle>{name.trim() || t('speechAnalytics.settingsTitle', 'Настройки проекта')}</DialogTitle>
        <Text variant="muted">{t('speechAnalytics.settingsSubtitle', 'Промпт, метрики, темы и уведомления этого проекта')}</Text>
      </DialogHeader>
      <div className={cls.scroll}>
        <div className={cls.identity}>
        <VStack gap="12" max>
          <VStack gap="4" max>
            <Label htmlFor="sa-settings-name">{t('speechAnalytics.projectName', 'Название проекта')}</Label>
            <Input id="sa-settings-name" value={name} onChange={(e) => setName(e.target.value)} />
          </VStack>
          <VStack gap="4" max>
            <Label htmlFor="sa-settings-description">{t('speechAnalytics.wizardProjectDescription', 'Описание проекта')}</Label>
            <Input id="sa-settings-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </VStack>
        </VStack>
        </div>

        <Section icon={<MessageSquareText size={18} />} title={t('speechAnalytics.settingsSystemPrompt', 'Системный промпт')} open={open.prompt} onToggle={() => setOpen((s) => ({ ...s, prompt: !s.prompt }))}>
          <Textarea rows={4} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
        </Section>

        <Section icon={<Tags size={18} />} title={t('speechAnalytics.settingsCallTopics', 'Темы звонков')} open={open.topics} onToggle={() => setOpen((s) => ({ ...s, topics: !s.topics }))}>
          <Text variant="muted">{t('speechAnalytics.wizardTopicsHint', 'Темы - метки для звонков. При анализе ИИ выбирает подходящие темы из справочника по смыслу разговора.')}</Text>
          {topics.map((tag, index) => (
            <Card key={tag.id} className={cls.nested}>
              <VStack gap="8" max>
                <HStack justify="between" max>
                  <Text>{tag.name || t('speechAnalytics.wizardNewTopic', 'Новая тема')}</Text>
                  <Button type="button" variant="outline" onClick={() => setPendingTopic(index)}>{t('common.delete', 'Удалить')}</Button>
                </HStack>
                <Label>{t('speechAnalytics.wizardTopicName', 'Название темы')}</Label>
                <Input value={tag.name} onChange={(e) => setTopics((prev) => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} />
                <Label>{t('speechAnalytics.wizardTopicWhen', 'Описание (когда ставить тему)')}</Label>
                <Textarea rows={2} value={tag.description ?? ''} onChange={(e) => setTopics((prev) => prev.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)))} />
                <Label>{t('speechAnalytics.wizardTopicPhrases', 'Формулировки (необязательно)')}</Label>
                <Input value={tag.aliases.join(', ')} onChange={(e) => setTopics((prev) => prev.map((row, i) => (i === index ? { ...row, aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : row)))} />
              </VStack>
            </Card>
          ))}
          <Button type="button" variant="outline" onClick={() => setTopics((prev) => [...prev, { id: `tag_${Date.now()}`, name: '', aliases: [], description: '' }])}>
            {t('speechAnalytics.wizardAddTopic', 'Добавить тему')}
          </Button>
        </Section>

        <Section icon={<SlidersHorizontal size={18} />} title={t('speechAnalytics.settingsMetrics', 'Метрики')} open={open.metrics} onToggle={() => setOpen((s) => ({ ...s, metrics: !s.metrics }))}>
          <Text variant="muted">{t('speechAnalytics.settingsMetricsHint', 'Один набор метрик проекта. Разбор смотрит на название, тип ответа и описание, без деления на стандартные и свои.')}</Text>
          {metrics.map((metric, index) => (
            <Card key={`${metric.id}-${index}`} className={cls.nested}>
              <VStack gap="8" max>
                <HStack justify="between" max>
                  <Text>{metric.name || t('speechAnalytics.wizardNewMetric', 'Новая метрика')}</Text>
                  <Button type="button" variant="outline" onClick={() => setPendingMetric(index)}>{t('common.delete', 'Удалить')}</Button>
                </HStack>
                <Label>{t('speechAnalytics.wizardMetricName', 'Название метрики')}</Label>
                <Input value={metric.name} onChange={(e) => setMetrics((prev) => prev.map((row, i) => (i === index ? { ...row, name: e.target.value, sourceScaleId: null } : row)))} />
                <Label>{t('speechAnalytics.wizardMetricType', 'Тип метрики')}</Label>
                <Select
                  value={metric.type}
                  onChange={(e) => {
                    const type = e.target.value as SaProjectMetric['type'];
                    setMetrics((prev) => prev.map((row, i) => (
                      i === index
                        ? {
                          ...row,
                          type,
                          sourceScaleId: null,
                          min: type === 'scale' ? (row.min ?? 0) : row.min,
                          max: type === 'scale' ? (row.max ?? 100) : row.max,
                        }
                        : row
                    )));
                  }}
                >
                  <option value="scale">{t('speechAnalytics.settingsScale', 'Шкала')}</option>
                  <option value="boolean">Boolean (Да/Нет)</option>
                  <option value="number">Number (Число)</option>
                  <option value="enum">Enum (Список)</option>
                  <option value="string">String (Текст)</option>
                </Select>
                {metric.type === 'scale' ? (
                  <HStack gap="8">
                    <VStack gap="4" className={cls.row}>
                      <Label htmlFor={`sa-scale-from-${index}`}>{t('speechAnalytics.settingsScaleFrom', 'От')}</Label>
                      <Input
                        id={`sa-scale-from-${index}`}
                        type="number"
                        value={metric.min ?? 0}
                        onChange={(e) => setMetrics((prev) => prev.map((row, i) => (i === index ? { ...row, min: Number(e.target.value), sourceScaleId: null } : row)))}
                      />
                    </VStack>
                    <VStack gap="4" className={cls.row}>
                      <Label htmlFor={`sa-scale-to-${index}`}>{t('speechAnalytics.settingsScaleTo', 'До')}</Label>
                      <Input
                        id={`sa-scale-to-${index}`}
                        type="number"
                        value={metric.max ?? 100}
                        onChange={(e) => setMetrics((prev) => prev.map((row, i) => (i === index ? { ...row, max: Number(e.target.value), sourceScaleId: null } : row)))}
                      />
                    </VStack>
                  </HStack>
                ) : null}
                <Label>{t('speechAnalytics.wizardLlmDescription', 'Описание для LLM')}</Label>
                <Textarea rows={2} value={metric.description} onChange={(e) => setMetrics((prev) => prev.map((row, i) => (i === index ? { ...row, description: e.target.value, sourceScaleId: null } : row)))} />
              </VStack>
            </Card>
          ))}
          <Button type="button" variant="outline" onClick={() => setMetrics((prev) => [...prev, { id: `metric_${Date.now()}`, name: '', type: 'boolean', description: '', polarity: 'neutral', sourceScaleId: null }])}>
            {t('speechAnalytics.wizardAddMetric', 'Добавить метрику')}
          </Button>
        </Section>

        <Section icon={<Webhook size={18} />} title={t('speechAnalytics.settingsWebhooks', 'Webhooks (опционально)')} open={open.webhook} onToggle={() => setOpen((s) => ({ ...s, webhook: !s.webhook }))}>
          <Text variant="muted">{t('speechAnalytics.settingsWebhookHint', 'Настройте уведомления о событиях проекта')}</Text>
          <Label>{t('speechAnalytics.settingsWebhookUrl', 'URL вебхука')}</Label>
          <Input value={webhookUrl} placeholder="https://your-api.com/webhook" onChange={(e) => setWebhookUrl(e.target.value)} />
          <WebhookAuthConfig
            authMode={authMode}
            token={authToken}
            customHeaders={customHeaders}
            onAuthModeChange={setAuthMode}
            onTokenChange={setAuthToken}
            onHeadersChange={setCustomHeaders}
          />
          <Text>{t('speechAnalytics.settingsEvents', 'События')}</Text>
          {SA_WEBHOOK_EVENTS.map((event) => (
            <HStack key={event} gap="8">
              <Checkbox
                checked={events.includes(event)}
                aria-label={EVENT_LABELS[event]}
                onChange={() => setEvents((prev) => (prev.includes(event) ? prev.filter((item) => item !== event) : [...prev, event]))}
              />
              <Text>{t(`speechAnalytics.settingsEvent.${event}`, EVENT_LABELS[event])}</Text>
            </HStack>
          ))}
          {webhookUrl ? (
            <Button type="button" variant="outline" onClick={() => void testWebhook({ id: projectId })}>{t('speechAnalytics.settingsTestWebhook', 'Тест вебхука')}</Button>
          ) : null}
        </Section>

        <Section icon={<Bell size={18} />} title={t('speechAnalytics.settingsNotifications', 'Уведомления')} open={open.notes} onToggle={() => setOpen((s) => ({ ...s, notes: !s.notes }))}>
          <div className={cls.group}>
            <Text>{t('speechAnalytics.settingsWhere', 'Куда уведомлять')}</Text>
            <Link to="/integrations" target="_blank" rel="noopener noreferrer" className={cls.integrationsLink}>
              <Text variant="muted">{t('speechAnalytics.settingsWhereHint', 'Интеграция из раздела уведомлений.')}</Text>
            </Link>
            <Label htmlFor="sa-settings-integration">{t('speechAnalytics.settingsIntegration', 'Интеграция')}</Label>
            <Select
              id="sa-settings-integration"
              value={digest.integrationUids[0] != null ? String(digest.integrationUids[0]) : ''}
              onChange={(e) => {
                const integrationUids = e.target.value ? [Number(e.target.value)] : [];
                setDigest((current) => ({ ...current, integrationUids }));
                setAlerts((current) => ({ ...current, integrationUids }));
              }}
            >
              <option value="">{t('speechAnalytics.settingsIntegrationNone', 'Не выбрана')}</option>
              {integrations.map((row) => (
                <option key={row.uid} value={row.uid}>{row.name}</option>
              ))}
            </Select>
          </div>
          <div className={cls.group}>
            <Text>{t('speechAnalytics.settingsWhen', 'Расписание')}</Text>
            <HStack gap="8">
              <Checkbox checked={digest.enabled} onChange={() => setDigest((d) => ({ ...d, enabled: !d.enabled }))} />
              <Text>{t('speechAnalytics.settingsDigestEnabled', 'Включить расписание')}</Text>
            </HStack>
            {digest.enabled ? (
              <Button type="button" variant="outline" onClick={() => setScheduleOpen(true)}>
                {t('speechAnalytics.settingsScheduleOpen', 'Настроить расписание')}
              </Button>
            ) : null}
          </div>
          <div className={cls.group}>
            <Text>{t('speechAnalytics.settingsWhat', 'Что отправлять')}</Text>
            <Text>{t('speechAnalytics.settingsDigest', 'Сводка')}</Text>
            <Label>{t('speechAnalytics.settingsDigestWindow', 'Период в сводке')}</Label>
            <Select value={digest.reportWindow} onChange={(e) => setDigest((d) => ({ ...d, reportWindow: e.target.value as SaDigestConfig['reportWindow'] }))}>
              <option value="last_7_days">{t('speechAnalytics.settingsDigestWindow7', 'Последние 7 дней')}</option>
              <option value="last_30_days">{t('speechAnalytics.settingsDigestWindow30', 'Последние 30 дней')}</option>
              <option value="previous_calendar_month">{t('speechAnalytics.settingsDigestWindowMonth', 'Прошлый календарный месяц')}</option>
            </Select>
            <Button type="button" variant="outline" onClick={() => void onSendDigest()}>{t('speechAnalytics.settingsDigestSend', 'Отправить сейчас')}</Button>
            <Text>{t('speechAnalytics.settingsAlerts', 'Критичные события')}</Text>
            <HStack gap="8"><Checkbox checked={alerts.enabled} onChange={() => setAlerts((a) => ({ ...a, enabled: !a.enabled }))} /><Text>{t('speechAnalytics.settingsAlertEnabled', 'Включить критичные уведомления')}</Text></HStack>
            <Text>{t('speechAnalytics.settingsAlertCsat', 'Падение CSAT')}</Text>
            <HStack gap="8">
              <Input aria-label={t('speechAnalytics.settingsAlertDrop', 'Порог падения, %')} type="number" value={alerts.csatDrop.dropPct} onChange={(e) => setAlerts((a) => ({ ...a, csatDrop: { ...a.csatDrop, dropPct: Number(e.target.value) } }))} />
              <Input aria-label={t('speechAnalytics.settingsAlertWindow', 'Окно, дней')} type="number" value={alerts.csatDrop.windowDays} onChange={(e) => setAlerts((a) => ({ ...a, csatDrop: { ...a.csatDrop, windowDays: Number(e.target.value) } }))} />
              <Input aria-label={t('speechAnalytics.settingsAlertMinCalls', 'Мин. звонков')} type="number" value={alerts.csatDrop.minCalls} onChange={(e) => setAlerts((a) => ({ ...a, csatDrop: { ...a.csatDrop, minCalls: Number(e.target.value) } }))} />
            </HStack>
            <Text>{t('speechAnalytics.settingsAlertNegative', 'Рост негатива')}</Text>
            <HStack gap="8">
              <Input aria-label={t('speechAnalytics.settingsAlertSpike', 'Рост, п.п.')} type="number" value={alerts.negativeSpike.spikePp} onChange={(e) => setAlerts((a) => ({ ...a, negativeSpike: { ...a.negativeSpike, spikePp: Number(e.target.value) } }))} />
              <Input aria-label={t('speechAnalytics.settingsAlertWindow', 'Окно, дней')} type="number" value={alerts.negativeSpike.windowDays} onChange={(e) => setAlerts((a) => ({ ...a, negativeSpike: { ...a.negativeSpike, windowDays: Number(e.target.value) } }))} />
              <Input aria-label={t('speechAnalytics.settingsAlertMinCalls', 'Мин. звонков')} type="number" value={alerts.negativeSpike.minCalls} onChange={(e) => setAlerts((a) => ({ ...a, negativeSpike: { ...a.negativeSpike, minCalls: Number(e.target.value) } }))} />
            </HStack>
            <Text>{t('speechAnalytics.settingsBudget', 'Порог бюджета')}</Text>
            <Label htmlFor="sa-settings-budget">{t('speechAnalytics.settingsBudgetLabel', 'USD (0 - без лимита)')}</Label>
            <Input id="sa-settings-budget" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
            <HStack gap="8"><Checkbox checked={alerts.budgetExceeded.enabled} onChange={() => setAlerts((a) => ({ ...a, budgetExceeded: { enabled: !a.budgetExceeded.enabled } }))} /><Text>{t('speechAnalytics.settingsAlertBudget', 'Превышение бюджета')}</Text></HStack>
            <Button type="button" variant="outline" onClick={() => void onTestAlert()}>{t('speechAnalytics.settingsAlertTest', 'Отправить тест')}</Button>
          </div>
        </Section>
      </div>
      <div className={cls.footer}>
        <Button type="button" disabled={busy || !name.trim()} onClick={() => void onSave()}>
          <Save size={16} />
          {busy ? t('speechAnalytics.wizardSaving', 'Сохранение...') : t('speechAnalytics.settingsSave', 'Сохранить')}
        </Button>
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('speechAnalytics.settingsDigestSchedule', 'Расписание')}</DialogTitle>
            <DialogDescription>{t('speechAnalytics.settingsScheduleHint', 'Когда отправлять сводку в выбранные интеграции.')}</DialogDescription>
          </DialogHeader>
          <VStack gap="8">
            <Label>{t('speechAnalytics.settingsDigestSchedule', 'Расписание')}</Label>
            <Select value={digest.schedule} onChange={(e) => setDigest((d) => ({ ...d, schedule: e.target.value as SaDigestConfig['schedule'] }))}>
              <option value="daily">{t('speechAnalytics.settingsDigestDaily', 'Каждый день')}</option>
              <option value="weekly">{t('speechAnalytics.settingsDigestWeekly', 'Раз в неделю')}</option>
              <option value="monthly">{t('speechAnalytics.settingsDigestMonthly', 'Раз в месяц')}</option>
            </Select>
            {digest.schedule === 'weekly' ? (
              <Select aria-label={t('speechAnalytics.settingsDigestWeekday', 'День недели')} value={String(digest.weeklyDay ?? 1)} onChange={(e) => setDigest((d) => ({ ...d, weeklyDay: Number(e.target.value) }))}>
                {WEEKDAYS.map((label, index) => <option key={label} value={String(index + 1)}>{label}</option>)}
              </Select>
            ) : null}
            {digest.schedule === 'monthly' ? (
              <Input aria-label={t('speechAnalytics.settingsDigestMonthDay', 'День месяца (1-28)')} type="number" value={digest.monthlyDay ?? 1} onChange={(e) => setDigest((d) => ({ ...d, monthlyDay: Math.min(28, Math.max(1, Number(e.target.value) || 1)) }))} />
            ) : null}
            <Label>{t('speechAnalytics.settingsDigestHour', 'Час отправки (0-23)')}</Label>
            <Input type="number" value={digest.sendHour ?? 9} onChange={(e) => setDigest((d) => ({ ...d, sendHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) }))} />
          </VStack>
          <DialogFooter>
            <Button type="button" onClick={() => setScheduleOpen(false)}>{t('common.close', 'Закрыть')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={pendingTopic != null} onOpenChange={(next) => { if (!next) setPendingTopic(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('speechAnalytics.wizardDeleteTopicTitle', { name: pendingTopic != null ? topics[pendingTopic]?.name : '', defaultValue: 'Удалить тему «{{name}}»?' })}</DialogTitle>
            <DialogDescription>{t('speechAnalytics.wizardDeleteTopicBody', 'Звонки, размеченные ранее, сохранят тег. Новые анализы перестанут его получать.')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingTopic(null)}>{t('common.cancel', 'Отмена')}</Button>
            <Button type="button" variant="destructive" onClick={() => { setTopics((prev) => prev.filter((_, i) => i !== pendingTopic)); setPendingTopic(null); }}>{t('speechAnalytics.wizardDeleteTopic', 'Удалить тему')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={pendingMetric != null} onOpenChange={(next) => { if (!next) setPendingMetric(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('speechAnalytics.wizardDeleteMetricTitle', { name: pendingMetric != null ? metrics[pendingMetric]?.name : '', defaultValue: 'Удалить метрику «{{name}}»?' })}</DialogTitle>
            <DialogDescription>{t('speechAnalytics.wizardDeleteMetricBody', 'Метрика не попадёт в набор этого проекта.')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingMetric(null)}>{t('common.cancel', 'Отмена')}</Button>
            <Button type="button" variant="destructive" onClick={() => { setMetrics((prev) => prev.filter((_, i) => i !== pendingMetric)); setPendingMetric(null); }}>{t('speechAnalytics.wizardDeleteMetric', 'Удалить метрику')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

ProjectSettingsForm.displayName = 'ProjectSettingsForm';
