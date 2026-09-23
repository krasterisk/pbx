import { AriHttpClientService } from './ari-http-client.service';

describe('AriHttpClientService originateChannel', () => {
  it('passes callerId as an originate parameter and variables in the body', async () => {
    const service = Object.create(AriHttpClientService.prototype) as AriHttpClientService;
    const post = jest.fn().mockResolvedValue({ data: { id: 'ac-1' } });
    service['client'] = { post } as unknown as AriHttpClientService['client'];

    await service.originateChannel({
      endpoint: 'PJSIP/79991234567@trunk-1',
      app: 'krasterisk',
      channelId: 'ac-1',
      callerId: '74951112233',
      timeout: 30,
      variables: { KRSK_AC_TASK: '22' },
    });

    expect(post).toHaveBeenCalledWith(
      '/channels',
      { variables: { KRSK_AC_TASK: '22' } },
      { params: {
        endpoint: 'PJSIP/79991234567@trunk-1',
        app: 'krasterisk',
        appArgs: '',
        channelId: 'ac-1',
        callerId: '74951112233',
        timeout: 30,
      }, timeout: 35000 },
    );
  });
});
