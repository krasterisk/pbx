import axios from "axios";
import { applyProviderAuth } from "../../ai-connectivity/provider-auth";
import { resolveChatCompletionsUrl } from "../../ai-connectivity/chat-endpoint.util";
import { deepseekStructuredParams } from "../../speech-analytics/pipeline/provider-analysis";
import {
  chatSamplingParams,
  chatTokenLimitParams,
} from "../../voicemail/llm-summary.service";
import {
  buildCallGroundingMessages,
  parseCallGroundingResponse,
  type CallEvidenceCandidate,
} from "./call-semantic-grounding";
import { guardCallEvidence } from "./call-semantic-evidence-guards";

export interface CallGroundingProvider {
  uid: number;
  endpoint: string;
  auth_type: string;
  enabled: boolean;
  is_global: boolean;
  capabilities: string[];
  defaults: { model?: unknown };
}

/** Caller authorizes a current snapshot BEFORE this network call, outside SQL. */
export async function groundCallCandidates(
  query: string,
  calls: CallEvidenceCandidate[],
  provider: CallGroundingProvider,
  token: string,
) {
  const messages = buildCallGroundingMessages(query, calls);
  if (!calls.length) return [];
  const url = resolveChatCompletionsUrl(provider.endpoint);
  if (
    !provider.enabled ||
    !provider.is_global ||
    !provider.capabilities.includes("llm") ||
    typeof provider.defaults.model !== "string" ||
    !provider.defaults.model.trim() ||
    !url ||
    new URL(url).protocol !== "https:"
  )
    throw new Error("CDR_GROUNDING_PROVIDER_UNAVAILABLE");
  const model = provider.defaults.model;
  let raw: unknown;
  try {
    const response = await axios.post(
      url,
      {
        model,
        messages,
        ...chatSamplingParams(model, 0),
        ...chatTokenLimitParams(model, 6000),
        ...deepseekStructuredParams(model, provider.endpoint),
        response_format: { type: "json_object" },
      },
      {
        headers: applyProviderAuth(
          { "Content-Type": "application/json" },
          provider.auth_type,
          token,
        ),
        timeout: 45000,
        maxContentLength: 100000,
        maxBodyLength: 1000000,
        maxRedirects: 0,
      },
    );
    raw = response.data?.choices?.[0]?.message?.content;
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    // Axios errors retain Authorization headers and transcript request bodies.
    // eslint-disable-next-line preserve-caught-error -- Intentionally discard the sensitive provider error/cause.
    throw new Error(
      status
        ? `CDR_GROUNDING_PROVIDER_HTTP_${status}`
        : "CDR_GROUNDING_PROVIDER_UNAVAILABLE",
    );
  }
  if (typeof raw !== "string")
    throw new Error("CDR_GROUNDING_RESPONSE_INVALID");
  return guardCallEvidence(query, calls, parseCallGroundingResponse(raw, calls))
    .matches;
}
