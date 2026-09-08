import { NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
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
  tool_call_id: string | null;
  proposal_id: string | null;
  tokens_in: number;
  tokens_out: number;
  created_at: Date;
};

function matchesWhere<T extends Record<string, unknown>>(row: T, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      const ops = value as Record<PropertyKey, unknown>;
      if (Op.in in ops) {
        const list = ops[Op.in];
        return Array.isArray(list) && list.includes(row[key]);
      }
      if (Op.ne in ops) {
        return row[key] !== ops[Op.ne];
      }
    }
    return row[key] === value;
  });
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
        tool_call_id: values.tool_call_id ?? null,
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

  it('addUsage increments thread counters and writes the per-message split', async () => {
    const thread = await service.createThread(tenantA, authorA);
    const message = await service.appendMessage(thread.uid, tenantA, authorA, {
      role: 'assistant',
      content: 'done',
    });

    await service.addUsage(thread.uid, tenantA, authorA, { in: 12, out: 34 });

    const reloaded = await service.getThread(thread.uid, tenantA, authorA);
    expect(reloaded.tokens_in).toBe(12);
    expect(reloaded.tokens_out).toBe(34);
    const messages = await service.listMessages(thread.uid, tenantA, authorA);
    const stored = messages.find((m) => m.uid === message.uid);
    expect(stored?.tokens_in).toBe(12);
    expect(stored?.tokens_out).toBe(34);
  });

  it('addUsage for another tenant or author does not change counters', async () => {
    const thread = await service.createThread(tenantA, authorA);
    await service.appendMessage(thread.uid, tenantA, authorA, { role: 'user', content: 'x' });

    await expect(service.addUsage(thread.uid, tenantB, authorA, { in: 99, out: 99 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.addUsage(thread.uid, tenantA, authorB, { in: 99, out: 99 })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const reloaded = await service.getThread(thread.uid, tenantA, authorA);
    expect(reloaded.tokens_in).toBe(0);
    expect(reloaded.tokens_out).toBe(0);
  });

  it('listMessagesForReplay keeps assistant tool_calls with their tool replies', async () => {
    const thread = await service.createThread(tenantA, authorA);
    await service.appendMessage(thread.uid, tenantA, authorA, { role: 'user', content: 'start' });
    await service.appendMessage(thread.uid, tenantA, authorA, {
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'call_x', name: 'create_call_group', arguments: {} }],
    });
    await service.appendMessage(thread.uid, tenantA, authorA, {
      role: 'tool',
      content: '{"error":"invalid_arguments"}',
      tool_name: 'create_call_group',
      tool_call_id: 'call_x',
    });
    await service.appendMessage(thread.uid, tenantA, authorA, { role: 'user', content: 'again' });

    const all = await service.listMessages(thread.uid, tenantA, authorA);
    expect(all.find((row) => row.role === 'tool')).toMatchObject({
      tool_name: 'create_call_group',
      tool_call_id: 'call_x',
    });

    const replay = await service.listMessagesForReplay(thread.uid, tenantA, authorA, {
      limit: 2,
      tokenBudget: 10_000,
    });

    expect(replay.map((row) => row.role)).toEqual(['assistant', 'tool', 'user']);
    expect(replay[1]).toMatchObject({ role: 'tool', tool_call_id: 'call_x' });
  });

  it('reads a foreign thread only when the scope allows its author', async () => {
    const thread = await service.createThread(tenantA, authorA);
    await service.appendMessage(thread.uid, tenantA, authorA, { role: 'user', content: 'shared' });
    const scope = { readableAuthors: [authorA], allTenantThreads: false };

    const listed = await service.listReadableThreads(tenantA, scope, authorB);
    expect(listed.map((t) => t.uid)).toEqual([thread.uid]);
    expect(listed.every((t) => t.user_uid !== authorB)).toBe(true);

    const read = await service.getReadableThread(thread.uid, tenantA, authorB, scope);
    expect(read.uid).toBe(thread.uid);

    const messages = await service.listReadableMessages(thread.uid, tenantA, authorB, scope);
    expect(messages.map((m) => m.content)).toEqual(['shared']);
  });

  it('refuses a foreign thread of the same tenant when the scope is empty', async () => {
    const thread = await service.createThread(tenantA, authorA);
    const empty = { readableAuthors: null, allTenantThreads: false };

    expect(await service.listReadableThreads(tenantA, empty, authorB)).toEqual([]);
    await expect(service.getReadableThread(thread.uid, tenantA, authorB, empty)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.listReadableMessages(thread.uid, tenantA, authorB, empty)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('never crosses the tenant boundary, even with allTenantThreads', async () => {
    const t = await service.createThread(tenantA, authorA);

    await expect(
      service.getReadableThread(t.uid, tenantB, authorB, { readableAuthors: null, allTenantThreads: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.listReadableThreads(tenantB, { readableAuthors: null, allTenantThreads: true }, authorB)).toEqual(
      [],
    );
  });

  it('keeps write paths author-scoped', async () => {
    const thread = await service.createThread(tenantA, authorA);

    await expect(
      service.appendMessage(thread.uid, tenantA, authorB, { role: 'user', content: 'nope' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteThread(thread.uid, tenantA, authorB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getThread(thread.uid, tenantA, authorB)).rejects.toBeInstanceOf(NotFoundException);
    expect(models.messages).toHaveLength(0);
    expect(models.threads).toHaveLength(1);
  });

  it('still forbids primary-key lookups on the read path', async () => {
    const thread = await service.createThread(tenantA, authorA);
    const scope = { readableAuthors: [authorA], allTenantThreads: false };

    await service.listReadableThreads(tenantA, scope, authorB);
    await service.getReadableThread(thread.uid, tenantA, authorB, scope);
    await service.listReadableMessages(thread.uid, tenantA, authorB, scope);
    await service.getReadableThread(thread.uid, tenantA, authorA, { readableAuthors: null, allTenantThreads: false });

    expect(models.threadModel.findByPk).not.toHaveBeenCalled();
    expect(models.messageModel.findByPk).not.toHaveBeenCalled();
  });
});

describe('AgentProposal model shape (D-18 prep)', () => {
  it('declares apply_payload and the card-badge status vocabulary', () => {
    const { AGENT_PROPOSAL_STATUSES, AgentProposal } = require('./models/agent-proposal.model');
    expect(AGENT_PROPOSAL_STATUSES).toEqual(['pending', 'applied', 'rejected', 'denied', 'expired']);
    expect(AgentProposal.name).toBe('AgentProposal');
    const source = require('fs').readFileSync(require('path').join(__dirname, 'models/agent-proposal.model.ts'), 'utf8');
    expect(source).toMatch(/tableName:\s*'ai_agent_proposals'/);
  });
});

describe('CcAiAuditLog conversation reference (D-08)', () => {
  it('exposes a nullable thread_uid distinct from call_uniqueid', () => {
    const { CcAiAuditLog } = require('../ai-agents/models/ai-audit-log.model');
    const src = require('fs').readFileSync(require.resolve('../ai-agents/models/ai-audit-log.model'), 'utf8');
    expect(src).toMatch(/declare thread_uid:/);
    expect(src).toMatch(/call_uniqueid/);
    expect(CcAiAuditLog).toBeDefined();
  });
});

describe('AgentThreadMessage timeline columns', () => {
  it('declares close_kind, visibility and reasoning', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'models/agent-thread-message.model.ts'),
      'utf8',
    );
    expect(source).toMatch(/declare close_kind:/);
    expect(source).toMatch(/declare visibility:/);
    expect(source).toMatch(/declare reasoning:/);
  });

  it('ships an idempotent migration for the three columns', () => {
    const migration = require('fs').readFileSync(
      require('path').join(__dirname, 'migrate-agent-timeline.ts'),
      'utf8',
    );
    for (const column of ['close_kind', 'visibility', 'reasoning']) {
      expect(migration).toContain(`'${column}'`);
    }
    expect(migration).toMatch(/addColumnGuarded/);
  });
});

