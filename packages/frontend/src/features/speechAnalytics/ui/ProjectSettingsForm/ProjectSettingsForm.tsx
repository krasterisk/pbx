import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronRight,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  SA_WEBHOOK_EVENTS,
  defaultDigestBlocks,
  defaultSaProjectConfig,
  digestSchedules,
  normalizeProjectMetric,
  projectNotices,
  resolveProjectInsights,
  type SaAlertConfig,
  type SaCallTagDef,
  type SaDigestConfig,
  type SaDigestSchedule,
  type SaNotice,
  type SaNoticeKind,
  type SaProjectConfigV1,
  type SaProjectInsights,
  type SaProjectMetric,
  type SaWebhookEvent,
} from '@krasterisk/shared';
import {
  Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, InfoTooltip, Input, Label, Select, Switch, Tabs, TabsContent, TabsList, TabsTrigger,
  Text, Textarea, type AuthMode, type WebhookHeader,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetNotificationsQuery } from '@/shared/api/endpoints/notificationApi';
import { WebhookList, type WebhookListItem } from '@/shared/ui/WebhookList/WebhookList';
import {
  useGetSaProjectsQuery,
  useGetSaProjectVersionsQuery,
  usePublishSaProjectMutation,
  useRestoreSaProjectVersionMutation,
  useTestSaNoticeMutation,
  useTestSaProjectAlertMutation,
  useUpdateSaProjectDraftMutation,
  useGetSaSpeechModelsQuery,
} from '../../api/speechAnalyticsApi';
import { SpeechAnalyticsModelFields } from '../SpeechAnalyticsModelFields/SpeechAnalyticsModelFields';
import cls from './ProjectSettingsForm.module.scss';

const WEEKDAY_INDEXES = [1, 2, 3, 4, 5, 6, 7] as const;
const MONTH_DAY_INDEXES = Array.from({ length: 28 }, (_, index) => index + 1);
const WEEKDAY_NAME_FALLBACK: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
};

function scheduleTitle(t: (key: string, fallback?: string) => string, slot: SaDigestSchedule): string {
  const when = slot.schedule === 'daily'
    ? t('speechAnalytics.settingsDigestDaily', 'Каждый день')
    : slot.schedule === 'weekly'
      ? `${t('speechAnalytics.settingsDigestWeekly', 'Раз в неделю')}, ${t(`speechAnalytics.settingsDigestWeekdayName.${slot.weeklyDay ?? 1}`, WEEKDAY_NAME_FALLBACK[slot.weeklyDay ?? 1])}`
      : `${t('speechAnalytics.settingsDigestMonthly', 'Раз в месяц')}, ${slot.monthlyDay ?? 1}`;
  return `${when}, ${slot.sendHour ?? 9}:00`;
}

function metricStampOf(config: SaProjectConfigV1): string {
  return JSON.stringify({
    metrics: config.metrics ?? [],
    callTaxonomy: config.callTaxonomy ?? [],
    customMetrics: config.customMetrics,
    topics: config.topics,
    systemPrompt: config.systemPrompt,
    hiddenDefaultScales: [...(config.hiddenDefaultScales ?? [])].sort(),
    insights: config.insights ?? null,
    sttProviderUid: config.sttProviderUid ?? null,
    llmProviderUid: config.llmProviderUid ?? null,
  });
}

const METRIC_TYPE_LABELS: Record<SaProjectMetric['type'], string> = {
  boolean: 'Boolean (Да/Нет)',
  number: 'Number (Число)',
  enum: 'Enum (Список)',
  string: 'String (Текст)',
};

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

function webhookItemsFromConfig(config: SaProjectConfigV1): WebhookListItem[] {
  const stored = config.eventWebhooks ?? [];
  if (stored.length) {
    return stored.map((row) => {
      const auth = authFromHeaders(row.headers);
      return {
        id: Math.random().toString(36).slice(2),
        event: row.event,
        url: row.url,
        authMode: auth.mode,
        token: auth.token,
        customHeaders: auth.custom,
      };
    });
  }
  if (!config.eventWebhook?.url) return [];
  const auth = authFromHeaders(config.eventWebhook.headers);
  const events = config.eventWebhook.events?.length
    ? config.eventWebhook.events
    : ['analysis.completed' as const];
  return events.map((event) => ({
    id: Math.random().toString(36).slice(2),
    event,
    url: config.eventWebhook.url ?? '',
    authMode: auth.mode,
    token: auth.token,
    customHeaders: auth.custom,
  }));
}

