import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { decryptSecret } from '../ai-agents/util/secret-cipher.util';
import { chatReasoningParams, chatSamplingParams, chatTokenLimitParams, resolveChatCompletionsUrl, usesMaxCompletionTokens } from '../voicemail/llm-summary.service';
import { normalizeOpenAiToolCalls, repairOpenAiChatMessages } from './openai-tool-messages.util';
import type {
    AgentChatParams,
    AgentCompletion,
    AgentLlmError,
    AgentToolCall,
    AgentTokenUsage,
} from './pbx-agent.types';

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_REASONING_MAX_TOKENS = 16384;
const DEFAULT_TEMPERATURE = 0.2;
/** Local Ollama + tools + thinking often exceeds 60s and aborts mid-token. */
const REQUEST_TIMEOUT_MS = 180_000;
const MAX_ERROR_BODY_CHARS = 400;

interface AccumulatedToolCall {
    id: string;
    name: string;
    arguments: string;
}

@Injectable()
export class PbxAgentLlmClient {
    private readonly logger = new Logger(PbxAgentLlmClient.name);

    async chat(params: AgentChatParams): Promise<AgentCompletion> {
        const { provider, messages, tools = [], signal, stream = true, onToken, toolChoice } = params;

        if (signal?.aborted) {
            return this.fail({ code: 'aborted', message: 'Request aborted before send' });
        }

        const caps = provider.capabilities ?? [];
        if (!caps.includes('llm')) {
            const label = provider.name || `uid=${provider.uid ?? '?'}`;
            return this.fail({
                code: 'missing_llm',
                message: `Provider ${label} is missing the language-model capability`,
            });
        }

        const url = resolveChatCompletionsUrl(provider.endpoint);
        if (!url) {
            return this.fail({
                code: 'invalid_endpoint',
                message: `Provider endpoint cannot be normalized to a chat-completions URL (endpoint=${provider.endpoint} provider=${this.providerLabel(provider)})`,
            });
        }

        const nativeTools = this.supportsTools(provider);
        const preparedMessages = this.toProviderMessages(messages);
        const outgoingMessages = nativeTools || !tools.length
            ? preparedMessages
            : this.withToolCatalogInstruction(preparedMessages, tools);
        if (!nativeTools && tools.length) {
            this.logger.warn('Provider does not advertise tool calling — degraded fallback: tools serialized into the system message');
        }

        const headers = this.buildHeaders(provider);
        const model = this.resolveOptionalModel(provider);
        const resolvedChoice = this.resolveToolChoice(toolChoice, nativeTools, tools.length > 0);
            const configuredMax = Number(provider.defaults?.max_tokens ?? DEFAULT_MAX_TOKENS);
            const maxTokens = usesMaxCompletionTokens(model)
                ? Math.max(configuredMax, DEFAULT_REASONING_MAX_TOKENS)
                : configuredMax;
        const body = {
            ...(model ? { model } : {}),
            ...this.samplingParams(provider, model),
            ...this.tokenLimitParams(model, maxTokens),
            ...chatReasoningParams(model, typeof provider.defaults?.reasoning_effort === 'string'
                ? provider.defaults.reasoning_effort
                : undefined),
            stream,
            messages: outgoingMessages,
            ...(nativeTools && tools.length
                ? {
                    tools: this.toOpenAiTools(tools),
                    ...(resolvedChoice ? { tool_choice: resolvedChoice } : {}),
                }
                : {}),
        };

        this.logger.debug(`LLM POST ${url} provider=${this.providerLabel(provider)} model=${model ?? '(gateway)'}`);

        const requestSignal = this.withDeadline(signal);
        const fallbackTools = tools.length > 0;

        if (!stream) {
            return this.chatOnce(url, headers, body, requestSignal, fallbackTools, provider);
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: requestSignal,
            });

            if (!response.ok) {
                const detail = await this.readFetchErrorBody(response);
                return this.fail({
                    code: 'provider_http',
                    message: this.formatHttpError(response.status, url, provider, model, detail),
                    status: response.status,
                });
            }

            const contentType = this.responseContentType(response);
            this.logger.debug(`LLM response ${response.status} contentType=${contentType || 'unknown'} provider=${this.providerLabel(provider)}`);

