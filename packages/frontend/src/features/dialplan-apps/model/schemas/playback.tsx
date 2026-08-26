import { useTranslation } from 'react-i18next';
import { Checkbox, Label, Select } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import type { IMediaOptions } from '@krasterisk/shared';
import type { FieldSchema } from '../schema.types';
import { OptionsEditor } from '../../ui/OptionsEditor/OptionsEditor';
import { serializeMediaOptionsObject, parseMediaOptionsObject } from './playbackOptions';
import styles from './playback.module.scss';

export const PLAYBACK_MODE_LABELS = {
  plain: { ru: 'Без прерывания', en: 'Without interruption' },
  control: { ru: 'С перемоткой / паузой', en: 'With rewind / pause' },
  menu: { ru: 'С выходом по цифре в меню', en: 'Exit on a menu digit' },
} as const;

/** Flat keys: `playback.mode` is itself a label, so modes cannot nest under it. */
const MODE_KEYS = {
  plain: 'routes.chain.playback.modePlain',
  control: 'routes.chain.playback.modeControl',
  menu: 'routes.chain.playback.modeMenu',
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
    MODE_KEYS[mode] ?? MODE_KEYS.plain,
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
      group: 'primary',
      labelKey: 'routes.chain.playback.mode',
      options: [
        {
          value: 'plain',
          labelKey: MODE_KEYS.plain,
          label: t(MODE_KEYS.plain, PLAYBACK_MODE_LABELS.plain.ru),
          descriptionKey: 'routes.chain.playback.modePlainHint',
          description: t(
            'routes.chain.playback.modePlainHint',
            'Проиграть файл до конца, цифры не обрабатываются',
          ),
        },
        {
          value: 'control',
          labelKey: MODE_KEYS.control,
          label: t(MODE_KEYS.control, PLAYBACK_MODE_LABELS.control.ru),
          descriptionKey: 'routes.chain.playback.modeControlHint',
          description: t(
            'routes.chain.playback.modeControlHint',
            'Можно перематывать и ставить на паузу с трубки',
          ),
        },
        {
          value: 'menu',
          labelKey: MODE_KEYS.menu,
          label: t(MODE_KEYS.menu, PLAYBACK_MODE_LABELS.menu.ru),
          descriptionKey: 'routes.chain.playback.modeMenuHint',
          description: t(
            'routes.chain.playback.modeMenuHint',
            'Цифра может увести вызов из цепочки в меню',
          ),
        },
      ],
    },
    {
      key: 'files',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.playback.files',
      optionsSource: 'prompts',
    },
    {
      key: 'langoverride',
      kind: 'text',
      group: 'params',
      labelKey: 'routes.chain.playback.langoverride',
      visibleWhen: { key: 'mode', equals: 'menu' },
    },
    {
      key: 'digittimeout',
      kind: 'number',
      group: 'params',
      labelKey: 'routes.chain.playback.digittimeout',
      visibleWhen: { key: 'mode', equals: 'menu' },
    },
    {
      key: 'options',
      kind: 'custom',
      group: 'params',
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