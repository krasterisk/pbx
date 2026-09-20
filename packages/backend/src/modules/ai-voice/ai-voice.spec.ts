import {
  admitSession, assertExpectedRevision, bumpDraft, consumeTicket, createDeployment,
  drainOnExpiry, emptyVoiceStores, enableDeployment, ensureDraft, issueTicket, publishVersion,
  type AgentSnapshot,
} from './voice-engine';
import { acceptFinalStt, bargeIn, beginSpeaking, ignoreLateCallback, initialCascade, serialPlayback } from './turn-coordinator';
import { assertRtpPacket } from './rtp-guard';
import { confirmVoiceTool, executeVoiceTool } from './call-control';
import { completeAutodialAttempt, linkAutodialAttempt } from './autodial-attempt.adapter';
import { classifyAriEvent } from '../ari/ari-event-classifier';
import { DEFAULT_ARI_APP_NAME, DEFAULT_AUTODIAL_ARI_APP_NAME } from '../ari/ari-app-name';
import { DEFAULT_AI_VOICE_ARI_APP_NAME } from '../ari/ari-event-classifier';

function agent(overrides: Partial<AgentSnapshot> = {}): AgentSnapshot {
  return {
    uid: 9, tenantUid: 8, name: 'Pilot', uniqueId: 'pilot', mode: 'cascade',
    greeting: 'здравствуйте', instruction: 'помогайте',
    modelProfileId: 1, sttProfileId: 2, ttsProfileId: 3, enabled: true, ...overrides,
  };
}

describe('VR1 publish CAS', () => {
  it('requires If-Match, rejects realtime publish, and replays operation keys', () => {
    const stores = emptyVoiceStores();
    const row = agent();
    expect(() => bumpDraft(stores, row, undefined as unknown as number)).toThrow(/revision_required/);
    ensureDraft(stores, row);
    expect(() => bumpDraft(stores, row, 99)).toThrow(/stale_draft/);
    bumpDraft(stores, row, 1, { maxTurns: 12 });
    expect(() => publishVersion({
      stores, agent: agent({ mode: 'realtime' }), userId: 7, operationKey: 'p1', llmRevisionId: 'llm',
    })).toThrow(/realtime_unavailable/);
    const first = publishVersion({ stores, agent: row, userId: 7, operationKey: 'p1', llmRevisionId: 'llm' });
    expect(publishVersion({ stores, agent: row, userId: 7, operationKey: 'p1', llmRevisionId: 'llm' }).id).toBe(first.id);
    const deployment = createDeployment({
      stores, tenantUid: 8, agentUid: 9, kind: 'internal', versionId: first.id,
    });
    expect(deployment.status).toBe('disabled');
    enableDeployment(stores, deployment.id, true);
    expect(createDeployment({ stores, tenantUid: 8, agentUid: 9, kind: 'external_sip' }).status).toBe('disabled');
    expect(() => enableDeployment(stores, createDeployment({
      stores, tenantUid: 8, agentUid: 9, kind: 'external_sip',
    }).id, true)).toThrow(/external_sip_disabled/);
  });
});

describe('VR2 tickets and ARI classifier', () => {
  it('rejects spoof/expired tickets and foreign ARI apps', () => {
    const issued = issueTicket({
      secret: 's', tenantUid: 8, nodeId: 'n1', channelUniqueid: 'ch-1',
      deploymentId: 'dep-1', now: new Date('2026-09-19T12:00:00.000Z'),
    });
    const ticket = {
      ...issued, tenantUid: 8, nodeId: 'n1', channelUniqueid: 'ch-1', deploymentId: 'dep-1', consumedAt: null,
    };
    expect(() => consumeTicket({
      secret: 'other', ticket, claimed: ticket, now: new Date('2026-09-19T12:00:10.000Z'),
    })).toThrow(/spoof_ticket/);
    expect(() => consumeTicket({
      secret: 's', ticket, claimed: ticket, now: new Date('2026-09-19T12:00:31.000Z'),
    })).toThrow(/ticket_expired/);
    consumeTicket({
      secret: 's', ticket, claimed: ticket, now: new Date('2026-09-19T12:00:10.000Z'),
    });
    ticket.consumedAt = new Date();
    expect(() => consumeTicket({
      secret: 's', ticket, claimed: ticket, now: new Date('2026-09-19T12:00:11.000Z'),
    })).toThrow(/ticket_replay/);
    const names = {
      scriptedVoiceRobots: DEFAULT_ARI_APP_NAME,
      autodial: DEFAULT_AUTODIAL_ARI_APP_NAME,
      aiVoice: DEFAULT_AI_VOICE_ARI_APP_NAME,
    };
    expect(classifyAriEvent({
      application: names.aiVoice, names, applicationReplaced: true,
    }).reason).toBe('application_replaced');
    expect(classifyAriEvent({ application: 'other', names }).accepted).toBe(false);
    expect(() => assertRtpPacket(
      { peer: '10.0.0.2', port: 10000, ssrc: 1, payloadType: 0 },
      { peer: '8.8.8.8', port: 10000, ssrc: 1, sequence: 1, timestamp: 0, padding: false, extension: false, csrcCount: 0, payloadType: 0 },
    )).toThrow(/rtp_spoof/);
  });
});

