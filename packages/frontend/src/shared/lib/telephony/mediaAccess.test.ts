import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundedMediaStream } from './mediaAccess';

describe('bounded microphone access', () => {
  afterEach(() => vi.useRealTimers());
  it('returns the media stream without stopping its tracks', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    expect(await boundedMediaStream(() => Promise.resolve(stream))).toBe(stream);
    expect(stop).not.toHaveBeenCalled();
  });
  it('preserves permission/device errors', async () => {
    const error = new DOMException('Denied', 'NotAllowedError');
    await expect(boundedMediaStream(() => Promise.reject(error))).rejects.toBe(error);
  });
  it('stops microphone tracks granted after the call was canceled', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    await expect(boundedMediaStream(() => Promise.resolve(stream), 15000, () => false)).rejects.toMatchObject({ name: 'AbortError' });
    expect(stop).toHaveBeenCalledOnce();
  });
  it('times out an unanswered prompt and closes a stream arriving after cancellation', async () => {
    vi.useFakeTimers();
    let grant!: (stream: MediaStream) => void;
    const stop = vi.fn();
    const result = boundedMediaStream(() => new Promise((resolve) => { grant = resolve; }), 100);
    const assertion = expect(result).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await vi.advanceTimersByTimeAsync(0);
    expect(stop).toHaveBeenCalledOnce();
  });
});
