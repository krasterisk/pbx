'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function originKey(origin) {
  return [origin.tenantUid, origin.nodeId, origin.recordingUid, origin.projectId, origin.policyRevision].join(':');
}

function admit(input) {
  if (input.privacyDenied) return { action: 'skip', reason: 'privacy_deny', outcome: 'skipped' };
  if (!input.entitled) return { action: 'skip', reason: 'entitlement', outcome: 'skipped' };
  if (input.pauseNew) return { action: 'skip', reason: 'pause_new', outcome: 'skipped' };
  const key = originKey(input.origin);
  if (input.knownOrigins.has(key)) return { action: 'replay', reason: 'duplicate_ready', outcome: 'duplicate' };
  if (input.durationMs < 400 || !input.speechDetected) {
    return { action: 'ingest', reason: 'no_speech', outcome: 'unscorable' };
  }
  return { action: 'ingest', reason: 'ready', outcome: 'queued' };
}

const labDir = process.argv[2] || '/tmp/krasterisk-ai-lab';
const files = fs.existsSync(labDir)
  ? fs.readdirSync(labDir).filter(name => name.endsWith('.wav'))
  : [];
const known = new Set();
const relations = [];
const decisions = [];

for (const file of files) {
  const recordingUid = file.replace(/\.wav$/, '');
  const origin = {
    tenantUid: 8, nodeId: 'ipbx', recordingUid, projectId: 'lab-project', policyRevision: 1,
  };
  const size = fs.statSync(path.join(labDir, file)).size;
  const first = admit({
    origin, entitled: true, pauseNew: false, privacyDenied: false,
    durationMs: size > 200 ? 5000 : 100, speechDetected: size > 200, knownOrigins: known,
  });
  decisions.push({ file, pass: 1, ...first });
  known.add(originKey(origin));
  const second = admit({
    origin, entitled: true, pauseNew: false, privacyDenied: false,
    durationMs: 5000, speechDetected: true, knownOrigins: known,
  });
  decisions.push({ file, pass: 2, ...second });
  const lateCdr = second.outcome === 'duplicate' ? 'enrich' : 'new_job';
  relations.push({
    id: crypto.randomUUID(),
    sourceKind: 'cdr',
    sourceId: recordingUid,
    linkedid: recordingUid,
    nodeId: 'ipbx',
    statusLink: true,
    snippet: null,
    lateCdr,
  });
}

const pauseSkip = admit({
  origin: {
    tenantUid: 8, nodeId: 'ipbx', recordingUid: 'pause', projectId: 'lab-project', policyRevision: 1,
  },
  entitled: true, pauseNew: true, privacyDenied: false, durationMs: 5000, speechDetected: true,
  knownOrigins: new Set(),
});

const digest = {
  files: files.length,
  queued: decisions.filter(row => row.outcome === 'queued').length,
  duplicate: decisions.filter(row => row.outcome === 'duplicate').length,
  pauseSkip: pauseSkip.outcome === 'skipped',
  relations: relations.length,
  cdrKinds: ['cdr', 'callcenter', 'autodial'],
};
process.stdout.write(JSON.stringify(digest) + '\n');
if (files.length < 1 || digest.duplicate < 1 || !digest.pauseSkip) process.exit(2);
