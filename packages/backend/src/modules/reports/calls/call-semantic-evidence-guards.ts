import type {
  CallEvidenceCandidate,
  GroundedCallMatch,
} from "./call-semantic-grounding";

const words = (text: string): string[] =>
  text
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .match(/\p{L}+/gu) || [];
const prepositions = new Set([
  "на",
  "по",
  "с",
  "со",
  "и",
  "в",
  "во",
  "о",
  "об",
]);
function containsAnchor(text: string, anchor: string): boolean {
  const tokens = words(text),
    key = anchor.toLocaleLowerCase("ru");
  if (tokens.includes(key)) return true;
  // A repeated ASR letter (Лорр) is not a different identifier (ОМСК).
  if (
    !/(\p{L})\1/u.test(key) &&
    tokens.some((token) => token.replace(/(\p{L})\1+/gu, "$1") === key)
  )
    return true;
  // Source-spelled full forms: ОМС = обязательное медицинское страхование,
  // НДС = налог на добавленную стоимость, CRM = customer relationship management.
  const significant = tokens.filter((word) => !prepositions.has(word));
  return significant.some(
    (_, at) =>
      significant
        .slice(at, at + key.length)
        .map((word) => word[0])
        .join("") === key,
  );
}
const weekdays = [
  /(?:^|\P{L})воскресень[ея](?:$|\P{L})/u,
  /(?:^|\P{L})понедельник(?:а|у|ом|е)?(?:$|\P{L})/u,
  /(?:^|\P{L})вторник(?:а|у|ом|е)?(?:$|\P{L})/u,
  /(?:^|\P{L})сред[ауы](?:$|\P{L})/u,
  /(?:^|\P{L})четверг(?:а|у|ом|е)?(?:$|\P{L})/u,
  /(?:^|\P{L})пятниц[ауы](?:$|\P{L})/u,
  /(?:^|\P{L})суббот[ауы](?:$|\P{L})/u,
];
const monthNames = [
  /^январ[ьяеюём]*$/u, /^феврал[ьяеюём]*$/u, /^март(?:а|е|у|ом)?$/u,
  /^апрел[ьяеюём]*$/u, /^ма[йяею]$/u, /^июн[ьяеюём]*$/u,
  /^июл[ьяеюём]*$/u, /^август(?:а|е|у|ом)?$/u, /^сентябр[ьяеюём]*$/u,
  /^октябр[ьяеюём]*$/u, /^ноябр[ьяеюём]*$/u, /^декабр[ьяеюём]*$/u,
];
function explicitMonths(text: string, numericDates = true): Set<number> {
  const tokens = words(text);
  const months = new Set(monthNames.flatMap((pattern, index) =>
    tokens.some(token => pattern.test(token)) ? [index + 1] : []));
  if (!numericDates) return months;
  // A short 08.05 may mean a time, so it is not a month anchor on its own.
  for (const date of text.matchAll(/(?<!\d)(?:0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])[./]\d{2,4}(?!\d)/gu))
    months.add(Number(date[1]));
  for (const date of text.matchAll(/(?<!\d)\d{4}-(0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?!\d)/gu))
    months.add(Number(date[1]));
  return months;
}
function uncertainCorrection(
  query: string,
  call: CallEvidenceCandidate,
): boolean {
  if (/исправ|поправ|оговор|перепут|уточня/u.test(query)) return false;
  const relative = /(?:^|\P{L})(послезавтра|завтра|вчера)(?:$|\P{L})/u.exec(
    query,
  )?.[1];
  if (!relative) return false;
  let day: number | undefined;
  for (const segment of call.segments) {
    const text = segment.text.toLocaleLowerCase("ru");
    if (
      !/(?:^|\P{L})(ой|нет|точнее|вернее|извините)(?:$|\P{L})|то есть/u.test(
        text,
      )
    )
      continue;
    const found = weekdays.findIndex((pattern) => pattern.test(text));
    if (found >= 0) day = found;
  }
  if (
    day === undefined ||
    !call.segments.some((segment) => words(segment.text).includes(relative))
  )
    return false;
  if (!call.context) return true;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: call.context.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(call.context.startedAt));
  const part = (type: string) =>
    Number(parts.find((value) => value.type === type)!.value);
  const offset = relative === "вчера" ? -1 : relative === "послезавтра" ? 2 : 1;
  return (
    new Date(
      Date.UTC(part("year"), part("month") - 1, part("day") + offset),
    ).getUTCDay() !== day
  );
}

/** Conservative refusal of unsupported anchors/time, never an assertion of absence. */
export function guardCallEvidence(
  query: string,
  calls: CallEvidenceCandidate[],
  matches: GroundedCallMatch[],
) {
  const normalized = query.normalize("NFKC");
  const aliases = [...new Set(normalized.match(/\[(?:PERSON|PHONE|EMAIL|ADDRESS|BIRTH_DATE|DOCUMENT|ACCOUNT|IDENTIFIER|ORGANIZATION)_\d+\]/gu) || [])];
  // An all-caps sentence is a writing style, not a list of business identifiers.
  const anchors = /\p{Ll}/u.test(normalized)
    ? [
        ...new Set(
          normalized.match(/(?<![\p{L}\p{N}])\p{Lu}{2,8}(?![\p{L}\p{N}])/gu) ||
            [],
        ),
      ]
    : [];
  const rejected: Array<{
    callId: string;
    reason: "unverified_anchor" | "unresolved_or_contradicted_time" | "unverified_privacy_alias";
  }> = [];
  const accepted = matches.filter((match) => {
    const call = calls.find((candidate) => candidate.callId === match.callId);
    if (!call) throw new Error("CDR_GROUNDING_RESPONSE_INVALID");
    // Aliases are opaque identities in one request, not interchangeable types.
    // A different date/person/organization cannot satisfy a masked condition.
    const source = call.segments.map(segment => segment.text).join(" ");
    // A weekday/day number or upload clock cannot supply a missing month.
    // Numeric dates are explicit equivalents; no calendar or ASR guessing here.
    const sourceMonths = explicitMonths(source);
    if ([...explicitMonths(normalized, false)].some(month => !sourceMonths.has(month))) {
      rejected.push({ callId: call.callId, reason: "unverified_anchor" });
      return false;
    }
    const sourceAliases = new Set(source.match(/\[[A-Z_]+_\d+\]/gu) || []);
    if (aliases.some(alias => !sourceAliases.has(alias))) {
      rejected.push({ callId: call.callId, reason: "unverified_privacy_alias" });
      return false;
    }
    if (
      anchors.some(
        (anchor) =>
          !containsAnchor(
            call.segments.map((segment) => segment.text).join(" "),
            anchor,
          ),
      )
    ) {
      rejected.push({ callId: call.callId, reason: "unverified_anchor" });
      return false;
    }
    if (uncertainCorrection(normalized.toLocaleLowerCase("ru"), call)) {
      rejected.push({
        callId: call.callId,
        reason: "unresolved_or_contradicted_time",
      });
      return false;
    }
    return true;
  });
  return { matches: accepted, rejected };
}
