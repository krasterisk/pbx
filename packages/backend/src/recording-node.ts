import { durableCaptureEnabled } from '@krasterisk/shared';
import { journalAppend, reconcileOpenRecording, spoolStates } from './modules/recording-capture/node/spool';

/**
 * Isolated recording-node helper. Must not import AppModule or require SQL.
 * Spool journal is local; backend ownership is transferred explicitly.
 */
async function main(): Promise<void> {
  const spool = process.env.CAPTURE_SPOOL_DIR;
  if (!spool) throw new Error('CAPTURE_SPOOL_DIR is required');
  if (!durableCaptureEnabled()) {
    process.stdout.write(JSON.stringify({ role: 'recording-node', durableCapture: false, states: spoolStates() }));
    return;
  }
  journalAppend(spool, JSON.stringify({ event: 'boot', at: new Date().toISOString() }));
  process.stdout.write(JSON.stringify({
    role: 'recording-node',
    durableCapture: true,
    openRecordingPolicy: reconcileOpenRecording('recording'),
  }));
}

if (require.main === module) {
  void main();
}

export { main as runRecordingNode };
