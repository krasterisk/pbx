import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { JwtPayloadUser } from "../../auth/auth.service";
import type { AiToolDefinition } from "../../ai-platform/ai-adapter.types";
import type { CallParty } from "@krasterisk/shared";
import type { CallsService } from "./calls.service";
import type { CallTextSearchService } from "./call-text-search.service";
import type { CallAnalysisService } from "./call-analysis.service";
import {
  callsAiFilterSchema,
  callsJournalLink,
  prepareCallsAiQuery,
  callsAiLocalTime,
} from "./calls-ai-tools";

const employeeFields = {
  employeeName: {
    type: "string",
    maxLength: 128,
    description:
      "Employee full name in any word order; never invent their extension. Ambiguous names require user selection.",
  },
  employeeId: {
    type: "string",
    maxLength: 128,
    description: "Exact id previously returned by resolve_call_employees.",
  },
};
const words = (s: string): string[] =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .match(/[\p{L}\p{N}]+/gu) || [];

function otherSide(caller: CallParty, recipient: CallParty, employeeId?: string): CallParty | null {
  if (!employeeId) return null;
  if (caller.kind === 'employee' && caller.id === employeeId) return recipient;
  if (recipient.kind === 'employee' && recipient.id === employeeId) return caller;
  // A scoped employee can have joined after a transfer. The original pair alone
  // cannot establish their interlocutor; keep that identity unknown.
  return null;
}

