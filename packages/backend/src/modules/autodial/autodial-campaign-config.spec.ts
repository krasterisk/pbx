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
  service["endpointModel"] = {
    findAll: jest.fn().mockResolvedValue([{ id: "trunk-1" }]),
  } as unknown as AutodialCampaignsService["endpointModel"];
  service["queueModel"] = {
    findAll: jest.fn().mockResolvedValue([{ name: "sales" }]),
  } as unknown as AutodialCampaignsService["queueModel"];
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
  it("accepts a modern fixed queue target", () => {
    const { service } = buildService();

    expect(() =>
      service["assertScenario"]("progressive", [
        {
          id: "queue",
          type: "toqueue",
          condition: {},
          params: { target: { source: "fixed", value: "priority" } },
        },
      ]),
    ).not.toThrow();
  });

  it("does not treat a disabled queue step as a reachable route", () => {
    const { service } = buildService();
    const disabledQueue = {
      id: "disabled-queue",
      type: "toqueue",
      enabled: false,
      condition: {},
      params: { target: { source: "fixed", value: "sales" } },
    };
    expect(() => service["assertScenario"]("agentless", [disabledQueue])).not.toThrow();
    expect(() => service["assertScenario"]("progressive", [disabledQueue])).not.toThrow();
  });

  it("rejects a toqueue step without a fixed queue", () => {
    const { service } = buildService();

    expect(() =>
      service["assertScenario"]("progressive", [
        { id: "queue", type: "toqueue", condition: {}, params: {} },
      ]),
    ).toThrow("Choose a fixed queue in the scenario To queue step");
  });

  it("rejects enabled scenario steps the autodial compiler cannot execute", () => {
    const { service } = buildService();

    expect(() =>
      service["assertScenario"]("progressive", [
        { id: "trunk", type: "totrunk", condition: {}, params: {} },
      ]),
    ).toThrow("Autodial does not support scenario step totrunk");
  });

  it("accepts agentless text2speech so CSV fields can be spoken", () => {
    const { service } = buildService();

    expect(() =>
      service["assertScenario"]("agentless", [
        {
          id: "tts",
          type: "text2speech",
          condition: {},
          params: { text: "Здравствуйте {AC_NAME} ваш долг {AC_DEBT} рублей", engine: 1 },
        },
      ]),
    ).not.toThrow();
  });

  it("rejects conditional and dynamic-target scenario steps before start", () => {
    const { service } = buildService();

    expect(() =>
      service["assertScenario"]("progressive", [
        {
          id: "conditional",
          type: "toqueue",
          condition: { dialstatus: "BUSY" },
          params: { target: { source: "fixed", value: "sales" } },
        },
      ]),
    ).toThrow("Autodial does not support conditional scenario steps yet");
    expect(() =>
      service["assertScenario"]("progressive", [
        {
          id: "dynamic",
          type: "toqueue",
          condition: {},
          params: { target: { source: "variable", name: "AC_QUEUE" } },
        },
      ]),
    ).toThrow("Autodial supports only a fixed target for this scenario step");
  });

  it("rejects a Caller ID directory field that is not owned by the tenant directory", async () => {
    const { service } = buildService();
    service["directoriesService"] = {
      findOne: jest.fn().mockResolvedValue({ uid: 4, fields: [{ uid: 8, key: "phone" }] }),
    } as unknown as AutodialCampaignsService["directoriesService"];

    await expect(
      service["assertTrunkPoolConfig"](7, [{ uid: 1, key: "region" }], [{
        trunk_id: "trunk-1",
        caller_id_source: {
          mode: "directory",
          directory_uid: 4,
          value_field_uid: 9,
          key: { source: "autodial_field", field_key: "region" },
          on_missing: "fallback",
        },
      }]),
    ).rejects.toMatchObject({ response: { code: "AC_CALLER_ID_DIRECTORY_INVALID" } });
  });

  it("rejects a missing or foreign-tenant trunk without exposing its owner", async () => {
    const { service } = buildService();
    service["endpointModel"] = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as AutodialCampaignsService["endpointModel"];

    await expect(service["assertTrunkPoolConfig"](7, [], [{ trunk_id: "foreign-trunk" }]))
      .rejects.toMatchObject({ response: { code: "AC_TRUNK_NOT_FOUND" } });
    expect(service["endpointModel"].findAll).toHaveBeenCalledWith({
      attributes: ["id"],
      where: { id: expect.anything(), tenantid: "7" },
    });
  });

  it("rejects duplicate trunk ids in one campaign pool", async () => {
    const { service } = buildService();
    await expect(service["assertTrunkPoolConfig"](7, [], [
      { trunk_id: "trunk-1" }, { trunk_id: "trunk-1" },
    ])).rejects.toMatchObject({ response: { code: "AC_TRUNK_INVALID" } });
  });

  it("rejects a fixed scenario queue outside the campaign tenant", async () => {
    const { service } = buildService();
    service["queueModel"] = {
      findAll: jest.fn().mockResolvedValue([{ name: "sales" }]),
    } as unknown as AutodialCampaignsService["queueModel"];

    await expect(service["assertQueueReferences"](7, ["sales"], [{
      id: "queue",
      type: "toqueue",
      condition: {},
      params: { target: { source: "fixed", value: "foreign-queue" } },
    }])).rejects.toMatchObject({ response: { code: "AC_QUEUE_NOT_FOUND" } });
    expect(service["queueModel"].findAll).toHaveBeenCalledWith({
      attributes: ["name"],
      where: { name: expect.anything(), user_uid: 7 },
    });
  });

  it("rejects a fixed extension outside the campaign tenant", async () => {
    const { service } = buildService();
    service["endpointModel"] = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as AutodialCampaignsService["endpointModel"];

    await expect(service["assertExtensionReferences"](7, [{
      id: "exten",
      type: "toexten",
      condition: {},
      params: { target: { source: "fixed", value: "foreign-extension" } },
    }])).rejects.toMatchObject({ response: { code: "AC_EXTENSION_NOT_FOUND" } });
    expect(service["endpointModel"].findAll).toHaveBeenCalledWith({
      attributes: ["id"],
      where: { id: expect.anything(), tenantid: "7" },
    });
  });

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
    expect(service["dialplanService"].applyCampaign).toHaveBeenCalled();
    expect(row.update).toHaveBeenCalledWith({ applied_revision: 4, apply_error: null });
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

  it("records apply_error when dialplan apply fails after a successful save", async () => {
    const { service, row } = buildService();
    service["dialplanService"] = {
      applyCampaign: jest.fn().mockResolvedValue(false),
    } as unknown as AutodialDialplanService;

    await service.update(7, 11, {
      expected_revision: 3,
      name: "Updated campaign",
    } as UpdateAutodialCampaignDto);

    expect(row.update).toHaveBeenCalledWith({ apply_error: "AC_DIALPLAN_APPLY_FAILED" });
  });
});
