import { boundSttToMedia } from './media-timing';
describe('decoded-media ASR bounds', () => {
  it('clips an overrun without mutating original text/timing and keeps an audit of the original boundary', () => {
    const source = [{ start: 3, end: 8, text: 'Запись не отменили.' }];
    const r = boundSttToMedia(source, 5000);
    expect(source[0].end).toBe(8);
    expect(r.segments).toEqual([{ ...source[0], end: 5 }]);
    expect(r.evidence[0]).toMatchObject({
      kind: 'media_bounds',
      mediaDurationMs: 5000,
      changes: [
        { originalStartSec: 3, originalEndSec: 8, startSec: 3, endSec: 5 },
      ],
    });
  });
  it('excludes entirely out-of-media text from downstream facts but preserves its local provenance', () => {
    const r = boundSttToMedia(
      [
        { start: 0, end: 2, text: 'Есть речь.' },
        { start: 7, end: 9, text: 'Внешний хвост.' },
      ],
      5000,
    );
    expect(r.segments).toHaveLength(1);
    expect(r.evidence[0].changes[0]).toMatchObject({
      ordinal: 1,
      startSec: null,
      excludedText: 'Внешний хвост.',
    });
  });
  it('does not infer media length from STT duration or a missing measurement', () => {
    const source = [{ start: 0, end: 20, text: 'Речь.' }];
    expect(boundSttToMedia(source).segments).toEqual(source);
    expect(boundSttToMedia(source).evidence).toEqual([]);
  });
  it.each([
    [{ start: -1, end: 2, text: 'x' }],
    [{ start: 4, end: 2, text: 'x' }],
    [{ start: 0, end: NaN, text: 'x' }],
  ])(
    'rejects malformed timing rather than persisting invented offsets',
    (source) => {
      expect(() => boundSttToMedia(source, 1000)).toThrow('invalid_stt_timing');
    },
  );
  it('rejects an entirely outside hypothesis', () => {
    expect(() =>
      boundSttToMedia([{ start: 3, end: 4, text: 'x' }], 1000),
    ).toThrow('stt_outside_media');
  });
});
