import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Lock, PenLine, Plus, SlidersHorizontal, Trash2,
} from 'lucide-react';
import {
  SA_DEFAULT_SCALES,
  allBuiltinScaleMetrics,
  applyIndustryTemplate,
  builtinScaleMetric,
  defaultSaProjectConfig,
  type SaCallTagDef,
  type SaDefaultScaleId,
  type SaMetricPolarity,
  type SaProjectConfigV1,
  type SaProjectMetric,
} from '@krasterisk/shared';
import {
  Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Input, Label, Select, Text, Textarea,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import cls from './ProjectWizard.module.scss';

type SetupMode = 'prompt' | 'manual';

const SCALE_COPY: Record<SaDefaultScaleId, { label: string; description: string }> = {
  greeting_quality: {
    label: 'Качество приветствия',
    description: 'Насколько оператор корректно открыл разговор: вежливое приветствие, представление компании и себя, предложение помощи.',
  },
  script_compliance: {
    label: 'Следование скрипту',
    description: 'Следует ли оператор вашему сценарию и бизнес-правилам: стандартное начало, уточнение запроса, нужные проверки и доведение до результата.',
  },
  politeness_empathy: {
    label: 'Вежливость и эмпатия',
    description: 'Вежливость и уважительный тон: формы вежливости, поддержка при негативе клиента, без грубости и перебиваний.',
  },
  active_listening: {
    label: 'Активное слушание',
    description: 'Слышит ли оператор клиента: уточняющие вопросы, подтверждение понимания, ответы по сути без игнорирования вопросов.',
  },
  objection_handling: {
    label: 'Работа с возражениями',
    description: 'Как оператор отрабатывает сомнения и отказы. Если возражений не было, оценка максимальная.',
  },
  product_knowledge: {
    label: 'Знание продукта',
    description: 'Насколько уверенно и точно оператор отвечает по продукту, тарифам и процедурам.',
  },
  problem_resolution: {
    label: 'Решение проблемы',
    description: 'Довёл ли оператор обращение до результата: понял проблему, сделал действия и подтвердил итог или следующий шаг.',
  },
  speech_clarity_pace: {
    label: 'Темп речи',
    description: 'Понятность речи по транскрипту: связные реплики, чёткие имена, даты и числа.',
  },
  closing_quality: {
    label: 'Качество завершения',
    description: 'Как оператор завершил звонок: краткий итог, вопрос о дополнительной помощи, благодарность и прощание.',
  },
};

const LOCKED = [
  { id: 'average_score', label: 'Средняя оценка', description: 'Средний балл по включённым метрикам качества за звонок.' },
  { id: 'sentiment', label: 'Настроение', description: 'Эмоциональный настрой клиента в разговоре: позитивный, нейтральный или негативный.' },
  { id: 'summary', label: 'Саммари', description: 'Краткое резюме звонка: о чём говорили и чем закончилось обращение.' },
];

type Step = 1 | 2 | 3;

export type ProjectWizardProps = {
  onSubmit: (name: string, config: SaProjectConfigV1) => void;
  onCancel: () => void;
  /** Prompt mode creates a draft and continues metric setup in the assistant chat. */
  onContinueInChat?: (name: string, prompt: string, description: string) => void;
  submitting?: boolean;
};

function slugId(name: string): string {
  const id = name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_|_$/g, '');
  return id || `metric_${Date.now()}`;
}

