import type { FieldSchema } from '../schema.types';

type TFn = (...args: [key: string] | [key: string, fallback: string]) => string;

export function buildAiVoiceRobotSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'robot_uid',
      kind: 'select',
      optionsSource: 'aiVoiceRobots',
      required: true,
      group: 'primary',
      labelKey: 'routes.apps.ai_voice_robot.select',
      label: t('aiVoiceDesigner.title', 'Голосовые AI-роботы'),
    },
  ];
}

export function summarizeAiVoiceRobot(params: Record<string, unknown>, t: TFn): string {
  const id = String(params.robot_uid ?? params.deployment_id ?? '').trim();
  return id
    ? t('routes.chain.ai_voice_robot.summary', 'AI-робот {{id}}').replace('{{id}}', id)
    : t('routes.chain.ai_voice_robot.summaryEmpty', 'AI-робот: не выбран');
}