            // Some gateways ignore stream:true and reply with a single JSON object.
            if (this.isJsonContentType(contentType)) {
                const raw = await this.readResponseText(response);
                const parsed = this.tryParseJson(raw);
                if (parsed) {
                    return this.completionFromOpenAiJson(parsed, fallbackTools);
                }
                return this.completionFromSseText(raw, { onToken, fallbackTools });
            }

            if (!response.body) {
                return this.fail({ code: 'empty_body', message: 'Provider returned an empty body' });
            }

            const streamed = await this.readStream(
                response.body as ReadableStream<Uint8Array>,
                { signal: requestSignal, onToken },
            );
            if (streamed.error?.code === 'aborted' && !signal?.aborted) {
                return this.fail({
                    code: 'provider_timeout',
                    message: `Provider request timed out after ${REQUEST_TIMEOUT_MS}ms`,
                });
            }
            if (!streamed.error && !streamed.text && !streamed.toolCalls.length) {
                this.logger.warn(`LLM SSE completion had no text/tool_calls contentType=${contentType || 'unknown'}`);
            }
            const streamedResult = this.maybeParseFallbackTools(streamed, fallbackTools);
            const emptyStream = !streamedResult.error && !streamedResult.text && !streamedResult.toolCalls.length;
            if ((streamedResult.error?.code === 'tool_args_parse' || emptyStream) && tools.length) {
                this.logger.warn(
                    streamedResult.error?.code === 'tool_args_parse'
                        ? 'tool_args_parse on stream — retrying same turn without streaming'
                        : 'empty SSE completion — retrying same turn without streaming',
                );
                return this.chatOnce(
                    url,
                    headers,
                    { ...body, stream: false },
                    requestSignal,
                    fallbackTools,
                    provider,
                );
            }
            return streamedResult;
        } catch (err) {
            return this.failFromAbortOrRequest(err, signal);
        }
    }

    private withDeadline(signal?: AbortSignal): AbortSignal {
        const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
        if (!signal) return timeout;
        if (typeof AbortSignal.any === 'function') {
            return AbortSignal.any([signal, timeout]);
        }
        return signal;
    }

    private failFromAbortOrRequest(err: unknown, userSignal?: AbortSignal): AgentCompletion {
        const aborted = userSignal?.aborted || (err as Error)?.name === 'AbortError';
        if (aborted && userSignal?.aborted) {
            return this.fail({ code: 'aborted', message: 'Request aborted' });
        }
        if (aborted) {
            return this.fail({
                code: 'provider_timeout',
                message: `Provider request timed out after ${REQUEST_TIMEOUT_MS}ms`,
            });
        }
        return this.fail({
            code: 'provider_request',
            message: (err as Error)?.message || 'Provider request failed',
        });
    }

    private buildHeaders(provider: AgentChatParams['provider']): Record<string, string> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const key = decryptSecret(provider.encrypted_api_key ?? '');
        const auth = provider.auth_type ?? 'bearer';
        if (auth === 'bearer' && key) headers.Authorization = `Bearer ${key}`;
        else if (auth === 'api_key_header' && key) headers['X-API-Key'] = key;
        return headers;
    }

    private async chatOnce(
        url: string,
        headers: Record<string, string>,
        body: Record<string, unknown>,
        signal: AbortSignal,
        fallbackTools: boolean,
        provider: AgentChatParams['provider'],
    ): Promise<AgentCompletion> {
        try {
            const { data, status } = await axios.post(
                url,
                { ...body, stream: false },
                { headers, timeout: REQUEST_TIMEOUT_MS, validateStatus: () => true, signal },
            );
            if (status >= 400 || data?.error) {
                return this.fail({
                    code: 'provider_http',
                    message: this.formatHttpError(
                        status,
                        url,
                        provider,
                        body.model,
                        this.stringifyErrorBody(data),
                    ),
                    status,
                });
            }
            return this.completionFromOpenAiJson(data, fallbackTools);
        } catch (err) {
            return this.failFromAbortOrRequest(err, signal);
        }
    }

    private withToolCatalogInstruction(
        messages: AgentChatParams['messages'],
        tools: NonNullable<AgentChatParams['tools']>,
    ) {
        const catalog = tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
        }));
        const instruction =
            'The provider does not support the tools field. Reply with a single JSON object ' +
            '{"name":"<tool>","arguments":{...}} when a tool is needed. Available tools: ' +
            JSON.stringify(catalog);
        const first = messages[0];
        if (first?.role === 'system') {
            return [{ ...first, content: `${first.content}\n\n${instruction}` }, ...messages.slice(1)];
        }
        return [{ role: 'system' as const, content: instruction }, ...messages];
    }

    /**
     * Normalize to OpenAI Chat Completions shape and repair tool_call pairs.
     * An assistant `tool_calls` row must be followed by a `tool` reply for every id.
     * @see https://platform.openai.com/docs/guides/function-calling
     */
    private toProviderMessages(messages: AgentChatParams['messages']): AgentChatParams['messages'] {
        const normalized = messages.map((message) => {
            if (message.role === 'assistant' && message.tool_calls != null) {
                const toolCalls = normalizeOpenAiToolCalls(message.tool_calls);
                return {
                    role: 'assistant' as const,
                    content: message.content ?? '',
                    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
                };
            }
            if (message.role === 'tool') {
                return {
                    role: 'tool' as const,
                    content: message.content ?? '',
                    ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
                    ...(message.name ? { name: message.name } : {}),
                };
            }
            return {
                role: message.role,
                content: message.content ?? '',
            };
        });
        return repairOpenAiChatMessages(normalized);
    }

    private maybeParseFallbackTools(completion: AgentCompletion, fallback: boolean): AgentCompletion {
        if (completion.error || !fallback || completion.toolCalls.length) {
            return completion;
        }
        const parsed = this.parseFallbackTool(completion.text);
        if (!parsed) return completion;
        return { ...completion, toolCalls: [parsed] };
    }

    private parseFallbackTool(text: string): AgentToolCall | null {
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const start = stripped.indexOf('{');
        const end = stripped.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        try {
            const obj = JSON.parse(stripped.slice(start, end + 1));
            const name = obj.name ?? obj.tool;
            if (typeof name !== 'string') return null;
            const args = obj.arguments ?? obj.args ?? {};
            if (args === null || typeof args !== 'object' || Array.isArray(args)) return null;
            return { id: 'fallback_1', name, arguments: args as Record<string, unknown> };
        } catch {
            return null;
        }
    }

    private nativeToolCallsFromMessage(message: any): AgentToolCall[] {
        const calls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
        const out: AgentToolCall[] = [];
        for (const call of calls) {
            const raw = call.function?.arguments;
            const name = String(call.function?.name ?? '');
            const args = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
                && !looksLikeNestedToolFragment(name, raw as Record<string, unknown>)
                ? raw as Record<string, unknown>
                : parseToolArgumentsWithHeal(name, typeof raw === 'string' ? raw : JSON.stringify(raw ?? ''));
            if (!args) {
                this.logger.warn(
                    `tool_args_parse tool=${call.function?.name ?? '?'} raw=${previewToolArgs(String(raw ?? ''))}`,
                );
                return [];
            }
            out.push({
                id: String(call.id ?? `call_${out.length + 1}`),
                name: String(call.function?.name ?? ''),
                arguments: args,
            });
        }
        return out.filter((call) => call.name);
    }

    private supportsTools(provider: AgentChatParams['provider']): boolean {
        const caps = provider.capabilities ?? [];
        if (caps.includes('tools') || caps.includes('function_calling')) return true;
        const vendor = String(provider.vendor ?? '').toLowerCase();
        if (vendor === 'aipbx' || vendor === 'openai') return true;
        try {
            const host = new URL(provider.endpoint).hostname.toLowerCase();
            if (host === 'api.openai.com' || host.endsWith('.openai.com')) return true;
        } catch {
            /* ignore bad endpoint */
        }
        return false;
    }

    private resolveToolChoice(
        choice: AgentChatParams['toolChoice'] | undefined,
        nativeTools: boolean,
        hasTools: boolean,
    ): 'auto' | 'required' | 'none' | undefined {
        if (!nativeTools || !hasTools) return undefined;
        if (choice === 'required' || choice === 'none' || choice === 'auto') return choice;
        return 'auto';
    }

    private toOpenAiTools(tools: AgentChatParams['tools']) {
        return (tools ?? []).map((tool) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: this.toOpenAiParameters(tool.inputSchema),
            },
        }));
    }

    /**
     * Accept either a flat property map (legacy) or a full JSON Schema object
     * `{ type, properties, required }` from the MCP registry. Nested wrapping
     * of an already-full schema would hide `required` from the model.
     */
    private toOpenAiParameters(schema: Record<string, unknown> | undefined): Record<string, unknown> {
        const raw = schema ?? {};
        const hasFullShape =
            raw.type === 'object' ||
            (raw.properties != null && typeof raw.properties === 'object') ||
            Array.isArray(raw.required);
        if (hasFullShape) {
            const parameters: Record<string, unknown> = {
                type: 'object',
                properties:
                    raw.properties != null && typeof raw.properties === 'object' && !Array.isArray(raw.properties)
                        ? raw.properties
                        : {},
            };
            if (Array.isArray(raw.required) && raw.required.length) {
                parameters.required = raw.required;
            }
            if (raw.additionalProperties === false) {
                parameters.additionalProperties = false;
            }
            return parameters;
        }
        return { type: 'object', properties: raw };
    }

    private async readStream(
        body: ReadableStream<Uint8Array>,
        opts: { signal?: AbortSignal; onToken?: (chunk: string) => void },
    ): Promise<AgentCompletion> {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        const toolAcc = new Map<number, AccumulatedToolCall>();
        let text = '';
        let reasoning = '';
        let usage: AgentTokenUsage | undefined;
        let finishReason: string | undefined;
        let buffer = '';

        try {
            while (true) {
                if (opts.signal?.aborted) {
                    await reader.cancel().catch(() => undefined);
                    return { text, reasoning: reasoning || undefined, toolCalls: [], usage, error: { code: 'aborted', message: 'Request aborted' } };
                }

                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n');
                buffer = parts.pop() ?? '';

                for (const line of parts) {
                    if (opts.signal?.aborted) {
                        await reader.cancel().catch(() => undefined);
                        return { text, reasoning: reasoning || undefined, toolCalls: [], usage, error: { code: 'aborted', message: 'Request aborted' } };
                    }
                    const parsed = this.parseSseLine(line);
                    if (!parsed) continue;
                    if (parsed.content) {
                        text += parsed.content;
                        opts.onToken?.(parsed.content);
                    }
                    if (parsed.reasoning) {
                        reasoning += parsed.reasoning;
                    }
                    if (parsed.toolDeltas?.length) {
                        for (const toolDelta of parsed.toolDeltas) {
                            this.accumulateToolDelta(toolAcc, toolDelta);
                        }
                    }
                    if (parsed.finishReason) finishReason = parsed.finishReason;
                    if (parsed.usage) usage = parsed.usage;
                }
            }
        } catch (err) {
            if (opts.signal?.aborted || (err as Error)?.name === 'AbortError') {
                return { text, reasoning: reasoning || undefined, toolCalls: [], usage, error: { code: 'aborted', message: 'Request aborted' } };
            }
            throw err;
        }

        const parsedCalls = this.parseToolCalls(toolAcc);
        if (parsedCalls.error) {
            return { text, reasoning: reasoning || undefined, toolCalls: [], usage, error: parsedCalls.error };
        }
        return { text, reasoning: reasoning || undefined, toolCalls: parsedCalls.toolCalls, usage, finishReason };
    }

    private parseSseLine(line: string): {
        content?: string;
        reasoning?: string;
        toolDeltas?: Array<{ index: number; id?: string; name?: string; arguments?: string }>;
        finishReason?: string;
        usage?: AgentTokenUsage;
    } | null {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return null;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') return null;

        let json: any;
        try {
            json = JSON.parse(payload);
        } catch {
            return null;
        }

        if (typeof json === 'string') {
            return json ? { content: json } : null;
        }

        const choice = json?.choices?.[0];
        const delta = choice?.delta ?? {};
        const usageRaw = json?.usage;
        const tools = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
        const content = typeof delta.content === 'string'
            ? delta.content
            : typeof choice?.message?.content === 'string'
                ? choice.message.content
                : undefined;
        const reasoning = typeof delta.reasoning_content === 'string'
            ? delta.reasoning_content
            : typeof delta.reasoning === 'string'
                ? delta.reasoning
                : undefined;
        const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : undefined;
        return {
            content,
            reasoning,
            toolDeltas: tools.map((tool: any, fallbackIndex: number) => ({
                index: Number(tool.index ?? fallbackIndex),
                id: tool.id,
                name: tool.function?.name,
                arguments: this.toolArgumentsDelta(tool.function?.arguments),
            })),
            finishReason,
            usage: usageRaw
                ? {
                    promptTokens: Number(usageRaw.prompt_tokens ?? 0),
                    completionTokens: Number(usageRaw.completion_tokens ?? 0),
                }
                : undefined,
        };
    }

    private toolArgumentsDelta(raw: unknown): string | undefined {
        if (typeof raw === 'string') return raw;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            try {
                return JSON.stringify(raw);
            } catch {
                return undefined;
            }
        }
        return undefined;
    }

    private accumulateToolDelta(
        acc: Map<number, AccumulatedToolCall>,
        delta: { index: number; id?: string; name?: string; arguments?: string },
    ): void {
        const current = acc.get(delta.index) ?? { id: '', name: '', arguments: '' };
        if (delta.id) current.id = delta.id;
        if (delta.name) current.name = delta.name;
        if (delta.arguments) {
            current.arguments = mergeToolArgumentChunks(current.arguments, delta.arguments);
        }
        acc.set(delta.index, current);
    }

    private parseToolCalls(acc: Map<number, AccumulatedToolCall>): {
        toolCalls: AgentToolCall[];
        error?: AgentLlmError;
    } {
        const merged = this.coalesceToolAccumulators(acc);
        const toolCalls: AgentToolCall[] = [];
        for (const item of merged) {
            if (!item.name) continue;
            const parsed = parseToolArgumentsWithHeal(item.name, item.arguments);
            if (!parsed) {
                this.logger.warn(
                    `tool_args_parse tool=${item.name} len=${item.arguments.length} raw=${previewToolArgs(item.arguments)}`,
                );
                return {
                    toolCalls: [],
                    error: { code: 'tool_args_parse', message: `Failed to parse tool arguments for ${item.name}` },
                };
            }
            if (looksLikeNestedToolFragment(item.name, parsed) && !rawLooksLikeRootPayload(item.name, item.arguments)) {
                this.logger.warn(
                    `tool_args_shape tool=${item.name} nested-fragment args raw=${previewToolArgs(item.arguments)}`,
                );
                return {
                    toolCalls: [],
                    error: {
                        code: 'tool_args_parse',
                        message: `${item.name} arguments look like a nested item, not the top-level tool payload`,
                    },
                };
            }
            toolCalls.push({
                id: item.id || `call_${toolCalls.length + 1}`,
                name: item.name,
                arguments: parsed,
            });
        }
        return { toolCalls };
    }

    /**
     * Some gateways put name/id on one index and argument fragments on another.
     * Fold unnamed long argument buffers into the nearest named tool call.
     */
    private coalesceToolAccumulators(acc: Map<number, AccumulatedToolCall>): AccumulatedToolCall[] {
        const rows = [...acc.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, value]) => ({ ...value }));
        if (rows.length <= 1) return rows;

        const named = rows.filter((row) => row.name);
        const unnamed = rows.filter((row) => !row.name && row.arguments);
        if (!named.length || !unnamed.length) return rows;

        for (const orphan of unnamed) {
            const target =
                named.find((row) => row.id && orphan.id && row.id === orphan.id)
                ?? named.find((row) => !row.arguments || row.arguments.length < orphan.arguments.length)
                ?? named[0];
            target.arguments = mergeToolArgumentChunks(target.arguments, orphan.arguments);
            if (!target.id && orphan.id) target.id = orphan.id;
        }
        return named;
    }

    private resolveOptionalModel(provider: AgentChatParams['provider']): string | undefined {
        const raw = provider.defaults?.model;
        if (typeof raw !== 'string') return undefined;
        const trimmed = raw.trim();
        return trimmed.length ? trimmed : undefined;
    }

    /**
     * gpt-5 / o-series reject `max_tokens` and require `max_completion_tokens`.
     * Keep `max_tokens` for classic chat models and non-OpenAI gateways.
     */
    private tokenLimitParams(model: string | undefined, maxTokens: number): Record<string, number> {
        return chatTokenLimitParams(model, maxTokens);
    }

    /** Some reasoning models only accept the default temperature — omit when unsupported. */
    private samplingParams(
        provider: AgentChatParams['provider'],
        model: string | undefined,
    ): Record<string, number> {
        return chatSamplingParams(
            model,
            Number(provider.defaults?.temperature ?? DEFAULT_TEMPERATURE),
        );
    }

    private providerLabel(provider: AgentChatParams['provider']): string {
        return `${provider.name || '?'} uid=${provider.uid ?? '?'}`;
    }

    private formatHttpError(
        status: number,
        url: string,
        provider: AgentChatParams['provider'],
        model: unknown,
        detail: string,
    ): string {
        const extra = detail ? ` body=${detail}` : '';
        return `Provider returned ${status} POST ${url} provider=${this.providerLabel(provider)} model=${model ?? '(gateway)'}${extra}`;
    }

    private completionFromOpenAiJson(data: any, fallbackTools: boolean): AgentCompletion {
        const message = data?.choices?.[0]?.message;
        const text = this.messageText(message);
        const reasoning = this.messageReasoning(message);
        const usageRaw = data?.usage;
        const usage = usageRaw
            ? {
                promptTokens: Number(usageRaw.prompt_tokens ?? 0),
                completionTokens: Number(usageRaw.completion_tokens ?? 0),
            }
            : undefined;
        const finishReason = typeof data?.choices?.[0]?.finish_reason === 'string'
            ? data.choices[0].finish_reason
            : undefined;
        const native = this.nativeToolCallsFromMessage(message);
        if (!text && !native.length) {
            const messageKeys = message && typeof message === 'object' ? Object.keys(message).join(',') : 'none';
            this.logger.warn(
                `LLM JSON completion had no text/tool_calls finish=${finishReason || 'n/a'} messageKeys=${messageKeys} provider response keys=${Object.keys(data ?? {}).join(',')}`,
            );
        }
        if (native.length) {
            return { text, reasoning, toolCalls: native, usage, finishReason };
        }
        return this.maybeParseFallbackTools({ text, reasoning, toolCalls: [], usage, finishReason }, fallbackTools);
    }

    /** Prefer visible content; some thinking models leave content empty and fill reasoning_*. */
    private messageText(message: any): string {
        if (typeof message?.content === 'string' && message.content.trim()) {
            return message.content;
        }
        if (Array.isArray(message?.content)) {
            const joined = message.content
                .map((part: any) => (typeof part?.text === 'string' ? part.text : typeof part === 'string' ? part : ''))
                .join('');
            if (joined.trim()) return joined;
        }
        return typeof message?.content === 'string' ? message.content : '';
    }

    private messageReasoning(message: any): string | undefined {
        for (const key of ['reasoning_content', 'reasoning', 'thinking']) {
            const value = message?.[key];
            if (typeof value === 'string' && value.trim()) return value;
        }
        return undefined;
    }

    private async completionFromSseText(
        raw: string,
        opts: { onToken?: (chunk: string) => void; fallbackTools: boolean },
    ): Promise<AgentCompletion> {
        const encoded = new TextEncoder().encode(raw.endsWith('\n') ? raw : `${raw}\n`);
        let sent = false;
        const body = {
            getReader() {
                return {
                    async read() {
                        if (sent) return { done: true as const, value: undefined };
                        sent = true;
                        return { done: false as const, value: encoded };
                    },
                    async cancel() {
                        sent = true;
                    },
                };
            },
        };
        const streamed = await this.readStream(
            body as unknown as ReadableStream<Uint8Array>,
            { onToken: opts.onToken },
        );
        return this.maybeParseFallbackTools(streamed, opts.fallbackTools);
    }

    private responseContentType(response: { headers?: { get?: (name: string) => string | null } }): string {
        return typeof response.headers?.get === 'function'
            ? (response.headers.get('content-type') ?? '')
            : '';
    }

    private isJsonContentType(contentType: string): boolean {
        return /application\/json/i.test(contentType) && !/event-stream/i.test(contentType);
    }

    private tryParseJson(raw: string): any | null {
        const trimmed = raw.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
        try {
            return JSON.parse(trimmed);
        } catch {
            return null;
        }
    }

    private async readResponseText(response: Response): Promise<string> {
        if (typeof response.text === 'function') {
            try {
                return await response.text();
            } catch {
                return '';
            }
        }
        return '';
    }

    private async readFetchErrorBody(response: Response): Promise<string> {
        if (typeof response.text !== 'function') return '';
        try {
            return this.sanitizeErrorBody(await response.text());
        } catch {
            return '';
        }
    }

    private stringifyErrorBody(data: unknown): string {
        if (data == null) return '';
        if (typeof data === 'string') return this.sanitizeErrorBody(data);
        try {
            return this.sanitizeErrorBody(JSON.stringify(data));
        } catch {
            return '';
        }
    }

    private sanitizeErrorBody(raw: string): string {
        const redacted = raw
            .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
            .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-key]')
            .replace(/(["']?(?:api[_-]?key|authorization|token)["']?\s*[:=]\s*["'])[^"']+(["'])/gi, '$1[redacted]$2')
            .trim();
        return redacted.slice(0, MAX_ERROR_BODY_CHARS);
    }

    private fail(error: AgentLlmError): AgentCompletion {
        this.logger.warn(`PbxAgentLlmClient ${error.code}: ${error.message}`);
        return { text: '', toolCalls: [], error };
    }
}

