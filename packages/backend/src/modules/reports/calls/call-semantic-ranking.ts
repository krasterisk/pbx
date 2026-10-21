import PorterStemmerRu from "natural/lib/natural/stemmers/porter_stemmer_ru";
import { hasCallSearchContradiction } from "./call-semantic-polarity";

export const CDR_RANKING_PROFILE = "cdr-hybrid-ru-v2";
// Development calibration, not a production quality guarantee. Preview remains off.
const MIN_COSINE = 0.55;
const MIN_LEXICAL_SUPPORT = 0.15;
const STRONG_COSINE = 0.88;
const STRONG_MARGIN = 0.04;
const stopWords = new Set(
  (
    "клиент сотрудник оператор компания покупатель абонент собеседник он она мы вы " +
    "его её их мне ему наш ваш свой это тот этот какой как что чтобы по из за на от до " +
    "для с со в во и а но к у о об не нет уже всё все очень так был была будет же то ли бы"
  ).split(" "),
);
const ignoredTerms = new Set(
  [...stopWords].map((word) => PorterStemmerRu.stem(word.replace(/ё/g, "е"))),
);

export function callSearchTerms(text: string): string[] {
  return [
    ...new Set(
      (
        text
          .normalize("NFKC")
          .toLowerCase()
          .replace(/ё/g, "е")
          .match(/[\p{L}\p{N}]+/gu) || []
      )
        .filter((word) => word.length > 1 || /^\d$/u.test(word))
        .map((word) => PorterStemmerRu.stem(word))
        .filter((term) => !ignoredTerms.has(term)),
    ),
  ];
}

export interface SemanticCandidate<T> {
  value: T;
  text: string;
  cosine: number;
  group: string;
}

/** Only current authorized windows enter this function. Never expands the cohort. */
export function rankCallSemanticCandidates<T>(
  query: string,
  candidates: SemanticCandidate<T>[],
) {
  const valid = candidates.filter((candidate) =>
    Number.isFinite(candidate.cosine),
  );
  const terms = callSearchTerms(query);
  if (!terms.length) return [];
  const numbers = terms.filter((term) => /^\d+$/u.test(term));
  const documents = valid.map(
    (candidate) => new Set(callSearchTerms(candidate.text)),
  );
  const frequency = new Map<string, number>();
  for (const document of documents)
    for (const term of document)
      frequency.set(term, (frequency.get(term) || 0) + 1);
  const weights = terms.map((term) => {
    const count = frequency.get(term) || 0;
    return Math.log(1 + (valid.length - count + 0.5) / (count + 0.5));
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const contradictions = valid.map((candidate) =>
    hasCallSearchContradiction(query, candidate.text),
  );
  return valid
    .map((candidate, index) => {
      const lexical =
        terms.reduce(
          (sum, term, at) =>
            sum + (documents[index].has(term) ? weights[at] : 0),
          0,
        ) / totalWeight;
      // A pure paraphrase can pass without shared words. Compare distinct calls,
      // not overlapping windows of the same conversation.
      const otherCosine = Math.max(
        0,
        ...valid
          .filter((other) => other.group !== candidate.group)
          .map((other) => other.cosine),
      );
      const supported =
        numbers.every((number) => documents[index].has(number)) &&
        !contradictions[index] &&
        // Do not fall back from a strongly topical contradiction to an
        // incidental word (“согласился” in a call about scheduling). A rival
        // must have more shared query terms and at least as strong a vector.
        // Equally supported assertions and same-call windows survive.
        !valid.some((rival, rivalIndex) => {
          if (
            !contradictions[rivalIndex] ||
            rival.group === candidate.group ||
            rival.cosine < Math.max(MIN_COSINE, candidate.cosine)
          )
            return false;
          const shared = terms.filter((term) => documents[index].has(term));
          const rivalShared = terms.filter((term) =>
            documents[rivalIndex].has(term),
          );
          return rivalShared.length > shared.length;
        }) &&
        (lexical >= MIN_LEXICAL_SUPPORT ||
          (candidate.cosine >= STRONG_COSINE &&
            candidate.cosine - otherCosine >= STRONG_MARGIN));
      return {
        ...candidate,
        lexical,
        score: candidate.cosine * 0.7 + lexical * 0.3,
        supported,
      };
    })
    .filter(
      (candidate) => candidate.cosine >= MIN_COSINE && candidate.supported,
    )
    .sort((a, b) => b.score - a.score);
}
