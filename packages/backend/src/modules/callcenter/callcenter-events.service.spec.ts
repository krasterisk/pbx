import { Subject } from 'rxjs';
import { CallCenterEventsService } from './callcenter-events.service';

describe('Shared authorized call center stream', () => {
  it('keeps tenant/user routing, recipient filtering, private fields and presence cleanup for either transport', async () => {
    const bus = new Subject<any>();
    const state: any = {
      getSnapshotForUser: jest.fn(() => ({
        tenant: 91,
        snapshot: { agents: [], calls: [], queues: [] },
      })),
      getMonitorSession: jest.fn(() => null),
      getEventStreamForUser: jest.fn(() => bus),
    };
    const cc: any = {
      bumpPanelConnection: jest.fn(() => 0),
      touchPanelSeen: jest.fn().mockResolvedValue(undefined),
    };
    const ami: any = {
      reconcileActiveAgentCalls: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CallCenterEventsService(state, {} as any, ami, cc);
    const received: any[] = [];
    let snapshotReady!: () => void;
    const snapshot = new Promise<void>((resolve) => {
      snapshotReady = resolve;
    });
    const subscription = service
      .events({ sub: 42, level: 2, vpbx_user_uid: 91 } as any)
      .subscribe((event) => {
        received.push(event);
        if (event.type === 'fullSnapshot') snapshotReady();
      });
    await snapshot;
    expect(state.getSnapshotForUser).toHaveBeenCalledWith(91, 42);
    expect(state.getEventStreamForUser).toHaveBeenCalledWith(91, 42);
    expect(received[0].type).toBe('fullSnapshot');
    bus.next({
      type: 'ccChatMessage',
      data: { text: 'other recipient', recipientUserIds: [43] },
    });
    expect(received).toHaveLength(1);
    bus.next({
      type: 'ccChatMessage',
      data: { text: 'own message', recipientUserIds: [42] },
    });
    expect(JSON.parse(received[1].data)).toEqual({ text: 'own message' });
    subscription.unsubscribe();
    expect(bus.observed).toBe(false);
    expect(cc.bumpPanelConnection.mock.calls).toEqual([
      [42, 1],
      [42, -1],
    ]);
  });

  it('releases presence even when disconnected before reconciliation finishes', () => {
    const cc: any = {
      bumpPanelConnection: jest.fn(() => 0),
      touchPanelSeen: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CallCenterEventsService(
      {} as any,
      {} as any,
      { reconcileActiveAgentCalls: () => new Promise(() => {}) } as any,
      cc,
    );
    const subscription = service
      .events({ sub: 42, vpbx_user_uid: 91 } as any)
      .subscribe();
    subscription.unsubscribe();
    expect(cc.bumpPanelConnection.mock.calls).toEqual([
      [42, 1],
      [42, -1],
    ]);
  });
});
