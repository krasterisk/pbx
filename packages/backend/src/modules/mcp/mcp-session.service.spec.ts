import { McpSessionService } from './mcp-session.service';

describe('MCP identity boundaries', () => {
  const response = () => { const res: any = { setHeader: jest.fn(), json: jest.fn(), end: jest.fn() }; res.status = jest.fn(() => res); return res; };
  it('binds sessions to tenant and author and forwards the authenticated role', async () => {
    const tools = { callTool: jest.fn().mockResolvedValue([]), getToolsList: jest.fn().mockReturnValue([]) };
    const service = new McpSessionService(tools as any);
    const res = response();
    const req: any = { method: 'POST', headers: {}, user: { sub: 8, level: 5 }, body: { method: 'initialize', id: 1 } };
    await service.handleRequest(req, res, 12);
    const id = res.setHeader.mock.calls.find((c: any[]) => c[0] === 'Mcp-Session-Id')[1];
    req.headers['mcp-session-id'] = id;
    req.body = { method: 'tools/call', id: 2, params: { name: 'list_endpoints', arguments: {} } };
    await service.handleRequest(req, response(), 12);
    expect(tools.callTool).toHaveBeenCalledWith('list_endpoints', {}, 12, { userUid: 8, role: 5, threadUid: 0 });
    await expect(service.handleRequest({ ...req, user: { sub: 9, level: 1 } }, response(), 12)).rejects.toThrow('another identity');
    await expect(service.handleRequest(req, response(), 13)).rejects.toThrow('another identity');
    expect(service.getActiveSessions(13, 8)).toEqual([]);
    await service.handleRequest({ ...req, method: 'GET' }, response(), 12);
    expect(service.getActiveSessions(12, 8)).toHaveLength(1);
  });
  it('limits integration keys to autodial scopes and isolates their sessions from JWT and other keys', async () => {
    const tools = { callTool: jest.fn().mockResolvedValue([]), isMutationTool: (name: string) => name === 'create_autodial_base',
      getToolsList: () => [{ name: 'list_autodial_campaigns' }, { name: 'create_autodial_base' }, { name: 'list_endpoints' }, { name: 'propose_plan' }] };
    const service = new McpSessionService(tools as never);
    const req: any = { method: 'POST', headers: {}, user: { sub: 8, level: 1, integration_key_uid: 'key-a', integration_scopes: ['autodial:read'] },
      body: { method: 'initialize', id: 1 } };
    const init = response(); await service.handleRequest(req, init, 12);
    req.headers['mcp-session-id'] = init.setHeader.mock.calls.find((call: any[]) => call[0] === 'Mcp-Session-Id')[1];
    req.body = { method: 'tools/list', id: 2 };
    const list = response(); await service.handleRequest(req, list, 12);
    expect(list.json.mock.calls[0][0].result.tools).toEqual([{ name: 'list_autodial_campaigns' }]);
    for (const name of ['create_autodial_base', 'list_endpoints', 'propose_plan', 'get_autodial_unknown']) {
      req.body = { method: 'tools/call', id: 3, params: { name, arguments: {} } };
      const denied = response(); await service.handleRequest(req, denied, 12);
      expect(denied.json.mock.calls[0][0].error).toBeDefined();
    }
    expect(tools.callTool).not.toHaveBeenCalled();
    await expect(service.handleRequest({ ...req, user: { ...req.user, integration_key_uid: 'key-b' } }, response(), 12)).rejects.toThrow('another identity');
    await expect(service.handleRequest({ ...req, user: { sub: 8, level: 1 } }, response(), 12)).rejects.toThrow('another identity');
    req.user.integration_scopes = ['autodial:proposals:write'];
    req.body = { method: 'tools/call', id: 4, params: { name: 'create_autodial_base', arguments: {} } };
    await service.handleRequest(req, response(), 12);
    expect(tools.callTool).toHaveBeenCalledWith('create_autodial_base', {}, 12, { userUid: 8, role: 1, threadUid: 0 });
    tools.callTool.mockClear();
    for (const step of ['propose_plan', 'list_endpoints', 'list_autodial_campaigns', 'create_autodial_unknown']) {
      req.body = { method: 'tools/call', id: 5, params: { name: 'propose_plan', arguments: { steps: [{ tool: step, args: {} }] } } };
      const denied = response(); await service.handleRequest(req, denied, 12);
      expect(denied.json.mock.calls[0][0].error).toBeDefined();
    }
    expect(tools.callTool).not.toHaveBeenCalled();
    req.body = { method: 'tools/call', id: 6, params: { name: 'propose_plan', arguments: { steps: [{ tool: 'create_autodial_base', args: {} }] } } };
    await service.handleRequest(req, response(), 12); expect(tools.callTool).toHaveBeenCalledTimes(1);
  });
});
