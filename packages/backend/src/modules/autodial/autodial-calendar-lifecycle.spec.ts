import { AutodialSchedulerService } from './autodial-scheduler.service';

describe('calendar wait versus manual pause', () => {
  const closed = new Date('2026-10-19T00:00:00Z'), open = new Date('2026-10-21T09:30:00Z');
  function setup(status = 'running') {
    const row = { uid: 20, user_uid: 7, revision: 1, status, update: jest.fn(async (patch: { status: string }) => { Object.assign(row, patch); }) };
    const campaigns = { findAll: jest.fn(async () => [row]), update: jest.fn(async (patch: { status: string }, options: { where: { status: string } }) => {
      if (row.status !== options.where.status) return [0]; Object.assign(row, patch); return [1];
    }) };
    const schedules = { findAll: jest.fn().mockResolvedValue([{ uid: 1, campaign_uid: 20, kind: 'weekly', weekday: 3,
      time_from: '09:00', time_to: '10:00', timezone: 'UTC', date_from: null, date_to: null, enabled: true }]) };
    const tasks = { count: jest.fn().mockResolvedValue(1) };
    const fresh = () => new AutodialSchedulerService(campaigns as never, schedules as never, tasks as never);
    return { row, fresh, tasks };
  }
  it('persists a calendar wait separately from a manual pause', async () => {
    const { row, fresh } = setup(); await fresh().applyCalendar(closed);
    expect(row.status).toBe('scheduled');
  });
  it('can resume a calendar wait using a fresh scheduler after restart', async () => {
    const { row, fresh } = setup(); await fresh().applyCalendar(closed); await fresh().applyCalendar(open);
    expect(row.status).toBe('running');
  });
  it('never undoes an explicit manual pause after waiting for a window', async () => {
    const { row, fresh } = setup(), scheduler = fresh(); await scheduler.applyCalendar(closed);
    await row.update({ status: 'paused' }); await scheduler.applyCalendar(open);
    expect(row.status).toBe('paused');
  });
  it('keeps an existing manual pause after restart', async () => {
    const { row, fresh } = setup('paused'); await fresh().applyCalendar(open);
    expect(row.status).toBe('paused');
  });
  it('preserves completion when an open campaign has drained its tasks', async () => {
    const { row, fresh, tasks } = setup(); tasks.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    await fresh().applyCalendar(open); expect(row.status).toBe('completed');
  });
  it('does not overwrite a manual pause that happened after reading the calendar wait', async () => {
    let storedStatus = 'paused';
    const snapshot = { uid: 20, user_uid: 7, revision: 1, status: 'scheduled', update: jest.fn(async (patch: { status: string }) => { storedStatus = patch.status; }) };
    const campaigns = { findAll: jest.fn().mockResolvedValue([snapshot]), update: jest.fn(async (patch: { status: string }, options: { where: { status: string } }) => {
      if (storedStatus !== options.where.status) return [0]; storedStatus = patch.status; return [1];
    }) };
    const schedules = { findAll: jest.fn().mockResolvedValue([]) }, tasks = { count: jest.fn() };
    await new AutodialSchedulerService(campaigns as never, schedules as never, tasks as never).applyCalendar(open);
    expect(storedStatus).toBe('paused');
    expect(snapshot.update).not.toHaveBeenCalled();
    expect(campaigns.update).toHaveBeenCalledWith({ status: 'running' }, { where: { uid: 20, user_uid: 7, revision: 1, status: 'scheduled' } });
  });
});
