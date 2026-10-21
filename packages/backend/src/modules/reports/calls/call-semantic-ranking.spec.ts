import {
  callSearchTerms,
  rankCallSemanticCandidates,
} from "./call-semantic-ranking";

describe("CDR local hybrid ranking", () => {
  const candidate = (id: string, text: string, cosine: number, group = id) => ({
    value: id,
    group,
    text,
    cosine,
  });
  it("normalizes Russian word forms and Unicode without a corpus-specific synonym list", () => {
    expect(
      callSearchTerms("Клиенту ПАРОЛЬ пароля паролем сотрудником"),
    ).toEqual(["парол"]);
    expect(callSearchTerms("Клиент: счёт СЧЕТА")).toEqual(["счет"]);
    expect(callSearchTerms("１２３ 1")).toEqual(["123", "1"]);
  });
  it("uses word-form evidence to rerank similar vectors and rejects weak unrelated matches", () => {
    const rows = [
      candidate("noise", "Сотрудник уточнил договор.", 0.8),
      candidate("match", "Восстановление пароля для входа.", 0.76),
    ];
    expect(
      rankCallSemanticCandidates("восстановить пароль", rows).map(
        (r) => r.value,
      ),
    ).toEqual(["match"]);
    expect(rankCallSemanticCandidates("рецепт супа", rows)).toEqual([]);
  });
  it("retains a strong pure paraphrase and abstains on indistinguishable unrelated vectors", () => {
    const one = candidate("a", "Высокая стоимость обслуживания.", 0.95);
    expect(
      rankCallSemanticCandidates("не по карману", [
        one,
        candidate("b", "Иной вопрос.", 0.7),
      ])[0].value,
    ).toBe("a");
    expect(
      rankCallSemanticCandidates("не по карману", [
        one,
        candidate("b", "Иной вопрос.", 0.94),
      ]),
    ).toEqual([]);
    expect(
      rankCallSemanticCandidates("не по карману", [
        one,
        candidate("a2", one.text, 0.95, "a"),
      ]),
    ).toHaveLength(2);
  });
  it("does not turn lexical matches or malformed vectors into semantic matches", () => {
    expect(
      rankCallSemanticCandidates("пароль", [
        candidate("a", "пароль", 0.1),
        candidate("b", "пароль", NaN),
      ]),
    ).toEqual([]);
    expect(
      rankCallSemanticCandidates("", [candidate("a", "пароль", 0.7)]),
    ).toEqual([]);
    expect(
      rankCallSemanticCandidates("счёт 123", [
        candidate("a", "счёт 124", 0.99),
      ]),
    ).toEqual([]);
    expect(
      rankCallSemanticCandidates("клиент", [candidate("a", "пароль", 0.99)]),
    ).toEqual([]);
  });
  it("vetoes polarity even for a strong vector", () => {
    expect(
      rankCallSemanticCandidates("Клиент согласился на запись разговора", [
        candidate("opposite", "Клиент не согласен на запись разговора.", 0.99),
        candidate("match", "Клиент согласился на запись разговора.", 0.8),
      ]).map((row) => row.value),
    ).toEqual(["match"]);
  });
  it("does not replace a topical contradiction with a weaker incidental fallback", () => {
    const rows = [
      candidate("opposite", "Клиент не согласен на запись разговора.", 0.95),
      candidate(
        "incidental",
        "Клиент согласился ждать обещанного звонка.",
        0.8,
      ),
    ];
    expect(
      rankCallSemanticCandidates("Клиент согласился на запись разговора", rows),
    ).toEqual([]);
    expect(
      rankCallSemanticCandidates("Клиент согласился на запись разговора", [
        ...rows,
        candidate("independent", "Клиент согласился на запись разговора.", 0.8),
      ]).map((row) => row.value),
    ).toEqual(["independent"]);
    expect(
      rankCallSemanticCandidates("Клиент согласился на запись разговора", [
        rows[0],
        candidate(
          "same-call",
          "Клиент согласился ждать разговора.",
          0.8,
          "opposite",
        ),
      ]).map((row) => row.value),
    ).toEqual(["same-call"]);
  });
});
