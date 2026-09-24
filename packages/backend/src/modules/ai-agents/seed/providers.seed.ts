/**
 * Historical vendor presets. Not seeded — each tenant creates their own
 * providers. Kept as a reference for default endpoints.
 * Cost belongs to the billing module, not to these templates.
 */

export interface ProviderTemplate {
  name: string;
  kind: 'online' | 'local' | 'custom';
  vendor: string;
  endpoint: string;
  auth_type: 'bearer' | 'api_key_header' | 'none' | 'custom';
  capabilities: string[];
  defaults: Record<string, any>;
}

export const BUILTIN_PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    name: 'OpenAI Realtime (gpt-4o-realtime)',
    kind: 'online',
    vendor: 'openai',
    endpoint: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
    auth_type: 'bearer',
    capabilities: ['llm', 'realtime', 'stt', 'tts'],
    defaults: { model: 'gpt-4o-realtime-preview', voice: 'alloy', language: 'ru' },
  },
  {
    name: 'OpenAI Cascade (gpt-4o-mini)',
    kind: 'online',
    vendor: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    auth_type: 'bearer',
    capabilities: ['llm', 'tools'],
    defaults: { model: 'gpt-4o-mini', temperature: 0.3 },
  },
  {
    name: 'aiPBX',
    kind: 'online',
    vendor: 'aipbx',
    endpoint: 'https://aipbx.net/api/v1/chat/completions',
    auth_type: 'bearer',
    capabilities: ['llm', 'tools'],
    defaults: { model: 'gemma4:e4b', temperature: 0.2 },
  },
  {
    name: 'Qwen Realtime',
    kind: 'online',
    vendor: 'qwen',
    endpoint: 'wss://dashscope.aliyuncs.com/api/v1/realtime',
    auth_type: 'bearer',
    capabilities: ['llm', 'realtime'],
    defaults: { model: 'qwen-omni-turbo', language: 'ru' },
  },
  {
    name: 'Yandex SpeechKit STT',
    kind: 'online',
    vendor: 'yandex',
    endpoint: 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize',
    auth_type: 'api_key_header',
    capabilities: ['stt'],
    defaults: { language: 'ru-RU' },
  },
  {
    name: 'Yandex SpeechKit TTS',
    kind: 'online',
    vendor: 'yandex',
    endpoint: 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize',
    auth_type: 'api_key_header',
    capabilities: ['tts'],
    defaults: { voice: 'alena', emotion: 'good' },
  },
  {
    name: 'Ollama (local LLM)',
    kind: 'local',
    vendor: 'ollama',
    endpoint: 'http://127.0.0.1:11434/api/chat',
    auth_type: 'none',
    capabilities: ['llm'],
    defaults: { model: 'qwen2.5:7b-instruct' },
  },
  {
    name: 'Piper TTS (local)',
    kind: 'local',
    vendor: 'piper',
    endpoint: 'http://127.0.0.1:5000/api/tts',
    auth_type: 'none',
    capabilities: ['tts'],
    defaults: { voice: 'ru_RU-ruslan-medium' },
  },
  {
    name: 'Whisper STT (local)',
    kind: 'local',
    vendor: 'whisper',
    endpoint: 'http://127.0.0.1:9000/asr',
    auth_type: 'none',
    capabilities: ['stt'],
    defaults: { model: 'large-v3', language: 'ru' },
  },
  {
    name: 'Custom WebSocket',
    kind: 'custom',
    vendor: 'custom',
    endpoint: 'wss://example.com/voice-ai/realtime',
    auth_type: 'bearer',
    capabilities: ['llm', 'realtime'],
    defaults: {},
  },
];
