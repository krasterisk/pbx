import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  conferenceRecordingRel,
  safeConferenceRecordingPath,
} from './conference-recording-path.util';

describe('conferenceRecordingRel (16.2-01 D-30)', () => {
  it('builds {vpbx}/conferences/{room_uid}/{meeting_uid}.wav', () => {
    expect(conferenceRecordingRel(42, 77, 15)).toBe('42/conferences/77/15.wav');
  });
});

describe('safeConferenceRecordingPath (16.2-01 D-30)', () => {
  let base: string;

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-rec-safe-'));
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  function writeRel(rel: string, body = 'RIFF'): string {
    const dest = path.join(base, ...rel.split('/').slice(0, -1));
    fs.mkdirSync(dest, { recursive: true });
    const file = path.join(base, ...rel.split('/'));
    fs.writeFileSync(file, body);
    return file;
  }

  it('resolves an existing relative wav under the base and does not append .mp3', () => {
    const rel = '42/conferences/77/15.wav';
    const wav = writeRel(rel);
    const resolved = safeConferenceRecordingPath(base, rel);
    expect(resolved).not.toBeNull();
    expect(resolved).toBe(path.resolve(wav));
    expect(resolved).not.toMatch(/\.mp3$/i);
    expect(resolved).not.toMatch(/\.wav\.mp3$/i);
    expect(fs.existsSync(`${resolved}.mp3`)).toBe(false);
  });

  it('returns null for empty, null, and whitespace rel (D-30 empty)', () => {
    expect(safeConferenceRecordingPath(base, '')).toBeNull();
    expect(safeConferenceRecordingPath(base, null as unknown as string)).toBeNull();
    expect(safeConferenceRecordingPath(base, '   ')).toBeNull();
  });

  it('rejects a relative path that contains ..', () => {
    expect(safeConferenceRecordingPath(base, '../secret.wav')).toBeNull();
    expect(safeConferenceRecordingPath(base, '42/conferences/../../../etc/passwd')).toBeNull();
  });

  it('rejects an absolute POSIX path and a Windows drive letter', () => {
    const rel = '42/conferences/77/15.wav';
    const wav = writeRel(rel);
    expect(safeConferenceRecordingPath(base, wav.replace(/\\/g, '/'))).toBeNull();
    expect(safeConferenceRecordingPath(base, '/usr/records/42/conferences/77/15.wav')).toBeNull();
    expect(safeConferenceRecordingPath(base, 'C:\\x')).toBeNull();
    expect(safeConferenceRecordingPath(base, 'C:/usr/records-evil/x.wav')).toBeNull();
  });

  it('does not treat a sibling prefix path as inside the base (D-30 adjacency)', () => {
    const sibling = `${base}-evil`;
    fs.mkdirSync(sibling, { recursive: true });
    const evil = path.join(sibling, 'x.wav');
    fs.writeFileSync(evil, 'RIFF');
    expect(safeConferenceRecordingPath(base, evil)).toBeNull();
    fs.rmSync(sibling, { recursive: true, force: true });
  });

  it('returns null when the wav file is missing', () => {
    expect(safeConferenceRecordingPath(base, '42/conferences/77/missing.wav')).toBeNull();
  });
});
