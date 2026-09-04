import { NotFoundException } from '@nestjs/common';
import { PbxAgentThreadService } from './pbx-agent-thread.service';

type ThreadRow = {
  uid: number;
  vpbx_user_uid: number;
  user_uid: number;
  title: string;
  status: string;
  provider_uid: number | null;
  tokens_in: number;
  tokens_out: number;
  last_message_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type MessageRow = {
  uid: number;
  thread_uid: number;
  vpbx_user_uid: number;
  role: string;
  content: string | null;
  tool_name: string | null;
  tool_calls: unknown;
  proposal_id: string | null;
  tokens_in: number;
  tokens_out: number;
  created_at: Date;
};

function matchesWhere<T extends Record<string, unknown>>(row: T, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function createModels() {
  const threads: ThreadRow[] = [];
  const messages: MessageRow[] = [];
  let nextThreadUid = 1;
  let nextMessageUid = 1;

  const threadModel = {
    create: jest.fn(async (values: Partial<ThreadRow>) => {
      const now = new Date();
      const row: ThreadRow = {
        uid: nextThreadUid++,
        vpbx_user_uid: values.vpbx_user_uid as number,
        user_uid: values.user_uid as number,
        title: values.title ?? '',
        status: values.status ?? 'active',
        provider_uid: values.provider_uid ?? null,
        tokens_in: values.tokens_in ?? 0,
        tokens_out: values.tokens_out ?? 0,
        last_message_at: values.last_message_at ?? null,
        created_at: values.created_at ?? now,
        updated_at: values.updated_at ?? now,
      };
      threads.push(row);
      return row;
    }),
    findAll: jest.fn(async (opts: { where?: Record<string, unknown>; order?: [string, string][] } = {}) => {
      let rows = threads.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, opts.where));
      const order = opts.order?.[0];
      if (order) {
        const [field, dir] = order;
        rows = [...rows].sort((a, b) => {
          const av = a[field as keyof ThreadRow];
          const bv = b[field as keyof ThreadRow];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          const cmp = av > bv ? 1 : av < bv ? -1 : 0;
          return dir === 'DESC' ? -cmp : cmp;
        });
      }
      return rows;
    }),
    findOne: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) => {
      return threads.find((row) => matchesWhere(row as unknown as Record<string, unknown>, opts.where)) ?? null;
    }),
    findByPk: jest.fn(async () => {
      throw new Error('findByPk is forbidden — every lookup must include tenant and author');
    }),
    update: jest.fn(async (values: Partial<ThreadRow>, opts: { where?: Record<string, unknown> } = {}) => {
      const matched = threads.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, opts.where));
      matched.forEach((row) => Object.assign(row, values, { updated_at: new Date() }));
      return [matched.length] as const;
    }),
    increment: jest.fn(async (fields: Record<string, number>, opts: { where?: Record<string, unknown> } = {}) => {
      const matched = threads.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, opts.where));
      matched.forEach((row) => {
        for (const [key, amount] of Object.entries(fields)) {
          (row as unknown as Record<string, number>)[key] =
            ((row as unknown as Record<string, number>)[key] ?? 0) + amount;
        }
      });
      return [matched];
    }),
    destroy: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) => {
      const keep: ThreadRow[] = [];
      let removed = 0;
      for (const row of threads) {
        if (matchesWhere(row as unknown as Record<string, unknown>, opts.where)) {
          removed += 1;
        } else {
          keep.push(row);
        }
      }
      threads.splice(0, threads.length, ...keep);
      return removed;
    }),
  };

  const messageModel = {
    create: jest.fn(async (values: Partial<MessageRow>) => {
      const row: MessageRow = {
        uid: nextMessageUid++,
        thread_uid: values.thread_uid as number,
        vpbx_user_uid: values.vpbx_user_uid as number,
        role: values.role as string,
        content: values.content ?? null,
        tool_name: values.tool_name ?? null,
        tool_calls: values.tool_calls ?? null,
        proposal_id: values.proposal_id ?? null,
        tokens_in: values.tokens_in ?? 0,
        tokens_out: values.tokens_out ?? 0,
        created_at: values.created_at ?? new Date(),
      };
      messages.push(row);
      return row;
    }),
    findAll: jest.fn(async (opts: { where?: Record<string, unknown>; order?: [string, string][] } = {}) => {
      let rows = messages.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, opts.where));
      const order = opts.order?.[0];
      if (order) {
        const [field, dir] = order;
        rows = [...rows].sort((a, b) => {
          const av = a[field as keyof MessageRow];
          const bv = b[field as keyof MessageRow];
          const cmp = av > bv ? 1 : av < bv ? -1 : 0;
          return dir === 'DESC' ? -cmp : cmp;
        });
      }
      return rows;
    }),
    findOne: jest.fn(async (opts: { where?: Record<string, unknown>; order?: [string, string][] } = {}) => {
      const rows = await messageModel.findAll(opts);
      return rows[0] ?? null;
    }),
    findByPk: jest.fn(async () => {
      throw new Error('findByPk is forbidden — every lookup must include tenant and author');
    }),
    update: jest.fn(async (values: Partial<MessageRow>, opts: { where?: Record<string, unknown> } = {}) => {
      const matched = messages.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, opts.where));
      matched.forEach((row) => Object.assign(row, values));
      return [matched.length] as const;
    }),
    destroy: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) => {
      const keep: MessageRow[] = [];
      let removed = 0;
      for (const row of messages) {
        if (matchesWhere(row as unknown as Record<string, unknown>, opts.where)) {
          removed += 1;
        } else {
          keep.push(row);
        }
      }
      messages.splice(0, messages.length, ...keep);
      return removed;
    }),
  };

  return { threads, messages, threadModel, messageModel };
}

