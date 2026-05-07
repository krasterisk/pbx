import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PbxContextBuilderService } from './pbx-context-builder.service';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

@Injectable()
export class AiChatService {
    private readonly logger = new Logger(AiChatService.name);

    constructor(
        private readonly config: ConfigService,
        private readonly http: HttpService,
        private readonly contextBuilder: PbxContextBuilderService,
    ) {}

    /**
     * Stream chat completion via aiPBX ChatService (SSE proxy).
     *
     * Payload includes `mcpServers` — ephemeral MCP per-request:
     * aiPBX connects to KrAsterisk MCP for this request only,
     * with X-Vpbx-User-Uid header for tenant isolation.
     *
     * Ref: aiPBX/.docs/MCP_INTEGRATION.md
     */
    async *streamFromAiPbx(
        message: string,
        history: ChatMessage[],
        userUid: number,
        signal?: AbortSignal,
    ): AsyncGenerator<string> {
        const aiPbxUrl = this.config.get<string>('AIPBX_URL');
        const chatId = this.config.get<string>('AIPBX_CHAT_ID');
        const token = this.config.get<string>('AIPBX_TOKEN');
        const publicUrl = this.config.get<string>('KRASTERISK_PUBLIC_URL');
        const serviceToken = this.config.get<string>('KRASTERISK_SERVICE_TOKEN');

        if (!aiPbxUrl || !chatId || !token) {
            yield `event: error\ndata: ${JSON.stringify('AI-ассистент не настроен. Обратитесь к администратору.')}\n\n`;
            return;
        }

        // Build the system prompt from current PBX state
        let systemMessage: ChatMessage | null = null;
        try {
            const state = await this.contextBuilder.buildState(userUid);
            const prompt = this.contextBuilder.buildSystemPrompt(state);
            systemMessage = { role: 'system', content: prompt };
        } catch (err: any) {
            this.logger.warn(`Failed to build PBX state for user ${userUid}: ${(err as Error).message}`);
        }

        // mcpServers — ephemeral per-request MCP (no DB registration in aiPBX).
        // aiPBX will do tools/list → LLM → tools/call with these headers.
        // X-Vpbx-User-Uid ensures tenant isolation on KrAsterisk side.
        const mcpServers = (publicUrl && serviceToken)
            ? [
                {
                    url: `${publicUrl}/api/mcp`,
                    transport: 'http',
                    headers: {
                        'Authorization': `Bearer ${serviceToken}`,
                        'X-Vpbx-User-Uid': String(userUid),
                    },
                },
            ]
            : [];

        if (!mcpServers.length) {
            this.logger.warn('KRASTERISK_PUBLIC_URL or KRASTERISK_SERVICE_TOKEN not set — MCP tools disabled');
        }

        const payload = {
            message,
            history: systemMessage
                ? [systemMessage, ...history]
                : history,
            ...(mcpServers.length ? { mcpServers } : {}),
        };

        try {
            const response = await fetch(`${aiPbxUrl}/chats/${chatId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify(payload),
                signal: signal as any,
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => response.statusText);
                this.logger.error(`aiPBX returned ${response.status}: ${errText}`);
                yield `event: error\ndata: ${JSON.stringify(`Ошибка AI-сервиса: ${response.status}`)}\n\n`;
                return;
            }

            if (!response.body) {
                yield `event: error\ndata: ${JSON.stringify('Пустой ответ от AI-сервиса')}\n\n`;
                return;
            }

            // Pipe the SSE stream directly
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                if (signal?.aborted) return;
                const { done, value } = await reader.read();
                if (done) break;
                yield decoder.decode(value, { stream: true });
            }
        } catch (err: any) {
            if (signal?.aborted) return;
            this.logger.error(`Stream error: ${err.message}`);
            yield `event: error\ndata: ${JSON.stringify(err.message)}\n\n`;
        }
    }

    /**
     * Get available models from aiPBX.
     * Endpoint: GET /api/aiModels/external (API key scope: models:read)
     * Ref: aiPBX/.docs/API_KEYS.md
     */
    async getAvailableModels(): Promise<Array<{ name: string; displayName: string }>> {
        const aiPbxUrl = this.config.get<string>('AIPBX_URL');
        const token = this.config.get<string>('AIPBX_TOKEN');
        if (!aiPbxUrl || !token) return [];
        try {
            const response = await fetch(`${aiPbxUrl}/aiModels/external`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) return [];
            const data = await response.json() as any[];
            return data
                .filter(m => m.publish)
                .map(m => ({ name: m.name, displayName: m.publishName || m.name }));
        } catch (err: any) {
            this.logger.warn(`Could not fetch models: ${err.message}`);
            return [];
        }
    }
}
