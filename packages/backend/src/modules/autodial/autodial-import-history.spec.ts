import { AutodialImportService } from './autodial-import.service';

describe('tenant-scoped import history', () => {
  function setup() {
    const bases = { findOne: jest.fn().mockResolvedValue({ uid: 8 }) };
    const runs = { findAll: jest.fn().mockResolvedValue([{ uid: 1, base_uid: 8, filename: 'appointments.csv',
      profile_uid: null, total_rows: 5, imported: 3, skipped: 2, errors: [], created_at: new Date('2026-10-18T07:00:00Z') }]) };
    const service = new AutodialImportService(bases as never, {} as never, {} as never, {} as never,
      {} as never, runs as never, {} as never, {} as never);
    return { bases, runs, service };
  }
  it('checks base ownership and bounds recent runs to that tenant/base', async () => {
    const { bases, runs, service } = setup();
    const result = await service.listRuns(71, 8);
    expect(bases.findOne).toHaveBeenCalledWith({ where: { uid: 8, user_uid: 71 } });
    expect(runs.findAll).toHaveBeenCalledWith({ where: { base_uid: 8, user_uid: 71 }, order: [['uid', 'DESC']], limit: 100 });
    expect(result).toEqual([expect.objectContaining({ filename: 'appointments.csv', imported: 3, skipped: 2 })]);
  });
  it('does not query history for an inaccessible base', async () => {
    const { bases, runs, service } = setup(); bases.findOne.mockResolvedValue(null);
    await expect(service.listRuns(72, 8)).rejects.toMatchObject({ response: { code: 'AC_BASE_NOT_FOUND' } });
    expect(runs.findAll).not.toHaveBeenCalled();
  });
});
