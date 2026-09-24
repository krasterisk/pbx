import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  SA_DEFAULT_SCALES,
  SA_INDUSTRY_TEMPLATES,
  SA_WEBHOOK_EVENTS,
  applyIndustryTemplate,
  defaultSaProjectConfig,
  type SaIndustryTemplateId,
  type SaProjectConfigV1,
  type SaWebhookEvent,
} from '@krasterisk/shared';
import {
  Button,
  InfoTooltip,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useGetNotificationsQuery } from '@/shared/api/endpoints/notificationApi';
import {
  useGetSaProjectsQuery,
  usePublishSaProjectMutation,
  useTestSaProjectWebhookMutation,
  useUpdateSaProjectDraftMutation,
} from '../api/speechAnalyticsApi';
import cls from './MetricEditor.module.scss';

export type MetricEditorProps = {
  projectId: string;
  /** D-38 partial: model overrides visible only when tenant right is on (full gating in 18-15). */
  canEditModels?: boolean;
};

const TAB_IDS = [
  'templates',
  'metrics',
  'scales',
  'prompt',
  'topics',
  'webhook',
  'digest',
  'alerts',
  'budget',
  'models',
] as const;

type TabId = (typeof TAB_IDS)[number];

const TAB_LABELS: Record<TabId, string> = {
  templates: 'Шаблоны',
  metrics: 'Метрики',
  scales: 'Шкалы',
  prompt: 'Промпт',
  topics: 'Темы',
  webhook: 'Вебхук',
  digest: 'Дайджест',
  alerts: 'Алерты',
  budget: 'Бюджет',
  models: 'Модели',
};

