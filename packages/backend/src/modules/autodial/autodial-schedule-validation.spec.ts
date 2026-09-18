import { AutodialCampaignsService } from "./autodial-campaigns.service";

describe("autodial schedule validation", () => {
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
