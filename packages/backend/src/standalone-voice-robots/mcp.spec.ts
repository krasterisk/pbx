import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { RobotMcpCredentials } from './mcp-credentials';
import { StandaloneRobotMcpController, StandaloneRobotMcpService } from './mcp';
import { z } from 'zod';
import { defineMutationTool } from '../modules/ai-platform/ai-mutation.contract';

describe('standalone MCP credentials and transport', () => {
  let directory: string;
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'krvr-mcp-test-')); });
  afterEach(() => { rmSync(directory, { recursive: true, force: true }); });
  it('stores only hashes, binds to one tenant, lists without token/hash, revokes and expires', () => {
    const file = join(directory, 'credentials.json'); const service = new RobotMcpCredentials(new ConfigService({ VOICE_ROBOTS_MCP_CREDENTIALS_FILE: file }));
    const key = service.issue(7, { name: 'Assistant', scope: 'configure', days: 1 });
    expect(readFileSync(file, 'utf8')).not.toContain(key.token);
    expect(service.authenticate('Bearer ' + key.token)).toMatchObject({ tenant: 7, scope: 'configure' });
    expect(service.list(8)).toEqual([]); expect(service.list(7)[0]).not.toHaveProperty('hash'); expect(service.list(7)[0]).not.toHaveProperty('token');
    expect(() => service.revoke(8, key.id)).toThrow(); expect(() => service.authenticate(key.token)).toThrow();
    service.revoke(7, key.id); expect(() => service.authenticate('Bearer ' + key.token)).toThrow();
    const expired = service.issue(7, { name: 'Expire', scope: 'read', days: 1 });
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 86400000);
    expect(() => service.authenticate('Bearer ' + expired.token)).toThrow(); jest.restoreAllMocks();
  });
  function mcpFixture() {
    const apply = jest.fn(async () => ({ uid: 25, robotId: 25 })); const schema = z.strictObject({ name: z.string() });
    const mutation = defineMutationTool({ name: 'create_voice_robot', description: 'Create', entityType: 'voice_robot', schemaVersion: '1',
      input: schema, args: schema, reload: { kind: 'none' }, propose: async () => ({ refused: true }), revalidate: async args => ({ ok: true, args }), apply: async () => {} });
    const read = { name: 'list_voice_robots', description: 'List', inputSchema: {}, entityType: 'voice_robot', handler: jest.fn(async (_a, tenant) => ({ robots: [{ uid: 25, tenant }] })) };
    const adapter = { getTools: () => [read, mutation] };
    const tools = { definitions: () => [{ name: 'create_voice_robot', input: schema, readOnly: false, execute: apply }] };
    const mcp = new StandaloneRobotMcpService(adapter as never, tools as never);
    return { mcp, apply, read };
  }
  it('hides and refuses writes for read keys; executes shared writes with credential tenant only', async () => {
    const f = mcpFixture(); const readonly = { id: 'test', tenant: 7, scope: 'read' as const }; const configure = { ...readonly, scope: 'configure' as const };
    const listing: any = await f.mcp.dispatch('tools/list', {}, readonly);
    expect(listing.tools.some((t: any) => t.name === 'create_voice_robot')).toBe(false);
    expect(await f.mcp.dispatch('tools/call', { name: 'create_voice_robot', arguments: { name: 'Bot' } }, readonly)).toMatchObject({ isError: true });
    expect(f.apply).not.toHaveBeenCalled();
    await f.mcp.dispatch('tools/call', { name: 'create_voice_robot', arguments: { name: 'Bot' } }, configure);
    expect(f.apply).toHaveBeenCalledWith({ name: 'Bot' }, 7);
    expect(await f.mcp.dispatch('tools/call', { name: 'create_voice_robot', arguments: { name: 'Bot', tenantId: 8 } }, configure)).toMatchObject({ isError: true });
    expect(await f.mcp.dispatch('tools/call', { name: 'create_voice_robot', arguments: { name: 'Bot', token: 'secret' } }, configure)).toMatchObject({ isError: true });
    expect(f.apply).toHaveBeenCalledTimes(1);
    await f.mcp.dispatch('tools/call', { name: 'list_voice_robots' }, readonly);
    expect(f.read.handler).toHaveBeenCalledWith({}, 7);
  });
  function response() { const res: any = { statusCode: 200, setHeader: jest.fn(), status: jest.fn(function (this: any, code: number) { this.statusCode = code; return this; }),
    json: jest.fn(), end: jest.fn() }; return res; }
  it('uses notifications 202 with no dispatch, rejects batches/versions, supports initialize and method-not-found', async () => {
    const f = mcpFixture(); const controller = new StandaloneRobotMcpController(f.mcp); const credential = { id: 'test', tenant: 7, scope: 'read' };
    const request = (body: any, headers = {}) => ({ method: 'POST', body, headers, mcpCredential: credential }) as never;
    const notification = response(); await controller.handle(request({ jsonrpc: '2.0', method: 'notifications/initialized' }), notification);
    expect(notification.statusCode).toBe(202); expect(notification.json).not.toHaveBeenCalled();
    const batch = response(); await controller.handle(request([{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]), batch); expect(batch.statusCode).toBe(400);
    const badVersion = response(); await controller.handle(request({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '2099-01-01' }), badVersion); expect(badVersion.statusCode).toBe(400);
    const initialize = response(); await controller.handle(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }), initialize);
    expect(initialize.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, result: expect.objectContaining({ protocolVersion: '2025-06-18', capabilities: expect.objectContaining({ tools: {}, prompts: {}, resources: {} }) }) }));
    const unknown = response(); await controller.handle(request({ jsonrpc: '2.0', id: 2, method: 'unknown' }), unknown); expect(unknown.json).toHaveBeenCalledWith(expect.objectContaining({ error: { code: -32601, message: 'Method not found' } }));
    const invalidNotification = response(); await controller.handle(request({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'create_voice_robot', arguments: { name: 'x' } } }), invalidNotification);
    expect(invalidNotification.statusCode).toBe(400); expect(f.apply).not.toHaveBeenCalled();
  });
});