const EVENT_LABELS: Record<SaWebhookEvent, string> = {
  'analysis.completed': 'Анализ завершён',
  'analysis.error': 'Ошибка анализа',
  'budget.exceeded': 'Превышен бюджет',
  'anomaly.detected': 'Аномалия метрик',
};

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
  const versionsQuery = useGetSaProjectVersionsQuery(projectId);
  const [restoreVersion, restoreState] = useRestoreSaProjectVersionMutation();
  const [testAlert] = useTestSaProjectAlertMutation();
  const [testNotice] = useTestSaNoticeMutation();
  const { data: integrations = [] } = useGetNotificationsQuery();
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [sttProviderUid, setSttProviderUid] = useState<number | null>(null);
  const [llmProviderUid, setLlmProviderUid] = useState<number | null>(null);
  const { data: speechModels } = useGetSaSpeechModelsQuery();
  const [metrics, setMetrics] = useState<SaProjectMetric[]>([]);
  const [insights, setInsights] = useState<SaProjectInsights>(defaultSaProjectConfig().insights);
  const [topics, setTopics] = useState<SaCallTagDef[]>([]);
  const [webhookItems, setWebhookItems] = useState<WebhookListItem[]>([]);
  const [digest, setDigest] = useState<SaDigestConfig>(defaultSaProjectConfig().digest);
  const [alerts, setAlerts] = useState<SaAlertConfig>(defaultSaProjectConfig().alerts);
  const [notices, setNotices] = useState<SaNotice[]>([]);
  const [openNotices, setOpenNotices] = useState<Record<string, boolean>>({});
  const [addingNotice, setAddingNotice] = useState(false);
  const [budget, setBudget] = useState('');
  const [revision, setRevision] = useState(1);
  const [hydrated, setHydrated] = useState<string | null>(null);
  const [tab, setTab] = useState('general');
  const [skipPublish, setSkipPublish] = useState(false);
  const [pendingTopic, setPendingTopic] = useState<number | null>(null);
  const [pendingMetric, setPendingMetric] = useState<number | null>(null);
  const [openMetrics, setOpenMetrics] = useState<Record<string, boolean>>({});
  const [openInsights, setOpenInsights] = useState({ summary: false, csat: false, sentiment: false });
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});
  const [openNotify, setOpenNotify] = useState({ where: false, when: false, what: false });
  const [aliasDraft, setAliasDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!project || hydrated === `${project.id}:${project.draft_revision}`) return;
    const cfg = project.draft_config ?? defaultSaProjectConfig();
    setName(project.name);
    setDescription(cfg.description ?? '');
    setSystemPrompt(cfg.systemPrompt ?? '');
    setSttProviderUid(cfg.sttProviderUid ?? null);
    setLlmProviderUid(cfg.llmProviderUid ?? null);
    setInsights(resolveProjectInsights(cfg));
    setMetrics((cfg.metrics ?? []).map((metric) => ({
      ...normalizeProjectMetric(metric),
      sourceScaleId: null,
    })));
    setTopics(cfg.callTaxonomy ?? []);
    setWebhookItems(webhookItemsFromConfig(cfg));
    const mergedDigest = { ...defaultSaProjectConfig().digest, ...cfg.digest };
    setDigest({ ...mergedDigest, schedules: digestSchedules(mergedDigest) });
    setAlerts({ ...defaultSaProjectConfig().alerts, ...cfg.alerts });
    setNotices(Array.isArray(cfg.notices) ? cfg.notices : projectNotices(cfg));
    setBudget(cfg.budget?.softLimit ? String(cfg.budget.softLimit) : '');
    setRevision(project.draft_revision);
    setHydrated(`${project.id}:${project.draft_revision}`);
  }, [hydrated, project]);

  const buildConfig = (): SaProjectConfigV1 => {
    const eventWebhooks = webhookItems
      .filter((row) => row.url.trim())
      .map((row) => ({
        event: row.event as SaWebhookEvent,
        url: row.url.trim(),
        headers: headersFromAuth(row.authMode, row.token, row.customHeaders),
      }));
    const headerMap = eventWebhooks[0]?.headers ?? {};
    const budgetNotice = notices.find((row) => row.kind === 'budget' && row.enabled);
    const parsedBudget = budgetNotice?.softLimit ?? (budget.trim() === '' ? 0 : Number(budget.replace(',', '.')));
    return {
      ...defaultSaProjectConfig(),
      ...(project?.draft_config ?? {}),
      description,
      systemPrompt,
      sttProviderUid,
      llmProviderUid,
      insights,
      metrics: metrics.map((metric) => ({ ...normalizeProjectMetric(metric), sourceScaleId: null })),
      callTaxonomy: topics,
      customMetrics: [],
      hiddenDefaultScales: [],
      eventWebhook: {
        url: eventWebhooks[0]?.url ?? null,
        headers: headerMap,
        events: [...new Set(eventWebhooks.map((row) => row.event))],
      },
      eventWebhooks,
      digest: {
        ...digest,
        enabled: (digest.schedules ?? []).length > 0,
        schedules: digest.schedules ?? [],
        schedule: digest.schedules?.[0]?.schedule ?? digest.schedule,
        weeklyDay: digest.schedules?.[0]?.weeklyDay ?? digest.weeklyDay,
        monthlyDay: digest.schedules?.[0]?.monthlyDay ?? digest.monthlyDay,
        sendHour: digest.schedules?.[0]?.sendHour ?? digest.sendHour,
      },
      alerts,
      notices,
      budget: { softLimit: Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : 0 },
    };
  };

  const showNotice = (text: string, tone: 'success' | 'error') => {
    setNotice({ text, tone });
    if (tone === 'success') toast.success(text);
    else toast.error(text);
  };

  const notifyToast = (error: unknown, fallback: string) => {
    const code = notifyErrorCode(error);
    if (code === 'digest_recipient_required') {
      showNotice(t('speechAnalytics.settingsIntegrationRequired', 'Выберите интеграцию'), 'error');
      return;
    }
    if (code === 'missing_credentials') {
      showNotice(t('speechAnalytics.notifyMissingCredentials', 'В интеграции не указан токен бота или chat id'), 'error');
      return;
    }
    if (code === 'invalid_bot_token') {
      showNotice(t('speechAnalytics.notifyInvalidToken', 'Токен бота неверный. Вставьте полный токен из BotFather'), 'error');
      return;
    }
    if (code === 'chat_not_found') {
      showNotice(t('speechAnalytics.notifyChatNotFound', 'Chat id не найден. Напишите боту в Telegram и укажите id этого чата'), 'error');
      return;
    }
    if (code === 'bot_blocked') {
      showNotice(t('speechAnalytics.notifyBotBlocked', 'Бот заблокирован в этом чате'), 'error');
      return;
    }
    showNotice(fallback, 'error');
  };

  const onTestNotice = async (noticeId: string) => {
    if (!digest.integrationUids.length) {
      showNotice(t('speechAnalytics.settingsIntegrationRequired', 'Выберите интеграцию'), 'error');
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
      await testNotice({ id: projectId, noticeId }).unwrap();
      showNotice(t('speechAnalytics.settingsAlertSent', 'Сообщение отправлено'), 'success');
    } catch (error) {
      notifyToast(error, t('speechAnalytics.settingsAlertFailed', 'Не удалось отправить уведомление'));
    }
  };

  const onTestAlert = async () => {
    if (!digest.integrationUids.length) {
      showNotice(t('speechAnalytics.settingsIntegrationRequired', 'Выберите интеграцию'), 'error');
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
      showNotice(t('speechAnalytics.settingsAlertSent', 'Сообщение отправлено'), 'success');
    } catch (error) {
      notifyToast(error, t('speechAnalytics.settingsAlertFailed', 'Не удалось отправить уведомление'));
    }
  };

  const onSave = async () => {
    try {
      const saved = await saveDraft({ id: projectId, expectedRevision: revision, config: buildConfig() }).unwrap();
      setRevision(saved.draft_revision);
      setHydrated(`${projectId}:${saved.draft_revision}`);
      if (!createsVersion || !skipPublish) {
        await publishProject({ id: projectId, operationKey: `settings-${saved.draft_revision}` }).unwrap();
        toast.success(t('speechAnalytics.publishedSaved', 'Сохранено и опубликовано'));
      } else {
        toast.success(project?.active_version_id
          ? t('speechAnalytics.draftSavedKeepPublished', 'Черновик сохранён. Разбор идёт по опубликованной версии')
          : t('speechAnalytics.draftSavedNoAnalysis', 'Черновик сохранён. Разбор не идёт, пока проект не опубликован'));
      }
      onSaved?.();
    } catch {
      toast.error(t('speechAnalytics.saveFailed', 'Не удалось сохранить'));
    }
  };

  if (projectsQuery.isLoading && !project) return <Text>{t('common.loading', 'Загрузка')}</Text>;
  if (!project) return <Text>{t('speechAnalytics.projectNotFound', 'Проект не найден')}</Text>;

  const busy = saveState.isLoading || publishState.isLoading;
  const editedSchedule = (digest.schedules ?? []).find((row) => row.id === editingScheduleId) ?? null;
  const patchSchedule = (patch: Partial<SaDigestSchedule>) => {
    if (!editedSchedule) return;
    setDigest((current) => ({
      ...current,
      schedules: (current.schedules ?? []).map((row) => (
        row.id === editedSchedule.id ? { ...row, ...patch } : row
      )),
    }));
  };
  const currentStamp = (versionsQuery.data ?? []).find((version) => version.current)?.metricStamp;
  const createsVersion = !versionsQuery.isLoading && (!currentStamp || metricStampOf(buildConfig()) !== currentStamp);

  return (
    <div className={cls.shell} data-testid="sa-project-settings">
      <DialogHeader className={cls.header}>
        <DialogTitle>{name.trim() || t('speechAnalytics.settingsTitle', 'Настройки проекта')}</DialogTitle>
        <Text variant="muted" className={cls.subtitle}>{t('speechAnalytics.settingsSubtitle', 'Промпт, метрики, темы и уведомления этого проекта')}</Text>
      </DialogHeader>
      <Tabs value={tab} onValueChange={setTab} className={cls.tabs}>
        <TabsList aria-label={t('speechAnalytics.settingsTitle', 'Настройки проекта')}>
          <TabsTrigger value="general">{t('speechAnalytics.settingsTabGeneral', 'Общие')}</TabsTrigger>
          <TabsTrigger value="metrics">{t('speechAnalytics.settingsMetrics', 'Метрики')}</TabsTrigger>
          <TabsTrigger value="topics">{t('speechAnalytics.settingsCallTopics', 'Темы звонков')}</TabsTrigger>
          <TabsTrigger value="webhook">{t('speechAnalytics.settingsWebhooks', 'Webhooks')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('speechAnalytics.settingsNotifications', 'Уведомления')}</TabsTrigger>
          <TabsTrigger value="versions">{t('speechAnalytics.settingsVersions', 'Версии')}</TabsTrigger>
          {speechModels?.projectOverride ? (
            <TabsTrigger value="models">{t('speechAnalytics.settingsModels', 'Модели')}</TabsTrigger>
          ) : null}
        </TabsList>
        <div className={cls.formBody}>
        <TabsContent value="general" className={cls.generalPanel}>
        <VStack gap="12" max className={cls.generalFields}>
          <div className={cls.identity}>
            <VStack gap="4" max>
              <Label htmlFor="sa-settings-name">{t('speechAnalytics.projectName', 'Название проекта')}</Label>
              <Input id="sa-settings-name" value={name} onChange={(e) => setName(e.target.value)} />
            </VStack>
            <VStack gap="4" max>
              <Label htmlFor="sa-settings-description">{t('speechAnalytics.wizardProjectDescription', 'Описание проекта')}</Label>
              <Input id="sa-settings-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </VStack>
          </div>
          <VStack gap="4" max className={cls.promptField}>
            <Label htmlFor="sa-settings-prompt">{t('speechAnalytics.settingsSystemPrompt', 'Системный промпт')}</Label>
            <Textarea
              id="sa-settings-prompt"
              className={`${cls.promptArea} min-h-0 h-full flex-1`}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </VStack>
        </VStack>
        </TabsContent>

        <TabsContent value="topics">
          <VStack gap="12" max>
          <Text variant="muted" className={cls.hint}>{t('speechAnalytics.wizardTopicsHint', 'Темы - метки для звонков. При анализе ИИ выбирает подходящие темы из справочника по смыслу разговора.')}</Text>
          {topics.map((tag, index) => {
            const topicOpen = openTopics[tag.id] === true;
            return (
            <Card key={tag.id} className={`${cls.nested} ${cls.metricCard}`}>
              <VStack gap="8" max>
                <div className={cls.metricHeadRow}>
                  <button
                    type="button"
                    className={cls.metricHead}
                    aria-expanded={topicOpen}
                    onClick={() => setOpenTopics((prev) => ({ ...prev, [tag.id]: !topicOpen }))}
                  >
                    <span className={cls.metricHeadMain}>
                      {topicOpen ? <ChevronDown size={16} className={cls.metricChevron} aria-hidden /> : <ChevronRight size={16} className={cls.metricChevron} aria-hidden />}
                      <span className={cls.itemTitle}>{tag.name || t('speechAnalytics.wizardNewTopic', 'Новая тема')}</span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`${cls.deleteBtn} text-destructive hover:text-destructive hover:bg-destructive/10`}
                    aria-label={t('common.delete', 'Удалить')}
                    onClick={() => setPendingTopic(index)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                {topicOpen ? (
                <>
                <Label>{t('speechAnalytics.wizardTopicName', 'Название темы')}</Label>
                <Input value={tag.name} onChange={(e) => setTopics((prev) => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} />
                <Label>{t('speechAnalytics.wizardTopicWhen', 'Описание (когда ставить тему)')}</Label>
                <Textarea rows={2} value={tag.description ?? ''} onChange={(e) => setTopics((prev) => prev.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)))} />
                <HStack gap="4" align="center">
                  <Label>{t('speechAnalytics.wizardTopicPhrases', 'Формулировки (необязательно)')}</Label>
                  <InfoTooltip text={t('speechAnalytics.settingsTopicPhrasesTooltip', 'Необязательно. Слова и фразы, которые могут прозвучать в таком звонке. ИИ использует их как подсказку, точное совпадение не нужно.\nНапример: возврат, вернуть товар, обмен')} />
                </HStack>
                <Input
                  value={aliasDraft[tag.id] ?? tag.aliases.join(', ')}
                  placeholder={t('speechAnalytics.wizardTopicPhrasesPlaceholder', 'например: возврат, вернуть товар, обмен')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setAliasDraft((prev) => ({ ...prev, [tag.id]: raw }));
                    const aliases = raw.split(',').map((part) => part.trim()).filter(Boolean);
                    setTopics((prev) => prev.map((row, i) => (i === index ? { ...row, aliases } : row)));
                  }}
                />
                </>
                ) : null}
              </VStack>
            </Card>
            );
          })}
          <Button type="button" variant="outline" onClick={() => {
            const id = `tag_${Date.now()}`;
            setOpenTopics((prev) => ({ ...prev, [id]: true }));
            setTopics((prev) => [...prev, { id, name: '', aliases: [], description: '' }]);
          }}>
            {t('speechAnalytics.wizardAddTopic', 'Добавить тему')}
          </Button>
          </VStack>
        </TabsContent>

        <TabsContent value="metrics">
          <VStack gap="12" max>
          <Text variant="muted" className={cls.hint}>{t('speechAnalytics.settingsInsightsHint', 'Саммари, удовлетворённость и тональность есть в каждом проекте. Ниже задаются шкала и правила, по которым модель их ставит.')}</Text>
          <Card className={`${cls.nested} ${cls.metricCard}`}>
            <VStack gap="8" max>
              <div className={cls.metricHeadRow}>
                <button
                  type="button"
                  className={cls.metricHead}
                  aria-expanded={openInsights.summary}
                  onClick={() => setOpenInsights((current) => ({ ...current, summary: !current.summary }))}
                >
                  <span className={cls.metricHeadMain}>
                    {openInsights.summary ? <ChevronDown size={16} className={cls.metricChevron} aria-hidden /> : <ChevronRight size={16} className={cls.metricChevron} aria-hidden />}
                    <span className={cls.itemTitle}>{t('speechAnalytics.insightSummary', 'Саммари')}</span>
                  </span>
                </button>
                <Switch
                  checked={insights.summary.enabled}
                  aria-label={t('speechAnalytics.insightEnabled', 'Включена')}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={(checked) => setInsights((current) => ({
                    ...current,
                    summary: { ...current.summary, enabled: checked },
                  }))}
                />
              </div>
              {openInsights.summary ? (
                <>
                  <Label htmlFor="sa-summary-instruction">{t('speechAnalytics.wizardLlmDescription', 'Описание для LLM')}</Label>
                  <Textarea
                    id="sa-summary-instruction"
                    rows={2}
                    value={insights.summary.instruction}
                    onChange={(event) => setInsights((current) => ({
                      ...current,
                      summary: { instruction: event.target.value },
                    }))}
                  />
                </>
              ) : null}
            </VStack>
          </Card>
          <Card className={`${cls.nested} ${cls.metricCard}`}>
            <VStack gap="8" max>
              <div className={cls.metricHeadRow}>
                <button
                  type="button"
                  className={cls.metricHead}
                  aria-expanded={openInsights.csat}
                  onClick={() => setOpenInsights((current) => ({ ...current, csat: !current.csat }))}
                >
                  <span className={cls.metricHeadMain}>
                    {openInsights.csat ? <ChevronDown size={16} className={cls.metricChevron} aria-hidden /> : <ChevronRight size={16} className={cls.metricChevron} aria-hidden />}
                    <span className={cls.itemTitle}>{t('speechAnalytics.insightCsat', 'Удовлетворённость клиента (CSAT)')}</span>
                  </span>
                  {openInsights.csat ? null : (
                    <span className={cls.metricType}>{`${insights.csat.min}-${insights.csat.max}`}</span>
                  )}
                </button>
                <Switch
                  checked={insights.csat.enabled}
                  aria-label={t('speechAnalytics.insightEnabled', 'Включена')}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={(checked) => setInsights((current) => ({
                    ...current,
                    csat: { ...current.csat, enabled: checked },
                  }))}
                />
              </div>
              {openInsights.csat ? (
                <>
                  <HStack gap="8" align="end">
                    <VStack gap="4">
                      <Label htmlFor="sa-csat-min">{t('speechAnalytics.settingsScaleFrom', 'От')}</Label>
                      <Input id="sa-csat-min" type="number" value={insights.csat.min} onChange={(event) => setInsights((current) => ({ ...current, csat: { ...current.csat, min: Number(event.target.value) } }))} />
                    </VStack>
                    <VStack gap="4">
                      <Label htmlFor="sa-csat-max">{t('speechAnalytics.settingsScaleTo', 'До')}</Label>
                      <Input id="sa-csat-max" type="number" value={insights.csat.max} onChange={(event) => setInsights((current) => ({ ...current, csat: { ...current.csat, max: Number(event.target.value) } }))} />
                    </VStack>
                  </HStack>
                  <Label htmlFor="sa-csat-low">{t('speechAnalytics.insightLowLabel', 'Подпись нижней границы')}</Label>
                  <Input id="sa-csat-low" value={insights.csat.lowLabel} onChange={(event) => setInsights((current) => ({ ...current, csat: { ...current.csat, lowLabel: event.target.value } }))} />
                  <Label htmlFor="sa-csat-high">{t('speechAnalytics.insightHighLabel', 'Подпись верхней границы')}</Label>
                  <Input id="sa-csat-high" value={insights.csat.highLabel} onChange={(event) => setInsights((current) => ({ ...current, csat: { ...current.csat, highLabel: event.target.value } }))} />
                  <Label htmlFor="sa-csat-instruction">{t('speechAnalytics.wizardLlmDescription', 'Описание для LLM')}</Label>
                  <Textarea id="sa-csat-instruction" rows={2} value={insights.csat.instruction} onChange={(event) => setInsights((current) => ({ ...current, csat: { ...current.csat, instruction: event.target.value } }))} />
                </>
              ) : null}
            </VStack>
          </Card>
          <Card className={`${cls.nested} ${cls.metricCard}`}>
            <VStack gap="8" max>
              <div className={cls.metricHeadRow}>
                <button
                  type="button"
                  className={cls.metricHead}
                  aria-expanded={openInsights.sentiment}
                  onClick={() => setOpenInsights((current) => ({ ...current, sentiment: !current.sentiment }))}
                >
                  <span className={cls.metricHeadMain}>
                    {openInsights.sentiment ? <ChevronDown size={16} className={cls.metricChevron} aria-hidden /> : <ChevronRight size={16} className={cls.metricChevron} aria-hidden />}
                    <span className={cls.itemTitle}>{t('speechAnalytics.insightSentiment', 'Тональность')}</span>
                  </span>
                </button>
                <Switch
                  checked={insights.sentiment.enabled}
                  aria-label={t('speechAnalytics.insightEnabled', 'Включена')}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={(checked) => setInsights((current) => ({
                    ...current,
                    sentiment: { ...current.sentiment, enabled: checked },
                  }))}
                />
              </div>
              {openInsights.sentiment ? (
                <>
                  <Label htmlFor="sa-sentiment-instruction">{t('speechAnalytics.wizardLlmDescription', 'Описание для LLM')}</Label>
                  <Textarea id="sa-sentiment-instruction" rows={2} value={insights.sentiment.instruction} onChange={(event) => setInsights((current) => ({ ...current, sentiment: { ...current.sentiment, instruction: event.target.value } }))} />
                  {insights.sentiment.values.map((row, index) => (
                    <VStack key={row.id} gap="4" max>
                      <Text variant="small">{row.id}</Text>
                      <Input
                        aria-label={t('speechAnalytics.insightSentimentName', 'Название тональности')}
                        value={row.name}
                        onChange={(event) => setInsights((current) => ({
                          ...current,
                          sentiment: {
                            ...current.sentiment,
                            values: current.sentiment.values.map((item, itemIndex) => (
                              itemIndex === index ? { ...item, name: event.target.value } : item
                            )),
                          },
                        }))}
                      />
                      <Textarea
                        rows={2}
                        aria-label={t('speechAnalytics.wizardLlmDescription', 'Описание для LLM')}
                        value={row.description}
                        onChange={(event) => setInsights((current) => ({
                          ...current,
                          sentiment: {
                            ...current.sentiment,
                            values: current.sentiment.values.map((item, itemIndex) => (
                              itemIndex === index ? { ...item, description: event.target.value } : item
                            )),
                          },
                        }))}
                      />
                    </VStack>
                  ))}
                </>
              ) : null}
            </VStack>
          </Card>
          <Text variant="muted" className={cls.hint}>{t('speechAnalytics.settingsMetricsHint', 'Набор метрик проекта. Разбор смотрит на название, тип ответа и описание.')}</Text>
          {metrics.map((metric, index) => {
            const metricOpen = openMetrics[metric.id] === true;
            return (
            <Card key={`${metric.id}-${index}`} className={`${cls.nested} ${cls.metricCard}`}>
              <VStack gap="8" max>
                <div className={cls.metricHeadRow}>
                  <button
                    type="button"
                    className={cls.metricHead}
                    aria-expanded={metricOpen}
                    onClick={() => setOpenMetrics((prev) => ({ ...prev, [metric.id]: !metricOpen }))}
                  >
                    <span className={cls.metricHeadMain}>
                      {metricOpen ? <ChevronDown size={16} className={cls.metricChevron} aria-hidden /> : <ChevronRight size={16} className={cls.metricChevron} aria-hidden />}
                      <span className={cls.itemTitle}>{metric.name || t('speechAnalytics.wizardNewMetric', 'Новая метрика')}</span>
                    </span>
                    {metricOpen ? null : (
                      <span className={cls.metricType}>{METRIC_TYPE_LABELS[metric.type]}</span>
                    )}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`${cls.deleteBtn} text-destructive hover:text-destructive hover:bg-destructive/10`}
                    aria-label={t('common.delete', 'Удалить')}
                    onClick={() => setPendingMetric(index)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                {metricOpen ? (
                <>
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
                          min: type === 'number' ? (row.min ?? 0) : row.min,
                          max: type === 'number' ? (row.max ?? 100) : row.max,
                          polarity: type === 'number' ? (row.polarity ?? 'positive') : row.polarity,
                        }
                        : row
                    )));
                  }}
                >
                  <option value="boolean">Boolean (Да/Нет)</option>
                  <option value="number">Number (Число)</option>
                  <option value="enum">Enum (Список)</option>
                  <option value="string">String (Текст)</option>
                </Select>
                {metric.type === 'number' ? (
                  <HStack gap="8" align="end">
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
                    <VStack gap="4" className={cls.row}>
                      <Label htmlFor={`sa-metric-unit-${index}`}>{t('speechAnalytics.wizardUnit', 'Единица')}</Label>
                      <Input
                        id={`sa-metric-unit-${index}`}
                        value={metric.unit ?? ''}
                        placeholder="%"
                        onChange={(e) => setMetrics((prev) => prev.map((row, i) => (i === index ? { ...row, unit: e.target.value, sourceScaleId: null } : row)))}
                      />
                    </VStack>
                    <VStack gap="4" className={cls.row}>
                      <Label htmlFor={`sa-metric-polarity-${index}`}>{t('speechAnalytics.wizardScore', 'Оценка')}</Label>
                      <Select
                        id={`sa-metric-polarity-${index}`}
                        value={metric.polarity ?? 'positive'}
                        onChange={(e) => setMetrics((prev) => prev.map((row, i) => (i === index ? { ...row, polarity: e.target.value as SaProjectMetric['polarity'], sourceScaleId: null } : row)))}
                      >
                        <option value="positive">{t('speechAnalytics.wizardPolarityHigh', 'Больше - лучше')}</option>
                        <option value="negative">{t('speechAnalytics.wizardPolarityLow', 'Меньше - лучше')}</option>
                        <option value="neutral">{t('speechAnalytics.wizardPolarityNeutral', 'Нейтрально (без оценки)')}</option>
                      </Select>
                    </VStack>
                  </HStack>
                ) : null}
                <Label>{t('speechAnalytics.wizardLlmDescription', 'Описание для LLM')}</Label>
                <Textarea rows={2} value={metric.description} onChange={(e) => setMetrics((prev) => prev.map((row, i) => (i === index ? { ...row, description: e.target.value, sourceScaleId: null } : row)))} />
                </>
                ) : null}
              </VStack>
            </Card>
            );
          })}
          <Button type="button" variant="outline" onClick={() => {
            const id = `metric_${Date.now()}`;
            setOpenMetrics((prev) => ({ ...prev, [id]: true }));
            setMetrics((prev) => [...prev, { id, name: '', type: 'boolean', description: '', polarity: 'neutral', sourceScaleId: null }]);
          }}>
            {t('speechAnalytics.wizardAddMetric', 'Добавить метрику')}
          </Button>
          </VStack>
        </TabsContent>

        <TabsContent value="webhook">
          <WebhookList
            items={webhookItems}
            onChange={setWebhookItems}
            events={SA_WEBHOOK_EVENTS.map((event) => ({
              value: event,
              label: t(`speechAnalytics.settingsEvent.${event}`, EVENT_LABELS[event]),
            }))}
            title={t('speechAnalytics.settingsWebhookTitle', 'Настройка Webhooks')}
            tooltip={t('speechAnalytics.settingsWebhookTooltip', 'HTTP-запросы при событиях проекта. Для каждого адреса выбирается своё событие и авторизация.')}
            addLabel={t('speechAnalytics.settingsAddWebhook', 'Добавить вебхук')}
            emptyLabel={t('speechAnalytics.settingsNoWebhooks', 'Нет настроенных вебхуков')}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <VStack gap="12" max>
          <div className={cls.group}>
            <button type="button" className={cls.metricHead} aria-expanded={openNotify.where} onClick={() => setOpenNotify((current) => ({ ...current, where: !current.where }))}>
              <span className={cls.metricHeadMain}>
                {openNotify.where ? <ChevronDown size={16} className={cls.metricChevron} aria-hidden /> : <ChevronRight size={16} className={cls.metricChevron} aria-hidden />}
                <span className={cls.groupTitle}>{t('speechAnalytics.settingsWhere', 'Куда уведомлять')}</span>
              </span>
            </button>
            {openNotify.where ? (
            <>
            <HStack gap="8" align="center">
              <Label htmlFor="sa-settings-integration">
                {t('speechAnalytics.settingsIntegration', 'Интеграция')}
              </Label>
              <Link to="/integrations" className={cls.integrationsLink}>
                {t('speechAnalytics.settingsIntegrationSetup', 'настроить')}
              </Link>
            </HStack>
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
            </>
            ) : null}
          </div>
          <div className={cls.group}>
            <button type="button" className={cls.metricHead} aria-expanded={openNotify.when} onClick={() => setOpenNotify((current) => ({ ...current, when: !current.when }))}>
              <span className={cls.metricHeadMain}>
                {openNotify.when ? <ChevronDown size={16} className={cls.metricChevron} aria-hidden /> : <ChevronRight size={16} className={cls.metricChevron} aria-hidden />}
                <span className={cls.groupTitle}>{t('speechAnalytics.settingsWhen', 'Расписание')}</span>
              </span>
            </button>
            {openNotify.when ? (
            <>
            {(digest.schedules ?? []).map((slot) => (
              <div key={slot.id} className={cls.metricHeadRow}>
                <button
                  type="button"
                  className={cls.metricHead}
                  onClick={() => {
                    setEditingScheduleId(slot.id);
                    setScheduleOpen(true);
                  }}
                >
                  <span className={cls.itemTitle}>{scheduleTitle(t, slot)}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`${cls.deleteBtn} text-destructive hover:text-destructive hover:bg-destructive/10`}
                  aria-label={t('common.delete', 'Удалить')}
                  onClick={() => setDigest((current) => ({
                    ...current,
                    schedules: (current.schedules ?? []).filter((row) => row.id !== slot.id),
                  }))}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const id = `sched_${Date.now()}`;
                setDigest((current) => ({
                  ...current,
                  enabled: true,
                  schedules: [
                    ...(current.schedules ?? []),
                    { id, schedule: 'monthly', weeklyDay: 1, monthlyDay: 1, sendHour: 9 },
                  ],
                }));
                setEditingScheduleId(id);
                setScheduleOpen(true);
              }}
            >
              {t('speechAnalytics.settingsAddSchedule', 'Добавить расписание')}
            </Button>
            </>
            ) : null}
          </div>
          <div className={cls.group}>
            <button type="button" className={cls.metricHead} aria-expanded={openNotify.what} onClick={() => setOpenNotify((current) => ({ ...current, what: !current.what }))}>
              <span className={cls.metricHeadMain}>
                {openNotify.what ? <ChevronDown size={16} className={cls.metricChevron} aria-hidden /> : <ChevronRight size={16} className={cls.metricChevron} aria-hidden />}
                <span className={cls.groupTitle}>{t('speechAnalytics.settingsWhat', 'Что отправлять')}</span>
              </span>
            </button>
            {openNotify.what ? (
            <>
            {notices.length > 0 ? (
              <Text variant="muted" className={cls.hint}>{t('speechAnalytics.settingsNoticesHint', 'Каждая строка - отдельная отправка. Сводки уходят по расписанию, критические - когда условие выполнено.')}</Text>
            ) : null}
            {notices.map((notice) => {
              const open = openNotices[notice.id] === true;
              const blocks = { ...defaultDigestBlocks(), ...(notice.blocks ?? {}) };
              const patch = (next: Partial<SaNotice>) => setNotices((current) => current.map((row) => (
                row.id === notice.id ? { ...row, ...next } : row
              )));
              return (
                <Card key={notice.id} className={`${cls.nested} ${cls.metricCard}`}>
                  <VStack gap="8" max>
                    <div className={cls.metricHeadRow}>
                      <button
                        type="button"
                        className={cls.metricHead}
                        aria-expanded={open}
                        onClick={() => setOpenNotices((current) => ({ ...current, [notice.id]: !open }))}
                      >
                        <span className={cls.metricHeadMain}>
                          {open ? <ChevronDown size={16} className={cls.metricChevron} aria-hidden /> : <ChevronRight size={16} className={cls.metricChevron} aria-hidden />}
                          <span className={cls.itemTitle}>{notice.title || t(`speechAnalytics.noticeKind.${notice.kind}`, notice.kind)}</span>
                        </span>
                        {open ? null : <span className={cls.metricType}>{t(`speechAnalytics.noticeKind.${notice.kind}`, notice.kind)}</span>}
                      </button>
                      <Switch
                        checked={notice.enabled}
                        aria-label={t('speechAnalytics.insightEnabled', 'Включена')}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={(checked) => patch({ enabled: checked })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`${cls.deleteBtn} text-destructive hover:text-destructive hover:bg-destructive/10`}
                        aria-label={t('common.delete', 'Удалить')}
                        onClick={() => setNotices((current) => current.filter((row) => row.id !== notice.id))}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    {open ? (
                      <>
                        <Label>{t('speechAnalytics.noticeTitle', 'Название')}</Label>
                        <Input value={notice.title} onChange={(event) => patch({ title: event.target.value })} />
                        {notice.kind === 'digest' ? (
                          <>
                            <HStack gap="4" align="center">
                              <Label htmlFor={`sa-digest-window-${notice.id}`}>{t('speechAnalytics.settingsDigestWindow', 'Период в сводке')}</Label>
                              <InfoTooltip text={t('speechAnalytics.settingsDigestWindowHint', 'Какие звонки попадут в документ. Последние 7 или 30 дней считаются от момента отправки. Прошлый месяц - календарный, без текущего.')} />
                            </HStack>
                            <Select id={`sa-digest-window-${notice.id}`} value={notice.reportWindow ?? 'last_7_days'} onChange={(event) => patch({ reportWindow: event.target.value as SaNotice['reportWindow'] })}>
                              <option value="last_7_days">{t('speechAnalytics.settingsDigestWindow7', 'Последние 7 дней')}</option>
                              <option value="last_30_days">{t('speechAnalytics.settingsDigestWindow30', 'Последние 30 дней')}</option>
                              <option value="previous_calendar_month">{t('speechAnalytics.settingsDigestWindowMonth', 'Прошлый календарный месяц')}</option>
                            </Select>
                            <HStack gap="4" align="center">
                              <Text>{t('speechAnalytics.noticeBlocksTitle', 'Что включить в документ')}</Text>
                              <InfoTooltip text={t('speechAnalytics.noticeBlocksHint', 'В текст и HTML попадут только отмеченные блоки. Снятая галка не удаляет данные из журнала.')} />
                            </HStack>
                            {([
                              ['calls', 'speechAnalytics.noticeBlockCalls', 'Число звонков', 'speechAnalytics.noticeBlockCallsHint', 'Сколько разговоров попало в выбранный период.'],
                              ['averageScore', 'speechAnalytics.noticeBlockScore', 'Средняя оценка', 'speechAnalytics.noticeBlockScoreHint', 'Среднее по оценкам звонков. Звонки с плохим распознаванием в среднее не входят.'],
                              ['csat', 'speechAnalytics.noticeBlockCsat', 'CSAT', 'speechAnalytics.noticeBlockCsatHint', 'Средняя удовлетворённость клиента по шкале проекта.'],
                              ['sentiment', 'speechAnalytics.noticeBlockSentiment', 'Тональность', 'speechAnalytics.noticeBlockSentimentHint', 'Сколько звонков с позитивной, нейтральной и негативной тональностью.'],
                              ['success', 'speechAnalytics.noticeBlockSuccess', 'Успех', 'speechAnalytics.noticeBlockSuccessHint', 'Доля звонков, которые модель отметила как успешные.'],
                              ['cost', 'speechAnalytics.noticeBlockCost', 'Стоимость', 'speechAnalytics.noticeBlockCostHint', 'Сумма стоимости последних разборов за период. Это расчёт, не списание.'],
                              ['metrics', 'speechAnalytics.noticeBlockMetrics', 'Метрики проекта', 'speechAnalytics.noticeBlockMetricsHint', 'Среднее по каждой метрике, которая задана в проекте.'],
                              ['topics', 'speechAnalytics.noticeBlockTopics', 'Темы', 'speechAnalytics.noticeBlockTopicsHint', 'Сколько раз встретилась каждая тема звонка из справочника проекта.'],
                            ] as const).map(([key, i18nKey, fallback, hintKey, hintFallback]) => (
                              <HStack key={key} gap="8" align="center">
                                <Checkbox
                                  checked={blocks[key]}
                                  onChange={() => patch({ blocks: { ...blocks, [key]: !blocks[key] } })}
                                />
                                <Text>{t(i18nKey, fallback)}</Text>
                                <InfoTooltip text={t(hintKey, hintFallback)} />
                              </HStack>
                            ))}
                          </>
                        ) : null}
                        {notice.kind === 'csat_drop' ? (
                          <HStack gap="8" align="start">
                            <VStack gap="4" className={cls.row}>
                              <HStack gap="4" align="center">
                                <Label htmlFor={`sa-csat-drop-${notice.id}`}>{t('speechAnalytics.settingsAlertDrop', 'Порог падения, %')}</Label>
                                <InfoTooltip text={t('speechAnalytics.settingsAlertDropHint', 'На сколько процентов средняя оценка за окно должна упасть относительно предыдущего такого же окна. 20 значит: было 5, стало 4 или ниже.')} />
                              </HStack>
                              <Input id={`sa-csat-drop-${notice.id}`} type="number" value={notice.dropPct ?? 20} onChange={(event) => patch({ dropPct: Number(event.target.value) })} />
                            </VStack>
                            <VStack gap="4" className={cls.row}>
                              <HStack gap="4" align="center">
                                <Label htmlFor={`sa-csat-window-${notice.id}`}>{t('speechAnalytics.settingsAlertWindow', 'Окно, дней')}</Label>
                                <InfoTooltip text={t('speechAnalytics.settingsAlertWindowHint', 'Сколько последних дней сравнивать с таким же периодом перед ними. 7 значит: эта неделя против предыдущей.')} />
                              </HStack>
                              <Input id={`sa-csat-window-${notice.id}`} type="number" value={notice.windowDays ?? 7} onChange={(event) => patch({ windowDays: Number(event.target.value) })} />
                            </VStack>
                            <VStack gap="4" className={cls.row}>
                              <HStack gap="4" align="center">
                                <Label htmlFor={`sa-csat-min-${notice.id}`}>{t('speechAnalytics.settingsAlertMinCalls', 'Мин. звонков')}</Label>
                                <InfoTooltip text={t('speechAnalytics.settingsAlertMinCallsHint', 'Меньше этого числа звонков в окне уведомление не отправится. 5 отсекает случайное падение на одном-двух звонках.')} />
                              </HStack>
                              <Input id={`sa-csat-min-${notice.id}`} type="number" value={notice.minCalls ?? 5} onChange={(event) => patch({ minCalls: Number(event.target.value) })} />
                            </VStack>
                          </HStack>
                        ) : null}
                        {notice.kind === 'negative_spike' ? (
                          <HStack gap="8" align="start">
                            <VStack gap="4" className={cls.row}>
                              <HStack gap="4" align="center">
                                <Label htmlFor={`sa-spike-${notice.id}`}>{t('speechAnalytics.settingsAlertSpike', 'Рост, п.п.')}</Label>
                                <InfoTooltip text={t('speechAnalytics.settingsAlertSpikeHint', 'На сколько процентных пунктов доля негативных звонков должна вырасти относительно предыдущего окна. 15 значит: было 10%, стало 25% или выше.')} />
                              </HStack>
                              <Input id={`sa-spike-${notice.id}`} type="number" value={notice.spikePp ?? 15} onChange={(event) => patch({ spikePp: Number(event.target.value) })} />
                            </VStack>
                            <VStack gap="4" className={cls.row}>
                              <HStack gap="4" align="center">
                                <Label htmlFor={`sa-spike-window-${notice.id}`}>{t('speechAnalytics.settingsAlertWindow', 'Окно, дней')}</Label>
                                <InfoTooltip text={t('speechAnalytics.settingsAlertWindowHint', 'Сколько последних дней сравнивать с таким же периодом перед ними. 7 значит: эта неделя против предыдущей.')} />
                              </HStack>
                              <Input id={`sa-spike-window-${notice.id}`} type="number" value={notice.windowDays ?? 7} onChange={(event) => patch({ windowDays: Number(event.target.value) })} />
                            </VStack>
                            <VStack gap="4" className={cls.row}>
                              <HStack gap="4" align="center">
                                <Label htmlFor={`sa-spike-min-${notice.id}`}>{t('speechAnalytics.settingsAlertMinCalls', 'Мин. звонков')}</Label>
                                <InfoTooltip text={t('speechAnalytics.settingsAlertMinCallsHint', 'Меньше этого числа звонков в окне уведомление не отправится. 5 отсекает случайное падение на одном-двух звонках.')} />
                              </HStack>
                              <Input id={`sa-spike-min-${notice.id}`} type="number" value={notice.minCalls ?? 5} onChange={(event) => patch({ minCalls: Number(event.target.value) })} />
                            </VStack>
                          </HStack>
                        ) : null}
                        {notice.kind === 'low_stt' ? (
                          <HStack gap="8" align="start">
                            <VStack gap="4" className={cls.row}>
                              <HStack gap="4" align="center">
                                <Label htmlFor={`sa-stt-${notice.id}`}>{t('speechAnalytics.noticeLowSttPct', 'Доля, %')}</Label>
                                <InfoTooltip text={t('speechAnalytics.noticeLowSttPctHint', 'Какая доля звонков в окне должна быть с плохим распознаванием. 30 значит: из 10 звонков хотя бы 3 разобраны плохо.')} />
                              </HStack>
                              <Input id={`sa-stt-${notice.id}`} type="number" value={notice.lowSttPct ?? 30} onChange={(event) => patch({ lowSttPct: Number(event.target.value) })} />
                            </VStack>
                            <VStack gap="4" className={cls.row}>
                              <HStack gap="4" align="center">
                                <Label htmlFor={`sa-stt-window-${notice.id}`}>{t('speechAnalytics.settingsAlertWindow', 'Окно, дней')}</Label>
                                <InfoTooltip text={t('speechAnalytics.settingsAlertWindowHint', 'Сколько последних дней сравнивать с таким же периодом перед ними. 7 значит: эта неделя против предыдущей.')} />
                              </HStack>
                              <Input id={`sa-stt-window-${notice.id}`} type="number" value={notice.windowDays ?? 7} onChange={(event) => patch({ windowDays: Number(event.target.value) })} />
                            </VStack>
                            <VStack gap="4" className={cls.row}>
                              <HStack gap="4" align="center">
                                <Label htmlFor={`sa-stt-min-${notice.id}`}>{t('speechAnalytics.settingsAlertMinCalls', 'Мин. звонков')}</Label>
                                <InfoTooltip text={t('speechAnalytics.settingsAlertMinCallsHint', 'Меньше этого числа звонков в окне уведомление не отправится. 5 отсекает случайное падение на одном-двух звонках.')} />
                              </HStack>
                              <Input id={`sa-stt-min-${notice.id}`} type="number" value={notice.minCalls ?? 5} onChange={(event) => patch({ minCalls: Number(event.target.value) })} />
                            </VStack>
                          </HStack>
                        ) : null}
                        {notice.kind === 'budget' ? (
                          <VStack gap="4" className={cls.row}>
                            <HStack gap="4" align="center">
                              <Label htmlFor={`sa-notice-budget-${notice.id}`}>{t('speechAnalytics.settingsBudgetLabel', 'Порог (0 - без лимита)')}</Label>
                              <InfoTooltip text={t('speechAnalytics.noticeBudgetHint', 'Срабатывает, когда сумма стоимости разборов за текущий месяц выше этого числа. 0 отключает порог: уведомление не уйдёт.')} />
                            </HStack>
                            <Input
                              id={`sa-notice-budget-${notice.id}`}
                              type="number"
                              value={notice.softLimit ?? 0}
                              onChange={(event) => patch({ softLimit: Number(event.target.value) || 0 })}
                            />
                          </VStack>
                        ) : null}
                        <Button type="button" variant="outline" onClick={() => void onTestNotice(notice.id)}>
                          {t('speechAnalytics.settingsAlertTest', 'Отправить тест')}
                        </Button>
                      </>
                    ) : null}
                  </VStack>
                </Card>
              );
            })}
            {addingNotice ? (
              <Select
                aria-label={t('speechAnalytics.noticeAddKind', 'Что добавить')}
                value=""
                onChange={(event) => {
                  const kind = event.target.value as SaNoticeKind;
                  if (!kind) return;
                  const id = `notice_${Date.now()}`;
                  const created: SaNotice = kind === 'digest'
                    ? { id, kind, enabled: true, title: t('speechAnalytics.noticeKind.digest', 'Сводка'), reportWindow: 'last_7_days', blocks: defaultDigestBlocks() }
                    : kind === 'csat_drop'
                      ? { id, kind, enabled: true, title: t('speechAnalytics.noticeKind.csat_drop', 'Падение CSAT'), dropPct: 20, windowDays: 7, minCalls: 5 }
                      : kind === 'negative_spike'
                        ? { id, kind, enabled: true, title: t('speechAnalytics.noticeKind.negative_spike', 'Рост негатива'), spikePp: 15, windowDays: 7, minCalls: 5 }
                        : kind === 'budget'
                          ? { id, kind, enabled: true, title: t('speechAnalytics.noticeKind.budget', 'Превышение бюджета'), windowDays: 1, minCalls: 1, softLimit: 0 }
                          : { id, kind, enabled: true, title: t('speechAnalytics.noticeKind.low_stt', 'Плохое распознавание'), lowSttPct: 30, windowDays: 7, minCalls: 5 };
                  setNotices((current) => [...current, created]);
                  setOpenNotices((current) => ({ ...current, [id]: true }));
                  setAddingNotice(false);
                }}
              >
                <option value="">{t('speechAnalytics.noticeAddKind', 'Выберите уведомление')}</option>
                <option value="digest">{t('speechAnalytics.noticeKind.digest', 'Сводка')}</option>
                <option value="csat_drop">{t('speechAnalytics.noticeKind.csat_drop', 'Падение CSAT')}</option>
                <option value="negative_spike">{t('speechAnalytics.noticeKind.negative_spike', 'Рост негатива')}</option>
                <option value="budget">{t('speechAnalytics.noticeKind.budget', 'Превышение бюджета')}</option>
                <option value="low_stt">{t('speechAnalytics.noticeKind.low_stt', 'Плохое распознавание')}</option>
              </Select>
            ) : (
              <Button type="button" variant="outline" onClick={() => setAddingNotice(true)}>
                {t('speechAnalytics.noticeAdd', 'Добавить уведомление')}
              </Button>
            )}
            {notice ? (
              <Text className={notice.tone === 'success' ? cls.noticeSuccess : cls.noticeError}>
                {notice.text}
              </Text>
            ) : null}
            </>
            ) : null}
          </div>
          </VStack>
        </TabsContent>

        <TabsContent value="models">
          <VStack gap="12" max>
            <Text variant="muted" className={cls.hint}>
              {t('speechAnalytics.settingsModelsHint', 'Модели этого проекта. Пустое значение берёт модель кабинета, а если её нет - модель платформы.')}
            </Text>
            <SpeechAnalyticsModelFields
              idPrefix="project-speech"
              providers={speechModels?.providers ?? []}
              sttProviderUid={sttProviderUid}
              llmProviderUid={llmProviderUid}
              onSttChange={setSttProviderUid}
              onLlmChange={setLlmProviderUid}
            />
          </VStack>
        </TabsContent>

        <TabsContent value="versions">
          <VStack gap="12" max>
            <Text variant="muted" className={cls.hint}>
              {t('speechAnalytics.settingsVersionsHint', 'Версия - это сохранённые настройки проекта на момент публикации. Разбор идёт только по текущей. Возврат к прежней версии возвращает её промпт, метрики и темы и снова включает их в разбор.')}
            </Text>
            {(versionsQuery.data ?? []).length === 0 ? (
              <Text variant="muted">{t('speechAnalytics.settingsNoVersions', 'Опубликованных версий ещё нет')}</Text>
            ) : (versionsQuery.data ?? []).map((version) => (
              <div key={version.id} className={cls.nested}>
                <HStack justify="between" align="center" max>
                  <VStack gap="4">
                    <Text className={cls.itemTitle}>
                      {t('speechAnalytics.analysisVersion', { version: version.versionNo, defaultValue: 'Версия {{version}}' })}
                      {version.current ? ` · ${t('speechAnalytics.versionCurrent', 'текущая')}` : ''}
                    </Text>
                    <Text variant="muted">
                      {version.createdAt ? new Date(version.createdAt).toLocaleString() : ''}
                    </Text>
                  </VStack>
                  {version.current ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={restoreState.isLoading}
                      onClick={() => {
                        void restoreVersion({ projectId, versionId: version.id }).unwrap()
                          .then(() => toast.success(t('speechAnalytics.versionRestored', 'Эта версия снова текущая')))
                          .catch(() => toast.error(t('speechAnalytics.versionRestoreFailed', 'Не удалось вернуться к этой версии')));
                      }}
                    >
                      {t('speechAnalytics.versionRestore', 'Вернуться к этой версии')}
                    </Button>
                  )}
                </HStack>
              </div>
            ))}
          </VStack>
        </TabsContent>
        </div>
      </Tabs>
      <div className={cls.footer}>
        {createsVersion ? (
          <HStack gap="8" align="center">
            <Checkbox id="sa-settings-skip-publish" checked={skipPublish} onChange={() => setSkipPublish((value) => !value)} />
            <Label htmlFor="sa-settings-skip-publish">{t('speechAnalytics.skipPublish', 'Не публиковать')}</Label>
          </HStack>
        ) : <span />}
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
          {editedSchedule ? (
          <VStack gap="8">
            <Label>{t('speechAnalytics.settingsDigestSchedule', 'Расписание')}</Label>
            <Select value={editedSchedule.schedule} onChange={(e) => patchSchedule({ schedule: e.target.value as SaDigestSchedule['schedule'] })}>
              <option value="daily">{t('speechAnalytics.settingsDigestDaily', 'Каждый день')}</option>
              <option value="weekly">{t('speechAnalytics.settingsDigestWeekly', 'Раз в неделю')}</option>
              <option value="monthly">{t('speechAnalytics.settingsDigestMonthly', 'Раз в месяц')}</option>
            </Select>
            {editedSchedule.schedule === 'weekly' ? (
              <Select aria-label={t('speechAnalytics.settingsDigestWeekday', 'День недели')} value={String(editedSchedule.weeklyDay ?? 1)} onChange={(e) => patchSchedule({ weeklyDay: Number(e.target.value) })}>
                {WEEKDAY_INDEXES.map((day) => (
                  <option key={day} value={String(day)}>
                    {t(`speechAnalytics.settingsDigestWeekdayName.${day}`, WEEKDAY_NAME_FALLBACK[day])}
                  </option>
                ))}
              </Select>
            ) : null}
            {editedSchedule.schedule === 'monthly' ? (
              <>
                <Label htmlFor="sa-settings-month-day">{t('speechAnalytics.settingsDigestMonthDay', 'Число месяца')}</Label>
                <Select
                  id="sa-settings-month-day"
                  value={String(editedSchedule.monthlyDay ?? 1)}
                  onChange={(e) => patchSchedule({ monthlyDay: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })}
                >
                  {MONTH_DAY_INDEXES.map((day) => (
                    <option key={day} value={String(day)}>{day}</option>
                  ))}
                </Select>
              </>
            ) : null}
            <Label>{t('speechAnalytics.settingsDigestHour', 'Час отправки (0-23)')}</Label>
            <Input type="number" value={editedSchedule.sendHour ?? 9} onChange={(e) => patchSchedule({ sendHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })} />
          </VStack>
          ) : null}
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