export function callsAiResearchTools(
  calls: CallsService,
  textSearch: CallTextSearchService,
  analysis: CallAnalysisService,
): AiToolDefinition[] {
  const actor = async (uid: number, ctx?: { userUid: number }) => {
    if (!ctx || !Number.isSafeInteger(ctx.userUid) || ctx.userUid <= 0)
      throw new ForbiddenException("User context is required");
    return calls.aiActor(uid, ctx.userUid);
  };
  const resolve = async (user: JwtPayloadUser, name: unknown, id: unknown) => {
    if (
      (name !== undefined &&
        (typeof name !== "string" ||
          name.trim().length < 2 ||
          name.length > 128)) ||
      (id !== undefined &&
        (typeof id !== "string" || !id || id.length > 128)) ||
      (!name && !id)
    )
      throw new BadRequestException("Employee name or id required");
    const tokens = typeof name === "string" ? words(name) : [];
    const directorySearch =
      typeof id === "string"
        ? id
        : [...tokens].sort((a, b) => b.length - a.length)[0];
    const facets = await calls.facets(user, {
      dateFrom: "",
      dateTo: "",
      directorySearch,
    });
    const matches = facets.options.employee.filter(
      (row) =>
        (typeof id !== "string" || row.value === id) &&
        tokens.every((token) => words(row.label).includes(token)),
    );
    return {
      state: facets.truncated.employee
        ? "truncated"
        : matches.length === 1
          ? "unique"
          : matches.length
            ? "ambiguous"
            : "not_found",
      employees: matches.map((row) => ({ id: row.value, name: row.label })),
      scope:
        "Participants in authorized call history; not a company-wide employee directory",
    };
  };
  const prepare = async (
    user: JwtPayloadUser,
    args: Record<string, unknown>,
  ) => {
    const { employeeName, employeeId, relationship, mine, ...filters } = args;
    if (mine !== undefined && typeof mine !== "boolean")
      throw new BadRequestException("Invalid own-call selector");
    if (
      relationship !== undefined &&
      relationship !== "initiator" &&
      relationship !== "participant"
    )
      throw new BadRequestException("Invalid employee relationship");
    const q = await prepareCallsAiQuery(calls, user, filters);
    if (mine) {
      if (employeeName || employeeId)
        throw new BadRequestException("Choose own calls or another employee");
      const id = await calls.aiOwnEmployee(user);
      if (!id)
        return {
          q,
          resolution: {
            state: "self_unmapped",
            employees: [],
            scope:
              "Current user has no mapped extension; ask for employee identity",
          },
        };
      return {
        q:
          relationship === "initiator"
            ? { ...q, callerEmployee: id }
            : { ...q, focusEmployee: id },
        resolution: {
          state: "unique",
          employees: [{ id, name: user.name }],
          scope: "Current authenticated user",
        },
      };
    }
    if (!employeeName && !employeeId) {
      if (relationship) throw new BadRequestException("Employee required");
      return { q, resolution: null };
    }
    const resolution = await resolve(user, employeeName, employeeId);
    if (resolution.state !== "unique") return { q, resolution };
    const id = resolution.employees[0].id;
    if (
      relationship === "initiator" &&
      q.callerEmployee &&
      q.callerEmployee !== id
    )
      throw new BadRequestException("Conflicting initiator filters");
    return {
      q:
        relationship === "initiator"
          ? { ...q, callerEmployee: id }
          : { ...q, focusEmployee: id },
      resolution,
    };
  };
  const statsSchema = {
    ...callsAiFilterSchema,
    ...employeeFields,
    mine: {
      type: "boolean",
      description:
        "For “I / я / мои разговоры”, restrict to the authenticated user mapped extension; never assume all visible calls are their own.",
    },
    relationship: {
      type: "string",
      enum: ["initiator", "participant"],
      description:
        "For “сделала/совершил звонки” use initiator AND direction out. For conversations involving employee use participant.",
    },
  };
  return [
    {
      name: "resolve_call_employees",
      entityType: "call",
      description:
        "Resolve employee names (including reversed first/last names) to authorized call participant IDs. Never choose silently between namesakes. not_found is not proof of zero calls.",
      inputSchema: employeeFields,
      handler: async (args, uid, ctx) => {
        const user = await actor(uid, ctx);
        if (
          Object.keys(args).some(
            (k) => !["employeeName", "employeeId"].includes(k),
          )
        )
          throw new BadRequestException("Invalid employee lookup");
        return resolve(user, args.employeeName, args.employeeId);
      },
    },
    {
      name: "summarize_employee_calls",
      entityType: "call",
      description:
        "Count calls and sum known human connection seconds over the ENTIRE authorized cohort, not a page. Use employeeName/id, relationship initiator + direction out for calls made by employee. Whole-call time after transfers is not personal talk time.",
      inputSchema: statsSchema,
      handler: async (args, uid, ctx) => {
        const user = await actor(uid, ctx);
        if (!args.employeeName && !args.employeeId && !args.mine)
          throw new BadRequestException("Employee required");
        const { q, resolution } = await prepare(user, args);
        if (resolution && resolution.state !== "unique")
          return { resolution, needsEmployeeSelection: true };
        const page = await calls.list(user, { ...q, limit: 1 });
        await calls.auditResearch(user, "call_aggregate");
        return {
          resolution,
          total: page.total,
          summary: page.summary,
          period: page.period,
          timezone: page.timezone,
          source: page.source,
          dataAsOf: page.dataAsOf,
          durationScope: "whole_logical_call_human_connection_union",
          individualEmployeeTalkTimeAvailable: false,
          url: callsJournalLink(q),
        };
      },
    },
    {
      name: "search_call_content",
      entityType: "call",
      description:
        "Find calls by conversation meaning or literal phrase using the SAME authorized CDR search and grounding. Returns contact numbers, participants, evidence timestamps and links. For “I / я разговаривал” set mine=true. Conversation snippets are not forwarded to the chat model; coverage may be partial. Default semantic; never silently fall back on failure.",
      inputSchema: {
        ...statsSchema,
        phrase: { type: "string", minLength: 2, maxLength: 200 },
        mode: {
          type: "string",
          enum: ["semantic", "literal"],
          default: "semantic",
        },
      },
      handler: async (args, uid, ctx) => {
        const user = await actor(uid, ctx);
        const { phrase, mode = "semantic", ...filters } = args;
        if (
          typeof phrase !== "string" ||
          (mode !== "semantic" && mode !== "literal")
        )
          throw new BadRequestException("Invalid content search");
        const { q, resolution } = await prepare(user, filters);
        if (resolution && resolution.state !== "unique")
          return { resolution, needsEmployeeSelection: true };
        const page = await textSearch.search(user, q, phrase, mode);
        const perspective = resolution?.employees[0];
        return {
          ...page,
          perspectiveEmployee: perspective ? {...perspective, role: filters.mine ? 'current_user' : 'selected_employee'} : null,
          rows: page.rows.map(({ snippet: _snippet, ...row }) => ({
            ...row,
            startedAtLocal: callsAiLocalTime(row.startedAt, page.timezone),
            counterparty: otherSide(row.caller, row.recipient, perspective?.id),
            url: `${callsJournalLink(q, row.callId)}&transcriptSegment=${encodeURIComponent(row.segmentId)}`,
          })),
          snippetsOmitted: true,
          url: callsJournalLink(q),
        };
      },
    },
    {
      name: "get_call_analysis",
      entityType: "call",
      description:
        "Read authorized project summary, named metrics and applicability for one call. Applies current speech-analytics/project/tenant/retention rights; analyzed badge alone grants nothing. Source quotations/rationale stay in the linked CDR card, never in chat tool results.",
      inputSchema: { id: { type: "string", pattern: "^[a-f0-9]{64}$" } },
      handler: async (args, uid, ctx) => {
        const user = await actor(uid, ctx);
        if (
          typeof args.id !== "string" ||
          !/^[a-f0-9]{64}$/.test(args.id) ||
          Object.keys(args).some((k) => k !== "id")
        )
          throw new BadRequestException("Call id required");
        const result = await analysis.read(user, args.id);
        const response = {
          ...result,
          summary: result.summary?.slice(0, 2000) || null,
          summaryTruncated: result.summaryTruncated || Boolean(result.summary && result.summary.length > 2000),
          metrics: result.metrics.map(({quote: _quote, rationale: _rationale, ...metric}) => metric),
          evidenceOmitted: true,
          assessmentSource: 'model_inference',
          containsCustomerSurvey: false,
          metricsTruncated: false,
          url: callsJournalLink({}, args.id),
        };
        // The chat loop clips tool results at4000 chars. Keep a valid object and
        // explicit coverage instead of letting it cut through a metric/summary.
        while (JSON.stringify(response).length > 3800 && response.metrics.length) {
          response.metrics.pop();
          response.metricsTruncated = true;
        }
        return response;
      },
    },
    {
      name: "summarize_call_conversations",
      entityType: "call",
      description:
        "Collect available project summaries/metrics for yesterday or another employee/period. Counts cover full cohort; contents limited to20 newest calls. If nextAnalysisOffset is non-null, repeat with analysisOffset set to it and identical filters; combine pages without duplicates. Report analysed/considered/total coverage explicitly; never call a partial sample a summary of all conversations. Uses current analysis permissions, no raw transcripts.",
      inputSchema: {
        ...statsSchema,
        analysisOffset: { type: "integer", minimum: 0, maximum: 20,
          description: "Continue with nextAnalysisOffset, keeping all other filters identical." },
      },
      handler: async (args, uid, ctx) => {
        const { analysisOffset = 0, ...filters } = args;
        if (!Number.isInteger(analysisOffset) || Number(analysisOffset) < 0 || Number(analysisOffset) > 20)
          throw new BadRequestException("Invalid analysis offset");
        const offset = Number(analysisOffset);
        const user = await actor(uid, ctx),
          { q, resolution } = await prepare(user, filters);
        if (resolution && resolution.state !== "unique")
          return { resolution, needsEmployeeSelection: true };
        const page = await calls.list(user, { ...q, limit: 20 });
        const results = [];
        let available = 0;
        const considered = page.rows.slice(0, 20);
        for (const call of considered) {
          const result = await analysis.read(user, call.id);
          if (result.state !== "available") continue;
          available++;
          results.push({
            callId: call.id,
            startedAt: call.startedAt,
            startedAtLocal: callsAiLocalTime(call.startedAt, page.timezone),
            caller: {kind:call.caller.kind,id:call.caller.id,name:call.caller.name,number:call.caller.number},
            recipient: {kind:call.recipient.kind,id:call.recipient.id,name:call.recipient.name,number:call.recipient.number},
            summary: result.summary?.slice(0, 900) || null,
            summaryTruncated:
              (result.summaryTruncated ||
              Boolean(result.summary && result.summary.length > 900)) ? true : undefined,
            privacyProtected: result.privacyProtected,
            metrics: result.metrics
              .filter((m) => ['csat', 'success', 'customer_sentiment'].includes(m.id))
              .slice(0, 3)
              .map((m) => ({
                id: m.id,
                value: m.value,
                status: m.status,
              })),
            url: callsJournalLink(q, call.id),
          });
        }
        await calls.auditResearch(user, "call_aggregate");
        const response = {
          resolution,
          assessmentSource: 'model_inference',
          containsCustomerSurvey: false,
          total: page.total,
          summary: page.summary,
          period: page.period,
          timezone: page.timezone,
          source: page.source,
          coverage: {
            consideredCalls: considered.length,
            availableAnalyses: available,
            cohortCalls: page.total,
            truncated: page.total > considered.length,
            includedAnalyses: results.length,
            contentTruncated: false,
          },
          analysisOffset: offset,
          nextAnalysisOffset: null as number | null,
          rows: results.slice(offset),
          url: callsJournalLink(q),
        };
        while (JSON.stringify(response).length > 3800 && response.rows.length) {
          response.rows.pop();
          response.coverage.contentTruncated = true;
          response.coverage.truncated = true;
        }
        response.coverage.includedAnalyses = response.rows.length;
        if (offset + response.rows.length < available && response.rows.length)
          response.nextAnalysisOffset = offset + response.rows.length;
        return response;
      },
    },
  ];
}
