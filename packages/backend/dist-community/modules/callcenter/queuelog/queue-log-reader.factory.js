"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueLogReaderProvider = void 0;
const queue_log_reader_interface_1 = require("./queue-log-reader.interface");
const file_queue_log_reader_1 = require("./file-queue-log-reader");
const realtime_queue_log_reader_1 = require("./realtime-queue-log-reader");
/**
 * Factory for QUEUE_LOG_READER.
 *
 * CC_QUEUE_LOG_BACKEND: file | realtime | auto
 * Default `realtime` — confirmed by 07-04 Task 1 (queue_log table present on target MySQL).
 * `auto` prefers realtime when available, else a readable file. Discovery
 * failures propagate; only an actually missing table selects the file.
 */
exports.queueLogReaderProvider = {
    provide: queue_log_reader_interface_1.QUEUE_LOG_READER,
    useFactory: async (fileReader, realtimeReader) => {
        const backend = (process.env.CC_QUEUE_LOG_BACKEND || 'realtime').toLowerCase();
        if (backend === 'file')
            return fileReader;
        if (backend === 'realtime')
            return realtimeReader;
        if (backend !== 'auto')
            throw new Error(`Invalid CC_QUEUE_LOG_BACKEND: ${backend}`);
        if (await realtimeReader.isAvailable())
            return realtimeReader;
        if (await fileReader.isAvailable())
            return fileReader;
        throw new Error('queue_log source unavailable: no realtime table or readable file');
    },
    inject: [file_queue_log_reader_1.FileQueueLogReader, realtime_queue_log_reader_1.RealtimeQueueLogReader],
};
//# sourceMappingURL=queue-log-reader.factory.js.map