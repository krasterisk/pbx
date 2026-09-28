import type { AiVoiceRobotConfig } from '@krasterisk/shared';

// Donor: aiPBX/entities/Assistants/model/lib/realtimeVoices.ts (a1126ae).
const openai = ['alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'sage', 'shimmer', 'marin', 'verse'];
const qwen = ['Cherry', 'Serena', 'Ethan', 'Chelsie', 'Momo', 'Vivian', 'Moon', 'Maia', 'Kai', 'Nofish',
  'Bella', 'Jennifer', 'Ryan', 'Katerina', 'Aiden', 'Eldric Sage', 'Mia', 'Mochi', 'Bellona', 'Vincent',
  'Bunny', 'Neil', 'Elias', 'Arthur', 'Nini', 'Ebona', 'Seren', 'Pip', 'Stella', 'Bodega', 'Sonrisa',
  'Alek', 'Dolce', 'Sohee', 'Ono Anna', 'Lenn', 'Emilien', 'Andre', 'Radio Gol', 'Jada', 'Dylan',
  'Li', 'Marcus', 'Roy', 'Peter', 'Sunny', 'Eric', 'Rocky', 'Kiki'];
const yandex = ['alena', 'filipp', 'ermil', 'jane', 'omazh', 'zahar', 'dasha', 'julia', 'lera', 'masha',
  'marina', 'alexander', 'kirill', 'anton', 'madi_ru', 'saule_ru', 'zamira_ru', 'zhanar_ru', 'yulduz_ru'];

export function voiceChoices(vendor: string, model: string, current: string): string[] {
  const choices = vendor === 'qwen' || model.startsWith('qwen') ? qwen
    : vendor === 'yandex' ? yandex : vendor === 'openai' || model.startsWith('gpt') ? openai : [];
  return [...new Set(['', ...choices, ...(current ? [current] : [])])];
}

export function changeRobotModel(config: AiVoiceRobotConfig, model: string): AiVoiceRobotConfig {
  if (model === config.model) return config;
  const format = model.startsWith('qwen') ? 'pcm16' : model.startsWith('gpt') ? 'g711_alaw' : undefined;
  return { ...config, model, voice: '', ...(format ? { inputAudioFormat: format, outputAudioFormat: format } : {}) };
}
