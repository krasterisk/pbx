import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  const threads = { getThread: jest.fn(), createThread: jest.fn() };
  const contextBuilder = { buildState: jest.fn() };
  const settings = { getSettings: jest.fn(), updateSettings: jest.fn() };
  const loggerService = { logAction: jest.fn().mockResolvedValue(undefined) };
  let controller: AiChatController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AiChatController(
      loop as any,
      threads as any,
      contextBuilder as any,
      settings as any,
      loggerService as any,
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
