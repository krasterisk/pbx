import { abortTtsPipeline, createSerialQueue, isTtsPipelineAborted } from './tts-pipeline-abort';

describe('tts-pipeline-abort', () => {
  it('keeps the aborted controller so remaining TTS chunks can see the abort', () => {
    const controller = new AbortController();
    abortTtsPipeline(controller);
    expect(controller.signal.aborted).toBe(true);
    expect(isTtsPipelineAborted(controller)).toBe(true);
  });

  it('treats a nulled controller as not aborted (the barge-in chunk-continue bug)', () => {
    expect(isTtsPipelineAborted(null)).toBe(false);
  });

  it('stops a chunk loop after abort when the controller is kept', async () => {
    const controller = new AbortController();
    const played: string[] = [];
    const chunks = ['one', 'two', 'three'];
    for (const chunk of chunks) {
      if (isTtsPipelineAborted(controller)) break;
      played.push(chunk);
      if (chunk === 'one') abortTtsPipeline(controller);
    }
    expect(played).toEqual(['one']);
  });

  it('serializes overlapping utterance handlers', async () => {
    const enqueue = createSerialQueue();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = enqueue(async () => {
      order.push('first-start');
      await firstGate;
      order.push('first-end');
    });
    const second = enqueue(async () => {
      order.push('second');
    });

    await Promise.resolve();
    expect(order).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });
});