describe('VR3 barge-in', () => {
  it('keeps the new caller utterance and drops late TTS', () => {
    let state = initialCascade();
    state = acceptFinalStt(state, 'здравствуйте');
    state = beginSpeaking(state, ['чем могу помочь']);
    state = bargeIn(state, 'тариф');
    expect(state.callerBuffer).toBe('тариф');
    expect(ignoreLateCallback(state, state.flushedEpoch)).toBe(true);
    expect(serialPlayback([
      { epoch: 1, seq: 1, text: 'b' }, { epoch: 1, seq: 0, text: 'a' },
    ])).toEqual(['a', 'b']);
  });
});

describe('VR4 tools', () => {
  it('dedupes operations and denies free-form transfer', () => {
    const seen = new Map<string, { action: string; state: 'requested' | 'confirmed' | 'failed' }>();
    expect(() => executeVoiceTool({
      action: 'transfer', operationKey: 'op', targetId: '+7900', allowlist: ['queue-1'], seen, preview: false,
    })).toThrow(/transfer_target_denied/);
    const first = executeVoiceTool({
      action: 'end_call', operationKey: 'end-1', allowlist: [], seen, preview: false,
    });
    expect(executeVoiceTool({
      action: 'end_call', operationKey: 'end-1', allowlist: [], seen, preview: false,
    }).replay).toBe(true);
    confirmVoiceTool(seen, 'end-1', 'confirmed');
    expect(first.state).toBe('requested');
    expect(() => executeVoiceTool({
      action: 'end_call', operationKey: 'x', allowlist: [], seen, preview: true,
    })).toThrow(/preview_no_side_effect/);
    const stores = emptyVoiceStores();
    const published = publishVersion({
      stores, agent: agent(), userId: 7, operationKey: 'v', llmRevisionId: 'llm',
    });
    const deployment = createDeployment({
      stores, tenantUid: 8, agentUid: 9, kind: 'internal', versionId: published.id,
    });
    enableDeployment(stores, deployment.id, true);
    const sessions = new Map();
    const firstSession = admitSession({
      stores, sessions, deploymentId: deployment.id, ingressKind: 'native', ingressKey: 'ch-1',
    });
    expect(admitSession({
      stores, sessions, deploymentId: deployment.id, ingressKind: 'native', ingressKey: 'ch-1',
    }).id).toBe(firstSession.id);
  });
});

describe('10R drain-on-expiry', () => {
  it('keeps in-flight sessions and refuses new admissions after drain', () => {
    const stores = emptyVoiceStores();
    const published = publishVersion({
      stores, agent: agent(), userId: 7, operationKey: 'drain', llmRevisionId: 'llm',
    });
    const deployment = createDeployment({
      stores, tenantUid: 8, agentUid: 9, kind: 'internal', versionId: published.id,
    });
    enableDeployment(stores, deployment.id, true);
    const sessions = new Map();
    const live = admitSession({
      stores, sessions, deploymentId: deployment.id, ingressKind: 'native', ingressKey: 'live',
    });
    expect(drainOnExpiry(stores, 8, true)).toMatchObject({ admissionsStopped: true });
    expect(() => admitSession({
      stores, sessions, deploymentId: deployment.id, ingressKind: 'native', ingressKey: 'new',
    })).toThrow(/admissions_stopped/);
    expect(sessions.get(live.id)?.ingressKey).toBe('live');
  });
});

describe('VR4 autodial attempt adapter', () => {
  it('links one attempt to one session and rejects conflicting terminal outcomes', () => {
    const seen = new Map<string, { sessionId: string; outcome: 'completed' | 'transferred' | 'no_input' | 'runtime_failed' | 'cancelled' | null }>();
    const events = new Set<string>();
    expect(() => linkAutodialAttempt({ seen, attemptUuid: 'a1' })).toThrow(/attempt_session_required/);
    const first = linkAutodialAttempt({ seen, attemptUuid: 'a1', sessionId: 's1' });
    expect(linkAutodialAttempt({ seen, attemptUuid: 'a1', sessionId: 's2' }).sessionId).toBe(first.sessionId);
    completeAutodialAttempt({ seen, attemptUuid: 'a1', outcome: 'completed', eventKey: 'done', events });
    expect(completeAutodialAttempt({
      seen, attemptUuid: 'a1', outcome: 'completed', eventKey: 'done', events,
    }).replay).toBe(true);
    expect(() => completeAutodialAttempt({
      seen, attemptUuid: 'a1', outcome: 'cancelled', eventKey: 'late', events,
    })).toThrow(/terminal_outcome_conflict/);
  });
});
