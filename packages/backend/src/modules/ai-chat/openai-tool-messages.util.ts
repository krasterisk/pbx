/**
 * OpenAI Chat Completions function-calling message rules:
 * - An assistant message with `tool_calls` must be immediately followed by a
 *   `role: "tool"` message for every `tool_call_id` (nothing else in between).
 * - A `role: "tool"` message must reference a preceding assistant `tool_calls` id.
 *
 * @see https://platform.openai.com/docs/guides/function-calling
 */

export interface OpenAiChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown;
}

type NormalizedToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeOpenAiToolCalls(raw: unknown): NormalizedToolCall[] {
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw.map((entry, index) => {
    const call = asRecord(entry) ?? {};
    const fn = asRecord(call.function);
    const name = String(fn?.name ?? call.name ?? '');
    const argsRaw = fn?.arguments ?? call.arguments ?? {};
    const args = typeof argsRaw === 'string' ? argsRaw : JSON.stringify(argsRaw ?? {});
    return {
      id: String(call.id ?? `call_${index + 1}`),
      type: 'function' as const,
      function: { name, arguments: args },
    };
  });
}

function syntheticToolResult(call: NormalizedToolCall, reason: string): OpenAiChatMessage {
  return {
    role: 'tool',
    tool_call_id: call.id,
    name: call.function.name || undefined,
    content: JSON.stringify({
      error: reason,
      tool: call.function.name || null,
      message: 'Tool result was missing from history; synthesized for OpenAI message order.',
    }),
  };
}

/**
 * Rewrites a message list so OpenAI accepts it: fills missing tool replies and
 * drops orphan `tool` rows that have no matching assistant `tool_calls`.
 */
export function repairOpenAiChatMessages<T extends OpenAiChatMessage>(messages: T[]): T[] {
  const out: T[] = [];
  let i = 0;

  while (i < messages.length) {
    const message = messages[i];
    const toolCalls = message.role === 'assistant' ? normalizeOpenAiToolCalls(message.tool_calls) : [];

    if (message.role === 'assistant' && toolCalls.length) {
      out.push({
        ...message,
        content: message.content ?? '',
        tool_calls: toolCalls,
      });
      i += 1;

      const pending = new Map(toolCalls.map((call) => [call.id, call]));
      while (i < messages.length && messages[i].role === 'tool') {
        const toolMsg = messages[i];
        const toolCallId = typeof toolMsg.tool_call_id === 'string' ? toolMsg.tool_call_id : '';
        if (toolCallId && pending.has(toolCallId)) {
          out.push(toolMsg);
          pending.delete(toolCallId);
        }
        i += 1;
      }

      for (const call of pending.values()) {
        out.push(syntheticToolResult(call, 'missing_tool_result') as T);
      }
      continue;
    }

    if (message.role === 'tool') {
      // Orphan tool reply (no immediately preceding assistant tool_calls).
      i += 1;
      continue;
    }

    if (message.role === 'assistant') {
      const { tool_calls: _ignored, ...rest } = message;
      out.push({ ...rest, content: message.content ?? '' } as T);
      i += 1;
      continue;
    }

    out.push(message);
    i += 1;
  }

  return out;
}
