import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { AgentItemVisibility, AgentTurnCloseKind } from '@krasterisk/shared';
import { AgentThread } from './models/agent-thread.model';
import { AgentThreadMessage, AgentThreadMessageRole } from './models/agent-thread-message.model';
import type { ConversationBrief } from './conversation-brief.types';
import type { ThreadVisibilityScope } from './thread-visibility.service';

const TITLE_FROM_MESSAGE_MAX = 80;

/** Recent complete assistant/tool turns kept in the model prompt (bounded replay). */
export const BOUNDED_REPLAY_MESSAGE_LIMIT = 24;
/** Approximate history token budget for replayed rows (excludes system + brief). */
export const HISTORY_TOKEN_BUDGET = 6000;
export const CHARS_PER_TOKEN_ESTIMATE = 4;

export interface AppendMessageInput {
  role: AgentThreadMessageRole;
  content?: string | null;
  tool_name?: string | null;
  tool_calls?: unknown;
  tool_call_id?: string | null;
  proposal_id?: string | null;
  provider_model?: string | null;
  tokens_in?: number;
  tokens_out?: number;
  close_kind?: AgentTurnCloseKind | null;
  visibility?: AgentItemVisibility;
  reasoning?: string | null;
}

export interface ThreadUsageDelta {
  in: number;
  out: number;
}

/**
 * Tenant- and author-scoped persistence for chat-agent conversations (D-26).
 *
 * Every read and write puts `vpbx_user_uid` and `user_uid` in the where clause.
 * Primary-key lookup helpers (`findByPk`) are forbidden — that shortcut is how
 * a conversation containing a configuration dump leaks to another tenant (T-15-08).
 */
@Injectable()
export class PbxAgentThreadService {
  constructor(
    @InjectModel(AgentThread) private readonly threadModel: typeof AgentThread,
    @InjectModel(AgentThreadMessage) private readonly messageModel: typeof AgentThreadMessage,
  ) {}

  async createThread(vpbxUserUid: number, userUid: number): Promise<AgentThread> {
    const now = new Date();
    return this.threadModel.create({
      vpbx_user_uid: vpbxUserUid,
      user_uid: userUid,
      title: '',
      status: 'active',
      provider_uid: null,
      tokens_in: 0,
      tokens_out: 0,
      brief_json: null,
      brief_version: 0,
      brief_updated_through_message_uid: null,
      last_message_at: now,
      created_at: now,
      updated_at: now,
    });
  }

  async listThreads(vpbxUserUid: number, userUid: number): Promise<AgentThread[]> {
    return this.threadModel.findAll({
      where: { vpbx_user_uid: vpbxUserUid, user_uid: userUid },
      order: [['last_message_at', 'DESC']],
    });
  }

  async getThread(threadUid: number, vpbxUserUid: number, userUid: number): Promise<AgentThread> {
    const thread = await this.findOwnedThread(threadUid, vpbxUserUid, userUid);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    return thread;
  }

  /** Треды других авторов тенанта, доступные на чтение. Пишущих операций не даёт. */
  async listReadableThreads(
    vpbxUserUid: number,
    scope: ThreadVisibilityScope,
    selfUid: number,
  ): Promise<AgentThread[]> {
    const authorWhere = this.readableAuthorWhere(scope, selfUid);
    if (!authorWhere) {
      return [];
    }
    return this.threadModel.findAll({
      where: { vpbx_user_uid: vpbxUserUid, user_uid: authorWhere },
      order: [['last_message_at', 'DESC']],
    });
  }

