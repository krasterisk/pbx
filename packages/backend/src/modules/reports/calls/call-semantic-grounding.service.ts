import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { AiProvidersService } from "../../ai-connectivity/ai-providers.service";
import { PlatformSpeechModelsService } from "../../ai-connectivity/platform-speech-models.service";
import { decryptSecret } from "../../ai-connectivity/secret-cipher.util";
import { groundCallCandidates } from "./call-semantic-grounding-client";
import { parseCallGroundingResponse, type CallEvidenceCandidate } from "./call-semantic-grounding";
import { preparePrivateText, maskPrivacyEntries, reuseTranscriptPrivacy, type PrivacyPosition } from '../../speech-analytics/pipeline/text-privacy';
import { guardCallEvidence } from './call-semantic-evidence-guards';
import { callSearchTerms } from './call-semantic-ranking';

/** Detect lost query anchors locally; never restore masked text to cloud input. */
export function privacyLimitsCallSearch(query: string, source: string, masked: string): boolean {
  const before = new Set(callSearchTerms(source));
  const after = new Set(callSearchTerms(masked.replace(/\[[A-Z_]+_\d+\]/gu, ' ')));
  return callSearchTerms(query).some(term => before.has(term) && !after.has(term));
}

@Injectable()
export class CallSemanticGroundingService {
  private inFlight = 0;
  constructor(
    private readonly assignments: PlatformSpeechModelsService,
    private readonly providers: AiProvidersService,
  ) {}

  private async current() {
    const assignment = await this.assignments.get();
    const provider = (await this.providers.findGlobal("llm")).find(
      (row) =>
        row.uid === assignment.llmProviderUid &&
        row.is_global === true &&
        row.enabled === true &&
        row.capabilities.includes("llm"),
    );
    if (
      !provider ||
      typeof provider.defaults?.model !== "string" ||
      !provider.defaults.model.trim()
    ) {
      throw new Error("CDR_GROUNDING_PROVIDER_UNAVAILABLE");
    }
    const revision = createHash("sha256")
      .update(
        JSON.stringify([
          provider.uid,
          provider.endpoint,
          provider.auth_type,
          provider.capabilities,
          provider.defaults,
          provider.encrypted_api_key,
        ]),
      )
      .digest("hex");
    return { provider, revision };
  }

  /** Uses exactly the platform assignment, never tenant/default-name/environment fallback. */
  async verify(query: string, calls: CallEvidenceCandidate[]) {
    if (this.inFlight >= 2) throw new Error("CDR_GROUNDING_BUSY");
    this.inFlight++;
    try {
      const before = await this.current();
      const token =
        before.provider.auth_type === "none"
          ? ""
          : decryptSecret(before.provider.encrypted_api_key || "");
      if (before.provider.auth_type !== "none" && !token)
        throw new Error("CDR_GROUNDING_PROVIDER_UNAVAILABLE");
      let cloudQuery=query,cloudCalls=calls;
      let privacy:ReturnType<typeof maskPrivacyEntries>|undefined;
      const segmentKey=(ci:number,si:number)=>`c${ci}s${si}`;
      if(calls.some(call=>call.anonymizeBeforeLlm===true)) {
        const entries=[{id:'query',text:query},...calls.flatMap((call,ci)=>call.segments.map((s,si)=>({id:segmentKey(ci,si),text:s.text})))];
        const positions:PrivacyPosition[]=[];
        const collect=(prepared:ReturnType<typeof maskPrivacyEntries>)=>{
          for(const row of prepared.sourceBindings){
            for(const span of row.spans)positions.push({entryId:row.entryId,digest:row.digest,...span});
          }
        };
        // Validate trusted persisted sources BEFORE any provider I/O. A missing,
        // stale or incomplete binding cannot silently fall back to fresh NER.
        for(const [ci,call] of calls.entries())if(call.anonymizeBeforeLlm){
          collect(reuseTranscriptPrivacy(call.segments.map((s,si)=>({id:segmentKey(ci,si),text:s.text,ordinal:s.ordinal!})),call.privacyEvidence));
        }
        collect(await preparePrivateText([entries[0]],this.providers,{purpose:'search_query'}));
        const unprotected=calls.flatMap((call,ci)=>call.anonymizeBeforeLlm?[]:call.segments.map((s,si)=>({id:segmentKey(ci,si),text:s.text})));
        if(unprotected.length)collect(await preparePrivateText(unprotected,this.providers));
        // One alias space preserves query/name identity across candidates.
        privacy=maskPrivacyEntries(entries,{reviewedIds:entries.map(e=>e.id),uncertain:false,entities:[]},positions);
        const texts=new Map(privacy.entries.map(e=>[e.id,e.text]));
        cloudQuery=texts.get('query')!;
        if (!/\p{L}/u.test(cloudQuery.replace(/\[[A-Z_]+_\d+\]/gu, '')))
          throw new Error('CDR_GROUNDING_QUERY_REDACTED');
        cloudCalls=calls.map((call,ci)=>({...call,segments:call.segments.map((s,si)=>({...s,text:texts.get(segmentKey(ci,si))!}))}));
      }
      let matches = await groundCallCandidates(
        cloudQuery,
        cloudCalls,
        before.provider,
        token,
      );
      if(privacy) {
        const restored=matches.map(match=>{
          const ci=calls.findIndex(call=>call.callId===match.callId);
          return {...match,evidence:match.evidence.map(e=>{
            const si=calls[ci].segments.findIndex(s=>s.id===e.segmentId);
            return {...e,quote:privacy!.restoreQuote(segmentKey(ci,si),e.quote)};
          })};
        });
        matches=guardCallEvidence(query,calls,parseCallGroundingResponse(JSON.stringify({results:calls.map(call=>{
          const match=restored.find(m=>m.callId===call.callId);
          return {callId:call.callId,status:match?'supported':'insufficient',evidence:match?.evidence??[]};
        })}),calls)).matches;
      }
      const after = await this.current();
      if (before.revision !== after.revision)
        throw new Error("CDR_GROUNDING_PROVIDER_CHANGED");
      return {
        matches,
        ...(privacy && calls.some((call, ci) => privacyLimitsCallSearch(query,
          call.segments.map(s => s.text).join(' '), cloudCalls[ci].segments.map(s => s.text).join(' ')))
          ? { privacyLimited: true } : {}),
        providerUid: before.provider.uid,
        model: String(before.provider.defaults.model),
      };
    } finally {
      this.inFlight--;
    }
  }
}
