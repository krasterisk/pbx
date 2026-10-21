import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { callsAiResearchTools } from "./calls-ai-research-tools";
import { aiCallPeriod } from "./calls-ai-period";
import { callsWhere } from "./calls-query";
import { summarizeCallGroups } from "@krasterisk/shared";

const ctx = { userUid: 7, role: 2, threadUid: 1 };
const actor = { sub: 7, vpbx_user_uid: 42, name: "Иван Петров" };
function fixture() {
  const calls = {
    aiActor: jest.fn().mockResolvedValue(actor),
    aiTimezone: jest.fn().mockResolvedValue("Asia/Krasnoyarsk"),
    aiOwnEmployee: jest.fn().mockResolvedValue("101"),
    facets: jest
      .fn()
      .mockResolvedValue({
        options: { employee: [{ value: "201", label: "Мария Иванова" }] },
        truncated: { employee: false },
      }),
    list: jest
      .fn()
      .mockResolvedValue({
        rows: [
          {
            id: "a".repeat(64),
            caller: { number: "100" },
            recipient: { name: "Мария" },
            startedAt: "2026-10-19T00:00:00Z",
          },
        ],
        total: 75,
        summary: { total: 75, totalConnectedSec: 12345 },
        source: { state: "ok" },
        timezone: "Asia/Krasnoyarsk",
      }),
    auditResearch: jest.fn(),
  };
  const text = {
    search: jest
      .fn()
      .mockResolvedValue({
        rows: [
          {
            callId: "a".repeat(64),
            segmentId: "segment",
            startMs: 12000,
            caller: { number: "79130000000" },
            recipient: { name: "Мария" },
            snippet: "private source transcript",
          },
        ],
        coverage: { eligibleCalls: 1 },
      }),
  };
  const analysis = {
    read: jest
      .fn()
      .mockResolvedValue({
        state: "available",
        summary: "Обсудили аренду крана",
        metrics: [{ id: "csat", value: null, status: "insufficient_evidence" }],
      }),
  };
  const tools = callsAiResearchTools(
    calls as never,
    text as never,
    analysis as never,
  );
  return {
    calls,
    text,
    analysis,
    tools,
    run: (name: string, args: Record<string, unknown>) =>
      tools.find((t) => t.name === name)!.handler(args, 42, ctx),
  };
}
describe("aiChat report research scenarios", () => {
  it.each([
    [{kind:'external',id:null,name:null,number:'79130000000'}, {kind:'employee',id:'101',name:'Иван Петров',number:'101'}, '79130000000'],
    [{kind:'employee',id:'101',name:'Иван Петров',number:'101'}, {kind:'external',id:null,name:null,number:'79130000000'}, '79130000000'],
    [{kind:'employee',id:'999',name:'Другой сотрудник',number:'999'}, {kind:'employee',id:'202',name:'Третий сотрудник',number:'202'}, null],
  ])('distinguishes the authenticated employee from the other side and does not guess after transfers', async (caller, recipient, number) => {
    const f = fixture();
    f.text.search.mockResolvedValue({rows:[{callId:'a'.repeat(64),segmentId:'s1',caller,recipient,snippet:'private source transcript'}]});
    const result=await f.run('search_call_content',{phrase:'башенный кран',mine:true}) as Record<string,any>;
    expect(result.perspectiveEmployee).toMatchObject({id:'101',role:'current_user'});
    if(number)expect(result.rows[0].counterparty).toMatchObject({number});
    else expect(result.rows[0].counterparty).toBeNull();
    expect(JSON.stringify(result)).not.toContain('private source transcript');
  });
  it("keeps a large summary response valid inside the real chat budget with explicit included coverage", async () => {
    const f = fixture();
    f.calls.list.mockResolvedValue({rows: Array.from({length:20},()=>({id:'a'.repeat(64),startedAt:'2026-10-19T00:00:00Z',caller:{number:'100'},recipient:{name:'Мария'}})),total:50,summary:{total:50}});
    f.analysis.read.mockResolvedValue({state:'available',summary:'Разговор о поставке. '.repeat(70),metrics:[]});
    const result = await f.run('summarize_call_conversations',{period:'yesterday'}) as Record<string,any>;
    const content = JSON.stringify(result);
    expect(content.length).toBeLessThanOrEqual(3800);
    expect(JSON.parse(content).coverage).toMatchObject({consideredCalls:20,availableAnalyses:20,cohortCalls:50,includedAnalyses:result.rows.length,contentTruncated:true,truncated:true});
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.length).toBeLessThan(20);
  });
  it("retrieves all six summaries with bounded continuation and no duplicates", async () => {
    const f = fixture();
    f.calls.list.mockResolvedValue({rows: Array.from({length:6}, (_, i) => ({id:String(i).repeat(64), startedAt:'2026-10-19T00:00:00Z', caller:{number:'100'}, recipient:{name:'Мария'}})), total:6, summary:{total:6}});
    f.analysis.read.mockResolvedValue({state:'available', summary:'Обсудили поставку. '.repeat(70), metrics:[]});
    const ids: string[] = [];
    let offset: number | null = 0;
    for (let i = 0; offset !== null && i < 6; i++) {
      const page = await f.run('summarize_call_conversations', {period:'yesterday', analysisOffset:offset}) as Record<string,any>;
      expect(JSON.stringify(page).length).toBeLessThanOrEqual(3800);
      ids.push(...page.rows.map((row: {callId:string}) => row.callId));
      offset = page.nextAnalysisOffset;
    }
    expect(offset).toBeNull();
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    await expect(f.run('summarize_call_conversations', {analysisOffset:-1})).rejects.toThrow(BadRequestException);
  });
  it("keeps source quotations and rationale in the card instead of forwarding them to chat", async () => {
    const f = fixture();
    f.analysis.read.mockResolvedValue({state: "available", summary: "Обсудили аренду крана", metrics: [{id: "csat", value: null, status: "insufficient_evidence", quote: "raw personal source", rationale: "raw personal rationale"}]});
    const result = await f.run("get_call_analysis", {id: "a".repeat(64)});
    expect(result).toMatchObject({evidenceOmitted: true, assessmentSource:'model_inference', containsCustomerSurvey:false, metrics: [{id: "csat", value: null, status: "insufficient_evidence"}]});
    expect(JSON.stringify(result)).not.toContain("raw personal");
  });
  it("resolves reversed names and counts initiated calls with full-cohort duration instead of a page sum", async () => {
    const f = fixture();
    const result = await f.run("summarize_employee_calls", {
      employeeName: "Иванова Мария",
      relationship: "initiator",
      direction: "out",
      period: "yesterday",
    });
    expect(f.calls.aiActor).toHaveBeenCalledWith(42, 7);
    expect(f.calls.list).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        callerEmployee: "201",
        direction: "out",
        limit: 1,
      }),
    );
    expect(result).toMatchObject({
      total: 75,
      summary: { totalConnectedSec: 12345 },
      individualEmployeeTalkTimeAvailable: false,
    });
  });
  it("refuses namesakes, truncated identity lookup and conflicting name/id instead of picking the first employee", async () => {
    const f = fixture();
    f.calls.facets.mockResolvedValue({
      options: {
        employee: [
          { value: "201", label: "Мария Иванова" },
          { value: "202", label: "Мария Иванова" },
        ],
      },
      truncated: {},
    });
    expect(
      await f.run("summarize_employee_calls", {
        employeeName: "Мария Иванова",
      }),
    ).toMatchObject({
      needsEmployeeSelection: true,
      resolution: { state: "ambiguous" },
    });
    expect(f.calls.list).not.toHaveBeenCalled();
    expect(
      await f.run("resolve_call_employees", {
        employeeName: "Петров Иван",
        employeeId: "201",
      }),
    ).toMatchObject({ state: "not_found" });
    f.calls.facets.mockResolvedValue({
      options: { employee: [{ value: "201", label: "Мария Иванова" }] },
      truncated: { employee: true },
    });
    expect(
      await f.run("resolve_call_employees", { employeeName: "Мария Иванова" }),
    ).toMatchObject({ state: "truncated" });
  });
  it("reads authorized project summaries for employee participation and reports incomplete coverage", async () => {
    const f = fixture();
    const result = await f.run("summarize_call_conversations", {
      employeeName: "Мария Иванова",
      period: "yesterday",
    });
    expect(f.calls.list).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ focusEmployee: "201", limit: 20 }),
    );
    expect(f.analysis.read).toHaveBeenCalledWith(actor, "a".repeat(64));
    expect(result).toMatchObject({
      assessmentSource:'model_inference',
      containsCustomerSurvey:false,
      coverage: {
        consideredCalls: 1,
        availableAnalyses: 1,
        cohortCalls: 75,
        truncated: true,
      },
      rows: [{ summary: "Обсудили аренду крана" }],
    });
  });
  it("searches my last-week topic through the same authorized semantic service, returns contacts/link, omits transcript", async () => {
    const f = fixture();
    const result = await f.run("search_call_content", {
      phrase: "башенный кран",
      period: "last_week",
      mine: true,
    });
    expect(f.text.search).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ focusEmployee: "101" }),
      "башенный кран",
      "semantic",
    );
    expect(result).toMatchObject({
      snippetsOmitted: true,
      rows: [
        {
          caller: { number: "79130000000" },
          url: expect.stringContaining("transcriptSegment=segment"),
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private source transcript");
    f.calls.aiOwnEmployee.mockResolvedValue(null);
    f.text.search.mockClear();
    expect(
      await f.run("search_call_content", {
        phrase: "башенный кран",
        mine: true,
      }),
    ).toMatchObject({
      needsEmployeeSelection: true,
      resolution: { state: "self_unmapped" },
    });
    expect(f.text.search).not.toHaveBeenCalled();
  });
  it("preserves access refusals and rejects identity/period injection for all research tools", async () => {
    const f = fixture();
    for (const tool of f.tools)
      await expect(tool.handler({}, 42)).rejects.toThrow(ForbiddenException);
    await expect(
      f.run("summarize_employee_calls", {
        employeeName: "Мария Иванова",
        tenantId: 99,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      f.run("search_call_content", {
        phrase: "кран",
        period: "last_week",
        dateFrom: "2026-10-01",
      }),
    ).rejects.toThrow(BadRequestException);
    f.analysis.read.mockRejectedValue(new ForbiddenException());
    await expect(
      f.run("get_call_analysis", { id: "a".repeat(64) }),
    ).rejects.toThrow(ForbiddenException);
  });
  it("uses civil yesterday/previous calendar week in company time, not UTC or rolling seven days", () => {
    const now = new Date("2026-10-19T19:00:00Z"); // Tuesday in Krasnoyarsk
    expect(aiCallPeriod("yesterday", "Asia/Krasnoyarsk", now)).toEqual({
      dateFrom: "2026-10-19",
      dateTo: "2026-10-19",
    });
    expect(aiCallPeriod("last_week", "Asia/Krasnoyarsk", now)).toEqual({
      dateFrom: "2026-10-12",
      dateTo: "2026-10-18",
    });
    expect(aiCallPeriod("last_7_days", "Asia/Krasnoyarsk", now)).toEqual({
      dateFrom: "2026-10-14",
      dateTo: "2026-10-20",
    });
  });
  it("keeps initiator distinct from participation with bound JSON predicates in both databases", () => {
    for (const dialect of ["mysql", "postgres"]) {
      const result = callsWhere(
        42,
        { callerEmployee: "201' OR 1=1", employees: ["202"] },
        { from: 0, to: 100 },
        null,
        dialect,
      );
      expect(result.sql).toContain(":callerEmployee");
      expect(result.sql).not.toContain("201' OR 1=1");
      expect(result.sql).toContain("='employee'");
      expect(result.sql).toContain("call_dimensions");
      expect(result.args.callerEmployee).toBe("201' OR 1=1");
    }
  });
  it("sums original intervals instead of multiplying a rounded average", () => {
    const summary = summarizeCallGroups([
      {
        direction: "out",
        outcome: "human",
        count: 3,
        connectedTotal: 101,
        connectedSample: 3,
      },
    ]);
    expect(summary).toMatchObject({
      total: 3,
      outgoing: 3,
      totalConnectedSec: 101,
      avgConnectedSec: 34,
    });
  });
});
