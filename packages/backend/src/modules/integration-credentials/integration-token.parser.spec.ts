import { parseIntegrationAuthorization } from './integration-token.parser';

describe('integration Authorization parser', () => {
  it('keeps JWT and machine-key grammar separate', () => {
    expect(parseIntegrationAuthorization({ headers: { authorization: 'Bearer a.b.c' } }))
      .toEqual({ kind: 'jwt', token: 'a.b.c' });
    const key = `krint_v1_${'A'.repeat(22)}_${'b'.repeat(43)}`;
    expect(parseIntegrationAuthorization({ headers: { authorization: `Bearer ${key}` } }))
      .toEqual({ kind: 'integration', selector: 'A'.repeat(22), secret: 'b'.repeat(43) });
    expect(() => parseIntegrationAuthorization({
      headers: { authorization: 'Bearer krint_v1_short_bad' },
    })).toThrow();
  });

  it('rejects query tokens and duplicate Authorization headers without echoing credentials', () => {
    expect(() => parseIntegrationAuthorization({
      headers: { authorization: 'Bearer a.b.c' }, query: { token: 'other' },
    })).toThrow();
    expect(() => parseIntegrationAuthorization({
      headers: { authorization: 'Bearer a.b.c' },
      rawHeaders: ['Authorization', 'Bearer a.b.c', 'authorization', 'Bearer x.y.z'],
    })).toThrow();
    expect(() => parseIntegrationAuthorization({ headers: { authorization: 'Bearer invalid' } }))
      .toThrow();
  });
});
