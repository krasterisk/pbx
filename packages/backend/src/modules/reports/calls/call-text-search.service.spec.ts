import {
  CallTextSearchService,
  normalizePhrase,
} from "./call-text-search.service";
const callId = "a".repeat(64);
function fixture(semantic?: unknown, grounding?: unknown) {
  const ctx = {
    tenant: 42,
    user: { sub: 7 },
    scope: { operators: ["101"], queues: [], ownExten: null },
    pages: new Set(["cdr", "speech-analytics-conversations"]),
  };
  const rows = {
    count: [{ amount: 1 }],
    calls: [
      {
        call_key: callId,
        node_id: "pbx",
        started_at: 100000,
        payload: JSON.stringify({ linkedid: "root", uniqueids: ["child"] }),
      },
    ],
    runs: [
      {
        run_id: "new",
        transcript_id: "t",
        source_id: "child",
        linkedid: null,
        node_id: "pbx",
      },
      {
        run_id: "old",
        transcript_id: "old-t",
        source_id: "child",
        linkedid: null,
        node_id: "pbx",
      },
    ],
    segments: [
      {
        id: "seg",
        transcript_id: "t",
        ordinal: 0,
        start_ms: 1234,
        end_ms: 2000,
        speaker_role: "client",
        text: "Уточните УСЛОВИЯ\n договора пожалуйста",
      },
    ],
  };
  const store = {
    select: jest.fn(async (sql: string, _args?: unknown, _tx?: unknown) =>
      sql.includes("COUNT(*)")
        ? rows.count
        : sql.includes("FROM dashboard_calls")
          ? rows.calls
          : sql.includes("SELECT DISTINCT")
            ? rows.runs
            : rows.segments,
    ),
    sequelize: {
      transaction: jest.fn(
        async (_opts: unknown, fn: (tx: unknown) => unknown) => fn({}),
      ),
    },
  };
  const access = { resolve: jest.fn().mockResolvedValue(ctx) },
    products = { decide: jest.fn().mockResolvedValue({ allowed: true }) },
    audit = { create: jest.fn().mockResolvedValue({}) },
    cloud = { timezone: jest.fn().mockResolvedValue("UTC") };
  const service = new CallTextSearchService(
    access as never,
    store as never,
    cloud as never,
    products as never,
    audit as never,
    semantic as never,
    grounding as never,
  );
  return { service, ctx, rows, store, access, products, audit, cloud };
}
describe("bounded authorized phrase search", () => {
  it("keeps semantic preview disabled by default and does not silently use literal results", async () => {
    const f = fixture();
    await expect(
      f.service.search({} as never, {}, "договор", "semantic"),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.store.select).not.toHaveBeenCalled();
  });
  it("normalizes Unicode width/case/whitespace and treats wildcards as literal text", () => {
    expect(normalizePhrase("  ＡБВ\n ДОГОВОР ")).toBe("aбв договор");
    expect(normalizePhrase("%_!*")).toBe("%_!*");
  });
  it("uses original whole-call ACL/filters, latest eligible run and audits without phrase/text", async () => {
    const f = fixture(),
      result = await f.service.search(
        {} as never,
        { dateFrom: "", dateTo: "", direction: "in" },
        "условия  ДОГОВОРА",
      );
    expect(result.rows).toEqual([
      expect.objectContaining({
        callId,
        runId: "new",
        segmentId: "seg",
        startMs: 1234,
        snippet: "Уточните УСЛОВИЯ договора пожалуйста",
      }),
    ]);
    expect(result.coverage).toMatchObject({
      cohortCalls: 1,
      consideredCalls: 1,
      eligibleCalls: 1,
      scannedSegments: 1,
      matchingSegments: 1,
    });
    expect(f.store.select.mock.calls[0]).toEqual([
      expect.stringContaining("dashboard_participants"),
      expect.objectContaining({
        tenant: 42,
        extensions: ["101"],
        direction: "in",
      }),
      expect.anything(),
    ]);
    expect(f.store.select.mock.calls[2][0]).toContain("m.can_transcript=TRUE");
    expect(f.store.select.mock.calls[2][1]).toMatchObject({
      tenant: 42,
      userId: 7,
      node0: "pbx",
      ids0: ["root", "child"],
    });
    expect(f.store.select.mock.calls[3][1]).toEqual({
      tenant: 42,
      transcripts: ["t"],
    });
    expect(JSON.stringify(f.audit.create.mock.calls)).not.toContain("ДОГОВОРА");
  });
  it("rejects missing page, revoked product and invalid phrase before source SQL", async () => {
    const f = fixture();
    f.ctx.pages.clear();
    await expect(
      f.service.search({} as never, {}, "фраза"),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.store.select).not.toHaveBeenCalled();
    const g = fixture();
    g.products.decide.mockResolvedValue({ allowed: false });
    await expect(
      g.service.search({} as never, {}, "фраза"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(g.service.search({} as never, {}, " ")).rejects.toMatchObject({
      status: 400,
    });
  });
  it("does not search hidden versions, an absent transcript or a literal SQL wildcard as a pattern", async () => {
    const f = fixture();
    f.rows.runs = [];
    const result = await f.service.search({} as never, {}, "%_");
    expect(result.rows).toEqual([]);
    expect(f.store.select).toHaveBeenCalledTimes(3);
  });
  it("reports capped calls/segments/text/results rather than claiming archive completeness", async () => {
    const f = fixture();
    f.rows.count = [{ amount: 201 }];
    f.rows.segments = Array.from({ length: 5001 }, (_, i) => ({
      ...f.rows.segments[0],
      id: String(i),
      text: "найдено " + "x".repeat(8193),
    }));
    const result = await f.service.search({} as never, {}, "найдено");
    expect(result.rows).toHaveLength(100);
    expect(result.coverage.scannedSegments).toBe(5000);
    expect(result.partialReasons).toEqual(
      expect.arrayContaining([
        "call_limit",
        "segment_limit",
        "segment_text_limit",
        "match_limit",
      ]),
    );
  });
  it("returns503 on source or audit failures without returning cached text", async () => {
    const f = fixture();
    f.audit.create.mockRejectedValue(new Error("audit failed"));
    await expect(
      f.service.search({} as never, {}, "договор"),
    ).rejects.toMatchObject({ status: 503 });
    const g = fixture();
    g.store.select.mockRejectedValue(new Error("source failed"));
    await expect(
      g.service.search({} as never, {}, "договор"),
    ).rejects.toMatchObject({ status: 503 });
  });
});

function semanticFixture() {
  const semantic = {
    previewEnabled: () => true,
    prepare: async () => ({
      embedder: {
        model: "nomic-ai/nomic-embed-text-v1.5",
        profile: "nomic-embed-text-v1.5",
        dim: 256,
      },
    }),
    purge: jest.fn(),
    enqueue: jest.fn(),
    rank: jest
      .fn()
      .mockResolvedValue({
        indexed: 1,
        missing: [],
        failed: 0,
        hits: [],
        recallCandidates: [{ window: { callId }, score: 0.75 }],
      }),
  };
  const grounding = {
    verify: jest
      .fn()
      .mockResolvedValue({
        matches: [
          {
            callId,
            evidence: [
              { segmentId: "proof", quote: "Предложили перезвонить позже." },
            ],
          },
        ],
        providerUid: 59,
        model: "deepseek-flash",
      }),
  };
  const f = fixture(semantic, grounding);
  f.rows.segments.push({
    ...f.rows.segments[0],
    id: "proof",
    ordinal: 1,
    start_ms: 9000,
    end_ms: 10000,
    speaker_role: "employee",
    text: "Предложили перезвонить позже.",
  });
  return { ...f, semantic, grounding };
}
describe("grounded semantic results and fresh authorization", () => {
  it('verifies a narrow authorized cohort even when vectors did not recall a date/number match', async () => {
    const f = semanticFixture();
    f.semantic.rank.mockResolvedValue({indexed: 1, missing: [], failed: 0, hits: [], recallCandidates: []});
    const result = await f.service.search({} as never, {}, 'Предложили перезвонить позже', 'semantic');
    expect(f.grounding.verify).toHaveBeenCalledWith(expect.any(String), [expect.objectContaining({callId})]);
    expect(result.rows).toHaveLength(1);
  });
  it('marks privacy-limited verification instead of claiming the complete source was checked', async () => {
    const f = semanticFixture();
    f.grounding.verify.mockResolvedValue({matches: [], providerUid: 59, model: 'deepseek-flash', privacyLimited: true} as never);
    const result = await f.service.search({} as never, {}, 'перезвонить', 'semantic');
    expect(result.partialReasons).toContain('privacy_limited');
    expect(result.rows).toEqual([]);
  });
  it("runs LLM outside SQL and returns one call with the source evidence time instead of window start", async () => {
    const f = semanticFixture();
    let sqlOpen = false;
    f.store.sequelize.transaction.mockImplementation(async (_opts, fn) => {
      sqlOpen = true;
      try {
        return await fn({});
      } finally {
        sqlOpen = false;
      }
    });
    f.grounding.verify.mockImplementation(async () => {
      expect(sqlOpen).toBe(false);
      return {
        matches: [
          {
            callId,
            evidence: [
              { segmentId: "proof", quote: "Предложили перезвонить позже." },
            ],
          },
        ],
        providerUid: 59,
        model: "deepseek-flash",
      };
    });
    const result = await f.service.search(
      {} as never,
      {},
      "предложили перезвонить",
      "semantic",
    );
    expect(result.rows).toEqual([
      expect.objectContaining({
        callId,
        segmentId: "proof",
        startMs: 9000,
        endMs: 10000,
        snippet: "Предложили перезвонить позже.",
      }),
    ]);
    expect(result.semantic?.verification).toMatchObject({
      providerUid: 59,
      model: "deepseek-flash",
    });
    expect(f.store.sequelize.transaction).toHaveBeenCalledTimes(2);
    expect(f.grounding.verify).toHaveBeenCalledWith(
      "предложили перезвонить",
      expect.arrayContaining([
        expect.objectContaining({
          context: { startedAt: "1970-01-01T00:01:40.000Z", timezone: "UTC" },
        }),
      ]),
    );
    expect(f.audit.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(f.audit.create.mock.calls)).not.toContain(
      "перезвонить",
    );
  });
  it("rejects a changed business timezone after provider I/O without auditing stale evidence", async () => {
    const f = semanticFixture();
    f.cloud.timezone
      .mockResolvedValueOnce("UTC")
      .mockResolvedValue("Asia/Krasnoyarsk");
    await expect(
      f.service.search({} as never, {}, "перезвонить", "semantic"),
    ).rejects.toMatchObject({ status: 503 });
    expect(f.grounding.verify).toHaveBeenCalledTimes(1);
    expect(f.audit.create).not.toHaveBeenCalled();
  });
  it.each(["run", "text", "grant", "call", "node", "scope", "privacy"])(
    "does not return old evidence after %s changes while LLM is running",
    async (kind) => {
      const f = semanticFixture();
      f.grounding.verify.mockImplementation(async () => {
        if (kind === "run") f.rows.runs[0].run_id = "newer-run";
        if (kind === "text") f.rows.segments[1].text = "Изменённая расшифровка";
        if (kind === "grant") f.rows.runs = [];
        if (kind === "call") f.rows.calls = [];
        if (kind === "node") f.rows.calls[0].node_id = "other-node";
        if (kind === "privacy") Object.assign(f.rows.runs[0],{privacy_evidence:'[{"kind":"changed"}]'});
        if (kind === "scope")
          f.access.resolve.mockResolvedValue({
            ...f.ctx,
            scope: { ...f.ctx.scope, operators: ["102"] },
          });
        return { matches: [], providerUid: 59, model: "deepseek-flash" };
      });
      await expect(
        f.service.search({} as never, {}, "предложили перезвонить", "semantic"),
      ).rejects.toMatchObject({ status: 503 });
      expect(f.audit.create).not.toHaveBeenCalled();
    },
  );
  it("does not infer facts from a truncated transcript or call a verifier when no candidates are indexed", async () => {
    const f = semanticFixture();
    f.rows.segments[0].text = "x".repeat(5001);
    const result = await f.service.search(
      {} as never,
      {},
      "перезвонить",
      "semantic",
    );
    expect(result.rows).toEqual([]);
    expect(result.partialReasons).toContain("verification_limit");
    expect(f.grounding.verify).not.toHaveBeenCalled();
    const g = semanticFixture();
    g.semantic.rank.mockResolvedValue({
      indexed: 0,
      missing: [],
      failed: 0,
      hits: [],
      recallCandidates: [],
    });
    expect(
      (await g.service.search({} as never, {}, "перезвонить", "semantic")).rows,
    ).toEqual([]);
    expect(g.grounding.verify).not.toHaveBeenCalled();
  });
  it("returns unavailable on verifier failure without any keyword/vector fallback", async () => {
    const f = semanticFixture();
    f.grounding.verify.mockRejectedValue(
      new Error("CDR_GROUNDING_PROVIDER_UNAVAILABLE"),
    );
    await expect(
      f.service.search({} as never, {}, "перезвонить", "semantic"),
    ).rejects.toMatchObject({ status: 503 });
    expect(f.audit.create).not.toHaveBeenCalled();
  });
  it('reports a fully redacted query explicitly instead of a successful empty result', async () => {
    const f = semanticFixture();
    f.grounding.verify.mockRejectedValue(new Error('CDR_GROUNDING_QUERY_REDACTED'));
    await expect(f.service.search({} as never, {}, 'перезвонить', 'semantic'))
      .rejects.toMatchObject({status:503,response:{code:'CDR_SEARCH_QUERY_REDACTED'}});
    expect(f.audit.create).not.toHaveBeenCalled();
  });
});
