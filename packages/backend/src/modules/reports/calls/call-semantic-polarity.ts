import PorterStemmerRu from "natural/lib/natural/stemmers/porter_stemmer_ru";

interface Assertion {
  anchor: string;
  negative: boolean;
  context: Set<string>;
}

const words = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .match(/[\p{L}\p{N}]+/gu) || [];
const stem = (word: string) => PorterStemmerRu.stem(word);
const filler =
  /^(я|мы|вы|он|она|они|клиент\p{L}*|сотрудник\p{L}*|оператор\p{L}*|собеседник\p{L}*|на|от|за|по|в|с|и|а|но|однако|так|еще|уже|вообще|совсем|никто|ничего|был|была|были|будет|будут|будем|будете)$/u;
const denial = /^(отказ\p{L}*|запрет\p{L}*)$/u;
const consent =
  /^(согласен|согласна|согласны|согласил\p{L}*|соглаша\p{L}*|согласие|согласия|согласиям\p{L}*)$/u;
// Deliberately limited to surface assertions. Infinitives/topics are not facts:
// “обсуждали возврат”, “просит вернуть” do not assert that money was returned.
const predicate =
  /(?:л|ла|ли|ло|ет|ют|ит|ят|ется|ются|ится|атся|ен|ена|ено|ены|ан|ана|ано|аны|лся|лась|лись)$/u;

function assertions(text: string): Assertion[] {
  const result: Assertion[] = [];
  // Negation never crosses a sentence, contrast, speaker turn or question.
  // A condition after a comma can scope over the preceding clause too.
  const clauses = text
    .split(/(?<=[.!?;\n])/u)
    .filter(
      (sentence) =>
        !sentence.includes("?") &&
        !words(sentence).some((word) =>
          /^(если|бы|возможно|вдруг|может|мог|могла|могли|нельзя|невозможно|или|ли)$/u.test(
            word,
          ),
        ),
    )
    .flatMap((sentence) => sentence.split(/,|\s+(?:но|однако)\s+/iu));
  // Conditional, modal and double-negation scopes need a parser/model. Abstain
  // from contradiction inference here instead of guessing their truth value.
  for (const clause of clauses) {
    const tokens = words(clause);
    if (tokens.filter((word) => word === "не").length > 1) continue;
    for (let at = 0; at < tokens.length; at++) {
      const token = tokens[at];
      if (token === "нет" || token === "без") continue;
      let target = at;
      let negative = false;
      if (token === "не" || denial.test(token)) {
        if (token === "не" && tokens[at + 1] === "только") continue;
        // “не отказался” is not evidence of accepting the proposed action.
        if (
          denial.test(token) &&
          tokens.slice(Math.max(0, at - 2), at).includes("не")
        )
          continue;
        target++;
        while (
          target < Math.min(tokens.length, at + 5) &&
          filler.test(tokens[target])
        )
          target++;
        if (target >= Math.min(tokens.length, at + 5)) continue;
        // Existential “нет/без” and bare objects need syntactic scope. Only
        // infer a negated predicate here; never label a noun like “интернет”
        // as affirmed just because it occurs before “соединения нет”.
        if (
          !consent.test(tokens[target]) &&
          !predicate.test(tokens[target]) &&
          !/(?:ть|ться)$/u.test(tokens[target])
        )
          continue;
        negative = true;
      } else {
        const consentNoun = /^(согласие|согласия|согласиям\p{L}*)$/u.test(
          token,
        );
        if (
          consentNoun &&
          !/^(дал|дала|дали|получил|получила|получили)$/u.test(
            tokens[at - 1] || "",
          )
        )
          continue;
        if (!predicate.test(token) && !consent.test(token)) continue;
        if (
          tokens
            .slice(Math.max(0, at - 4), at)
            .some(
              (word) =>
                word === "не" ||
                word === "нет" ||
                word === "без" ||
                denial.test(word),
            )
        )
          continue;
      }
      const anchor = consent.test(tokens[target])
        ? "соглас"
        : stem(tokens[target]);
      const context = new Set(
        tokens
          .slice(Math.max(0, target - 6), target + 7)
          .filter(
            (word) =>
              !filler.test(word) &&
              !/^(не|нет|без)$/u.test(word) &&
              !denial.test(word),
          )
          .map(stem)
          .filter((term) => term !== anchor),
      );
      result.push({ anchor, negative, context });
    }
  }
  return result;
}

/** A conservative veto, not an entailment classifier. Ambiguity does not veto. */
export function hasCallSearchContradiction(
  query: string,
  document: string,
): boolean {
  const claims = assertions(query);
  const evidence = assertions(document);
  return claims.some((claim) => {
    const aligned = evidence.filter(
      (item) =>
        item.anchor === claim.anchor &&
        (!claim.context.size ||
          !item.context.size ||
          [...claim.context].some((term) => item.context.has(term))),
    );
    return (
      aligned.some((item) => item.negative !== claim.negative) &&
      !aligned.some((item) => item.negative === claim.negative)
    );
  });
}