describe('PbxAgentThreadService', () => {
  const tenantA = 10;
  const tenantB = 20;
  const authorA = 100;
  const authorB = 200;

  let models: ReturnType<typeof createModels>;
  let service: PbxAgentThreadService;

  beforeEach(() => {
    models = createModels();
    service = new PbxAgentThreadService(models.threadModel as any, models.messageModel as any);
  });

  it('lists threads for the same tenant and author, newest first', async () => {
    const older = await service.createThread(tenantA, authorA);
    await new Promise((r) => setTimeout(r, 5));
    const newer = await service.createThread(tenantA, authorA);

    const listed = await service.listThreads(tenantA, authorA);

    expect(listed.map((t) => t.uid)).toEqual([newer.uid, older.uid]);
    expect(listed.every((t) => t.vpbx_user_uid === tenantA && t.user_uid === authorA)).toBe(true);
  });

  it('returns appended messages in insertion order after a reload-style read', async () => {
    const thread = await service.createThread(tenantA, authorA);
    await service.appendMessage(thread.uid, tenantA, authorA, { role: 'user', content: 'first' });
    await service.appendMessage(thread.uid, tenantA, authorA, { role: 'assistant', content: 'second' });

    const messages = await service.listMessages(thread.uid, tenantA, authorA);

    expect(messages.map((m) => m.content)).toEqual(['first', 'second']);
  });

  it('hides another tenant’s conversation: list is empty and read is not-found', async () => {
    const thread = await service.createThread(tenantA, authorA);
    await service.appendMessage(thread.uid, tenantA, authorA, { role: 'user', content: 'secret dump' });

    expect(await service.listThreads(tenantB, authorA)).toEqual([]);
    await expect(service.getThread(thread.uid, tenantB, authorA)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.listMessages(thread.uid, tenantB, authorA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides another author’s conversation in the same tenant: list is empty and read is not-found', async () => {
    const thread = await service.createThread(tenantA, authorA);
    await service.appendMessage(thread.uid, tenantA, authorA, { role: 'user', content: 'author private' });

    expect(await service.listThreads(tenantA, authorB)).toEqual([]);
    await expect(service.getThread(thread.uid, tenantA, authorB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.listMessages(thread.uid, tenantA, authorB)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never uses primary-key lookup helpers', async () => {
    const thread = await service.createThread(tenantA, authorA);
    await service.getThread(thread.uid, tenantA, authorA);
    await service.listMessages(thread.uid, tenantA, authorA);
    await service.appendMessage(thread.uid, tenantA, authorA, { role: 'user', content: 'hi' });
    await service.deleteThread(thread.uid, tenantA, authorA);

    expect(models.threadModel.findByPk).not.toHaveBeenCalled();
    expect(models.messageModel.findByPk).not.toHaveBeenCalled();
  });
});