function mergeToolArgumentChunks(current: string, delta: string): string {
    if (!delta) return current;
    if (!current) return delta;

    // Growing snapshot: provider re-sends the full prefix each time.
    if (delta.startsWith(current)) return delta;
    if (current.startsWith(delta)) return current;

    const currentObj = tryParseJsonObject(current);
    const deltaObj = tryParseJsonObject(delta);

    // Ollama-style full-object snapshots: `{}` then `{"x":1}`.
    // Never replace a root payload (name/menu_items) with a longer nested fragment
    // like `{digit:2,destination:...}` — gpt-5-nano emits those mid-stream.
    if (deltaObj && (current === '{}' || !!currentObj)) {
        if (currentObj && isNestedFragment(deltaObj) && !isNestedFragment(currentObj)) {
            return current;
        }
        const currentKeys = currentObj ? Object.keys(currentObj).length : 0;
        const deltaKeys = Object.keys(deltaObj).length;
        const deltaCoversCurrent = !currentObj || Object.keys(currentObj).every((key) => key in deltaObj);
        const currentScore = currentObj ? rootScore(currentObj) : 0;
        if (current === '{}' || (deltaCoversCurrent && (deltaKeys >= currentKeys || rootScore(deltaObj) >= currentScore))) {
            return delta;
        }
        return current + delta;
    }
    // Never let an empty-object heartbeat wipe an incomplete OpenAI fragment.
    if (delta.trim() === '{}' && !currentObj) {
        return current;
    }

    return current + delta;
}

