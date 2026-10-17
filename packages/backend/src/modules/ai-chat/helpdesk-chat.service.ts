import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PbxAgentThreadService } from './pbx-agent-thread.service';
import { HelpdeskMessageDto } from './dto/helpdesk-chat.dto';

export interface SupportSession {
  schema_version: 'support-session-v1';
  task: null | { task_id: string; ticket_id: number; status: string; version: number; question_id: string | null;
    result: { answer?: string; question?: string; reason?: string; resolution?: string } };
  history: { id: string; role: 'user' | 'support'; text: string; created_at: string }[];
}

const STATUSES = new Set(['queued', 'running', 'needs_input', 'completed', 'escalated', 'failed', 'cancelled']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class HelpdeskChatService {
  constructor(private readonly config: ConfigService, private readonly http: HttpService,
    private readonly threads: PbxAgentThreadService) {}

  async session(threadUid: number, tenantUid: number, userUid: number, message?: HelpdeskMessageDto): Promise<SupportSession> {
    if (![threadUid, tenantUid, userUid].every((id) => Number.isSafeInteger(id) && id > 0)) throw new ForbiddenException();
    const thread = await this.threads.getThread(threadUid, tenantUid, userUid);
    if (thread.status !== 'active') throw new ForbiddenException();
    if (this.config.get('HELPDESK_INTEGRATION_ENABLED') !== 'true') throw new ServiceUnavailableException('Support is not configured');
    const instance = this.config.get<string>('HELPDESK_INSTANCE_ID') ?? '';
    const token = this.config.get<string>('HELPDESK_AGENT_TOKEN') ?? '';
    let url: URL;
    try { url = new URL(this.config.get<string>('HELPDESK_URL') ?? ''); } catch { throw new ServiceUnavailableException('Support is not configured'); }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(instance) || !/^hda_[A-Za-z0-9_-]{43}$/.test(token)
      || url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
      throw new ServiceUnavailableException('Support is not configured');
    }
    const payload: Record<string, unknown> = { tenant_ref: `${instance}:tenant:${tenantUid}`, subject_ref: `user:${userUid}`, conversation_ref: `thread:${threadUid}` };
    if (message) {
      const allowed = ['requestId', 'message', 'expectedTaskId', 'expectedVersion'];
      if (Object.keys(message).some((key) => !allowed.includes(key)) || !UUID.test(message.requestId ?? '')
        || typeof message.message !== 'string' || !message.message.trim() || message.message.length > 8000
        || (message.expectedTaskId !== null && !UUID.test(message.expectedTaskId ?? ''))
        || (message.expectedVersion !== null && (!Number.isSafeInteger(message.expectedVersion) || message.expectedVersion < 1))
        || (message.expectedTaskId === null) !== (message.expectedVersion === null)) throw new BadRequestException();
      Object.assign(payload, { request_id: message.requestId, message: message.message.trim(), expected_task_id: message.expectedTaskId, expected_version: message.expectedVersion });
    }
    const endpoint = new URL(url.toString().replace(/\/?$/, '/') + (message ? 'session_message' : 'open_session'));
    let data: unknown;
    try {
      const response = await this.http.axiosRef.post(endpoint.toString(), payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 10_000, maxRedirects: 0, maxContentLength: 1_048_576, maxBodyLength: 32768,
      });
      data = response.data;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 409) throw new ConflictException('Support conversation changed; refresh and retry');
      if (status === 403 || status === 401) throw new ForbiddenException('Support access is unavailable');
      throw new ServiceUnavailableException('Support is temporarily unavailable');
    }
    const safe = this.sanitize(data);
    if (message) await this.threads.touchHelpdeskThread(threadUid, tenantUid, userUid);
    return safe;
  }

  private sanitize(value: unknown): SupportSession {
    const fail = (): never => { throw new BadGatewayException('Invalid support response'); };
    if (!value || typeof value !== 'object') return fail();
    const data = value as SupportSession;
    if (data.schema_version !== 'support-session-v1' || !Array.isArray(data.history) || data.history.length > 60) return fail();
    const history = data.history.map((row) => {
      if (!row || typeof row.id !== 'string' || row.id.length > 128 || !['user', 'support'].includes(row.role)
        || typeof row.text !== 'string' || row.text.length > 12000 || typeof row.created_at !== 'string') return fail();
      return { id: row.id, role: row.role, text: row.text, created_at: row.created_at };
    });
    let task: SupportSession['task'] = null;
    if (data.task !== null) {
      const t = data.task;
      if (!t || !UUID.test(t.task_id) || !Number.isSafeInteger(t.ticket_id) || t.ticket_id < 1 || !STATUSES.has(t.status)
        || !Number.isSafeInteger(t.version) || t.version < 1 || (t.question_id !== null && !UUID.test(t.question_id))
        || !t.result || typeof t.result !== 'object') return fail();
      const result: NonNullable<SupportSession['task']>['result'] = {};
      for (const key of ['answer', 'question', 'reason', 'resolution'] as const) {
        const text = t.result[key];
        if (text !== undefined) {
          if (typeof text !== 'string' || text.length > 12000) return fail();
          result[key] = text;
        }
      }
      task = { task_id: t.task_id, ticket_id: t.ticket_id, status: t.status, version: t.version, question_id: t.question_id, result };
    }
    // Explicit projection: no remote context/token/private diagnostics reach the browser.
    return { schema_version: 'support-session-v1', task, history };
  }
}
