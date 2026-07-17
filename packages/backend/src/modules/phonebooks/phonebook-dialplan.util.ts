import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import type { IRouteAction } from '@krasterisk/shared';
import { normalizePhonebookBehaviorType } from '@krasterisk/shared';
import { PhonebookEntry } from './phonebook-entry.model';
import { RoutePhonebook } from './phonebook.model';
import { RoutePhonebookBinding } from './route-phonebook-binding.model';

export interface GeneratedDialplanCategory {
  name: string;
  lines: string[];
}

/**
 * Collect all unique var keys from all entries in a phonebook.
 * Used at dialplan generation time to know which CUT() positions to generate —
 * keys are sorted so CUT() positions stay deterministic (Pitfall 6).
 */
export function collectAllVarKeys(entries: Array<Pick<PhonebookEntry, 'vars'>>): string[] {
  const keys = new Set<string>();
  for (const entry of entries) {
    if (entry.vars) Object.keys(entry.vars).forEach((k) => keys.add(k));
  }
  return Array.from(keys).sort();
}

/**
 * Generate the Asterisk dialplan sub-context for a single route<->phonebook binding (D-06, D-17).
 *
 * Category: `pb_bind_{binding.uid}_{vpbxUserUid}`, file: `krasterisk/phonebooks/pb_{vpbxUserUid}.conf`.
 *
 * Pattern (05-RESEARCH.md §1):
 *   [pb_bind_{uid}_{vpbx}]
 *   exten => s,1,NoOp(...)
 *   same => n,Set(PB_RAW=${CURL(...)})               ; single lookup request
 *   same => n,GotoIf($["${PB_RAW}" = ""]?nomatch)     ; graceful fallback if backend unreachable
 *   same => n,Set(PB_MATCH=${CUT(PB_RAW,|,1)})
 *   same => n,GotoIf($["${PB_MATCH}" = "1"]?act:nomatch)  ; on_no_match swaps act/nomatch (D-24)
 *   same => n(act),NoOp(...)
 *   same => n,Set(PB_<key>=${CUT(PB_RAW,|,N)})        ; union var keys — only in the on_match branch
 *   ...behavior lines (preset or custom actions)...
 *   same => n,Return()
 *   same => n(nomatch),Return()
 */
export function generateBindingDialplan(
  binding: RoutePhonebookBinding,
  phonebook: RoutePhonebook,
  vpbxUserUid: number,
  routeTenantedContext: string,
  isAdmin: boolean,
): GeneratedDialplanCategory {
  const lines: string[] = [];
  const ctxName = `pb_bind_${binding.uid}_${vpbxUserUid}`;
  const baseUrl = AsteriskDialplanUtils.backendBaseUrl;
  const apiKey = AsteriskDialplanUtils.dialplanApiKey;
  const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
  const onNoMatch = binding.match_mode === 'on_no_match';

  lines.push(`[${ctxName}]`);
  lines.push(`exten => s,1,NoOp(PB binding ${binding.uid}: ${phonebook.name} / ${binding.behavior_type})`);

  const lookupUrl = `${baseUrl}/internal/dialplan/phonebook-lookup?phonebook_uid=${phonebook.uid}${keyParam}`;
  lines.push(`same => n,Set(PB_RAW=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})`);
  lines.push('same => n,GotoIf($["${PB_RAW}" = ""]?nomatch)');
  lines.push('same => n,Set(PB_MATCH=${CUT(PB_RAW,|,1)})');

  // on_match: act when PB_MATCH=1. on_no_match: act when PB_MATCH!=1 (D-24).
  const trueLabel = onNoMatch ? 'nomatch' : 'act';
  const falseLabel = onNoMatch ? 'act' : 'nomatch';
  lines.push(`same => n,GotoIf($["\${PB_MATCH}" = "1"]?${trueLabel}:${falseLabel})`);

  lines.push(`same => n(act),NoOp(PB ${phonebook.name}: acting)`);

  // Vars only meaningful in the actual-match branch — on_no_match's "act" branch
  // fires on non-match, where PB_RAW carries no entry data to CUT() from.
  if (!onNoMatch) {
    const allKeys = collectAllVarKeys(phonebook.entries || []);
    allKeys.forEach((key, index) => {
      const cutPos = index * 2 + 3; // response format: 1|key1|val1|key2|val2|...
      lines.push(`same => n,Set(PB_${key}=\${CUT(PB_RAW,|,${cutPos})})`);
    });
  }

  generateBehaviorLines(binding, vpbxUserUid, routeTenantedContext, isAdmin)
    .forEach((l) => lines.push(`same => n,${l}`));

  lines.push('same => n,Return()');
  lines.push('same => n(nomatch),Return()');

  return { name: ctxName, lines };
}

/** Behavior preset table — 05-RESEARCH.md §1. */
function generateBehaviorLines(
  binding: RoutePhonebookBinding,
  vpbxUserUid: number,
  routeTenantedContext: string,
  isAdmin: boolean,
): string[] {
  const params: Record<string, any> = binding.behavior_params || {};

  switch (normalizePhonebookBehaviorType(binding.behavior_type)) {
    case 'set_name': {
      // Fixed variant (D-24): the only set_name flavor kept available when
      // match_mode=on_no_match, since no PB_* vars exist to read a var_key from.
      if (params.fixed) {
        const fixed = AsteriskDialplanUtils.sanitizeDialplanInput(params.fixed);
        return [`Set(CALLERID(name)=${fixed})`];
      }
      // No hardcoded key-name convention: var_key must be chosen explicitly in
      // the UI (from real entry vars). Without it there is nothing to read —
      // emit no action rather than referencing a variable that may not exist.
      const varKey = AsteriskDialplanUtils.sanitizeDialplanInput(params.var_key);
      if (!varKey) return [];
      return [`ExecIf($["\${PB_${varKey}}" != ""]?Set(CALLERID(name)=\${PB_${varKey}}))`];
    }
    case 'set_number': {
      if (params.fixed) {
        const fixed = AsteriskDialplanUtils.sanitizeDialplanInput(params.fixed);
        return [`Set(CALLERID(num)=${fixed})`];
      }
      const varKey = AsteriskDialplanUtils.sanitizeDialplanInput(params.var_key);
      if (!varKey) return [];
      return [`ExecIf($["\${PB_${varKey}}" != ""]?Set(CALLERID(num)=\${PB_${varKey}}))`];
    }
    case 'drop':
      return ['Hangup()'];
    case 'redirect': {
      const ctx = AsteriskDialplanUtils.sanitizeDialplanInput(params.target_context) || routeTenantedContext;
      if (params.fixed_exten) {
        const fixedExten = AsteriskDialplanUtils.sanitizeDialplanInput(params.fixed_exten);
        return [`Goto(${ctx},${fixedExten},1)`];
      }
      const varKey = AsteriskDialplanUtils.sanitizeDialplanInput(params.var_key);
      if (!varKey) return [];
      return [`ExecIf($["\${PB_${varKey}}" != ""]?Goto(${ctx},\${PB_${varKey}},1))`];
    }
    case 'vars_only':
      return [];
    case 'custom': {
      const actions: IRouteAction[] = binding.actions || [];
      const out: string[] = [];
      for (const action of actions) {
        const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, isAdmin);
        if (dp) out.push(dp);
      }
      return out;
    }
    default:
      return [];
  }
}
