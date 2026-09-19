import { createCaptureIntent, digestNodeIdentity, emptyCaptureStores } from '../recording-capture/capture-engine';

/** Robot-only capture writes the same intent/manifest contracts without routes or CDR. */
export function createRobotCaptureIntent(input: {
  nodeId: string;
  secret: string;
  bindingId: string;
  recordingUid: string;
  sessionId: string;
  now: Date;
}) {
  const stores = emptyCaptureStores();
  return { stores, identity: digestNodeIdentity(input.nodeId, input.secret), createCaptureIntent };
}
