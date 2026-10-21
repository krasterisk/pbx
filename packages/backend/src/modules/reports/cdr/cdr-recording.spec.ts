import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import type { Request, Response } from 'express';
import type { Sequelize } from 'sequelize-typescript';
import type { SystemSettingsService } from '../../system-settings/system-settings.service';
import { CdrService } from './cdr.service';

describe('CDR recording files and streaming', () => {
  const temporaryParent = fs.realpathSync(os.tmpdir());
  let root: string;
  let owned: string[];
  const mp3 = Buffer.from('ID3-unit-recording-bytes');
  const wav = Buffer.alloc(364);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);

  beforeEach(() => {
    owned = [];
    root = fs.mkdtempSync(path.join(temporaryParent, 'cdr-r7-recording-test-'));
    owned.push(root);
  });
  afterEach(() => {
    for (const directory of owned.reverse()) {
      const absolute = fs.realpathSync(directory);
      const relative = path.relative(temporaryParent, absolute);
      if (path.isAbsolute(relative) || relative.includes(path.sep) || !relative.startsWith('cdr-r7-recording-test-')) {
        throw new Error('Refuse cleanup outside the exact owned temporary directories');
      }
      fs.rmSync(absolute, { recursive: true, force: true });
    }
  });

  function service(record: string): CdrService {
    // File/stream unit tests: an already-visible SQL row, configuration fixture.
    // Tenant/participant/JWT checks are exercised by the separate real SQL harness.
    const sql = { query: jest.fn().mockResolvedValue([{ uniqueid: 'lab.1', record }]) };
    const settings = { getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: root }) };
    return new CdrService(undefined as never, undefined as never, undefined as never, undefined as never,
      sql as unknown as Sequelize, settings as unknown as SystemSettingsService);
  }
  function file(name: string, bytes = mp3): string {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    return target;
  }
  async function stream(record: string, range?: string, download = false) {
    const chunks: Buffer[] = [], headers: Record<string, string | number> = {};
    let status = 200;
    const output = new PassThrough();
    const response = Object.assign(output, {
      setHeader(name: string, value: string | number): PassThrough { headers[name.toLowerCase()] = value; return output; },
      status(value: number): PassThrough { status = value; return output; },
    });
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    const ended = once(output, 'end');
    try {
      await service(record).streamRecording(910001, 'lab.1', response as unknown as Response,
        { headers: range ? { range } : {}, query: download ? { download: '1' } : {} } as unknown as Request);
      await ended;
      return { status, headers, bytes: Buffer.concat(chunks) };
    } finally { output.destroy(); }
  }

  it.each(['legacy', 'pbx-1792346284.0'])('preserves extensionless/decimal legacy basename %s', async name => {
    const target = file(name + '.mp3');
    expect((await service(name).resolveRecordingFile(910001, 'lab.1')).filePath).toBe(target);
  });
  it.each(['call.mp3', 'call.wav', 'call.WAV'])('opens the explicit recording filename %s', async name => {
    const target = file(name, name.endsWith('.mp3') ? mp3 : wav);
    expect((await service(name).resolveRecordingFile(910001, 'lab.1')).filePath).toBe(target);
  });
  it('keeps the old converted WAV.mp3 layout when the original is absent', async () => {
    const target = file('call.wav.mp3');
    expect((await service('call.wav').resolveRecordingFile(910001, 'lab.1')).filePath).toBe(target);
  });
  it('serves WAV bytes with the actual MIME and download extension', async () => {
    file('call.wav', wav);
    const result = await stream('call.wav', undefined, true);
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toBe('audio/wav');
    expect(result.headers['content-disposition']).toBe('attachment; filename="lab.1.wav"');
    expect(result.bytes).toEqual(wav);
  });
  it('keeps MP3 MIME and byte ranges for legacy recordings', async () => {
    file('legacy.mp3');
    const result = await stream('legacy', 'bytes=0-2');
    expect(result.status).toBe(206);
    expect(result.headers['content-type']).toBe('audio/mpeg');
    expect(result.bytes).toEqual(mp3.subarray(0, 3));
  });
  it('seeks within the original WAV, without converting or offsetting bytes', async () => {
    file('call.wav', wav);
    const result = await stream('call.wav', 'bytes=12-23');
    expect(result.status).toBe(206);
    expect(result.headers['content-range']).toBe(`bytes 12-23/${wav.length}`);
    expect(result.headers['content-length']).toBe(12);
    expect(result.bytes).toEqual(wav.subarray(12, 24));
  });
  it('rejects an out-of-file WAV range', async () => {
    file('call.wav', wav);
    const result = await stream('call.wav', 'bytes=999999-');
    expect(result.status).toBe(416);
    expect(result.headers['content-range']).toBe(`bytes */${wav.length}`);
    expect(result.bytes.length).toBe(0);
  });
  it('does not serve directories or arbitrary non-audio files', async () => {
    fs.mkdirSync(path.join(root, 'folder.mp3'));
    file('private.json', Buffer.from('{"synthetic":true}'));
    await expect(service('folder').resolveRecordingFile(910001, 'lab.1')).rejects.toThrow('Recording file not found');
    await expect(service('private.json').resolveRecordingFile(910001, 'lab.1')).rejects.toThrow('Recording file not found');
  });
  it('rejects parent traversal even when a sibling file exists', async () => {
    await expect(service('../outside').resolveRecordingFile(910001, 'lab.1')).rejects.toThrow('Recording file not found');
  });
  it('rejects a junction/symlink that resolves outside the recording root', async () => {
    const outside = fs.mkdtempSync(path.join(temporaryParent, 'cdr-r7-recording-test-'));
    owned.push(outside); fs.writeFileSync(path.join(outside, 'outside.mp3'), mp3);
    fs.symlinkSync(outside, path.join(root, 'alias'), 'junction');
    await expect(service('alias/outside').resolveRecordingFile(910001, 'lab.1')).rejects.toThrow('Recording file not found');
  });
  it('allows a junction/symlink to another audio directory inside the root', async () => {
    file('inside/call.wav', wav);
    fs.symlinkSync(path.join(root, 'inside'), path.join(root, 'alias'), 'junction');
    const result = await service('alias/call.wav').resolveRecordingFile(910001, 'lab.1');
    expect(fs.readFileSync(result.filePath)).toEqual(wav);
  });
});