function healBrokenToolJson(raw: string): string {
    return String(raw ?? '').replace(/\[(\s*)([A-Za-z_][\w]*)"\s*:/g, '[$1{"$2":');
}

function rawLooksLikeRootPayload(toolName: string, raw: string): boolean {
    const text = String(raw ?? '');
    if (toolName === 'create_call_group' || toolName === 'update_call_group') {
        return /"name"\s*:/.test(text) && /"exten"\s*:/.test(text);
    }
    if (toolName === 'create_ivr' || toolName === 'update_ivr') {
        return /"name"\s*:/.test(text) && (/"menu_items"\s*:/.test(text) || /"prompts"\s*:/.test(text) || /"text"\s*:/.test(text));
    }
    return false;
}

function recoverRootToolArgs(toolName: string, raw: string): Record<string, unknown> | null {
    const text = healBrokenToolJson(raw);
    if (toolName === 'create_call_group' || toolName === 'update_call_group') {
        const name = text.match(/"name"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];
        const exten = text.match(/"exten"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];
        if (!name || !exten) return null;
        const strategy = text.match(/"strategy"\s*:\s*"(\w+)"/)?.[1];
        const members: Array<Record<string, unknown>> = [];
        const memberRe = /"value"\s*:\s*"(\d{2,8})"/g;
        let match: RegExpExecArray | null;
        while ((match = memberRe.exec(text))) {
            members.push({ member_type: 'internal', value: match[1], position: members.length });
        }
        return {
            name,
            exten,
            ...(strategy ? { strategy } : {}),
            ...(members.length ? { members } : {}),
        };
    }
    if (toolName === 'create_ivr' || toolName === 'update_ivr') {
        const name = text.match(/"name"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];
        if (!name) return null;
        const promptText = text.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];
        const engineRaw = text.match(/"engine_uid"\s*:\s*(\d+)/)?.[1];
        const menu_items: Array<Record<string, unknown>> = [];
        const itemRe = /"digit"\s*:\s*"?([\dtTiI*#]+)"?[\s\S]{0,180}?"kind"\s*:\s*"(\w+)"[\s\S]{0,80}?"target"\s*:\s*"?([^"{}]+)"?/g;
        let match: RegExpExecArray | null;
        while ((match = itemRe.exec(text))) {
            menu_items.push({
                digit: match[1],
                destination: { kind: match[2], target: String(match[3]).trim() },
            });
        }
        const prompts = promptText
            ? [{ kind: 'tts', text: promptText, engine_uid: engineRaw ? Number(engineRaw) : 1 }]
            : undefined;
        return {
            name,
            ...(prompts ? { prompts } : {}),
            ...(menu_items.length ? { menu_items } : {}),
        };
    }
    return null;
}

