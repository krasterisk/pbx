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
});
