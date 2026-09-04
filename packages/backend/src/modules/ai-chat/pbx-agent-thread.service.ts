import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AgentThread } from './models/agent-thread.model';
import { AgentThreadMessage, AgentThreadMessageRole } from './models/agent-thread-message.model';

const TITLE_FROM_MESSAGE_MAX = 80;

export interface AppendMessageInput {
  role: AgentThreadMessageRole;
  content?: string | null;
  tool_name?: string | null;
  tool_calls?: unknown;
  proposal_id?: string | null;
  tokens_in?: number;
  tokens_out?: number;
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
      proposal_id: input.proposal_id ?? null,
      tokens_in: input.tokens_in ?? 0,
      tokens_out: input.tokens_out ?? 0,
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
}
