import { assertEgressUrl, isBlockedAddress } from './egress-guard';

describe('egress guard', () => {
  it('blocks private, loopback and metadata addresses', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.16.0.1', '169.254.169.254', '0.0.0.0', '::1']) {
      expect(isBlockedAddress(address)).toBe(true);
    }
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
  });

  it('rejects http, credentials, localhost and DNS that resolves privately', async () => {
    await expect(assertEgressUrl('http://example.com/hook', async () => ['8.8.8.8'])).rejects.toMatchObject({ code: 'egress_scheme' });
    await expect(assertEgressUrl('https://user:pass@example.com', async () => ['8.8.8.8'])).rejects.toMatchObject({ code: 'egress_url' });
    await expect(assertEgressUrl('https://localhost/hook', async () => ['127.0.0.1'])).rejects.toMatchObject({ code: 'egress_private' });
    await expect(assertEgressUrl('https://crm.example/hook', async () => ['10.0.0.5'])).rejects.toMatchObject({ code: 'egress_private' });
    await expect(assertEgressUrl('https://crm.example/hook', async () => ['1.2.3.4', '127.0.0.1'])).rejects.toMatchObject({ code: 'egress_private' });
  });

  it('allows a public https host', async () => {
    const url = await assertEgressUrl('https://crm.example/hook', async () => ['1.2.3.4']);
    expect(url.hostname).toBe('crm.example');
  });
});
