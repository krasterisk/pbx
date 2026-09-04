import { Injectable, Logger } from '@nestjs/common';
import { decryptSecret } from '../ai-agents/util/secret-cipher.util';
import { resolveChatCompletionsUrl } from '../voicemail/llm-summary.service';
import type {
    AgentChatParams,
    AgentCompletion,
    AgentLlmError,
    AgentToolCall,
    AgentTokenUsage,
} from './pbx-agent.types';

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MODEL = 'gpt-4o-mini';

interface AccumulatedToolCall {
    id: string;
    name: string;
    arguments: string;
}

@Injectable()
export class PbxAgentLlmClient {
    private readonly logger = new Logger(PbxAgentLlmClient.name);

    async chat(params: AgentChatParams): Promise<AgentCompletion> {
        const { provider, messages, tools = [], signal, stream = true, onToken } = params;

        if (signal?.aborted) {
            return this.fail({ code: 'aborted', message: 'Request aborted before send' });
        }

        const url = resolveChatCompletionsUrl(provider.endpoint);
        if (!url) {
            return this.fail({
                code: 'invalid_endpoint',
                message: 'Provider endpoint cannot be normalized to a chat-completions URL',
            });
        }

        const headers = this.buildHeaders(provider);
        const body = {
            model: String(provider.defaults?.model ?? DEFAULT_MODEL),
            temperature: Number(provider.defaults?.temperature ?? DEFAULT_TEMPERATURE),
            max_tokens: Number(provider.defaults?.max_tokens ?? DEFAULT_MAX_TOKENS),
            stream,
            messages,
            ...(this.supportsTools(provider) && tools.length
                ? { tools: this.toOpenAiTools(tools) }
                : {}),
        };

        const requestSignal = signal ?? new AbortController().signal;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: requestSignal,
            });

            if (!response.ok) {
                return this.fail({
                    code: 'provider_http',
                    message: `Provider returned ${response.status}`,
                    status: response.status,
                });
            }

            if (!response.body) {
                return this.fail({ code: 'empty_body', message: 'Provider returned an empty body' });
            }

            return await this.readStream(response.body as ReadableStream<Uint8Array>, { signal: requestSignal, onToken });
        } catch (err) {
            if (requestSignal.aborted || (err as Error)?.name === 'AbortError') {
                return this.fail({ code: 'aborted', message: 'Request aborted' });
            }
            return this.fail({
                code: 'provider_request',
                message: (err as Error).message || 'Provider request failed',
            });
        }
    }

    private buildHeaders(provider: AgentChatParams['provider']): Record<string, string> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const key = decryptSecret(provider.encrypted_api_key ?? '');
        const auth = provider.auth_type ?? 'bearer';
        if (auth === 'bearer' && key) headers.Authorization = `Bearer ${key}`;
        else if (auth === 'api_key_header' && key) headers['X-API-Key'] = key;
        return headers;
    }

    private supportsTools(provider: AgentChatParams['provider']): boolean {
        const caps = provider.capabilities ?? [];
        return caps.includes('tools') || caps.includes('function_calling');
    }

    private toOpenAiTools(tools: AgentChatParams['tools']) {
        return (tools ?? []).map((tool) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: { type: 'object', properties: tool.inputSchema ?? {} },
            },
        }));
    }

    private async readStream(
        body: ReadableStream<Uint8Array>,
        opts: { signal?: AbortSignal; onToken?: (chunk: string) => void },
    ): Promise<AgentCompletion> {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        const toolAcc = new Map<number, AccumulatedToolCall>();
        let text = '';
        let usage: AgentTokenUsage | undefined;
        let buffer = '';

        try {
            while (true) {
                if (opts.signal?.aborted) {
                    await reader.cancel().catch(() => undefined);
                    return { text, toolCalls: [], usage, error: { code: 'aborted', message: 'Request aborted' } };
                }

                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n');
                buffer = parts.pop() ?? '';

                for (const line of parts) {
                    if (opts.signal?.aborted) {
                        await reader.cancel().catch(() => undefined);
                        return { text, toolCalls: [], usage, error: { code: 'aborted', message: 'Request aborted' } };
                    }
                    const parsed = this.parseSseLine(line);
                    if (!parsed) continue;
                    if (parsed.content) {
                        text += parsed.content;
                        opts.onToken?.(parsed.content);
                    }
                    if (parsed.toolDelta) {
                        this.accumulateToolDelta(toolAcc, parsed.toolDelta);
                    }
                    if (parsed.usage) usage = parsed.usage;
                }
            }
        } catch (err) {
            if (opts.signal?.aborted || (err as Error)?.name === 'AbortError') {
                return { text, toolCalls: [], usage, error: { code: 'aborted', message: 'Request aborted' } };
            }
            throw err;
        }

        const parsedCalls = this.parseToolCalls(toolAcc);
        if (parsedCalls.error) {
            return { text, toolCalls: [], usage, error: parsedCalls.error };
        }
        return { text, toolCalls: parsedCalls.toolCalls, usage };
    }

    private parseSseLine(line: string): {
        content?: string;
        toolDelta?: { index: number; id?: string; name?: string; arguments?: string };
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

        const delta = json?.choices?.[0]?.delta ?? {};
        const usageRaw = json?.usage;
        const tool = Array.isArray(delta.tool_calls) ? delta.tool_calls[0] : undefined;
        return {
            content: typeof delta.content === 'string' ? delta.content : undefined,
            toolDelta: tool
                ? {
                    index: Number(tool.index ?? 0),
                    id: tool.id,
                    name: tool.function?.name,
                    arguments: typeof tool.function?.arguments === 'string' ? tool.function.arguments : undefined,
                }
                : undefined,
            usage: usageRaw
                ? {
                    promptTokens: Number(usageRaw.prompt_tokens ?? 0),
                    completionTokens: Number(usageRaw.completion_tokens ?? 0),
                }
                : undefined,
        };
    }

    private accumulateToolDelta(
        acc: Map<number, AccumulatedToolCall>,
        delta: { index: number; id?: string; name?: string; arguments?: string },
    ): void {
        const current = acc.get(delta.index) ?? { id: '', name: '', arguments: '' };
        if (delta.id) current.id = delta.id;
        if (delta.name) current.name = delta.name;
        if (delta.arguments) current.arguments += delta.arguments;
        acc.set(delta.index, current);
    }

    private parseToolCalls(acc: Map<number, AccumulatedToolCall>): {
        toolCalls: AgentToolCall[];
        error?: AgentLlmError;
    } {
        const toolCalls: AgentToolCall[] = [];
        for (const item of [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)) {
            if (!item.name) continue;
            try {
                const parsed = item.arguments ? JSON.parse(item.arguments) : {};
                if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    return {
                        toolCalls: [],
                        error: { code: 'tool_args_parse', message: `Tool arguments for ${item.name} are not a JSON object` },
                    };
                }
                toolCalls.push({
                    id: item.id || `call_${toolCalls.length + 1}`,
                    name: item.name,
                    arguments: parsed as Record<string, unknown>,
                });
            } catch {
                return {
                    toolCalls: [],
                    error: { code: 'tool_args_parse', message: `Failed to parse tool arguments for ${item.name}` },
                };
            }
        }
        return { toolCalls };
    }

    private fail(error: AgentLlmError): AgentCompletion {
        this.logger.warn(`PbxAgentLlmClient ${error.code}: ${error.message}`);
        return { text: '', toolCalls: [], error };
    }
}