function parseToolArgumentsWithHeal(toolName: string, raw: string): Record<string, unknown> | null {
    const healed = healBrokenToolJson(raw);
    const parsed = parseToolArgumentsObject(healed) ?? parseToolArgumentsObject(raw);
    if (parsed && (!looksLikeNestedToolFragment(toolName, parsed) || rawLooksLikeRootPayload(toolName, healed))) {
        if (looksLikeNestedToolFragment(toolName, parsed) && rawLooksLikeRootPayload(toolName, healed)) {
            return recoverRootToolArgs(toolName, healed) ?? parsed;
        }
        return parsed;
    }
    return recoverRootToolArgs(toolName, healed || raw);
}

function parseToolArgumentsObject(raw: string): Record<string, unknown> | null {
    const parsed = tryParseJsonObject(raw);
    if (parsed && Object.keys(parsed).length) return parsed;
    if (parsed && Object.keys(parsed).length === 0 && String(raw ?? '').trim() === '{}') return parsed;
    return extractBestJsonObject(raw);
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '—' || trimmed === '-') {
        return {};
    }
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
        if (parsed === null) return {};
        return null;
    } catch {
        return null;
    }
}

/** Prefer a root tool payload over a nested member/menu-item fragment. */
function extractBestJsonObject(raw: string): Record<string, unknown> | null {
    const text = String(raw ?? '');
    let best: Record<string, unknown> | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let start = 0; start < text.length; start += 1) {
        if (text[start] !== '{') continue;
        for (let end = text.length - 1; end > start; end -= 1) {
            if (text[end] !== '}') continue;
            const parsed = tryParseJsonObject(text.slice(start, end + 1));
            if (!parsed || !Object.keys(parsed).length) continue;
            const score = rootScore(parsed) * 10_000 + (end - start + 1);
            if (score > bestScore) {
                best = parsed;
                bestScore = score;
            }
        }
    }
    return best;
}

