import { AutodialCampaignsService } from "./autodial-campaigns.service";
import type { UpdateAutodialCampaignDto } from "./dto/autodial-campaign.dto";
import type { AutodialDialplanService } from "./autodial-dialplan.service";

const schedule = {
  kind: "weekly" as const,
  weekday: 1,
  time_from: "09:00",
  time_to: "18:00",
  timezone: "Asia/Krasnoyarsk",
};

function buildService(revision = 3) {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const row = {
    uid: 11,
    user_uid: 7,
    revision,
    status: "draft",
    base_uid: 8,
    dial_mode: "progressive",
    queue_names: ["sales"],
    scenario_actions: [],
    update: jest.fn().mockResolvedValue(undefined),
  };
  const service = Object.create(
    AutodialCampaignsService.prototype,
  ) as AutodialCampaignsService;
  service["sequelize"] = {
    transaction: jest.fn(async (work) => work(transaction)),
  } as unknown as AutodialCampaignsService["sequelize"];
  service["campaignModel"] = {
    findOne: jest.fn().mockResolvedValue(row),
  } as unknown as AutodialCampaignsService["campaignModel"];
  service["scheduleModel"] = {
    destroy: jest.fn().mockResolvedValue(undefined),
    bulkCreate: jest.fn().mockResolvedValue(undefined),
  } as unknown as AutodialCampaignsService["scheduleModel"];
  service["basesService"] = {
    findOne: jest.fn(),
  } as unknown as AutodialCampaignsService["basesService"];
  service["dialplanService"] = {
    applyCampaign: jest.fn().mockResolvedValue(true),
  } as unknown as AutodialDialplanService;
  jest.spyOn(service, "findOne").mockResolvedValue({ uid: 11 } as never);
  return { service, row, transaction };
}

describe("autodial campaign configuration transaction", () => {
  it("updates campaign and schedules in one locked transaction", async () => {
    const { service, row, transaction } = buildService();

    await service.update(7, 11, {
      expected_revision: 3,
      name: "Updated campaign",
      schedules: [schedule],
    } as UpdateAutodialCampaignDto);

    expect(service["campaignModel"].findOne).toHaveBeenCalledWith({
      where: { uid: 11, user_uid: 7 },
      transaction,
      lock: "UPDATE",
    });
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Updated campaign", revision: 4 }),
      { transaction },
    );
    expect(service["scheduleModel"].destroy).toHaveBeenCalledWith({
      where: { campaign_uid: 11 },
      transaction,
    });
    expect(service["scheduleModel"].bulkCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ timezone: "Asia/Krasnoyarsk" })],
      { transaction },
    );
  });

  it("rejects a stale edit before changing campaign or schedules", async () => {
    const { service, row } = buildService(4);

    await expect(
      service.update(7, 11, {
        expected_revision: 3,
      } as UpdateAutodialCampaignDto),
    ).rejects.toMatchObject({
      response: { code: "AC_CAMPAIGN_REVISION_CONFLICT" },
    });

    expect(row.update).not.toHaveBeenCalled();
    expect(service["scheduleModel"].destroy).not.toHaveBeenCalled();
  });
});