export const MetricEditor = memo(({ projectId, canEditModels = false }: MetricEditorProps) => {
  const { t } = useTranslation();
  const projectsQuery = useGetSaProjectsQuery();
  const [saveDraft, saveState] = useUpdateSaProjectDraftMutation();
  const [publishProject, publishState] = usePublishSaProjectMutation();
  const [testWebhook, testState] = useTestSaProjectWebhookMutation();
  const { data: integrations = [] } = useGetNotificationsQuery();

  const project = useMemo(
    () => (projectsQuery.data ?? []).find((row) => row.id === projectId),
    [projectId, projectsQuery.data],
  );

  const [config, setConfig] = useState<SaProjectConfigV1>(defaultSaProjectConfig());
  const [revision, setRevision] = useState(1);
  const [tab, setTab] = useState<TabId>('templates');
  const [saveError, setSaveError] = useState(false);
  const [publishError, setPublishError] = useState(false);
  const [topicsText, setTopicsText] = useState('');
  const [headersText, setHeadersText] = useState('{}');
  const [metricName, setMetricName] = useState('');
  const [metricType, setMetricType] = useState<'boolean' | 'number' | 'enum'>('boolean');
  const [hydratedId, setHydratedId] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    const hydrateKey = `${project.id}:${project.draft_revision}`;
    if (hydratedId === hydrateKey) return;
    const next = project.draft_config ?? defaultSaProjectConfig();
    setConfig(next);
    setRevision(project.draft_revision);
    setTopicsText(next.topics.join(', '));
    setHeadersText(JSON.stringify(next.eventWebhook.headers ?? {}, null, 2));
    setHydratedId(hydrateKey);
  }, [hydratedId, project]);

  const busy = saveState.isLoading || publishState.isLoading;
  const visibleTabs = canEditModels ? TAB_IDS : TAB_IDS.filter((id) => id !== 'models');

  const patchConfig = (partial: Partial<SaProjectConfigV1>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const onSaveDraft = async () => {
    setSaveError(false);
    let headers: Record<string, string> = {};
    try {
      headers = JSON.parse(headersText) as Record<string, string>;
    } catch {
      toast.error(t('speechAnalytics.webhookHeadersInvalid', 'Заголовки вебхука должны быть JSON-объектом'));
      return;
    }
    const next: SaProjectConfigV1 = {
      ...config,
      topics: topicsText.split(',').map((v) => v.trim()).filter(Boolean),
      eventWebhook: { ...config.eventWebhook, headers },
    };
    try {
      const saved = await saveDraft({
        id: projectId,
        expectedRevision: revision,
        config: next,
      }).unwrap();
      setConfig(saved.draft_config ?? next);
      setRevision(saved.draft_revision);
      toast.success(t('speechAnalytics.draftSaved', 'Черновик сохранён'));
    } catch {
      setSaveError(true);
      toast.error(t('speechAnalytics.saveFailed', 'Не удалось сохранить'));
    }
  };

  const onPublish = async () => {
    setPublishError(false);
    try {
      await publishProject({ id: projectId, operationKey: crypto.randomUUID() }).unwrap();
      toast.success(t('speechAnalytics.projectPublished', 'Проект опубликован'));
    } catch {
      setPublishError(true);
      toast.error(t('speechAnalytics.publishFailed', 'Не удалось опубликовать проект'));
    }
  };

  const toggleScale = (scaleId: string, hidden: boolean) => {
    const set = new Set(config.hiddenDefaultScales);
    if (hidden) set.add(scaleId);
    else set.delete(scaleId);
    patchConfig({ hiddenDefaultScales: [...set] });
  };

  const addCustomMetric = () => {
    const name = metricName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64);
    patchConfig({
      customMetrics: [
        ...config.customMetrics,
        { id: id || `metric_${config.customMetrics.length + 1}`, name, type: metricType },
      ],
    });
    setMetricName('');
  };

  const toggleIntegration = (uid: number, target: 'digest' | 'alerts') => {
    if (target === 'digest') {
      const set = new Set(config.digest.integrationUids);
      if (set.has(uid)) set.delete(uid);
      else set.add(uid);
      patchConfig({ digest: { ...config.digest, integrationUids: [...set] } });
      return;
    }
    const set = new Set(config.alerts.integrationUids);
    if (set.has(uid)) set.delete(uid);
    else set.add(uid);
    patchConfig({ alerts: { ...config.alerts, integrationUids: [...set] } });
  };

  const toggleWebhookEvent = (event: SaWebhookEvent) => {
    const set = new Set(config.eventWebhook.events);
    if (set.has(event)) set.delete(event);
    else set.add(event);
    patchConfig({
      eventWebhook: { ...config.eventWebhook, events: [...set] as SaWebhookEvent[] },
    });
  };

  if (projectsQuery.isLoading && !project) {
    return (
      <Flex align="center" justify="center" className={cls.loading} data-testid="sa-metric-editor-loading">
        <Loader2 size={24} className={cls.spinner} />
      </Flex>
    );
  }

  if (!project) {
    return (
      <VStack gap="12" max data-testid="sa-metric-editor-missing">
        <Text>{t('speechAnalytics.projectNotFound', 'Проект не найден')}</Text>
      </VStack>
    );
  }

  return (
    <VStack gap="16" max className={cls.shell} data-testid="sa-metric-editor">
      <Flex justify="between" align="center" max className={cls.toolbar}>
        <VStack gap="4">
          <Text variant="h2" as="h2">{project.name}</Text>
          <Text variant="muted">
            {t('speechAnalytics.draftHint', 'Черновик не влияет на звонки до публикации')}
          </Text>
        </VStack>
        <HStack gap="8" className={cls.actions}>
          <Button type="button" variant="outline" onClick={() => void onSaveDraft()} disabled={busy}>
            {saveState.isLoading ? <Loader2 size={16} className={cls.spinner} /> : null}
            {t('speechAnalytics.saveDraft', 'Сохранить черновик')}
          </Button>
          <Button
            type="button"
            onClick={() => void onPublish()}
            disabled={busy || saveState.isLoading}
            data-testid="sa-publish-project"
          >
            {t('speechAnalytics.publishProject', 'Опубликовать проект')}
          </Button>
        </HStack>
      </Flex>

      {saveError ? (
        <VStack gap="8" max data-testid="sa-save-error">
          <Text>{t('speechAnalytics.saveFailed', 'Не удалось сохранить')}</Text>
          <Button type="button" variant="outline" onClick={() => void onSaveDraft()}>
            {t('speechAnalytics.retry', 'Повторить')}
          </Button>
        </VStack>
      ) : null}

      {publishError ? (
        <VStack gap="8" max data-testid="sa-publish-error">
          <Text>{t('speechAnalytics.publishFailed', 'Не удалось опубликовать проект')}</Text>
          <Button type="button" variant="outline" onClick={() => void onPublish()}>
            {t('speechAnalytics.retry', 'Повторить')}
          </Button>
        </VStack>
      ) : null}

      <VStack gap="12" max className={cls.tabs}>
        <div
          className={cls.tabsScroll}
          role="tablist"
          aria-label={t('speechAnalytics.editorTabs', 'Разделы редактора')}
        >
          <HStack gap="8" className={cls.tabRow}>
            {visibleTabs.map((id) => (
              <Button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                variant={tab === id ? 'default' : 'outline'}
                onClick={() => setTab(id)}
              >
                {t(`speechAnalytics.editorTab.${id}`, TAB_LABELS[id])}
              </Button>
            ))}
          </HStack>
        </div>

        <div className={cls.formBody}>
          {tab === 'templates' ? (
            <VStack gap="12" max data-testid="sa-section-templates" className={cls.tabPanel}>
              <HStack gap="8" align="center">
                <Text variant="h3" as="h3">{t('speechAnalytics.templatesTitle', 'Отраслевые шаблоны')}</Text>
                <InfoTooltip text={t('speechAnalytics.templatesTooltip', 'Шаблон заполняет черновик. Неопубликованные правки на звонки не влияют.')} />
              </HStack>
              <HStack gap="8" className={cls.templateGrid}>
                {SA_INDUSTRY_TEMPLATES.map((templateId) => (
                  <Button
                    key={templateId}
                    type="button"
                    variant={config.templateId === templateId ? 'default' : 'outline'}
                    data-testid={`sa-template-${templateId}`}
                    onClick={() => setConfig((prev) => applyIndustryTemplate(templateId as SaIndustryTemplateId, prev))}
                  >
                    {t(`speechAnalytics.template.${templateId}`, templateId)}
                  </Button>
                ))}
              </HStack>
            </VStack>
          ) : null}

          {tab === 'metrics' ? (
            <VStack gap="12" max data-testid="sa-section-custom-metrics" className={cls.tabPanel}>
              <Text variant="h3" as="h3">{t('speechAnalytics.customMetricsTitle', 'Свои метрики')}</Text>
              <HStack gap="8" align="end" className={cls.metricRow}>
                <VStack gap="4" className={cls.grow}>
                  <Label htmlFor="sa-metric-name">{t('speechAnalytics.metricWhat', 'Что проверять')}</Label>
                  <Input id="sa-metric-name" value={metricName} onChange={(e) => setMetricName(e.target.value)} />
                </VStack>
                <VStack gap="4">
                  <Label htmlFor="sa-metric-type">{t('speechAnalytics.metricType', 'Тип')}</Label>
                  <Select
                    id="sa-metric-type"
                    value={metricType}
                    onChange={(e) => setMetricType(e.target.value as typeof metricType)}
                  >
                    <option value="boolean">{t('speechAnalytics.metricBoolean', 'Да / нет')}</option>
                    <option value="number">{t('speechAnalytics.metricNumber', 'Число')}</option>
                    <option value="enum">{t('speechAnalytics.metricEnum', 'Варианты')}</option>
                  </Select>
                </VStack>
                <Button type="button" onClick={addCustomMetric}>
                  {t('speechAnalytics.addMetric', 'Добавить метрику')}
                </Button>
              </HStack>
              {config.customMetrics.map((metric) => (
                <Text key={metric.id} variant="muted">{metric.name} ({metric.type})</Text>
              ))}
            </VStack>
          ) : null}

          {tab === 'scales' ? (
            <VStack gap="12" max data-testid="sa-section-scales" className={cls.tabPanel}>
              <HStack gap="8" align="center">
                <Text variant="h3" as="h3">{t('speechAnalytics.scalesTitle', 'Шкалы')}</Text>
                <InfoTooltip text={t('speechAnalytics.scalesTooltip', 'Скрытые стандартные шкалы не участвуют в оценке.')} />
              </HStack>
              {SA_DEFAULT_SCALES.map((scaleId) => {
                const hidden = config.hiddenDefaultScales.includes(scaleId);
                return (
                  <HStack key={scaleId} justify="between" align="center" max>
                    <Text>{t(`speechAnalytics.scale.${scaleId}`, scaleId)}</Text>
                    <Switch
                      checked={!hidden}
                      onCheckedChange={(visible) => toggleScale(scaleId, !visible)}
                      aria-label={scaleId}
                    />
                  </HStack>
                );
              })}
            </VStack>
          ) : null}

          {tab === 'prompt' ? (
            <VStack gap="12" max data-testid="sa-section-system-prompt" className={cls.tabPanel}>
              <Text variant="h3" as="h3">{t('speechAnalytics.systemPromptTitle', 'Системный промпт')}</Text>
              <Textarea
                value={config.systemPrompt}
                onChange={(e) => patchConfig({ systemPrompt: e.target.value })}
                rows={8}
                className={cls.wrapTextarea}
              />
            </VStack>
          ) : null}

          {tab === 'topics' ? (
            <VStack gap="12" max data-testid="sa-section-topics" className={cls.tabPanel}>
              <Text variant="h3" as="h3">{t('speechAnalytics.topicsTitle', 'Темы звонка')}</Text>
              <Textarea
                value={topicsText}
                onChange={(e) => setTopicsText(e.target.value)}
                rows={4}
                className={cls.wrapTextarea}
                aria-label={t('speechAnalytics.topicsTitle', 'Темы звонка')}
              />
            </VStack>
          ) : null}

          {tab === 'webhook' ? (
            <VStack gap="12" max data-testid="sa-section-webhook" className={cls.tabPanel}>
              <Text variant="h3" as="h3">{t('speechAnalytics.webhookTitle', 'Вебхук событий')}</Text>
              <Label htmlFor="sa-webhook-url">{t('speechAnalytics.webhookUrl', 'URL')}</Label>
              <Input
                id="sa-webhook-url"
                value={config.eventWebhook.url ?? ''}
                onChange={(e) =>
                  patchConfig({
                    eventWebhook: { ...config.eventWebhook, url: e.target.value || null },
                  })
                }
              />
              <Label htmlFor="sa-webhook-headers">{t('speechAnalytics.webhookHeaders', 'Заголовки (JSON)')}</Label>
              <Textarea
                id="sa-webhook-headers"
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                rows={6}
                className={cls.wrapTextarea}
              />
              <VStack gap="8" max>
                {SA_WEBHOOK_EVENTS.map((event) => (
                  <HStack key={event} gap="8" align="center">
                    <Switch
                      checked={config.eventWebhook.events.includes(event)}
                      onCheckedChange={() => toggleWebhookEvent(event)}
                      aria-label={event}
                    />
                    <Text>{event}</Text>
                  </HStack>
                ))}
              </VStack>
              <Button
                type="button"
                variant="outline"
                disabled={testState.isLoading}
                onClick={() => void testWebhook({ id: projectId })}
              >
                {t('speechAnalytics.testWebhook', 'Проверить вебхук')}
              </Button>
            </VStack>
          ) : null}

          {tab === 'digest' ? (
            <VStack gap="12" max data-testid="sa-section-digest" className={cls.tabPanel}>
              <Text variant="h3" as="h3">{t('speechAnalytics.digestTitle', 'Дайджест')}</Text>
              <HStack gap="8" align="center">
                <Switch
                  checked={config.digest.enabled}
                  onCheckedChange={(enabled) => patchConfig({ digest: { ...config.digest, enabled } })}
                />
                <Text>{t('speechAnalytics.digestEnabled', 'Включить дайджест')}</Text>
              </HStack>
              {integrations.length === 0 ? (
                <Text>
                  {t('speechAnalytics.noIntegrations', 'Нет интеграций.')}{' '}
                  <Link to="/integrations" className={cls.integrationsLink}>
                    {t('speechAnalytics.openIntegrations', 'Интеграции')}
                  </Link>
                </Text>
              ) : (
                integrations.map((row) => (
                  <HStack key={row.uid} gap="8" align="center">
                    <Switch
                      checked={config.digest.integrationUids.includes(row.uid)}
                      onCheckedChange={() => toggleIntegration(row.uid, 'digest')}
                      aria-label={row.name}
                    />
                    <Text>{row.name}</Text>
                  </HStack>
                ))
              )}
            </VStack>
          ) : null}

          {tab === 'alerts' ? (
            <VStack gap="12" max data-testid="sa-section-alerts" className={cls.tabPanel}>
              <Text variant="h3" as="h3">{t('speechAnalytics.alertsTitle', 'Алерты')}</Text>
              <HStack gap="8" align="center">
                <Switch
                  checked={config.alerts.enabled}
                  onCheckedChange={(enabled) => patchConfig({ alerts: { ...config.alerts, enabled } })}
                />
                <Text>{t('speechAnalytics.alertsEnabled', 'Включить алерты')}</Text>
              </HStack>
              {integrations.length === 0 ? (
                <Text>
                  {t('speechAnalytics.noIntegrations', 'Нет интеграций.')}{' '}
                  <Link to="/integrations" className={cls.integrationsLink}>
                    {t('speechAnalytics.openIntegrations', 'Интеграции')}
                  </Link>
                </Text>
              ) : (
                integrations.map((row) => (
                  <HStack key={row.uid} gap="8" align="center">
                    <Switch
                      checked={config.alerts.integrationUids.includes(row.uid)}
                      onCheckedChange={() => toggleIntegration(row.uid, 'alerts')}
                      aria-label={row.name}
                    />
                    <Text>{row.name}</Text>
                  </HStack>
                ))
              )}
            </VStack>
          ) : null}

          {tab === 'budget' ? (
            <VStack gap="12" max data-testid="sa-section-budget" className={cls.tabPanel}>
              <Text variant="h3" as="h3">{t('speechAnalytics.budgetTitle', 'Бюджет')}</Text>
              <Label htmlFor="sa-budget-limit">
                {t('speechAnalytics.budgetSoftLimit', 'Мягкий лимит (0 - без лимита)')}
              </Label>
              <Input
                id="sa-budget-limit"
                type="number"
                min={0}
                value={String(config.budget.softLimit)}
                onChange={(e) =>
                  patchConfig({ budget: { softLimit: Number(e.target.value) || 0 } })
                }
              />
            </VStack>
          ) : null}

          {tab === 'models' && canEditModels ? (
            <VStack gap="12" max data-testid="sa-section-models" className={cls.tabPanel}>
              <Text variant="h3" as="h3">{t('speechAnalytics.modelsTitle', 'Модели проекта')}</Text>
              <Label htmlFor="sa-stt-model">{t('speechAnalytics.sttModel', 'Модель распознавания')}</Label>
              <Input
                id="sa-stt-model"
                value={config.sttModelId ?? ''}
                onChange={(e) => patchConfig({ sttModelId: e.target.value || null })}
              />
              <Label htmlFor="sa-score-model">{t('speechAnalytics.scoreModel', 'Модель оценок')}</Label>
              <Input
                id="sa-score-model"
                value={config.scoreModelId ?? ''}
                onChange={(e) => patchConfig({ scoreModelId: e.target.value || null })}
              />
            </VStack>
          ) : null}
        </div>
      </VStack>
    </VStack>
  );
});

MetricEditor.displayName = 'MetricEditor';
