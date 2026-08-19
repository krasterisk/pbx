import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Label, Select } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import type { IMediaOptions } from '@krasterisk/shared';
import type { FieldSchema, SchemaRefs } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';
import { OptionsEditor } from '../../OptionsEditor/OptionsEditor';
import { serializeMediaOptionsObject, parseMediaOptionsObject } from './playbackOptions';
import styles from './PlaybackApp.module.scss';

export const PLAYBACK_MODE_LABELS = {
  plain: { ru: 'Без прерывания', en: 'Without interruption' },
  control: { ru: 'С перемоткой / паузой', en: 'With rewind / pause' },
  menu: { ru: 'С выходом по цифре в меню', en: 'Exit on a menu digit' },
} as const;

type TFn = (key: string, fallback?: string) => string;

function asOptions(value: unknown): IMediaOptions {
  return parseMediaOptionsObject(value);
}

export function normalizePlaybackParams(params: Record<string, unknown> = {}): Record<string, unknown> {
  const files = params.files ?? params.file ?? '';
  return {
    ...params,
    files: Array.isArray(files) ? files[0] ?? '' : files,
    mode: params.mode ?? 'plain',
  };
}

export function summarizePlayback(
  params: Record<string, unknown>,
  t: TFn,
): string {
  const mode = String(params.mode ?? 'plain') as keyof typeof PLAYBACK_MODE_LABELS;
  const modeLabel = t(
    `routes.chain.playback.mode.${mode}`,
    PLAYBACK_MODE_LABELS[mode]?.ru ?? PLAYBACK_MODE_LABELS.plain.ru,
  );
  const raw = params.files ?? params.file ?? '';
  const file = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
  if (!file) {
    return t('routes.chain.playback.summary.empty', `${modeLabel}: файл не выбран`);
  }
  return t('routes.chain.playback.summary', '{{mode}}: {{file}}')
    .replace('{{mode}}', modeLabel)
    .replace('{{file}}', file);
}

export function buildPlaybackSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'mode',
      kind: 'choice-cards',
      labelKey: 'routes.chain.playback.mode',
      options: [
        {
          value: 'plain',
          labelKey: 'routes.chain.playback.mode.plain',
          label: t('routes.chain.playback.mode.plain', PLAYBACK_MODE_LABELS.plain.ru),
          description: t(
            'routes.chain.playback.mode.plainHint',
            'Проиграть файл до конца, цифры не обрабатываются',
          ),
        },
        {
          value: 'control',
          labelKey: 'routes.chain.playback.mode.control',
          label: t('routes.chain.playback.mode.control', PLAYBACK_MODE_LABELS.control.ru),
          description: t(
            'routes.chain.playback.mode.controlHint',
            'Можно перематывать и ставить на паузу с трубки',
          ),
        },
        {
          value: 'menu',
          labelKey: 'routes.chain.playback.mode.menu',
          label: t('routes.chain.playback.mode.menu', PLAYBACK_MODE_LABELS.menu.ru),
          description: t(
            'routes.chain.playback.mode.menuHint',
            'Цифра может увести вызов из цепочки в меню',
          ),
        },
      ],
    },
    {
      key: 'files',
      kind: 'select',
      required: true,
      labelKey: 'routes.chain.playback.files',
      optionsSource: 'prompts',
    },
    {
      key: 'langoverride',
      kind: 'text',
      labelKey: 'routes.chain.playback.langoverride',
      visibleWhen: { key: 'mode', equals: 'menu' },
    },
    {
      key: 'digittimeout',
      kind: 'number',
      labelKey: 'routes.chain.playback.digittimeout',
      visibleWhen: { key: 'mode', equals: 'menu' },
    },
    {
      key: 'options',
      kind: 'custom',
      labelKey: 'routes.chain.section.options',
      render: ({ params, onChange, readOnly }) => (
        <PlaybackOptionsField params={params} onChange={onChange} readOnly={readOnly} />
      ),
    },
  ];
}

function PlaybackOptionsField({
  params,
  onChange,
  readOnly,
}: {
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const mode = String(params.mode ?? 'plain');
  const opts = asOptions(params.options);
  const flags = mode === 'control' ? ['n', 's', 'p'] : ['n', 's'];

  const patchOpts = (next: IMediaOptions) => {
    onChange({ options: next });
  };

  return (
    <VStack gap="12" max className={styles.options}>
      <HStack gap="8" align="center">
        <Checkbox
          id="playback-opt-noanswer"
          aria-label={t('routes.chain.playback.opt.noanswer', 'Не отвечать на вызов')}
          disabled={readOnly}
          checked={Boolean(opts.noanswer)}
          onChange={(e) => patchOpts({ ...opts, noanswer: e.target.checked })}
        />
        <Label htmlFor="playback-opt-noanswer">
          {t('routes.chain.playback.opt.noanswer', 'Не отвечать на вызов')}
        </Label>
      </HStack>
      <HStack gap="8" align="center">
        <Checkbox
          id="playback-opt-skip"
          aria-label={t('routes.chain.playback.opt.skip', 'Пропустить, если канал не отвечен')}
          disabled={readOnly}
          checked={Boolean(opts.skip)}
          onChange={(e) => patchOpts({ ...opts, skip: e.target.checked })}
        />
        <Label htmlFor="playback-opt-skip">
          {t('routes.chain.playback.opt.skip', 'Пропустить, если канал не отвечен')}
        </Label>
      </HStack>
      {mode === 'control' ? (
        <HStack gap="8" align="center">
          <Checkbox
            id="playback-opt-p"
            aria-label={t('routes.chain.playback.opt.p', 'Управление DTMF')}
            disabled={readOnly}
            checked={Boolean(opts.p)}
            onChange={(e) => patchOpts({ ...opts, p: e.target.checked })}
          />
          <Label htmlFor="playback-opt-p">
            {t('routes.chain.playback.opt.p', 'Управление DTMF')}
          </Label>
        </HStack>
      ) : null}
      <Select
        id="playback-opt-mix"
        aria-label={t('routes.chain.playback.opt.mixMode', 'Произносить имя файла')}
        disabled={readOnly}
        value={opts.mixMode ?? ''}
        onChange={(e) => {
          const mixMode = e.target.value === 'say' || e.target.value === 'mix'
            ? e.target.value
            : undefined;
          patchOpts({ ...opts, mixMode });
        }}
      >
        <option value="">{t('routes.chain.playback.opt.mixNone', 'Не произносить')}</option>
        <option value="say">say</option>
        <option value="mix">mix</option>
      </Select>
      <OptionsEditor
        value={serializeMediaOptionsObject(opts)}
        flags={flags}
        readOnly={readOnly}
        onChange={(next) => patchOpts(parseMediaOptionsObject(next))}
      />
    </VStack>
  );
}

export function PlaybackApp({ params, onChange, readOnly }: IDialplanAppProps) {
  const { t } = useTranslation();
  const { data: prompts = [], isLoading } = useGetPromptsQuery();
  const normalized = normalizePlaybackParams(params as Record<string, unknown>);
  const schema = useMemo(() => buildPlaybackSchema(t), [t]);
  const refs: SchemaRefs = {
    prompts: {
      items: prompts.map((prompt) => ({
        value: prompt.filename,
        label: prompt.comment || prompt.filename,
      })),
      isLoading,
      sectionHref: '/prompts',
      sectionFallback: 'Промпты',
    },
  };

  return (
    <div className={styles.root}>
      <SchemaFields
        schema={schema}
        params={normalized}
        refs={refs}
        readOnly={readOnly}
        onChange={onChange}
      />
    </div>
  );
}
