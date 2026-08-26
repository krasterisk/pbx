import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

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

export function summarizeVoiceRobot(params: Record<string, unknown>, t: TFn): string {
  const uid = String(params.robot_uid ?? '').trim();
  return uid
    ? t('routes.chain.voicerobot.summary', 'Робот #{{uid}}').replace('{{uid}}', uid)
    : t('routes.chain.voicerobot.summaryEmpty', 'Голосовой робот: не выбран');
}