function looksLikeCallGroupMemberOnly(args: Record<string, unknown>): boolean {
    const hasMemberKeys =
        args.member_type != null ||
        (typeof args.value === 'string' && /^\d{2,8}$/.test(args.value)) ||
        args.ring_time != null;
    const hasGroupKeys =
        (typeof args.name === 'string' && args.name.trim() !== '') ||
        (typeof args.exten === 'string' && args.exten.trim() !== '') ||
        Array.isArray(args.members);
    return hasMemberKeys && !hasGroupKeys;
}

function looksLikeIvrMenuItemOnly(args: Record<string, unknown>): boolean {
    const hasItemKeys = args.digit != null || args.destination != null || args.actions != null;
    const hasIvrKeys =
        (typeof args.name === 'string' && args.name.trim() !== '') ||
        Array.isArray(args.menu_items) ||
        Array.isArray(args.prompts) ||
        Array.isArray(args.steps) ||
        (typeof args.text === 'string' && args.text.trim() !== '');
    return hasItemKeys && !hasIvrKeys;
}

function isNestedFragment(args: Record<string, unknown>): boolean {
    return looksLikeCallGroupMemberOnly(args) || looksLikeIvrMenuItemOnly(args);
}

function looksLikeNestedToolFragment(toolName: string, args: Record<string, unknown>): boolean {
    if (toolName === 'create_call_group' || toolName === 'update_call_group') {
        return looksLikeCallGroupMemberOnly(args);
    }
    if (toolName === 'create_ivr' || toolName === 'update_ivr') {
        return looksLikeIvrMenuItemOnly(args);
    }
    return false;
}

function rootScore(args: Record<string, unknown>): number {
    let score = Object.keys(args).length;
    if (typeof args.name === 'string' && args.name.trim()) score += 10;
    if (typeof args.exten === 'string' && args.exten.trim()) score += 5;
    if (Array.isArray(args.members) || Array.isArray(args.menu_items) || Array.isArray(args.prompts)) score += 8;
    if (isNestedFragment(args)) score -= 20;
    return score;
}

function previewToolArgs(raw: string, max = 160): string {
    return JSON.stringify(String(raw ?? '').slice(0, max));
}
