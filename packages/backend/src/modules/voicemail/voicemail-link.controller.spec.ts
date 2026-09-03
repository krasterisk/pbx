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
    const { VoicemailService } = require('./voicemail.service') as typeof import('./voicemail.service');
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vm-play-'));
    const rel = '12/voicemail/u1.wav';
    const dest = path.join(tmp, '12', 'voicemail');
    fs.mkdirSync(dest, { recursive: true });
    const payload = Buffer.alloc(32, 7);
    fs.writeFileSync(path.join(dest, 'u1.wav'), payload);

    const tokens = {
      findOne: jest.fn().mockResolvedValue({
        token: 'a'.repeat(64),
        message_uid: 3,
        vpbx_user_uid: 12,
        revoked_at: null,
        expires_at: new Date(Date.now() + 1000),
      }),
    };
    const messages = {
      findOne: jest.fn().mockResolvedValue({
        uid: 3,
        user_uid: 12,
        uniqueid: 'u1',
        file_rel: rel,
      }),
    };
    const service = new VoicemailService(
      messages as any,
      tokens as any,
      { get: jest.fn() } as any,
      { getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: tmp }) } as any,
    );

    const headers: Record<string, unknown> = {};
    let statusCode = 200;
    const chunks: Buffer[] = [];
    const res: any = {
      setHeader: (k: string, v: unknown) => {
        headers[k.toLowerCase()] = v;
      },
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      end: jest.fn(),
    };

    await new Promise<void>((resolve, reject) => {
      const { PassThrough } = require('stream');
      const passthrough = new PassThrough();
      passthrough.on('data', (c: Buffer) => chunks.push(c));
      passthrough.on('end', () => resolve());
      passthrough.on('error', reject);
      res.pipe = (destStream: NodeJS.WritableStream) => {
        destStream.on('finish', () => resolve());
        return destStream;
      };
      // stream.pipe(res) — capture by replacing pipe on the readable via monkeypatch after createReadStream
      const origCreate = fs.createReadStream.bind(fs);
      const spy = jest.spyOn(fs, 'createReadStream').mockImplementation((...args: any[]) => {
        const stream = origCreate(...args);
        stream.pipe = ((destination: any) => {
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            destination?.end?.();
            resolve();
          });
          return destination;
        }) as any;
        return stream;
      });

      service
        .streamByPlayToken('a'.repeat(64), 12, { headers: { range: 'bytes=0-7' } } as any, res)
        .then(() => {
          if (!chunks.length) {
            setTimeout(() => resolve(), 50);
          }
        })
        .catch(reject)
        .finally(() => spy.mockRestore());
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