export const ProjectWizard = memo(({ onSubmit, onCancel, onContinueInChat, submitting = false }: ProjectWizardProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<SetupMode | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [visible, setVisible] = useState<SaDefaultScaleId[]>([...SA_DEFAULT_SCALES]);
  const [custom, setCustom] = useState<SaProjectMetric[]>([]);
  const [topics, setTopics] = useState<SaCallTagDef[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingMetricDelete, setPendingMetricDelete] = useState<number | null>(null);
  const [aliasDraft, setAliasDraft] = useState<Record<string, string>>({});

  const chooseManual = () => {
    const next = applyIndustryTemplate('custom');
    setMode('manual');
    setSystemPrompt(next.systemPrompt);
    setVisible(next.metrics.flatMap((m) => (m.sourceScaleId ? [m.sourceScaleId] : [])));
    setCustom(next.metrics.filter((m) => !m.sourceScaleId));
    setTopics(next.callTaxonomy ?? []);
  };

  const choosePrompt = () => {
    setMode('prompt');
    setVisible([]);
    setCustom([]);
    setTopics([]);
  };

  const toggleScale = (id: SaDefaultScaleId) => {
    setVisible((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  };

  const promptPreview = useMemo(() => {
    const lines = [
      systemPrompt ? `[System Context]\n${systemPrompt}` : '',
      '[Default Metrics]',
      ...visible.map((id) => `  - ${id}`),
      custom.length ? '[Custom Metrics]' : '',
      ...custom.map((m) => `  - ${m.id} (${m.type}): ${m.description || '-'}`),
    ];
    return lines.filter(Boolean).join('\n');
  }, [custom, systemPrompt, visible]);

  const submit = () => {
    const scales = visible.map((id) => builtinScaleMetric(id));
    const hidden = allBuiltinScaleMetrics().map((m) => m.id).filter((id) => !visible.includes(id as SaDefaultScaleId));
    const config: SaProjectConfigV1 = {
      ...defaultSaProjectConfig(),
      templateId: 'custom',
      description,
      systemPrompt,
      metrics: [...scales, ...custom],
      callTaxonomy: topics,
      customMetrics: custom.filter((m) => m.type !== 'string').map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type as 'boolean' | 'number' | 'enum',
        description: m.description,
        enumValues: m.enumValues,
        min: m.min,
        max: m.max,
        unit: m.unit,
        polarity: m.polarity,
      })),
      hiddenDefaultScales: hidden,
    };
    onSubmit(name.trim(), config);
  };

  const canNext = step === 1
    ? Boolean(name.trim() && mode && (mode === 'manual' || systemPrompt.trim()))
    : step === 2
      ? visible.length > 0 || custom.length > 0
      : true;

  const goNext = async () => {
    if (step !== 1) {
      setStep(3);
      return;
    }
    if (mode === 'prompt') {
      onContinueInChat?.(name.trim(), systemPrompt.trim(), description.trim());
      return;
    }
    setStep(2);
  };
  const pendingTopic = pendingDelete != null ? topics[pendingDelete] : undefined;

  const confirmDeleteTopic = () => {
    if (pendingDelete == null) return;
    const removed = topics[pendingDelete];
    setTopics((prev) => prev.filter((_, i) => i !== pendingDelete));
    if (removed) {
      setAliasDraft((prev) => {
        const next = { ...prev };
        delete next[removed.id];
        return next;
      });
    }
    setPendingDelete(null);
  };

  const pendingMetric = pendingMetricDelete != null ? custom[pendingMetricDelete] : undefined;

  const confirmDeleteMetric = () => {
    if (pendingMetricDelete == null) return;
    setCustom((prev) => prev.filter((_, i) => i !== pendingMetricDelete));
    setPendingMetricDelete(null);
  };

  return (
    <>
    <div className={cls.shell}>
      <DialogHeader className={cls.header}>
        <DialogTitle>{name.trim() || t('speechAnalytics.newProjectDefault', 'Новый проект')}</DialogTitle>
        <Text variant="muted">
          {t('speechAnalytics.wizardStepProgress', { step, defaultValue: 'Шаг {{step}} из 3' })}
        </Text>
      </DialogHeader>
      <div className={cls.body}>
        {mode === 'prompt' ? null : (
        <div className={cls.phases} role="tablist">
          {([1, 2, 3] as Step[]).map((id, index) => {
            const done = step > id;
            const label = id === 1
              ? t('speechAnalytics.wizardStepName', 'Название')
              : id === 2
                ? t('speechAnalytics.wizardStepMetrics', 'Метрики')
                : t('speechAnalytics.wizardStepTopics', 'Темы');
            return (
              <div key={id} className={cls.phaseItem}>
                {index > 0 ? <span className={cls.connector} /> : null}
                <button
                  type="button"
                  role="tab"
                  aria-selected={step === id}
                  className={`${cls.phaseStep} ${step === id ? cls.phaseActive : ''} ${done ? cls.phaseDone : ''}`}
                  disabled={!done && step !== id}
                  onClick={() => { if (done) setStep(id); }}
                >
                  <span className={cls.marker} aria-hidden>
                    {done ? <Check size={16} strokeWidth={2.5} /> : id}
                  </span>
                  {label}
                </button>
              </div>
            );
          })}
        </div>
        ) : null}

        {step === 1 ? (
          <VStack gap="16" max className={cls.step}>
            <VStack gap="4" max>
              <Label htmlFor="sa-wizard-name">{t('speechAnalytics.projectName', 'Название проекта')}</Label>
              <Input id="sa-wizard-name" value={name} onChange={(e) => setName(e.target.value)} />
            </VStack>
            <VStack gap="4" max>
              <Label htmlFor="sa-wizard-description">{t('speechAnalytics.wizardProjectDescription', 'Описание проекта')}</Label>
              <Input id="sa-wizard-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </VStack>
            <Text variant="muted">{t('speechAnalytics.wizardHint', 'Опишите, что оценивать в звонках, или настройте метрики и темы вручную.')}</Text>
            <Text>{t('speechAnalytics.wizardPickSetup', 'Как настроить проект')}</Text>
            <div className={cls.templateGrid}>
              <Card
                className={`${cls.templateCard} ${mode === 'prompt' ? cls.templateSelected : ''}`}
                onClick={choosePrompt}
              >
                <VStack gap="8" align="center" className={cls.templateBody}>
                  <span className={cls.templateIcon}><PenLine size={22} /></span>
                  <Text>{t('speechAnalytics.wizardModePrompt', 'Произвольный промпт')}</Text>
                  <Text variant="muted">{t('speechAnalytics.wizardModePromptHint', 'Опишите задачу своими словами. Дальше метрики и темы настраиваются в чате с помощником.')}</Text>
                </VStack>
              </Card>
              <Card
                className={`${cls.templateCard} ${mode === 'manual' ? cls.templateSelected : ''}`}
                onClick={chooseManual}
              >
                <VStack gap="8" align="center" className={cls.templateBody}>
                  <span className={cls.templateIcon}><SlidersHorizontal size={22} /></span>
                  <Text>{t('speechAnalytics.wizardModeManual', 'Ручная настройка')}</Text>
                  <Text variant="muted">{t('speechAnalytics.wizardModeManualHint', 'Как шаблон «Свой»: готовые метрики качества, свои метрики и темы добавляете сами.')}</Text>
                </VStack>
              </Card>
            </div>
            {mode === 'prompt' ? (
              <VStack gap="4" max>
                <Label htmlFor="sa-wizard-prompt">{t('speechAnalytics.wizardPromptLabel', 'Промпт')}</Label>
                <Textarea
                  id="sa-wizard-prompt"
                  rows={6}
                  value={systemPrompt}
                  placeholder={t('speechAnalytics.wizardPromptPlaceholder', 'Например: оценивать приветствие, решение вопроса и обещание перезвонить. Темы: доставка, оплата, возврат.')}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                  }}
                />
              </VStack>
            ) : null}
          </VStack>
        ) : null}

        {step === 2 ? (
          <VStack gap="16" max className={cls.step}>
            <Text>{t('speechAnalytics.wizardPickMetrics', 'Выберите метрики для отображения в дашборде')}</Text>
            <Text variant="muted">{t('speechAnalytics.wizardMetricHint', 'Каждая метрика оценивается ИИ по шкале 0-100. Включайте только то, что важно для контроля качества в вашем проекте.')}</Text>
            <Text>{t('speechAnalytics.wizardAlwaysOn', 'Всегда активны')}</Text>
            {LOCKED.map((row) => (
              <HStack key={row.id} gap="12" align="start" className={cls.metricRow}>
                <Lock size={16} />
                <Checkbox checked disabled aria-label={row.label} />
                <VStack gap="4" className={cls.grow}>
                  <Text>{row.label}</Text>
                  <Text variant="muted">{row.description}</Text>
                </VStack>
              </HStack>
            ))}
            <Text>{t('speechAnalytics.wizardOptionalMetrics', 'Опциональные метрики')}</Text>
            {SA_DEFAULT_SCALES.map((id) => {
              const copy = SCALE_COPY[id];
              return (
                <HStack key={id} gap="12" align="start" className={cls.metricRow}>
                  <Checkbox
                    checked={visible.includes(id)}
                    onChange={() => toggleScale(id)}
                    aria-label={copy.label}
                  />
                  <VStack gap="4" className={cls.grow}>
                    <Text>{copy.label}</Text>
                    <Text variant="muted">{copy.description}</Text>
                  </VStack>
                </HStack>
              );
            })}
            <Button type="button" variant="outline" onClick={() => setCustomOpen((v) => !v)}>
              {t('speechAnalytics.wizardCustomMetrics', 'Кастомные метрики')}
              {customOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
            {customOpen ? (
              <VStack gap="8" max>
                {custom.map((metric, index) => (
                  <Card key={`${metric.id}-${index}`}>
                    <VStack gap="8" max>
                      <HStack justify="between" max>
                        <Text>{metric.name || t('speechAnalytics.wizardNewMetric', 'Новая метрика')}</Text>
                        <Button type="button" variant="outline" onClick={() => setPendingMetricDelete(index)}>
                          <Trash2 size={14} />
                          {t('common.delete', 'Удалить')}
                        </Button>
                      </HStack>
                      <Label>{t('speechAnalytics.wizardMetricName', 'Название метрики')}</Label>
                      <Input
                        value={metric.name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCustom((prev) => prev.map((row, i) => (i === index ? { ...row, name: value, id: slugId(value) } : row)));
                        }}
                      />
                      <Label>{t('speechAnalytics.wizardMetricType', 'Тип метрики')}</Label>
                      <Select
                        value={metric.type}
                        onChange={(e) => {
                          const type = e.target.value as SaProjectMetric['type'];
                          setCustom((prev) => prev.map((row, i) => (i === index ? { ...row, type } : row)));
                        }}
                      >
                        <option value="boolean">Boolean (Да/Нет)</option>
                        <option value="number">Number (Число)</option>
                        <option value="enum">Enum (Список)</option>
                        <option value="string">String (Текст)</option>
                      </Select>
                      {metric.type === 'enum' ? (
                        <>
                          <Label>{t('speechAnalytics.wizardEnumValues', 'Значения (через запятую)')}</Label>
                          <Input
                            value={(metric.enumValues ?? []).join(', ')}
                            onChange={(e) => {
                              const enumValues = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                              setCustom((prev) => prev.map((row, i) => (i === index ? { ...row, enumValues } : row)));
                            }}
                          />
                        </>
                      ) : null}
                      {metric.type === 'number' ? (
                        <HStack gap="8" align="end">
                          <VStack gap="4" className={cls.grow}>
                            <Label>{t('speechAnalytics.settingsScaleFrom', 'От')}</Label>
                            <Input
                              aria-label={t('speechAnalytics.settingsScaleFrom', 'От')}
                              value={metric.min ?? ''}
                              onChange={(e) => setCustom((prev) => prev.map((row, i) => (i === index ? { ...row, min: e.target.value === '' ? undefined : Number(e.target.value) } : row)))}
                            />
                          </VStack>
                          <VStack gap="4" className={cls.grow}>
                            <Label>{t('speechAnalytics.settingsScaleTo', 'До')}</Label>
                            <Input
                              aria-label={t('speechAnalytics.settingsScaleTo', 'До')}
                              value={metric.max ?? ''}
                              onChange={(e) => setCustom((prev) => prev.map((row, i) => (i === index ? { ...row, max: e.target.value === '' ? undefined : Number(e.target.value) } : row)))}
                            />
                          </VStack>
                          <VStack gap="4" className={cls.grow}>
                            <Label>{t('speechAnalytics.wizardUnit', 'Единица')}</Label>
                            <Input
                              aria-label={t('speechAnalytics.wizardUnit', 'Единица')}
                              value={metric.unit ?? ''}
                              placeholder="%"
                              onChange={(e) => setCustom((prev) => prev.map((row, i) => (i === index ? { ...row, unit: e.target.value } : row)))}
                            />
                          </VStack>
                          <VStack gap="4" className={cls.grow}>
                            <Label>{t('speechAnalytics.wizardScore', 'Оценка')}</Label>
                            <Select
                              aria-label={t('speechAnalytics.wizardScore', 'Оценка')}
                              value={metric.polarity ?? 'positive'}
                              onChange={(e) => setCustom((prev) => prev.map((row, i) => (i === index ? { ...row, polarity: e.target.value as SaMetricPolarity } : row)))}
                            >
                              <option value="positive">{t('speechAnalytics.wizardPolarityHigh', 'Больше - лучше')}</option>
                              <option value="negative">{t('speechAnalytics.wizardPolarityLow', 'Меньше - лучше')}</option>
                              <option value="neutral">{t('speechAnalytics.wizardPolarityNeutral', 'Нейтрально (без оценки)')}</option>
                            </Select>
                          </VStack>
                        </HStack>
                      ) : null}
                      {metric.type === 'boolean' ? (
                        <Select
                          aria-label={t('speechAnalytics.wizardBoolScore', 'Оценка значения')}
                          value={metric.polarity ?? 'neutral'}
                          onChange={(e) => setCustom((prev) => prev.map((row, i) => (i === index ? { ...row, polarity: e.target.value as SaMetricPolarity } : row)))}
                        >
                          <option value="positive">«Да» - это хорошо</option>
                          <option value="negative">«Да» - это плохо</option>
                          <option value="neutral">Нейтрально (без оценки)</option>
                        </Select>
                      ) : null}
                      <Label>{t('speechAnalytics.wizardLlmDescription', 'Описание для LLM')}</Label>
                      <Textarea
                        value={metric.description}
                        rows={2}
                        onChange={(e) => setCustom((prev) => prev.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)))}
                      />
                      <Text variant="muted">{metric.description.length}/500</Text>
                    </VStack>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCustom((prev) => [...prev, {
                    id: `metric_${Date.now()}`,
                    name: '',
                    type: 'boolean',
                    description: '',
                    polarity: 'neutral',
                    sourceScaleId: null,
                  }])}
                >
                  <Plus size={16} />
                  {t('speechAnalytics.wizardAddMetric', 'Добавить метрику')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setPromptOpen((v) => !v)}>
                  {t('speechAnalytics.wizardPromptPreview', 'Предпросмотр промпта')}
                  {promptOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>
                {promptOpen ? <Text as="pre">{promptPreview}</Text> : null}
              </VStack>
            ) : null}
          </VStack>
        ) : null}

        {step === 3 ? (
          <VStack gap="16" max className={cls.step}>
            <Text>{t('speechAnalytics.wizardTopicsTitle', 'Темы звонков')}</Text>
            <Text variant="muted">{t('speechAnalytics.wizardTopicsHint', 'Темы - метки для звонков. При анализе ИИ выбирает подходящие темы из справочника по смыслу разговора.')}</Text>
            {topics.length === 0 ? (
              <Text variant="muted">{t('speechAnalytics.wizardTopicsEmpty', 'Добавьте темы - звонки начнут размечаться при следующем анализе.')}</Text>
            ) : null}
            {topics.map((tag, index) => (
              <Card key={tag.id}>
                <VStack gap="8" max>
                  <HStack justify="between" max>
                    <Text>{tag.name || t('speechAnalytics.wizardNewTopic', 'Новая тема')}</Text>
                    <Button type="button" variant="outline" onClick={() => setPendingDelete(index)}>
                      <Trash2 size={14} />
                      {t('common.delete', 'Удалить')}
                    </Button>
                  </HStack>
                  <Label>{t('speechAnalytics.wizardTopicName', 'Название темы')}</Label>
                  <Input value={tag.name} onChange={(e) => setTopics((prev) => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} />
                  <Text variant="muted">{t('speechAnalytics.wizardTopicNameHint', 'Как тема показывается в отчётах, на дашборде и в списке тегов звонка.')}</Text>
                  <Label>{t('speechAnalytics.wizardTopicWhen', 'Описание (когда ставить тему)')}</Label>
                  <Textarea
                    rows={2}
                    value={tag.description ?? ''}
                    placeholder={t('speechAnalytics.wizardTopicWhenPlaceholder', 'например: клиент просит вернуть товар или деньги')}
                    onChange={(e) => setTopics((prev) => prev.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)))}
                  />
                  <Text variant="muted">{t('speechAnalytics.wizardTopicWhenHint', 'Кратко: в каких случаях ставить эту тему. Если пусто - ИИ ориентируется на название.')}</Text>
                  <Label>{t('speechAnalytics.wizardTopicPhrases', 'Формулировки (необязательно)')}</Label>
                  <Input
                    value={aliasDraft[tag.id] ?? tag.aliases.join(', ')}
                    placeholder={t('speechAnalytics.wizardTopicPhrasesPlaceholder', 'например: возврат, вернуть товар, обмен')}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setAliasDraft((prev) => ({ ...prev, [tag.id]: raw }));
                      const aliases = raw.split(',').map((s) => s.trim()).filter(Boolean);
                      setTopics((prev) => prev.map((row, i) => (i === index ? { ...row, aliases } : row)));
                    }}
                  />
                  <Text variant="muted">{t('speechAnalytics.wizardTopicPhrasesHint', 'Необязательно. Типичные фразы из речи - подсказки для ИИ, не обязательное совпадение.')}</Text>
                </VStack>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setTopics((prev) => [...prev, { id: `tag_${Date.now()}`, name: '', aliases: [], description: '' }])}
            >
              <Plus size={16} />
              {t('speechAnalytics.wizardAddTopic', 'Добавить тему')}
            </Button>
          </VStack>
        ) : null}
      </div>
      <DialogFooter className={cls.footer}>
        <HStack gap="8" justify="end" max>
          <Button type="button" variant="outline" onClick={step === 1 ? onCancel : () => setStep((prev) => (prev === 3 ? 2 : 1))}>
            <ArrowLeft size={16} />
            {step === 1 ? t('speechAnalytics.wizardClose', 'Закрыть') : t('speechAnalytics.wizardBack', 'Назад')}
          </Button>
          {step < 3 ? (
            <Button type="button" disabled={!canNext || submitting} onClick={() => { void goNext(); }}>
              {mode === 'prompt'
                ? (submitting
                  ? t('speechAnalytics.wizardSaving', 'Сохранение...')
                  : t('speechAnalytics.wizardOpenChat', 'Открыть чат'))
                : t('speechAnalytics.wizardNext', 'Далее')}
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button type="button" disabled={submitting || !canNext} onClick={submit}>
              {submitting ? t('speechAnalytics.wizardSaving', 'Сохранение...') : t('speechAnalytics.wizardCreate', 'Создать')}
              <Check size={16} />
            </Button>
          )}
        </HStack>
      </DialogFooter>
    </div>
    <Dialog open={pendingDelete != null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('speechAnalytics.wizardDeleteTopicTitle', {
              name: pendingTopic?.name || t('speechAnalytics.wizardNewTopic', 'Новая тема'),
              defaultValue: 'Удалить тему «{{name}}»?',
            })}
          </DialogTitle>
          <DialogDescription>
            {t('speechAnalytics.wizardDeleteTopicBody', 'Звонки, размеченные ранее, сохранят тег. Новые анализы перестанут его получать.')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button type="button" variant="destructive" onClick={confirmDeleteTopic}>
            {t('speechAnalytics.wizardDeleteTopic', 'Удалить тему')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={pendingMetricDelete != null} onOpenChange={(open) => { if (!open) setPendingMetricDelete(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('speechAnalytics.wizardDeleteMetricTitle', {
              name: pendingMetric?.name || t('speechAnalytics.wizardNewMetric', 'Новая метрика'),
              defaultValue: 'Удалить метрику «{{name}}»?',
            })}
          </DialogTitle>
          <DialogDescription>
            {t('speechAnalytics.wizardDeleteMetricBody', 'Метрика не попадёт в набор этого проекта.')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setPendingMetricDelete(null)}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button type="button" variant="destructive" onClick={confirmDeleteMetric}>
            {t('speechAnalytics.wizardDeleteMetric', 'Удалить метрику')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
});

ProjectWizard.displayName = 'ProjectWizard';
