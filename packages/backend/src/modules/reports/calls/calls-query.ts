import { BadRequestException } from "@nestjs/common";
import type { CallsQuery } from "@krasterisk/shared";
import { normalizeCallNumber } from "@krasterisk/shared";
import { companyDayStart } from "./calls-calendar";
import type { CdrAccessScope } from "../cdr/cdr-access-scope";

export function callsPeriod(
  query: CallsQuery,
  timezone: string,
  now = new Date(),
): { from: number; to: number } {
  if (query.from || query.to) {
    const from = Date.parse(query.from || "");
    const to = Date.parse(query.to || "");
    if (
      !query.from ||
      !query.to ||
      !/(Z|[+-]\d\d:\d\d)$/.test(query.from) ||
      !/(Z|[+-]\d\d:\d\d)$/.test(query.to) ||
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      to <= from
    )
      throw new BadRequestException("Invalid call period");
    return { from, to };
  }
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const explicit = query.dateFrom !== undefined || query.dateTo !== undefined;
  const weekStart = new Date(`${date}T12:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const start = explicit ? query.dateFrom : weekStart.toISOString().slice(0, 10);
  const end = explicit ? query.dateTo : date;
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException("Invalid call period");
    const normalized = Date.parse(`${value}T00:00:00Z`);
    if (
      !Number.isFinite(normalized) ||
      new Date(normalized).toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException("Invalid call period");
    return companyDayStart(value, timezone);
  };
  const from = start ? parse(start) : 0;
  let to = now.getTime() + 1;
  if (end) {
    parse(end);
    const day = new Date(`${end}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 1);
    to = parse(`${day.toISOString().slice(0, 10)}`);
  }
  if (from >= to) throw new BadRequestException("Invalid call period");
  return { from, to };
}
/** Filter READY facts, never individual legs. The same predicate serves list and summary. */
export function callsWhere(
  tenant: number,
  query: CallsQuery,
  period: { from: number; to: number },
  scope: CdrAccessScope | null,
  dialect = 'mysql',
) {
  const conditions = [
    "c.tenant=:tenant",
    "f.tenant=:tenant",
    "c.started_at>=:from",
    "c.started_at < :to",
  ];
  const args: Record<string, unknown> = { tenant, ...period };
  if (query.callerEmployee) {
    const caller = dialect === 'postgres'
      ? "CAST(f.payload AS jsonb)->'caller'->>'id'"
      : "JSON_UNQUOTE(JSON_EXTRACT(f.payload,'$.caller.id'))";
    const kind = dialect === 'postgres'
      ? "CAST(f.payload AS jsonb)->'caller'->>'kind'"
      : "JSON_UNQUOTE(JSON_EXTRACT(f.payload,'$.caller.kind'))";
    conditions.push(`(${caller})=:callerEmployee AND (${kind})='employee'`);
    args.callerEmployee = query.callerEmployee;
  }
  if (query.directions?.length) {
    conditions.push("c.direction IN (:directions)");
    args.directions = query.directions;
  } else if (query.direction) {
    conditions.push("c.direction=:direction");
    args.direction = query.direction;
  }
  if (query.dashboardOutcome) {
    conditions.push("c.outcome=:dashboardOutcome");
    args.dashboardOutcome = query.dashboardOutcome;
  }
  if (query.origin) {
    conditions.push("c.origin=:origin");
    args.origin = query.origin;
  }
  if (
    query.outcome !== "active" &&
    query.focusOutcome !== "active" &&
    !query.outcomes?.includes("active") &&
    query.dashboardOutcome !== "active"
  )
    conditions.push("c.outcome<>'active'");
  if (query.outcome) {
    conditions.push("f.outcome=:outcome");
    args.outcome = query.outcome;
  }
  const resultTerms: string[] = [];
  if (query.outcomes?.length) {
    resultTerms.push("f.outcome IN (:outcomes)");
    args.outcomes = query.outcomes;
  }
  if (query.results?.length) {
    const has = (value: string) => dialect === 'postgres'
      ? `EXISTS (SELECT 1 FROM jsonb_array_elements(CAST(f.payload AS jsonb)->'journey') step WHERE step->>'kind' IN ('attempt','queue') AND step->>'result'='${value}')`
      : `JSON_CONTAINS(JSON_EXTRACT(f.payload,'$.journey'), JSON_OBJECT('kind','attempt','result','${value}'))=1 OR JSON_CONTAINS(JSON_EXTRACT(f.payload,'$.journey'), JSON_OBJECT('kind','queue','result','${value}'))=1`;
    const noAnswer = `(${has('noAnswer')})`, busy = `(${has('busy')})`;
    const projectedResult = dialect === 'postgres' ? "CAST(f.payload AS jsonb)->>'connectionResult'" : "JSON_UNQUOTE(JSON_EXTRACT(f.payload,'$.connectionResult'))";
    const result = `COALESCE(${projectedResult}, (CASE WHEN ${noAnswer} THEN 'noAnswer' WHEN ${busy} THEN 'busy' ELSE 'unavailable' END))`;
    resultTerms.push(`(f.outcome IN ('missed','error','unknown') AND ${result} IN (:results))`);
    args.results = query.results;
  }
  if (resultTerms.length) conditions.push(`(${resultTerms.join(' OR ')})`);
  if (query.numbers?.length) {
    const numbers = [...new Set(query.numbers.map(normalizeCallNumber))];
    if (numbers.length > 30 || query.numbers.some(number => !/^[+\d\s().-]+$/.test(number)) || numbers.some(number => number.length < 2 || number.length > 20)) throw new BadRequestException('Invalid phone number');
    const roles = query.numberRole === 'caller' ? ['caller'] : query.numberRole === 'recipient' ? ['recipient'] : ['caller','recipient'];
    conditions.push(`(${roles.map(role => `f.${role}_number IN (:numbers)`).join(' OR ')})`);
    args.numbers = numbers;
  }
  if (query.trunks?.length) {
    conditions.push("EXISTS (SELECT 1 FROM call_dimensions trunk_d WHERE trunk_d.call_key=c.call_key AND trunk_d.tenant=:tenant AND trunk_d.kind='trunk' AND trunk_d.value IN (:trunks))");
    args.trunks = query.trunks;
  }
  const dimensions = {
    employees: "employee",
    departments: "department",
    companyNumbers: "companyNumber",
    queues: "queue",
    groups: "group",
    robots: "robot",
  } as const;
  for (const key of Object.keys(dimensions) as Array<keyof typeof dimensions>) {
    if (!query[key]?.length) continue;
    conditions.push(
      `EXISTS (SELECT 1 FROM call_dimensions d WHERE d.call_key=c.call_key AND d.tenant=:tenant AND d.kind=:kind_${key} AND d.value IN (:values_${key}))`,
    );
    args[`kind_${key}`] = dimensions[key];
    args[`values_${key}`] = [
      ...new Set(
        query[key]!.map((v) =>
          key === "companyNumbers"
            ? normalizeCallNumber(v)
            : key === "departments"
              ? v.trim().toLowerCase()
              : v,
        ),
      ),
    ];
  }
  for (const [field, kind] of [
    ["focusEmployee", "employee"],
    ["focusDepartment", "department"],
    ["focusCompanyNumber", "companyNumber"],
  ] as const) {
    const value = query[field];
    if (!value) continue;
    conditions.push(
      `EXISTS (SELECT 1 FROM call_dimensions focused WHERE focused.call_key=c.call_key AND focused.tenant=:tenant AND focused.kind=:kind_${field} AND focused.value=:value_${field})`,
    );
    args[`kind_${field}`] = kind;
    args[`value_${field}`] =
      kind === "companyNumber"
        ? normalizeCallNumber(value)
        : kind === "department"
          ? value.trim().toLowerCase()
          : value;
  }
  if (query.unassignedDimensions?.length) {
    if (
      query.unassignedDimensions.some(
        (d) => !["employee", "department", "companyNumber"].includes(d),
      )
    )
      throw new BadRequestException("Invalid dimension");
    conditions.push(
      "NOT EXISTS (SELECT 1 FROM call_dimensions absent WHERE absent.call_key=c.call_key AND absent.tenant=:tenant AND absent.kind IN (:unassignedKinds))",
    );
    args.unassignedKinds = [...new Set(query.unassignedDimensions)];
  }
  if (query.focusOutcome) {
    conditions.push("f.outcome=:focusOutcome");
    args.focusOutcome = query.focusOutcome;
  }
  if (query.recording)
    conditions.push(
      `${query.recording === "no" ? "NOT " : ""}EXISTS (SELECT 1 FROM call_dimensions media WHERE media.call_key=c.call_key AND media.tenant=:tenant AND media.kind='recording')`,
    );
  if (query.voicemail === "1") conditions.push("f.has_voicemail=1");
  if (query.companyNumber) {
    conditions.push("f.company_number=:companyNumber");
    args.companyNumber = normalizeCallNumber(query.companyNumber);
  }
  if (query.department) {
    conditions.push("f.departments LIKE :department ESCAPE '!'");
    args.department = `%${JSON.stringify(query.department.trim().toLowerCase()).replace(/[!%_]/g, "!$&")}%`;
  }
  if (query.analytics) {
    conditions.push("f.analytics_state=:analytics");
    args.analytics = query.analytics;
  }
  if (query.handlings?.length) {
    const terms = query.handlings.map((kind, index) => {
      if (kind === 'autodial') return "c.origin='autodial'";
      args[`handling${index}`] = `%"${kind}"%`;
      return `f.handling LIKE :handling${index}`;
    });
    conditions.push(`(${terms.join(' OR ')})`);
  } else if (query.handling === "autodial") conditions.push("c.origin='autodial'");
  else if (query.handling) {
    conditions.push("f.handling LIKE :handling");
    args.handling = `%"${query.handling}"%`;
  }
  if (query.extension) {
    conditions.push(
      "EXISTS (SELECT 1 FROM dashboard_participants e WHERE e.call_key=c.call_key AND e.tenant=:tenant AND e.kind='extension' AND e.value=:extension)",
    );
    args.extension = query.extension;
  }
  if (query.search?.trim()) {
    const text = query.search.trim().toLowerCase();
    if (text.length < 3 || text.length > 200) throw new BadRequestException('Call search requires 3 to 200 characters');
    const digits = normalizeCallNumber(text);
    if (digits && /^[+\d\s().-]+$/.test(text)) {
      conditions.push(
        "(f.caller_number LIKE :phone OR f.recipient_number LIKE :phone OR EXISTS (SELECT 1 FROM call_dimensions search_d WHERE search_d.call_key=c.call_key AND search_d.tenant=:tenant AND search_d.kind IN ('employee','companyNumber') AND search_d.value LIKE :phone))",
      );
      args.phone = `%${digits.length >= 10 ? digits.slice(-10) : digits}%`;
    } else {
      conditions.push(
        "(f.search_text LIKE :search ESCAPE '!' OR EXISTS (SELECT 1 FROM call_dimensions search_d WHERE search_d.call_key=c.call_key AND search_d.tenant=:tenant AND search_d.search_label LIKE :search ESCAPE '!'))",
      );
      args.search = `%${text.replace(/[!%_]/g, "!$&")}%`;
    }
  }
  if (scope && (scope.operators.length || scope.queues.length)) {
    const terms: string[] = [];
    const extensions = [
      ...new Set([
        ...scope.operators,
        ...(scope.ownExten ? [scope.ownExten] : []),
      ]),
    ];
    if (extensions.length) {
      terms.push("(p.kind='extension' AND p.value IN (:extensions))");
      args.extensions = extensions;
    }
    if (scope.queues.length) {
      terms.push("(p.kind='queue' AND p.value IN (:queues))");
      args.queues = scope.queues;
    }
    conditions.push(
      `EXISTS (SELECT 1 FROM dashboard_participants p WHERE p.call_key=c.call_key AND p.tenant=:tenant AND (${terms.join(" OR ")}))`,
    );
  }
  return { sql: conditions.join(" AND "), args };
}
