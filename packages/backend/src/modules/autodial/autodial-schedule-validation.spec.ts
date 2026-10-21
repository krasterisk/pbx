import { AutodialCampaignsService, assertAutodialSchedules } from "./autodial-campaigns.service";

describe("autodial schedule validation", () => {
  it('requires a valid one-off date and preserves the supported one_off kind', () => {
    const row = { kind: 'one_off', time_from: '09:00', time_to: '18:00', timezone: 'UTC' };
    expect(() => assertAutodialSchedules([row])).toThrow();
    expect(() => assertAutodialSchedules([{ ...row, date_from: '2026-02-30' }])).toThrow();
    expect(() => assertAutodialSchedules([{ ...row, date_from: '2026-10-19' }])).not.toThrow();
  });
  it('allows an explicit overnight window and rejects a zero-length window', () => {
    const row = { kind: 'weekly', weekday: 0, time_from: '22:00', time_to: '02:00', timezone: 'UTC' };
    expect(() => assertAutodialSchedules([row])).not.toThrow();
    expect(() => assertAutodialSchedules([{ ...row, time_to: '22:00' }])).toThrow();
  });
  const serviceWithScheduleModel = () => {
    const service = Object.create(
      AutodialCampaignsService.prototype,
    ) as AutodialCampaignsService;
    service["scheduleModel"] = {
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
    } as unknown as AutodialCampaignsService["scheduleModel"];
    return service;
  };

  it("rejects an invalid IANA time zone instead of silently using Moscow", async () => {
    const service = serviceWithScheduleModel();
    await expect(
      service["replaceSchedules"](7, 11, [
        {
          kind: "weekly",
          weekday: 1,
          time_from: "09:00",
          time_to: "18:00",
          timezone: "Mars/Olympus",
        },
      ]),
    ).rejects.toMatchObject({ response: { code: "AC_SCHEDULE_TIMEZONE" } });
    expect(service["scheduleModel"].destroy).not.toHaveBeenCalled();
  });

  it("keeps a selected IANA time zone when replacing schedules", async () => {
    const service = serviceWithScheduleModel();
    await service["replaceSchedules"](7, 11, [
      {
        kind: "weekly",
        weekday: 1,
        time_from: "09:00",
        time_to: "18:00",
        timezone: "Asia/Krasnoyarsk",
      },
    ]);
    expect(service["scheduleModel"].bulkCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ timezone: "Asia/Krasnoyarsk" })],
      { transaction: undefined },
    );
  });
});