  /** Тред на чтение: свой или разрешённый scope. Бросает NotFound, если ни то ни другое. */
  async getReadableThread(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
    scope: ThreadVisibilityScope,
  ): Promise<AgentThread> {
    const thread = await this.threadModel.findOne({
      where: { uid: threadUid, vpbx_user_uid: vpbxUserUid },
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    if (this.canReadThread(thread.user_uid, userUid, scope)) {
      return thread;
    }
    throw new NotFoundException('Thread not found');
  }

  /** Строки треда на чтение. Тенант в where обязателен, автор — из найденного треда. */
  async listReadableMessages(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
    scope: ThreadVisibilityScope,
  ): Promise<AgentThreadMessage[]> {
    await this.getReadableThread(threadUid, vpbxUserUid, userUid, scope);
    return this.messageModel.findAll({
      where: { thread_uid: threadUid, vpbx_user_uid: vpbxUserUid },
      order: [['uid', 'ASC']],
    });
  }

  async listMessages(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
  ): Promise<AgentThreadMessage[]> {
    await this.getThread(threadUid, vpbxUserUid, userUid);
    return this.messageModel.findAll({
      where: { thread_uid: threadUid, vpbx_user_uid: vpbxUserUid },
      order: [['uid', 'ASC']],
    });
  }

  /**
   * Bounded replay for the model: keep recent complete assistant/tool pairs and
   * user turns within a token budget. Skill bodies must not appear as tool history
   * (they are re-injected via the system prompt when selected).
   */
  async listMessagesForReplay(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
    options: { limit?: number; tokenBudget?: number } = {},
  ): Promise<AgentThreadMessage[]> {
    const all = await this.listMessages(threadUid, vpbxUserUid, userUid);
    const limit = options.limit ?? BOUNDED_REPLAY_MESSAGE_LIMIT;
    const budget = options.tokenBudget ?? HISTORY_TOKEN_BUDGET;
    const filtered = all.filter((row) => {
      if (row.role === 'tool' && row.tool_name === 'read_skill') return false;
      return true;
    });
    const recent = filtered.slice(-limit);
    const kept: AgentThreadMessage[] = [];
    let used = 0;
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      const row = recent[i];
      const cost = Math.ceil((row.content?.length ?? 0) / CHARS_PER_TOKEN_ESTIMATE);
      if (kept.length && used + cost > budget) break;
      kept.unshift(row);
      used += cost;
    }
    return this.alignReplayToToolPairs(filtered, kept);
  }

  /**
   * Replay must not start mid tool-reply or keep an assistant tool_calls without
   * its following tool messages (OpenAI rejects both).
   */
  private alignReplayToToolPairs(
    all: AgentThreadMessage[],
    kept: AgentThreadMessage[],
  ): AgentThreadMessage[] {
    if (!kept.length) return kept;
    let startUid = kept[0].uid;
    const startIdx = all.findIndex((row) => row.uid === startUid);
    if (startIdx < 0) return kept;

    let from = startIdx;
    while (from > 0 && all[from].role === 'tool') {
      from -= 1;
    }
    if (all[from]?.role === 'assistant' && all[from].tool_calls) {
      // include the assistant that owns leading tool replies
    } else if (all[from]?.role === 'tool') {
      from = startIdx;
      while (from < all.length && all[from].role === 'tool') from += 1;
    }

    let to = all.findIndex((row) => row.uid === kept[kept.length - 1].uid);
    if (to < 0) to = all.length - 1;
    const last = all[to];
    if (last?.role === 'assistant' && last.tool_calls) {
      const callIds = this.toolCallIds(last.tool_calls);
      let cursor = to + 1;
      while (cursor < all.length && all[cursor].role === 'tool' && callIds.size) {
        const id = all[cursor].tool_call_id;
        if (id && callIds.has(id)) callIds.delete(id);
        to = cursor;
        cursor += 1;
      }
    }

    return all.slice(from, to + 1);
  }

  private toolCallIds(raw: unknown): Set<string> {
    if (!Array.isArray(raw)) return new Set();
    return new Set(
      raw
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return '';
          const id = (entry as { id?: unknown }).id;
          return typeof id === 'string' ? id : '';
        })
        .filter(Boolean),
    );
  }

  async appendMessage(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
    input: AppendMessageInput,
  ): Promise<AgentThreadMessage> {
    const thread = await this.getThread(threadUid, vpbxUserUid, userUid);
    const now = new Date();
    const message = await this.messageModel.create({
      thread_uid: threadUid,
      vpbx_user_uid: vpbxUserUid,
      role: input.role,
      content: input.content ?? null,
      tool_name: input.tool_name ?? null,
      tool_calls: input.tool_calls ?? null,
      tool_call_id: input.tool_call_id ?? null,
      proposal_id: input.proposal_id ?? null,
      provider_model: input.provider_model ?? null,
      tokens_in: input.tokens_in ?? 0,
      tokens_out: input.tokens_out ?? 0,
      close_kind: input.close_kind ?? null,
      visibility: input.visibility ?? 'public',
      reasoning: input.reasoning ?? null,
      created_at: now,
    });
    await this.threadModel.update(
      { last_message_at: now, updated_at: now },
      { where: { uid: threadUid, vpbx_user_uid: vpbxUserUid, user_uid: userUid } },
    );
    if (input.role === 'user' && !thread.title) {
      await this.renameThreadFromFirstMessage(threadUid, vpbxUserUid, userUid);
    }
    return message;
  }

  async saveBrief(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
    brief: ConversationBrief,
  ): Promise<void> {
    await this.getThread(threadUid, vpbxUserUid, userUid);
    await this.threadModel.update(
      {
        brief_json: brief,
        brief_version: brief.version,
        brief_updated_through_message_uid: brief.updatedThroughMessageUid || null,
        updated_at: new Date(),
      },
      { where: { uid: threadUid, vpbx_user_uid: vpbxUserUid, user_uid: userUid } },
    );
  }

  async setProviderUid(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
    providerUid: number,
  ): Promise<void> {
    await this.getThread(threadUid, vpbxUserUid, userUid);
    await this.threadModel.update(
      { provider_uid: providerUid, updated_at: new Date() },
      { where: { uid: threadUid, vpbx_user_uid: vpbxUserUid, user_uid: userUid } },
    );
  }

  async renameThreadFromFirstMessage(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
  ): Promise<void> {
    await this.getThread(threadUid, vpbxUserUid, userUid);
    const firstUser = await this.messageModel.findOne({
      where: { thread_uid: threadUid, vpbx_user_uid: vpbxUserUid, role: 'user' },
      order: [['uid', 'ASC']],
    });
    const raw = firstUser?.content?.trim() ?? '';
    const title = raw.slice(0, TITLE_FROM_MESSAGE_MAX);
    await this.threadModel.update(
      { title, updated_at: new Date() },
      { where: { uid: threadUid, vpbx_user_uid: vpbxUserUid, user_uid: userUid } },
    );
  }

  async deleteThread(threadUid: number, vpbxUserUid: number, userUid: number): Promise<void> {
    await this.getThread(threadUid, vpbxUserUid, userUid);
    await this.messageModel.destroy({
      where: { thread_uid: threadUid, vpbx_user_uid: vpbxUserUid },
    });
    await this.threadModel.destroy({
      where: { uid: threadUid, vpbx_user_uid: vpbxUserUid, user_uid: userUid },
    });
  }

  async addUsage(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
    usage: ThreadUsageDelta,
  ): Promise<void> {
    await this.getThread(threadUid, vpbxUserUid, userUid);
    await this.threadModel.increment(
      { tokens_in: usage.in, tokens_out: usage.out },
      { where: { uid: threadUid, vpbx_user_uid: vpbxUserUid, user_uid: userUid } },
    );
    const latest = await this.messageModel.findOne({
      where: { thread_uid: threadUid, vpbx_user_uid: vpbxUserUid },
      order: [['uid', 'DESC']],
    });
    if (latest) {
      await this.messageModel.update(
        { tokens_in: usage.in, tokens_out: usage.out },
        { where: { uid: latest.uid, thread_uid: threadUid, vpbx_user_uid: vpbxUserUid } },
      );
    }
  }

  private async findOwnedThread(
    threadUid: number,
    vpbxUserUid: number,
    userUid: number,
  ): Promise<AgentThread | null> {
    return this.threadModel.findOne({
      where: { uid: threadUid, vpbx_user_uid: vpbxUserUid, user_uid: userUid },
    });
  }

  private canReadThread(authorUid: number, callerUid: number, scope: ThreadVisibilityScope): boolean {
    if (authorUid === callerUid) return true;
    if (scope.allTenantThreads) return true;
    return Boolean(scope.readableAuthors?.includes(authorUid));
  }

  private readableAuthorWhere(
    scope: ThreadVisibilityScope,
    selfUid: number,
  ): { [Op.ne]: number } | { [Op.in]: number[] } | null {
    if (scope.allTenantThreads) {
      return { [Op.ne]: selfUid };
    }
    const authors = (scope.readableAuthors ?? []).filter((id) => id !== selfUid);
    if (authors.length === 0) {
      return null;
    }
    return { [Op.in]: authors };
  }
}
