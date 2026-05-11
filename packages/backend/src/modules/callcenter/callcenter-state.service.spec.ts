import { CallCenterStateService } from './callcenter-state.service';

/**
 * Unit tests for the CC in-memory state store.
 *
 * Coverage targets per plan §14.2:
 *  - setAgent / setQueue / setCall and event emission shapes
 *  - getEventStream per-tenant isolation
 *  - getSnapshot composition
 *  - RxJS subscription cleanup (no leaks)
 */
describe('CallCenterStateService', () => {
  let service: CallCenterStateService;

  beforeEach(() => {
    service = new CallCenterStateService();
  });

  // ─── Agent state ────────────────────────────────────────

  describe('setAgent', () => {
    it('upserts an agent and emits agentUpdate', done => {
      service.getEventStream(7).subscribe(event => {
        expect(event.type).toBe('agentUpdate');
        expect(event.userUid).toBe(7);
        expect(event.data.interface).toBe('PJSIP/101');
        expect(event.data.status).toBe('READY');
        expect(event.data.userUid).toBe(7);
        expect(event.data._eventId).toBe(1);
        done();
      });

      service.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'READY', userId: 42 });
    });

    it('preserves fields on partial update', () => {
      service.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'READY', userId: 42 });
      service.setAgent(7, 'PJSIP/101', { status: 'PAUSED', pauseReason: 'Lunch' });

      const agent = service.getAgent(7, 'PJSIP/101');
      expect(agent?.name).toBe('Alice');
      expect(agent?.status).toBe('PAUSED');
      expect(agent?.pauseReason).toBe('Lunch');
      expect(agent?.userId).toBe(42);
    });

    it('keys agents by tenant — same interface in two tenants is independent', () => {
      service.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'READY' });
      service.setAgent(8, 'PJSIP/101', { name: 'Bob', status: 'IN_CALL' });

      expect(service.getAgent(7, 'PJSIP/101')?.name).toBe('Alice');
      expect(service.getAgent(8, 'PJSIP/101')?.name).toBe('Bob');
      expect(service.getAllAgents(7)).toHaveLength(1);
      expect(service.getAllAgents(8)).toHaveLength(1);
    });
  });

  describe('removeAgent', () => {
    it('drops the agent and emits a removed marker', () => {
      service.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'READY' });
      // Subject does not replay, so we attach the subscriber AFTER the
      // initial setAgent and only the removal event will arrive.
      const received: any[] = [];
      service.getEventStream(7).subscribe(e => received.push(e));

      service.removeAgent(7, 'PJSIP/101');

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('agentUpdate');
      expect(received[0].data.removed).toBe(true);
      expect(received[0].data.interface).toBe('PJSIP/101');
      expect(service.getAgent(7, 'PJSIP/101')).toBeUndefined();
    });
  });

  // ─── Queue state ────────────────────────────────────────

  describe('setQueue', () => {
    it('emits queueUpdate scoped to the tenant', () => {
      const received: any[] = [];
      service.getEventStream(7).subscribe(e => received.push(e));
      service.getEventStream(8).subscribe(e => received.push(e));

      service.setQueue(7, 'sales', { waiting: 3, talking: 1 });

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('queueUpdate');
      expect(received[0].userUid).toBe(7);
      expect(received[0].data.waiting).toBe(3);
    });

    it('uses sane defaults when only partial state is provided', () => {
      service.setQueue(7, 'sales', { waiting: 5 });
      const q = service.getQueue(7, 'sales');
      expect(q?.waiting).toBe(5);
      expect(q?.strategy).toBe('ringall');
      expect(q?.sla).toBe(100);
      expect(q?.agents).toEqual({ total: 0, available: 0, paused: 0, busy: 0 });
    });
  });

  // ─── Call state ─────────────────────────────────────────

  describe('setCall / removeCall', () => {
    it('emits callNew on first insert and callUpdate on subsequent changes', () => {
      const types: string[] = [];
      service.getEventStream(7).subscribe(e => types.push(e.type));

      service.setCall('U1', { userUid: 7, callerIdNum: '+1', queue: 'sales' });
      service.setCall('U1', { status: 'TALKING', agent: 'PJSIP/101' });

      expect(types).toEqual(['callNew', 'callUpdate']);
    });

    it('emits callEnd on removeCall with the reason payload', done => {
      service.setCall('U2', { userUid: 7, callerIdNum: '+2', queue: 'sales' });
      const events: any[] = [];
      service.getEventStream(7).subscribe(e => events.push(e));
      service.removeCall('U2', 'abandoned');

      // events: [ existing callNew/update emitted later isn't here because subscribe is after setCall ]
      setTimeout(() => {
        const end = events.find(e => e.type === 'callEnd');
        expect(end).toBeDefined();
        expect(end.data.reason).toBe('abandoned');
        expect(end.data.uniqueid).toBe('U2');
        done();
      }, 0);
    });
  });

  // ─── Snapshot & isolation ───────────────────────────────

  describe('getSnapshot', () => {
    it('returns only the requested tenant\'s state', () => {
      service.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'READY' });
      service.setAgent(8, 'PJSIP/200', { name: 'Bob', status: 'READY' });
      service.setQueue(7, 'sales', { waiting: 2 });
      service.setQueue(8, 'support', { waiting: 1 });
      service.setCall('U1', { userUid: 7, queue: 'sales' });
      service.setCall('U2', { userUid: 8, queue: 'support' });

      const snap7 = service.getSnapshot(7);
      expect(snap7.agents).toHaveLength(1);
      expect(snap7.agents[0].name).toBe('Alice');
      expect(snap7.queues).toHaveLength(1);
      expect(snap7.queues[0].name).toBe('sales');
      expect(snap7.calls).toHaveLength(1);
      expect(snap7.calls[0].uniqueid).toBe('U1');
    });
  });

  describe('getEventStream tenant isolation', () => {
    it('never delivers cross-tenant events to a subscriber', () => {
      const seen7: any[] = [];
      const seen8: any[] = [];
      service.getEventStream(7).subscribe(e => seen7.push(e));
      service.getEventStream(8).subscribe(e => seen8.push(e));

      service.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'READY' });
      service.setAgent(8, 'PJSIP/200', { name: 'Bob', status: 'READY' });

      expect(seen7.every(e => e.userUid === 7)).toBe(true);
      expect(seen8.every(e => e.userUid === 8)).toBe(true);
      expect(seen7).toHaveLength(1);
      expect(seen8).toHaveLength(1);
    });
  });

  // ─── getAllCallsGlobal ──────────────────────────────────

  describe('getAllCallsGlobal', () => {
    it('returns calls across tenants — used by AMI Hold/Unhold which lacks tenant context', () => {
      service.setCall('U1', { userUid: 7 });
      service.setCall('U2', { userUid: 8 });
      service.setCall('U3', { userUid: 7 });

      expect(service.getAllCallsGlobal()).toHaveLength(3);
    });
  });
});
