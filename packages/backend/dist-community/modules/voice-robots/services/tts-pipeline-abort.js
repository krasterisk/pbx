"use strict";
/**
 * Barge-in must abort TTS without dropping the AbortController.
 * speakBatch/speakStreaming check `signal.aborted` before each chunk;
 * nulling the controller makes that check pass and the next chunk plays.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.abortTtsPipeline = abortTtsPipeline;
exports.isTtsPipelineAborted = isTtsPipelineAborted;
exports.createSerialQueue = createSerialQueue;
function abortTtsPipeline(controller) {
    controller?.abort();
}
function isTtsPipelineAborted(controller) {
    return !!controller?.signal.aborted;
}
/** Run async utterance handlers one at a time so barge-in cannot overlap two bot actions. */
function createSerialQueue() {
    let tail = Promise.resolve();
    return (task) => {
        const next = tail.then(task, task);
        tail = next.then(() => undefined, () => undefined);
        return next;
    };
}
//# sourceMappingURL=tts-pipeline-abort.js.map