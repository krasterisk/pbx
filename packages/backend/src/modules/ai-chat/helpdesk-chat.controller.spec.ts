import { HelpdeskChatController } from './helpdesk-chat.controller';
import { HelpdeskChatService } from './helpdesk-chat.service';
describe('HelpdeskChatController', () => {
  it('takes tenant and author exclusively from the JWT request', async () => {
    const session = jest.fn().mockResolvedValue({ task: null });
    const controller = new HelpdeskChatController({ session } as unknown as HelpdeskChatService);
    const req = { user: { sub: 7, vpbx_user_uid: 12 } };
    await controller.session(5, req);
    expect(session).toHaveBeenCalledWith(5, 12, 7);
    const body = { requestId: '11111111-1111-4111-8111-111111111111', message: 'Help', expectedTaskId: null, expectedVersion: null };
    await controller.message(5, req, body);
    expect(session).toHaveBeenLastCalledWith(5, 12, 7, body);
  });
});
