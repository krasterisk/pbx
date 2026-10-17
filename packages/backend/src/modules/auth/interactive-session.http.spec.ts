import { Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Server } from 'node:http';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InteractiveSessionService } from './interactive-session.service';
import { AutodialInteractiveGuard } from '../ai-chat/autodial-interactive.guard';

let applied = 0;
function request(server: Server) {
  return { post: (path: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }; let body: unknown;
    const chain = { set: (name: string, value: string) => { headers[name] = value; return chain; },
      send: (value: unknown) => { body = value; return chain; },
      expect: async (status: number) => {
        const address = server.address(); if (!address || typeof address === 'string') throw new Error('HTTP fixture not listening');
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
        expect(response.status).toBe(status); await response.arrayBuffer();
        const cookies = response.headers.getSetCookie(); return { headers: { 'set-cookie': cookies.length ? cookies : undefined } };
      } };
    return chain;
  } };
}
@Controller('proof-fixture')
class ProofFixtureController {
  @Post(':proposalId/apply') @UseGuards(AutodialInteractiveGuard)
  apply() { applied++; return { applied: true }; }
}

describe('Password-login browser proof over HTTP', () => {
  it('requires the password-issued cookie, binds it to the exact access token, and rotates only an existing proof', async () => {
    // Authentication storage and proposal storage are fixtures. Controllers, cookie
    // serialization, HMAC validation and autodial confirmation guard are actual source.
    const config = new ConfigService({ JWT_SECRET: 'synthetic-http-test-secret-at-least-32-characters', NODE_ENV: 'test' });
    const proof = new InteractiveSessionService(config);
    const guard = new AutodialInteractiveGuard({ findOne: async () => ({ apply_payload: { tool: 'add_autodial_dnc' } }) } as never,
      {} as never, {} as never, proof);
    const token = (suffix = '') => ({ accessToken: `synthetic-access${suffix}`, refreshToken: `synthetic-refresh${suffix}`,
      user: { uniqueid: 7, vpbx_user_uid: 2 } });
    const auth = { login: async (_login: string, password: string) => {
      if (password !== 'synthetic-password') throw new UnauthorizedException(); return token();
    }, refresh: async () => token('-rotated') };
    const module = await Test.createTestingModule({ controllers: [AuthController, ProofFixtureController], providers: [
      { provide: AuthService, useValue: auth }, { provide: InteractiveSessionService, useValue: proof },
    ] }).overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true }).overrideGuard(AutodialInteractiveGuard).useValue(guard).compile();
    const app = module.createNestApplication({ logger: false }); app.setGlobalPrefix('api');
    app.use((req: any, _res: unknown, next: () => void) => { req.user = { sub: 7, vpbx_user_uid: 2 }; next(); });
    await app.listen(0, '127.0.0.1'); applied = 0;
    try {
      const server = app.getHttpServer(), apply = '/api/proof-fixture/own/apply';
      const deniedLogin = await request(server).post('/api/auth/login').send({ login: 'synthetic', password: 'wrong' }).expect(401);
      expect(deniedLogin.headers['set-cookie']).toBeUndefined();
      await request(server).post(apply).set('Authorization', 'Bearer synthetic-access').expect(403);
      const logged = await request(server).post('/api/auth/login').send({ login: 'synthetic', password: 'synthetic-password' }).expect(200);
      const rawCookie = logged.headers['set-cookie']![0]; expect(rawCookie).toMatch(/HttpOnly/); expect(rawCookie).toMatch(/SameSite=Strict/);
      const cookie = rawCookie.split(';')[0];
      await request(server).post(apply).set('Authorization', 'Bearer another-access').set('Cookie', cookie).expect(403);
      await request(server).post(apply).set('Authorization', 'Bearer synthetic-access').set('Cookie', cookie).set('Sec-Fetch-Site', 'cross-site').expect(403);
      expect(applied).toBe(0);
      await request(server).post(apply).set('Authorization', 'Bearer synthetic-access').set('Cookie', cookie).expect(201);
      expect(applied).toBe(1);
      const refreshOnly = await request(server).post('/api/auth/refresh').send({ refreshToken: 'synthetic-refresh' }).expect(200);
      expect(refreshOnly.headers['set-cookie']).toBeUndefined();
      const rotated = await request(server).post('/api/auth/refresh').set('Cookie', cookie).send({ refreshToken: 'synthetic-refresh' }).expect(200);
      const nextCookie = rotated.headers['set-cookie']![0].split(';')[0];
      await request(server).post(apply).set('Authorization', 'Bearer synthetic-access-rotated').set('Cookie', nextCookie).expect(201);
      expect(applied).toBe(2);
    } finally { await app.close(); }
  });
});
