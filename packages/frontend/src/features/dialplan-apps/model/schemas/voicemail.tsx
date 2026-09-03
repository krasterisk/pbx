import { Input, Select, Switch } from '@/shared/ui';
import { useGetNotificationsQuery } from '@/shared/api/endpoints/notificationApi';
import type { FieldSchema, SchemaFieldRenderCtx } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

const RECORD_FLAGS = ['q', 'o', 'x', 'y', 'n', 's', 'u'] as const;

const FLAG_FALLBACK: Record<(typeof RECORD_FLAGS)[number], string> = {
  q: 'q — без гудка перед записью',
  o: 'o — остановить запись по 0',
  x: 'x — игнорировать завершающий #',
  y: 'y — разрешить запись после таймаута',
  n: 'n — не отвечать на канал',
  s: 's — пропустить, если канал не отвечен',
  u: 'u — уникальное имя файла',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readNested(params: Record<string, unknown>, root: string, key: string): unknown {
  return asRecord(params[root])[key];
}

function writeNested(
  params: Record<string, unknown>,
  onChange: (patch: Record<string, unknown>) => void,
  root: string,
  key: string,
  value: unknown,
): void {
  onChange({ [root]: { ...asRecord(params[root]), [key]: value } });
}

function NotifyIntegrationSelect({ params, onChange, readOnly, field }: SchemaFieldRenderCtx) {
  const { data: integrations = [], isLoading } = useGetNotificationsQuery();
  const value = String(readNested(params, 'notify', 'integration_uid') ?? '');

  return (
    <Select
      id={`schema-field-${field.key}`}
      disabled={readOnly || isLoading}
      value={value}
      aria-label={field.label ?? field.labelKey}
      onChange={(e) => writeNested(params, onChange, 'notify', 'integration_uid', e.target.value)}
    >
      <option value="">{isLoading ? '…' : ''}</option>
      {integrations.map((row) => (
        <option key={row.uid} value={String(row.uid)}>
          {row.name}
        </option>
      ))}
    </Select>
  );
}

function NestedText({
  root,
  leaf,
  ctx,
}: {
  root: string;
  leaf: string;
  ctx: SchemaFieldRenderCtx;
}) {
  const raw = readNested(ctx.params, root, leaf);
  return (
    <Input
      id={`schema-field-${ctx.field.key}`}
      aria-label={ctx.field.label ?? ctx.field.labelKey}
      disabled={ctx.readOnly}
      value={typeof raw === 'string' ? raw : ''}
      onChange={(e) => writeNested(ctx.params, ctx.onChange, root, leaf, e.target.value)}
    />
  );
}

function RecordFlagToggle({ flag, ctx }: { flag: (typeof RECORD_FLAGS)[number]; ctx: SchemaFieldRenderCtx }) {
  const raw = readNested(ctx.params, 'record_options', flag);
  return (
    <Switch
      id={`schema-field-${ctx.field.key}`}
      aria-label={ctx.field.label ?? ctx.field.labelKey}
      disabled={ctx.readOnly}
      checked={Boolean(raw)}
      onCheckedChange={(checked) => writeNested(ctx.params, ctx.onChange, 'record_options', flag, checked)}
    />
  );
}

export function summarizeVoicemail(params: Record<string, unknown>, t: TFn): string {
  const duration = Number(params.max_duration ?? 120) || 120;
  const greeting = String(params.greeting ?? '').trim();
  if (greeting) {
    return t('routes.apps.voicemail.summary', 'Голосовая почта {{duration}} с, {{greeting}}')
      .replace('{{duration}}', String(duration))
      .replace('{{greeting}}', greeting);
  }
  return t('routes.apps.voicemail.summaryDefault', 'Голосовая почта {{duration}} с')
    .replace('{{duration}}', String(duration));
}

export function buildVoicemailSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'greeting',
      kind: 'select',
      group: 'primary',
      labelKey: 'routes.apps.voicemail.greeting',
      label: t('routes.apps.voicemail.greeting', 'Приветствие'),
      hintKey: 'routes.apps.voicemail.greetingHint',
      hint: t('routes.apps.voicemail.greetingHint', 'Файл из каталога записей, не путь на диске'),
      optionsSource: 'prompts',
    },
    {
      key: 'max_duration',
      kind: 'duration',
      group: 'primary',
      labelKey: 'routes.apps.voicemail.maxDuration',
      label: t('routes.apps.voicemail.maxDuration', 'Макс. длительность, сек'),
    },
    {
      key: 'silence_timeout',
      kind: 'number',
      group: 'params',
      labelKey: 'routes.apps.voicemail.silenceTimeout',
      label: t('routes.apps.voicemail.silenceTimeout', 'Таймаут тишины, сек'),
    },
    ...RECORD_FLAGS.map((flag): FieldSchema => ({
      key: `record_options.${flag}`,
      kind: 'custom',
      group: 'params',
      labelKey: `routes.apps.voicemail.flag.${flag}`,
      label: t(`routes.apps.voicemail.flag.${flag}`, FLAG_FALLBACK[flag]),
      render: (ctx) => <RecordFlagToggle flag={flag} ctx={ctx} />,
    })),
    {
      key: 'notify.integration_uid',
      kind: 'custom',
      group: 'params',
      labelKey: 'routes.apps.notify.selectIntegration',
      label: t('routes.apps.notify.selectIntegration', 'Интеграция'),
      hintKey: 'routes.chain.notify.integrationHint',
      hint: t(
        'routes.chain.notify.integrationHint',
        'Канал (Telegram, email, webhook…) берётся из выбранной интеграции.',
      ),
      optionsSource: 'notifications',
      render: (ctx) => <NotifyIntegrationSelect {...ctx} />,
    },
    {
      key: 'notify.body',
      kind: 'custom',
      group: 'params',
      labelKey: 'routes.chain.notify.body',
      label: t('routes.chain.notify.body', 'Текст сообщения'),
      render: (ctx) => <NestedText root="notify" leaf="body" ctx={ctx} />,
    },
    {
      key: 'notify.target',
      kind: 'custom',
      group: 'params',
      labelKey: 'routes.apps.notify.target',
      label: t('routes.apps.notify.target', 'Переопределение получателя (опц.)'),
      render: (ctx) => <NestedText root="notify" leaf="target" ctx={ctx} />,
    },
    {
      key: 'notify.subject',
      kind: 'custom',
      group: 'params',
      labelKey: 'routes.chain.notify.subject',
      label: t('routes.chain.notify.subject', 'Тема (для email)'),
      render: (ctx) => <NestedText root="notify" leaf="subject" ctx={ctx} />,
    },
    {
      key: 'stt_engine_uid',
      kind: 'text',
      group: 'params',
      labelKey: 'routes.apps.voicemail.sttEngine',
      label: t('routes.apps.voicemail.sttEngine', 'STT движок (опц.)'),
    },
    {
      key: 'llm_provider_uid',
      kind: 'text',
      group: 'params',
      labelKey: 'routes.apps.voicemail.llmProvider',
      label: t('routes.apps.voicemail.llmProvider', 'LLM провайдер (опц.)'),
    },
  ];
}
