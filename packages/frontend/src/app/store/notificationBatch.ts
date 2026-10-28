// Background call panels must not wait for a compositor frame to notify views.
// Normal-priority actions still flush immediately; only opted-in RTK actions wait.
export const notificationBatch = { type: 'timer', timeout: 16 } as const;
