/**
 * Barge-in must abort TTS without dropping the AbortController.
 * speakBatch/speakStreaming check `signal.aborted` before each chunk;
 * nulling the controller makes that check pass and the next chunk plays.
 */

export function abortTtsPipeline(controller: AbortController | null): void {
  controller?.abort();
}

export function isTtsPipelineAborted(controller: AbortController | null): boolean {
  return !!controller?.signal.aborted;
}

/** Run async utterance handlers one at a time so barge-in cannot overlap two bot actions. */
export function createSerialQueue(): (task: () => Promise<void>) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  return (task) => {
    const next = tail.then(task, task);
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}
