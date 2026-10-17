import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { HelpdeskChatService } from './helpdesk-chat.service';
import { PbxAgentThreadService } from './pbx-agent-thread.service';

const id = '11111111-1111-4111-8111-111111111111';
describe('HelpdeskChatService', () => {
  let service: HelpdeskChatService;
  let env: Record<string, string>;
  const post = jest.fn();
  const threads = { getThread: jest.fn(), touchHelpdeskThread: jest.fn() };
  beforeEach(() => {
    jest.resetAllMocks();
    env = { HELPDESK_INTEGRATION_ENABLED: 'true', HELPDESK_URL: 'https://support.example/api/agents/v1/', HELPDESK_INSTANCE_ID: 'lab-v4', HELPDESK_AGENT_TOKEN: 'hda_' + 'x'.repeat(43) };
    threads.getThread.mockResolvedValue({ status: 'active' });
    threads.touchHelpdeskThread.mockResolvedValue(undefined);
    post.mockResolvedValue({ data: { schema_version: 'support-session-v1', task: null, history: [], client_context: id, token: 'MUST_NOT_LEAK' } });
    service = new HelpdeskChatService({ get: (key: string) => env[key] } as ConfigService,
      { axiosRef: { post } } as unknown as HttpService, threads as unknown as PbxAgentThreadService);
  });
  it('injects verified identity and projects only public response fields', async () => {
    expect(await service.session(5, 12, 7)).toEqual({ schema_version: 'support-session-v1', task: null, history: [] });
    expect(threads.getThread).toHaveBeenCalledWith(5, 12, 7);
    expect(post).toHaveBeenCalledWith('https://support.example/api/agents/v1/open_session',
      { tenant_ref: 'lab-v4:tenant:12', subject_ref: 'user:7', conversation_ref: 'thread:5' },
      expect.objectContaining({ maxRedirects: 0, timeout: 10000, maxBodyLength: 32768 }));
  });
  it('rejects foreign/shared/archived threads before contacting helpdesk', async () => {
    threads.getThread.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.session(5, 12, 7)).rejects.toBeInstanceOf(ForbiddenException);
    threads.getThread.mockResolvedValueOnce({ status: 'archived' });
    await expect(service.session(5, 12, 7)).rejects.toBeInstanceOf(ForbiddenException);
    expect(post).not.toHaveBeenCalled();
  });
  it.each(['http://remote.example/api/', 'https://user:pass@support.example/', 'https://support.example/?url=evil', 'file:///etc/passwd', 'https://support.example/#fragment'])('rejects unsafe configured URL %s', async (url) => {
    env.HELPDESK_URL = url;
    await expect(service.session(5, 12, 7)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(post).not.toHaveBeenCalled();
  });
  it('allows loopback HTTP fixture and preserves request UUID for retry', async () => {
    env.HELPDESK_URL = 'http://127.0.0.1:8901/api/agents/v1/';
    const message = { requestId: id, message: ' Problem ', expectedTaskId: null, expectedVersion: null };
    await service.session(5, 12, 7, message);
    expect(post.mock.calls[0][1]).toMatchObject({ request_id: id, message: 'Problem', expected_task_id: null, expected_version: null });
    expect(threads.touchHelpdeskThread).toHaveBeenCalledWith(5, 12, 7);
  });
  it('rejects injected identity and inconsistent task metadata', async () => {
    const message = { requestId: id, message: 'Problem', expectedTaskId: null, expectedVersion: null, tenant_ref: 'foreign' };
    await expect(service.session(5, 12, 7, message)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.session(5, 12, 7, { requestId: id, message: 'Problem', expectedTaskId: null, expectedVersion: 1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(post).not.toHaveBeenCalled();
  });
  it('hides upstream errors and reports stale versions', async () => {
    post.mockRejectedValueOnce({ response: { status: 500, data: 'secret' }, message: 'secret' });
    await expect(service.session(5, 12, 7)).rejects.toThrow('Support is temporarily unavailable');
    post.mockRejectedValueOnce({ response: { status: 409 } });
    await expect(service.session(5, 12, 7)).rejects.toBeInstanceOf(ConflictException);
  });
  it('fails closed on malformed responses', async () => {
    post.mockResolvedValueOnce({ data: { schema_version: 'support-session-v1', history: [], task: { task_id: 'forged' } } });
    await expect(service.session(5, 12, 7)).rejects.toBeInstanceOf(BadGatewayException);
  });
  it('keeps disabled integration disabled', async () => {
    env.HELPDESK_INTEGRATION_ENABLED = 'false';
    await expect(service.session(5, 12, 7)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(post).not.toHaveBeenCalled();
  });
});
