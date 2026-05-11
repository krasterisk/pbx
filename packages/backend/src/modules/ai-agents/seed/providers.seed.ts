/**
 * Built-in provider templates. Installed as `user_uid = 0` rows on first
 * boot of the AI Agents module — tenants clone them to enter their own
 * API keys.
 *
 * Pricing is taken from public vendor docs at the time of writing
 * (May 2026) and is intended to be edited by admins per agreement.
 */

export interface ProviderTemplate {
  name: string;
  kind: 'online' | 'local' | 'custom';
  vendor: string;
  endpoint: string;
  auth_type: 'bearer' | 'api_key_header' | 'none' | 'custom';
  capabilities: string[];
  defaults: Record<string, any>;
  pricing: Record<string, any>;
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
    pricing: {
      inputTokenUsd: 5e-6,
      outputTokenUsd: 20e-6,
      audioMinuteUsd: 0.06,
      currency: 'USD',
    },
  },
  {
    name: 'OpenAI Cascade (gpt-4o-mini)',
    kind: 'online',
    vendor: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    auth_type: 'bearer',
    capabilities: ['llm'],
    defaults: { model: 'gpt-4o-mini', temperature: 0.3 },
    pricing: { inputTokenUsd: 0.15e-6, outputTokenUsd: 0.6e-6, currency: 'USD' },
  },
  {
    name: 'Qwen Realtime',
    kind: 'online',
    vendor: 'qwen',
    endpoint: 'wss://dashscope.aliyuncs.com/api/v1/realtime',
    auth_type: 'bearer',
    capabilities: ['llm', 'realtime'],
    defaults: { model: 'qwen-omni-turbo', language: 'ru' },
    pricing: { audioMinuteUsd: 0.04, currency: 'USD' },
  },
  {
    name: 'Yandex SpeechKit STT',
    kind: 'online',
    vendor: 'yandex',
    endpoint: 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize',
    auth_type: 'api_key_header',
    capabilities: ['stt'],
    defaults: { language: 'ru-RU' },
    pricing: { audioMinuteUsd: 0.0036, currency: 'USD' },
  },
  {
    name: 'Yandex SpeechKit TTS',
    kind: 'online',
    vendor: 'yandex',
    endpoint: 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize',
    auth_type: 'api_key_header',
    capabilities: ['tts'],
    defaults: { voice: 'alena', emotion: 'good' },
    pricing: { charUsd: 0.000005, currency: 'USD' },
  },
  {
    name: 'Ollama (local LLM)',
    kind: 'local',
    vendor: 'ollama',
    endpoint: 'http://127.0.0.1:11434/api/chat',
    auth_type: 'none',
    capabilities: ['llm'],
    defaults: { model: 'qwen2.5:7b-instruct' },
    pricing: { inputTokenUsd: 0, outputTokenUsd: 0, currency: 'USD' },
  },
  {
    name: 'Piper TTS (local)',
    kind: 'local',
    vendor: 'piper',
    endpoint: 'http://127.0.0.1:5000/api/tts',
    auth_type: 'none',
    capabilities: ['tts'],
    defaults: { voice: 'ru_RU-ruslan-medium' },
    pricing: { audioMinuteUsd: 0, currency: 'USD' },
  },
  {
    name: 'Whisper STT (local)',
    kind: 'local',
    vendor: 'whisper',
    endpoint: 'http://127.0.0.1:9000/asr',
    auth_type: 'none',
    capabilities: ['stt'],
    defaults: { model: 'large-v3', language: 'ru' },
    pricing: { audioMinuteUsd: 0, currency: 'USD' },
  },
  {
    name: 'Custom WebSocket',
    kind: 'custom',
    vendor: 'custom',
    endpoint: 'wss://example.com/voice-ai/realtime',
    auth_type: 'bearer',
    capabilities: ['llm', 'realtime'],
    defaults: {},
    pricing: { currency: 'USD' },
  },
];
