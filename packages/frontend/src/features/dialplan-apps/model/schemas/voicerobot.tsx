import type { FieldSchema } from '../schema.types';

type TFn = (...args: [key: string] | [key: string, fallback: string]) => string;

export function buildVoiceRobotSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'robot_uid',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.apps.voicerobot.select',
      label: t('routes.apps.voicerobot.select', 'Голосовой робот'),
      optionsSource: 'voiceRobots',
    },
  ];
}

export function summarizeVoiceRobot(
  params: Record<string, unknown>,
  t: TFn,
  refs?: Record<string, unknown>,
): string {
  const uid = String(params.robot_uid ?? '').trim();
  const catalog = refs?.voiceRobots as { items?: Array<{ value: string; label: string }> } | undefined;
  const name = catalog?.items?.find((item) => item.value === uid)?.label;
  if (name) return name;
  return uid
    ? t('routes.chain.voicerobot.summary', 'Робот #{{uid}}').replace('{{uid}}', uid)
    : t('routes.chain.voicerobot.summaryEmpty', 'Голосовой робот: не выбран');
}
