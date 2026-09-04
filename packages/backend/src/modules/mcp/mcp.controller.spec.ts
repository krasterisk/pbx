import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtOrServiceTokenGuard } from '../auth/jwt-or-service-token.guard';
import { McpController } from './mcp.controller';
import { McpSessionService } from './mcp-session.service';

const INTERNAL_TOOLS = [
  { name: 'list_contexts', description: 'contexts', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_pbx_state', description: 'state', inputSchema: { type: 'object', properties: {} } },
];

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    body: undefined as any,
    headers,
    setHeader: jest.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    status: jest.fn(function status(this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(this: any, payload: any) {
      this.body = payload;
      return this;
    }),
  };
}

function userReq(uid: number, extras: Record<string, any> = {}) {
  return {
    method: 'POST',
    user: { vpbx_user_uid: uid, sub: uid, level: 3 },
    headers: {} as Record<string, string>,
    body: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    ...extras,
  };
}

describe('McpController token-only tenant (D-28)', () => {
  let toolsService: { getToolsList: jest.Mock; callTool: jest.Mock };
  let sessionService: McpSessionService;
  let controller: McpController;

  beforeEach(() => {
    toolsService = {
      getToolsList: jest.fn().mockReturnValue(INTERNAL_TOOLS),
      callTool: jest.fn().mockResolvedValue([{ type: 'text', text: 'ok' }]),
    };
    sessionService = new McpSessionService(toolsService as any);
    controller = new McpController(sessionService);
  });

  it('guards the external entry with JwtAuthGuard and not the service-token guard', () => {
    const handleGuards = Reflect.getMetadata(GUARDS_METADATA, McpController.prototype.handleMcp) ?? [];
    const sessionGuards = Reflect.getMetadata(GUARDS_METADATA, McpController.prototype.getSessions) ?? [];
    expect(handleGuards).toContain(JwtAuthGuard);
    expect(handleGuards).not.toContain(JwtOrServiceTokenGuard);
    expect(sessionGuards).toContain(JwtAuthGuard);
    expect(sessionGuards).not.toContain(JwtOrServiceTokenGuard);
  });

  it('dispatches a valid user token with that token tenant', async () => {
    const req = userReq(100);
    const res = mockRes();

    await controller.handleMcp(req as any, res as any);

    expect(toolsService.getToolsList).toHaveBeenCalledWith(100);
    expect(res.statusCode).toBe(200);
  });

  it('rejects a service token plus tenant header (unauthorised)', async () => {
    const src = fs.readFileSync(path.join(__dirname, 'mcp.controller.ts'), 'utf8');
    expect(src).not.toMatch(/JwtOrServiceTokenGuard|KRASTERISK_SERVICE_TOKEN/);
    expect(src).not.toMatch(/x-vpbx-user-uid|X-Vpbx-User-Uid/i);

    const guard = new JwtAuthGuard();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: 'Bearer service-token-value',
            'x-vpbx-user-uid': '200',
          },
          user: undefined,
        }),
      }),
      getHandler: () => McpController.prototype.handleMcp,
      getClass: () => McpController,
    } as any;

    let granted = false;
    try {
      granted = (await Promise.resolve(guard.canActivate(ctx))) === true;
    } catch {
      granted = false;
    }
    expect(granted).toBe(false);
  });

  it('ignores a contradicting tenant header and keeps the token tenant', async () => {
    const req = userReq(100, {
      headers: { 'x-vpbx-user-uid': '200', 'X-Vpbx-User-Uid': '200' },
    });
    const res = mockRes();

    await controller.handleMcp(req as any, res as any);

    expect(toolsService.getToolsList).toHaveBeenCalledWith(100);
    expect(toolsService.getToolsList).not.toHaveBeenCalledWith(200);
  });

  it('lists the same tools as the internal path and no extra names', async () => {
    const req = userReq(100);
    const res = mockRes();

    await controller.handleMcp(req as any, res as any);

    const listed = res.body?.result?.tools ?? [];
    const internal = toolsService.getToolsList(100);
    expect(listed.map((t: { name: string }) => t.name)).toEqual(internal.map((t) => t.name));
    expect(listed).toHaveLength(internal.length);
  });

  it('rejects resume of a session with another tenant token', async () => {
    const initReq = userReq(100, {
      body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    });
    const initRes = mockRes();
    await controller.handleMcp(initReq as any, initRes as any);

    const sessionId = initRes.headers['Mcp-Session-Id'] || initRes.headers['mcp-session-id'];
    expect(sessionId).toBeTruthy();

    const resumeReq = userReq(200, {
      headers: { 'mcp-session-id': sessionId },
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    });
    const resumeRes = mockRes();

    await expect(controller.handleMcp(resumeReq as any, resumeRes as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(toolsService.getToolsList).not.toHaveBeenCalledWith(200);
  });
});
