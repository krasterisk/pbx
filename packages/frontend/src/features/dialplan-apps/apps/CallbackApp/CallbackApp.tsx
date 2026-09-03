import { Input, Text } from '@/shared/ui';
import type { FieldSchema, SchemaFieldRenderCtx } from '../../model/schema.types';

type TFn = (key: string, fallback?: string) => string;

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface CallbackFieldErrors {
  window_start?: string;
  window_end?: string;
  max_attempts?: string;
  pause_minutes?: string;
}

function TimeField({ ctx, fallback }: { ctx: SchemaFieldRenderCtx; fallback: string }) {
  const raw = ctx.params[ctx.field.key];
  return (
    <Input
      id={`schema-field-${ctx.field.key}`}
      type="time"
      aria-label={ctx.field.label ?? ctx.field.labelKey}
      disabled={ctx.readOnly}
      value={typeof raw === 'string' && raw ? raw : fallback}
      onChange={(e) => ctx.onChange({ [ctx.field.key]: e.target.value })}
    />
  );
}

function SettingsNote({ t }: { t: TFn }) {
  return (
    <Text variant="muted">
      {t(
        'routes.apps.callback.settingsHint',
        'The request mode, the key and the dial order are tenant wide and live in call centre settings, on the "Callback" tab',
      )}
      {' '}
      <a href="/callcenter/settings" target="_blank" rel="noreferrer">
        {t('routes.apps.callback.settingsLink', 'Open callback settings')}
      </a>
    </Text>
  );
}

export function validateCallbackParams(params: Record<string, unknown>): CallbackFieldErrors {
  const errors: CallbackFieldErrors = {};
  const start = String(params.window_start ?? '');
  const end = String(params.window_end ?? '');
  if (!HH_MM.test(start)) errors.window_start = 'time';
  if (!HH_MM.test(end)) errors.window_end = 'time';
  const attempts = Number(params.max_attempts);
  if (!Number.isInteger(attempts) || attempts < 1) errors.max_attempts = 'min';
  const pause = Number(params.pause_minutes);
  if (!Number.isInteger(pause) || pause < 0) errors.pause_minutes = 'min';
  return errors;
}

export function summarizeCallback(params: Record<string, unknown>, t: TFn): string {
  const attempts = Number(params.max_attempts ?? 3) || 3;
  const from = String(params.window_start ?? '09:00');
  const to = String(params.window_end ?? '21:00');
  return t(
    'routes.apps.callback.summary',
    'Callback, up to {{attempts}} attempts, from {{from}} to {{to}}',
  )
    .replace('{{attempts}}', String(attempts))
    .replace('{{from}}', from)
    .replace('{{to}}', to);
}

export function buildCallbackSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'settingsNote',
      kind: 'custom',
      group: 'primary',
      hideLabel: true,
      labelKey: 'routes.apps.callback.settingsHint',
      label: t(
        'routes.apps.callback.settingsHint',
        'The request mode, the key and the dial order are tenant wide and live in call centre settings, on the "Callback" tab',
      ),
      render: () => <SettingsNote t={t} />,
    },
    {
      key: 'window_start',
      kind: 'custom',
      group: 'primary',
      required: true,
      row: 'window',
      rowWeight: 1,
      labelKey: 'routes.apps.callback.windowStart',
      label: t('routes.apps.callback.windowStart', 'Start dialling at'),
      hintKey: 'routes.apps.callback.windowHint',
      hint: t(
        'routes.apps.callback.windowHint',
        'Requests outside this window wait for it to open instead of being lost',
      ),
      render: (ctx) => <TimeField ctx={ctx} fallback="09:00" />,
    },
    {
      key: 'window_end',
      kind: 'custom',
      group: 'primary',
      required: true,
      row: 'window',
      rowWeight: 1,
      labelKey: 'routes.apps.callback.windowEnd',
      label: t('routes.apps.callback.windowEnd', 'Stop dialling at'),
      render: (ctx) => <TimeField ctx={ctx} fallback="21:00" />,
    },
    {
      key: 'max_attempts',
      kind: 'number',
      group: 'primary',
      required: true,
      labelKey: 'routes.apps.callback.maxAttempts',
      label: t('routes.apps.callback.maxAttempts', 'How many attempts'),
    },
    {
      key: 'pause_minutes',
      kind: 'number',
      group: 'primary',
      required: true,
      labelKey: 'routes.apps.callback.pauseMinutes',
      label: t('routes.apps.callback.pauseMinutes', 'Pause between attempts, min'),
    },
  ];
}
