import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AiChatController } from './ai-chat.controller';
import { formatSseEvent } from './agent-sse.util';

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(full, acc);
    else if (entry.name.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

function mockRes() {
  const writes: string[] = [];
  return {
    writes,
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => { writes.push(chunk); }),
    end: jest.fn(),
  };
}

describe('AiChatController', () => {
  const loop = { runTurn: jest.fn() };
  const threads = {
    getThread: jest.fn(),
    createThread: jest.fn(),
    listThreads: jest.fn(),
    listMessages: jest.fn(),
    listReadableThreads: jest.fn(),
    getReadableThread: jest.fn(),
    listReadableMessages: jest.fn(),
    deleteThread: jest.fn(),
    appendMessage: jest.fn(),
  };
  const contextBuilder = { buildState: jest.fn() };
  const settings = {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    getSeeAllThreads: jest.fn(),
    setSeeAllThreads: jest.fn(),
  };
  const providers = { findOne: jest.fn() };
  const loggerService = { logAction: jest.fn().mockResolvedValue(undefined) };
  const proposals = { findAll: jest.fn(), destroy: jest.fn() };
  const workflows = { getOwned: jest.fn(), deleteForThread: jest.fn() };
  const visibility = { resolve: jest.fn() };
  const users = { findAll: jest.fn() };
  let controller: AiChatController;

  const threadRow = {
    uid: 7,
    user_uid: 7,
    title: 'IVR',
    status: 'active' as const,
    last_message_at: new Date('2026-09-08T10:00:00Z'),
    created_at: new Date('2026-09-08T09:00:00Z'),
    updated_at: new Date('2026-09-08T10:00:00Z'),
  };

  const proposalRow = {
    proposal_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    entity_type: 'ivr',
    entity_label: 'Продажи',
    summary: ['IVR Продажи'],
    before_json: null,
    after_json: { name: 'Продажи' },
    includes_dialplan_reload: true,
    status: 'pending',
    expires_at: new Date('2026-09-09T10:00:00Z'),
    applied_at: null,
    error: null,
  };

  const threadMessages = [
    {
      uid: 1,
      thread_uid: 7,
      role: 'user' as const,
      content: 'Создай IVR',
      tool_name: null,
      tool_calls: null,
      proposal_id: null,
      visibility: 'public',
      created_at: new Date('2026-09-08T10:00:00Z'),
    },
    {
      uid: 2,
      thread_uid: 7,
      role: 'tool' as const,
      content: '{"proposalId":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","apply_payload":{"tool":"create_ivr"}}',
      tool_name: 'create_ivr',
      tool_calls: [{ id: 'call_1', name: 'create_ivr' }],
      proposal_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      visibility: 'public',
      created_at: new Date('2026-09-08T10:00:01Z'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    proposals.findAll.mockResolvedValue([]);
    workflows.getOwned.mockRejectedValue(new NotFoundException('Workflow not found'));
    visibility.resolve.mockResolvedValue({ readableAuthors: null, allTenantThreads: false });
    users.findAll.mockResolvedValue([]);
    threads.listReadableThreads.mockResolvedValue([]);
    threads.getReadableThread.mockImplementation((...args: unknown[]) => threads.getThread(...args));
    threads.listReadableMessages.mockImplementation((...args: unknown[]) => threads.listMessages(...args));
    controller = new AiChatController(
      loop as any,
      threads as any,
      contextBuilder as any,
      settings as any,
      providers as any,
      loggerService as any,
      proposals as any,
      workflows as any,
      visibility as any,
      users as any,
    );
  });

  it('streams loop events and forwards the request abort signal', async () => {
    threads.createThread.mockResolvedValue({ uid: 11 });
    loop.runTurn.mockImplementation(async function* (_message: string, _conv: { uid: number }, ctx: { signal?: AbortSignal }) {
      expect(ctx.signal).toBeInstanceOf(AbortSignal);
      yield { name: 'text', data: 'hello' };
      yield { name: 'done', data: { totalLength: 5 } };
    });

    const res = mockRes();
    const req = {
      user: { vpbx_user_uid: 42, sub: 7, level: 3 },
      body: { message: 'hi' },
      on: jest.fn(),
    };

    await controller.sendMessage({ message: 'hi' }, req, res as any);

    expect(req.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(loop.runTurn).toHaveBeenCalledWith(
      'hi',
      { uid: 11 },
      expect.objectContaining({ tenantUid: 42, authorUid: 7, role: 3, signal: expect.any(AbortSignal) }),
    );
    expect(res.writes.join('')).toContain(formatSseEvent('text', 'hello'));
    expect(res.writes.join('')).toContain(formatSseEvent('done', { totalLength: 5 }));
    expect(res.end).toHaveBeenCalled();
  });

  it('rejects a body that supplies tenant, author or role', async () => {
    const res = mockRes();
    const req = {
      user: { vpbx_user_uid: 42, sub: 7, level: 3 },
      body: { message: 'hi', tenantUid: 99, authorUid: 8, role: 1 },
      on: jest.fn(),
    };

    await expect(
      controller.sendMessage({ message: 'hi', tenantUid: 99 } as any, req, res as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(loop.runTurn).not.toHaveBeenCalled();
    expect(res.write).not.toHaveBeenCalled();
  });

  it('does not find a conversation belonging to another tenant or author', async () => {
    threads.getThread.mockRejectedValue(new NotFoundException('Thread not found'));
    const res = mockRes();
    const req = {
      user: { vpbx_user_uid: 42, sub: 7, level: 3 },
      body: { message: 'hi', threadUid: 99 },
      on: jest.fn(),
    };

    await expect(
      controller.sendMessage({ message: 'hi', threadUid: 99 } as any, req, res as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(loop.runTurn).not.toHaveBeenCalled();
    expect(res.write).not.toHaveBeenCalled();
  });

  it('lists only the caller\'s conversations and omits tenant fields', async () => {
    threads.listThreads.mockResolvedValue([
      {
        uid: 3,
        title: 'Queues',
        status: 'active',
        last_message_at: new Date('2026-09-05T01:00:00Z'),
        created_at: new Date('2026-09-05T00:00:00Z'),
        updated_at: new Date('2026-09-05T01:00:00Z'),
        vpbx_user_uid: 42,
        user_uid: 7,
      },
    ]);
    const req = { user: { vpbx_user_uid: 42, sub: 7, level: 3 } };

    const listed = await controller.listThreads(req);

    expect(threads.listThreads).toHaveBeenCalledWith(42, 7);
    expect(listed).toEqual([
      expect.objectContaining({ uid: 3, title: 'Queues', status: 'active' }),
    ]);
    expect(JSON.stringify(listed)).not.toMatch(/vpbx_user_uid|user_uid/);
  });

  it('does not return a conversation belonging to another tenant or author', async () => {
    threads.getThread.mockRejectedValue(new NotFoundException('Thread not found'));
    const req = { user: { vpbx_user_uid: 42, sub: 7, level: 3 } };

    await expect(controller.getThread(99, req)).rejects.toBeInstanceOf(NotFoundException);
    expect(threads.listMessages).not.toHaveBeenCalled();
  });

  it('creates and deletes conversations through the scoped service', async () => {
    threads.createThread.mockResolvedValue({
      uid: 4,
      title: '',
      status: 'active',
      last_message_at: new Date('2026-09-05T02:00:00Z'),
      created_at: new Date('2026-09-05T02:00:00Z'),
      updated_at: new Date('2026-09-05T02:00:00Z'),
    });
    threads.deleteThread.mockResolvedValue(undefined);
    const req = { user: { vpbx_user_uid: 42, sub: 7, level: 3 } };

    const created = await controller.createThread(req);
    await controller.deleteThread(4, req);

    expect(created.uid).toBe(4);
    expect(threads.createThread).toHaveBeenCalledWith(42, 7);
    expect(threads.deleteThread).toHaveBeenCalledWith(4, 42, 7);
    expect(workflows.deleteForThread).toHaveBeenCalledWith(4, { vpbxUserUid: 42, userUid: 7, role: 3 });
    expect(proposals.destroy).toHaveBeenCalledWith({
      where: { thread_uid: 4, vpbx_user_uid: 42, user_uid: 7 },
    });

    const src = fs.readFileSync(path.join(__dirname, 'ai-chat.controller.ts'), 'utf8');
    expect(src).toMatch(/@SkipThrottle\(\{ default: true, global: true \}\)\s*\n\s*@HttpCode\(HttpStatus\.NO_CONTENT\)\s*\n\s*@Delete\('threads\/:uid'\)/);
    expect(src).toMatch(/@SkipThrottle\(\{ default: true, global: true \}\)\s*\n\s*@Post\('threads'\)/);
  });

  it('returns a timeline and a card map instead of raw messages', async () => {
    threads.getThread.mockResolvedValue(threadRow);
    threads.listMessages.mockResolvedValue(threadMessages);
    proposals.findAll.mockResolvedValue([proposalRow]);
    const req = { user: { vpbx_user_uid: 42, sub: 7, level: 3 } };

    const detail = await controller.getThread(7, req);
    expect(detail.readOnly).toBe(false);
    expect(detail).not.toHaveProperty('ownerName');
    expect(detail).toHaveProperty('timeline');
    expect(detail).not.toHaveProperty('messages');
    expect(JSON.stringify(detail.timeline)).not.toMatch(/proposalId|apply_payload|tool_calls/);
  });

  it('keeps proposal identifiers only in the card map', async () => {
    threads.getThread.mockResolvedValue(threadRow);
    threads.listMessages.mockResolvedValue(threadMessages);
    proposals.findAll.mockResolvedValue([proposalRow]);
    const req = { user: { vpbx_user_uid: 42, sub: 7, level: 3 } };

    const detail = await controller.getThread(7, req);
    const card = Object.values(detail.cards)[0] as { card: string; proposal?: { proposalId?: string } };
    expect(card.proposal?.proposalId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(JSON.stringify(detail.timeline)).not.toMatch(/proposalId|apply_payload|tool_calls/);
  });

  it('streams a continuation turn without a user-visible message', async () => {
    threads.getThread.mockResolvedValue(threadRow);
    threads.appendMessage.mockResolvedValue({ uid: 99, created_at: new Date() });
    loop.runTurn.mockImplementation(async function* (
      _message: string,
      conv: { uid: number },
      ctx: { tenantUid: number; authorUid: number; userVisibility?: string },
    ) {
      await threads.appendMessage(conv.uid, ctx.tenantUid, ctx.authorUid, {
        role: 'user',
        content: _message,
        visibility: ctx.userVisibility ?? 'public',
      });
      yield { name: 'thread', data: { uid: conv.uid } };
      yield { name: 'done', data: { closeKind: 'complete' } };
    });
    const res = mockRes();
    const req = {
      user: { vpbx_user_uid: 42, sub: 7, level: 3 },
      body: {},
      on: jest.fn(),
    };

    await controller.continueThread(7, req, res as any);
    expect(loop.runTurn).toHaveBeenCalledWith(
      expect.stringContaining('Карточка применена'),
      { uid: 7 },
      expect.objectContaining({ tenantUid: 42, authorUid: 7 }),
    );
    const appended = threads.appendMessage.mock.calls.find((c) => c[3].role === 'user');
    expect(appended?.[3].visibility).toBe('internal');
  });

  it('refuses to continue a thread of another tenant or author', async () => {
    threads.getThread.mockRejectedValue(new NotFoundException('Thread not found'));
    const res = mockRes();
    const req = {
      user: { vpbx_user_uid: 42, sub: 7, level: 3 },
      body: {},
      on: jest.fn(),
    };

    await expect(controller.continueThread(99, req, res as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists shared threads with an owner name and a read-only flag', async () => {
    visibility.resolve.mockResolvedValue({ readableAuthors: [8], allTenantThreads: false });
    threads.listReadableThreads.mockResolvedValue([
      {
        uid: 3,
        title: 'Queues',
        status: 'active',
        last_message_at: new Date('2026-09-05T01:00:00Z'),
        created_at: new Date('2026-09-05T00:00:00Z'),
        updated_at: new Date('2026-09-05T01:00:00Z'),
        vpbx_user_uid: 42,
        user_uid: 8,
      },
    ]);
    users.findAll.mockResolvedValue([{ uniqueid: 8, name: 'Пётр', login: 'petr' }]);
    const req = { user: { vpbx_user_uid: 42, sub: 7, level: 3 } };

    const rows = await controller.listSharedThreads(req);

    expect(visibility.resolve).toHaveBeenCalledWith(42, 7, 3);
    expect(threads.listReadableThreads).toHaveBeenCalledWith(
      42,
      { readableAuthors: [8], allTenantThreads: false },
      7,
    );
    expect(users.findAll).toHaveBeenCalledTimes(1);
    expect(rows[0]).toEqual(expect.objectContaining({ ownerName: 'Пётр', readOnly: true }));
    expect(JSON.stringify(rows)).not.toMatch(/vpbx_user_uid|user_uid/);
  });

  it('returns an empty shared list when nothing is shared', async () => {
    visibility.resolve.mockResolvedValue({ readableAuthors: null, allTenantThreads: false });
    threads.listReadableThreads.mockResolvedValue([]);
    const req = { user: { vpbx_user_uid: 42, sub: 7, level: 3 } };

    await expect(controller.listSharedThreads(req)).resolves.toEqual([]);
    expect(users.findAll).not.toHaveBeenCalled();
  });

  it('reads a shared thread detail as read-only', async () => {
    const sharedThread = { ...threadRow, user_uid: 8 };
    threads.getThread.mockResolvedValue(sharedThread);
    threads.listMessages.mockResolvedValue(threadMessages);
    users.findAll.mockResolvedValue([{ uniqueid: 8, name: 'Пётр', login: 'petr' }]);
    proposals.findAll.mockResolvedValue([proposalRow]);
    const req = { user: { vpbx_user_uid: 42, sub: 7, level: 3 } };

    const detail = await controller.getThread(7, req);

    expect(detail.readOnly).toBe(true);
    expect(detail.ownerName).toBe('Пётр');
    expect(detail.timeline).toEqual(expect.any(Array));
    expect(proposals.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_uid: 8, vpbx_user_uid: 42 }),
      }),
    );
  });

  it('does not resolve threads/shared as a thread id', async () => {
    const src = fs.readFileSync(path.join(__dirname, 'ai-chat.controller.ts'), 'utf8');
    const sharedIdx = src.indexOf("@Get('threads/shared')");
    const uidIdx = src.indexOf("@Get('threads/:uid')");
    expect(sharedIdx).toBeGreaterThan(-1);
    expect(sharedIdx).toBeLessThan(uidIdx);

    visibility.resolve.mockResolvedValue({ readableAuthors: null, allTenantThreads: false });
    await expect(controller.listSharedThreads({ user: { vpbx_user_uid: 42, sub: 7, level: 3 } })).resolves.toEqual([]);
  });

  it('lets only an admin switch the see-all-threads flag', async () => {
    await expect(
      controller.updateSettings({ seeAllThreads: true }, { user: { level: 3, vpbx_user_uid: 42 } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(settings.updateSettings).not.toHaveBeenCalled();
    expect(settings.setSeeAllThreads).not.toHaveBeenCalled();
  });

  it('does not keep the proxy service or read external chat environment variables', () => {
    const serviceFile = path.join(__dirname, 'ai-chat.service.ts');
    expect(fs.existsSync(serviceFile)).toBe(false);

    const srcRoot = path.resolve(__dirname, '../../..');
    const files = walkTs(srcRoot);
    const importHits: string[] = [];
    const envHits: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (/from ['"][^'"]*ai-chat\.service['"]/.test(text) || /import\s*\{[^}]*\bAiChatService\b/.test(text)) {
        importHits.push(path.relative(srcRoot, file));
      }
      if (/\bAIPBX_(URL|CHAT_ID|TOKEN)\b/.test(text)) {
        envHits.push(path.relative(srcRoot, file));
      }
    }
    expect(importHits).toEqual([]);
    expect(envHits).toEqual([]);
  });
});
