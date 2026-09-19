import { admittedJobPayload } from './outbox-payload';

describe('D1 outbox payload wiring', () => {
  it('emits schema v1 without embedding result bodies', () => {
    expect(admittedJobPayload(7, '11111111-2222-4333-8444-555555555555')).toEqual({
      schemaVersion: 1,
      tenantUid: 7,
      aggregateKind: 'job',
      aggregateId: '11111111-2222-4333-8444-555555555555',
      eventType: 'job.admitted',
    });
  });
});
