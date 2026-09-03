import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VoicemailLinkController } from './voicemail-link.controller';
import { VoicemailLinkGuard } from './voicemail-link.guard';
import * as fs from 'fs';
import * as path from 'path';

describe('VoicemailLinkController', () => {
  it('is guarded only by VoicemailLinkGuard (no JwtAuthGuard)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, VoicemailLinkController) ?? [];
    expect(guards).toContain(VoicemailLinkGuard);
    expect(guards).not.toContain(JwtAuthGuard);
  });

  it('play delegates to streamByPlayToken with the opaque token', async () => {
    const service = { streamByPlayToken: jest.fn().mockResolvedValue(undefined) };
    const controller = new VoicemailLinkController(service as any);
    const req = { user: { vpbx_user_uid: 12, isDisplayToken: true } } as any;
    const res = {} as any;

    await controller.play(req, res, 'deadbeef'.repeat(8));

    expect(service.streamByPlayToken).toHaveBeenCalledWith(
      'deadbeef'.repeat(8),
      12,
      req,
      res,
    );
  });
});

describe('voicemail play stream (audio/wav + Range)', () => {
  it('streamByPlayToken sets Content-Type audio/wav and supports Range 206', async () => {
    const { PassThrough } = require('stream') as typeof import('stream');
    const { VoicemailService } = require('./voicemail.service') as typeof import('./voicemail.service');
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vm-play-'));
    const rel = '12/voicemail/u1.wav';
    const destDir = path.join(tmp, '12', 'voicemail');
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'u1.wav'), Buffer.alloc(32, 7));

    const service = new VoicemailService(
      {
        findOne: jest.fn().mockResolvedValue({
          uid: 3,
          user_uid: 12,
          uniqueid: 'u1',
          file_rel: rel,
        }),
      } as any,
      {
        findOne: jest.fn().mockResolvedValue({
          token: 'a'.repeat(64),
          message_uid: 3,
          vpbx_user_uid: 12,
          revoked_at: null,
          expires_at: new Date(Date.now() + 1000),
        }),
      } as any,
      { get: jest.fn() } as any,
      { getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: tmp }) } as any,
    );

    const headers: Record<string, unknown> = {};
    let statusCode = 200;
    const chunks: Buffer[] = [];
    const dest = new PassThrough();
    dest.on('data', (c: Buffer) => chunks.push(c));
    const res: any = dest;
    res.setHeader = (k: string, v: unknown) => {
      headers[k.toLowerCase()] = v;
    };
    res.status = (code: number) => {
      statusCode = code;
      return res;
    };

    await new Promise<void>((resolve, reject) => {
      dest.on('end', () => resolve());
      dest.on('finish', () => resolve());
      dest.on('error', reject);
      service
        .streamByPlayToken('a'.repeat(64), 12, { headers: { range: 'bytes=0-7' }, query: {} } as any, res)
        .catch(reject);
    });

    expect(headers['content-type']).toBe('audio/wav');
    expect(headers['content-type']).not.toBe('audio/mpeg');
    expect(headers['accept-ranges']).toBe('bytes');
    expect(statusCode).toBe(206);
    expect(Buffer.concat(chunks).length).toBe(8);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('voicemail module isolation', () => {
  const src = fs.readFileSync(path.join(__dirname, 'voicemail.module.ts'), 'utf8');

  it('does not import cdr-public.controller', () => {
    expect(src).not.toMatch(/cdr-public/);
  });
});
