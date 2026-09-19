/**
 * Turn a stored provider endpoint into an OpenAI-compatible chat URL.
 * Seeded realtime / Ollama native paths are mapped; unknown websockets stay rejected.
 */
export function resolveChatCompletionsUrl(endpoint: string): string | null {
  const url = (endpoint ?? '').trim();
  if (!url) return null;

  const aipbx = mapAipbxToChat(url);
  if (aipbx) return aipbx;

  if (/\/api\/chat\/?(\?.*)?$/i.test(url) && !/^wss?:/i.test(url)) {
    return url.replace(/\/api\/chat\/?(\?.*)?$/i, '/v1/chat/completions');
  }

  if (/^wss?:/i.test(url) || /\/v1\/realtime/i.test(url)) {
    return mapVendorRealtimeToChat(url);
  }

  const openai = mapOpenAiHostToChat(url);
  if (openai) return openai;

  const normalized = normalizeChatCompletionsPath(url);
  if (normalized) return normalized;

  return `${url.replace(/\/$/, '')}/v1/chat/completions`;
}

/** api.openai.com (+ typo paths like /v1/chat/comletions) → canonical completions URL. */
function mapOpenAiHostToChat(endpoint: string): string | null {
  try {
    const parsed = new URL(endpoint.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:'));
    const host = parsed.hostname.toLowerCase();
    if (host === 'api.openai.com' || host.endsWith('.openai.com')) {
      return 'https://api.openai.com/v1/chat/completions';
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Accept an already-chat path, including common typos (comletions) and doubled
 * suffixes like .../completions/v1/chat/completions.
 */
function normalizeChatCompletionsPath(endpoint: string): string | null {
  try {
    const parsed = new URL(endpoint);
    let path = parsed.pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

    // Collapse accidental double appends first.
    path = path.replace(
      /(?:\/v1\/chat\/complet(?:e|io)?ns)+$/i,
      '/v1/chat/completions',
    );
    path = path.replace(/\/chat\/complet(?:e|io)?ns$/i, '/chat/completions');

    // Typo: comletions / completons / completion (singular) under /v1/chat/
    if (/\/v1\/chat\/complet[a-z]*$/i.test(path) || /\/v1\/chat\/comletions$/i.test(path)) {
      path = path.replace(/\/v1\/chat\/[a-z]+$/i, '/v1/chat/completions');
    }

    if (/\/v1\/chat\/completions$/i.test(path) || /\/chat\/completions$/i.test(path)) {
      parsed.pathname = path;
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().replace(/\/$/, '');
    }
    return null;
  } catch {
    return null;
  }
}

function mapAipbxToChat(endpoint: string): string | null {
  try {
    const parsed = new URL(endpoint.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:'));
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'aipbx.net'
      || host.endsWith('.aipbx.net')
      || host === 'aipbx.ru'
      || host.endsWith('.aipbx.ru')
    ) {
      // gpu.aipbx.net:11434 is raw Ollama (NDJSON + thinking). Always use the gateway.
      return 'https://aipbx.net/api/v1/chat/completions';
    }
    return null;
  } catch {
    return null;
  }
}

function mapVendorRealtimeToChat(endpoint: string): string | null {
  try {
    const parsed = new URL(endpoint.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:'));
    const host = parsed.hostname.toLowerCase();
    if (host === 'api.openai.com' || host.endsWith('.openai.com')) {
      return 'https://api.openai.com/v1/chat/completions';
    }
    if (host.includes('dashscope') && host.endsWith('.aliyuncs.com')) {
      return `https://${parsed.hostname}/compatible-mode/v1/chat/completions`;
    }
    return null;
  } catch {
    return null;
  }
}
