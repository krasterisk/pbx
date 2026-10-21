import { guardCallEvidence } from "./call-semantic-evidence-guards";
import {
  buildCallGroundingMessages,
  type CallEvidenceCandidate,
} from "./call-semantic-grounding";
const match = [
  {
    callId: "c",
    evidence: [{ segmentId: "s", quote: "Специалист уже перезвонил." }],
  },
];
const candidate = (
  texts: string[],
  context?: CallEvidenceCandidate["context"],
): CallEvidenceCandidate => ({
  callId: "c",
  context,
  segments: texts.map((text, i) => ({
    id: "s" + i,
    text,
    startMs: i * 1000,
    endMs: i * 1000 + 900,
    speaker: "unknown",
  })),
});
describe("source-only CDR factual anchors and corrected calendar", () => {
  it('does not invent September from a Friday appointment on the 25th', () => {
    const source = candidate(['В пятницу 25-го, в 8 утра. В октябре результаты будут готовы.']);
    expect(guardCallEvidence('Записали на 25 сентября в восемь утра', [source], match).rejected)
      .toEqual([{ callId: 'c', reason: 'unverified_anchor' }]);
  });
  it.each(['25 сентября', '25.09.2026', '2026-09-25'])('accepts an explicitly recorded month: %s', date => {
    expect(guardCallEvidence('Записали на 25 сентября', [candidate([`Записали на ${date}.`])], match).matches).toHaveLength(1);
  });
  it.each(['PERSON', 'ORGANIZATION', 'IDENTIFIER', 'PHONE'])("requires the exact opaque %s alias rather than another value", type => {
    const query = `Подтвердили [${type}_1]`;
    expect(guardCallEvidence(query, [candidate([`Подтвердили [${type}_2].`])], match).rejected)
      .toEqual([{callId:'c',reason:'unverified_privacy_alias'}]);
    expect(guardCallEvidence(query, [candidate([`Подтвердили [${type}_10].`])], match).matches).toEqual([]);
    expect(guardCallEvidence(query, [candidate([`Подтвердили [${type}_1].`])], match).matches).toHaveLength(1);
  });
  it("does not equate a quota callback with a callback after an OMS application", () => {
    const calls = [
      candidate(["Мне только что звонили по поводу записи по квоте."]),
    ];
    expect(
      guardCallEvidence(
        "После заявки по ОМС специалист перезвонил",
        calls,
        match,
      ).rejected,
    ).toEqual([{ callId: "c", reason: "unverified_anchor" }]);
    expect(
      guardCallEvidence("Специалист уже перезвонил", calls, match).matches,
    ).toHaveLength(1);
  });
  it.each([
    "Специалист перезвонил по ОМС.",
    "Позвонили по обязательному медицинскому страхованию.",
  ])("retains the acronym or its explicitly spoken full form", (text) => {
    expect(
      guardCallEvidence("По ОМС уже перезвонили", [candidate([text])], match)
        .matches,
    ).toHaveLength(1);
  });
  it("retains ASR repeated-letter typos without conflating a city or a one-letter preposition", () => {
    expect(
      guardCallEvidence(
        "Цена приёма ЛОР",
        [candidate(["Лорр принимает, цена три тысячи."])],
        match,
      ).matches,
    ).toHaveLength(1);
    expect(
      guardCallEvidence(
        "Заявка по ОМС",
        [candidate(["Из Омска перезвонили."])],
        match,
      ).matches,
    ).toEqual([]);
    expect(
      guardCallEvidence(
        "Договор с ООО",
        [candidate(["О договоре поговорили."])],
        match,
      ).matches,
    ).toEqual([]);
  });
  it("does not treat an all-caps sentence as business identifiers", () => {
    expect(
      guardCallEvidence(
        "ХОЧУ ОТМЕНИТЬ ЗАПИСЬ",
        [candidate(["Попросили отмену приёма."])],
        match,
      ).matches,
    ).toHaveLength(1);
  });
  const corrected = [
    "На завтра тогда отменяем?",
    "На четверг.",
    "Ой, на четверг, то есть, извините.",
  ];
  it("abstains on unresolved tomorrow/Thursday equivalence without inventing a date", () => {
    expect(
      guardCallEvidence(
        "Отменили запись на завтра",
        [candidate(corrected)],
        match,
      ).matches,
    ).toEqual([]);
    expect(
      guardCallEvidence(
        "Оператор исправляет завтра на четверг",
        [candidate(corrected)],
        match,
      ).matches,
    ).toHaveLength(1);
    expect(
      guardCallEvidence(
        "Отменили запись на четверг",
        [candidate(corrected)],
        match,
      ).matches,
    ).toHaveLength(1);
  });
  it.each([
    ["2026-10-14T12:00:00.000Z", "Asia/Krasnoyarsk", true], // Wed -> Thu
    ["2026-10-13T12:00:00.000Z", "Asia/Krasnoyarsk", false],
    ["2026-10-15T02:00:00.000Z", "America/Los_Angeles", true], // local Wed
  ])(
    "uses the original call calendar, including a UTC/local date boundary",
    (startedAt, timezone, accepted) => {
      expect(
        guardCallEvidence(
          "Отменили запись на завтра",
          [candidate(corrected, { startedAt, timezone })],
          match,
        ).matches.length,
      ).toBe(accepted ? 1 : 0);
    },
  );
  it("requires explicit unknown timing and a complete valid trusted clock", () => {
    const call = candidate(["Просто текст."]);
    call.segments[0] = {
      ...call.segments[0],
      timing: "unavailable",
      startMs: null,
      endMs: null,
    };
    expect(() =>
      buildCallGroundingMessages("Текст разговора", [call]),
    ).not.toThrow();
    delete call.segments[0].timing;
    expect(() =>
      buildCallGroundingMessages("Текст разговора", [call]),
    ).toThrow();
    for (const context of [
      { startedAt: "2026-10-14T12:00:00Z", timezone: "" },
      { startedAt: "not-a-date", timezone: "UTC" },
      { startedAt: "2026-10-14T12:00:00", timezone: "UTC" },
    ])
      expect(() =>
        buildCallGroundingMessages("Текст разговора", [
          candidate(["Текст"], context),
        ]),
      ).toThrow();
  });
  it("accepts a complete longer dialogue within 240 segments and refuses overflow", () => {
    const call = candidate(Array.from({ length: 240 }, () => "Реплика."));
    expect(() =>
      buildCallGroundingMessages("Длинный разговор", [call]),
    ).not.toThrow();
    call.segments.push({ ...call.segments[0], id: "overflow" });
    expect(() =>
      buildCallGroundingMessages("Длинный разговор", [call]),
    ).toThrow("CDR_GROUNDING_INPUT_INVALID");
  });
});
