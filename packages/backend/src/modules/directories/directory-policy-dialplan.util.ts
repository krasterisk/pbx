import type { IDirectoryBehaviorParams, IRouteAction } from '@krasterisk/shared';
import { AsteriskDialplanUtils, renderActionChain } from '../../shared/utils/dialplan.util';
import {
  compileDirectoryLookup,
  validateAction,
  type CompiledDirectoryLookup,
} from '../../shared/utils/directory-lookup-dialplan.util';
import type { RouteDirectoryBinding } from './route-directory-binding.model';

export interface GeneratedDialplanCategory {
  name: string;
  lines: string[];
}

function collectFieldUids(binding: RouteDirectoryBinding): number[] {
  const params: IDirectoryBehaviorParams = binding.behavior_params || {};
  if (binding.behavior_type === 'map_fields') {
    return (params.mappings ?? [])
      .map((m) => m.fieldUid)
      .filter((uid) => Number.isInteger(uid) && uid > 0);
  }
  if (
    (binding.behavior_type === 'set_name'
      || binding.behavior_type === 'set_number'
      || binding.behavior_type === 'redirect')
    && Number.isInteger(params.fieldUid)
    && (params.fieldUid as number) > 0
  ) {
    return [params.fieldUid as number];
  }
  return [];
}

function collectOutputs(binding: RouteDirectoryBinding) {
  if (binding.behavior_type !== 'map_fields') return undefined;
  return (binding.behavior_params?.mappings ?? []).filter((m) => validateAction(m).length === 0);
}

function pushApp(lines: string[], app: string): void {
  if (!app) return;
  lines.push(app.startsWith('same =>') ? app : `same => n,${app}`);
}

function generateBehaviorLines(
  binding: RouteDirectoryBinding,
  compiled: CompiledDirectoryLookup,
  vpbxUserUid: number,
  routeTenantedContext: string,
  isAdmin: boolean,
): string[] {
  const params: IDirectoryBehaviorParams = binding.behavior_params || {};

  switch (binding.behavior_type) {
    case 'set_name': {
      if (params.fixed) {
        return [`Set(CALLERID(name)=${AsteriskDialplanUtils.sanitizeDialplanInput(params.fixed)})`];
      }
      const valueVar = compiled.valueVars.get(params.fieldUid as number);
      if (!valueVar) return [];
      return [`Set(CALLERID(name)=\${${valueVar}})`];
    }
    case 'set_number': {
      if (params.fixed) {
        return [`Set(CALLERID(num)=${AsteriskDialplanUtils.sanitizeDialplanInput(params.fixed)})`];
      }
      const valueVar = compiled.valueVars.get(params.fieldUid as number);
      if (!valueVar) return [];
      return [`Set(CALLERID(num)=\${${valueVar}})`];
    }
    case 'drop':
      return ['Hangup()'];
    case 'redirect': {
      const ctx = AsteriskDialplanUtils.sanitizeDialplanInput(params.targetContext) || routeTenantedContext;
      if (params.fixedExten) {
        return [`Goto(${ctx},${AsteriskDialplanUtils.sanitizeDialplanInput(params.fixedExten)},1)`];
      }
      const valueVar = compiled.valueVars.get(params.fieldUid as number);
      if (!valueVar) return [];
      return [`Goto(${ctx},\${${valueVar}},1)`];
    }
    case 'map_fields':
      return [];
    case 'custom': {
      const actions: IRouteAction[] = binding.actions || [];
      const dp = renderActionChain(actions, { vpbxUserUid, host: 'route', isAdmin });
      return dp ? dp.split('\n') : [];
    }
    default:
      return [];
  }
}

/**
 * Generate the Asterisk sub-context for one route directory policy.
 * Category: `dir_policy_{binding.uid}_{vpbxUserUid}`.
 * Lookup lines come only from DirectoryLookupCompiler.
 * ERROR is fail-open; on_no_match runs only on literal NOT_FOUND.
 */
export function generatePolicyDialplan(
  binding: RouteDirectoryBinding,
  directory: { uid: number; name?: string },
  vpbxUserUid: number,
  routeTenantedContext: string,
  isAdmin: boolean,
): GeneratedDialplanCategory {
  const ctxName = `dir_policy_${binding.uid}_${vpbxUserUid}`;
  const compiled = compileDirectoryLookup({
    token: `P${binding.uid}`,
    directoryUid: directory.uid,
    userUid: vpbxUserUid,
    keySource: binding.key_source,
    fieldUids: collectFieldUids(binding),
    outputs: collectOutputs(binding),
    onMissing: 'keep',
    backendBaseUrl: AsteriskDialplanUtils.backendBaseUrl,
    apiKey: AsteriskDialplanUtils.dialplanApiKey,
  });

  const label = directory.name || String(directory.uid);
  const lines: string[] = [];
  lines.push(`[${ctxName}]`);
  lines.push(`exten => s,1,NoOp(DIR policy ${binding.uid}: ${label} / ${binding.behavior_type})`);
  for (const app of compiled.lines) {
    pushApp(lines, app);
  }

  const status = compiled.statusVar;
  lines.push(`same => n,GotoIf($["\${${status}}" = "ERROR"]?done)`);
  lines.push(`same => n,GotoIf($["\${${status}}" = "FOUND"]?found)`);
  lines.push(`same => n,GotoIf($["\${${status}}" = "NOT_FOUND"]?nomatch)`);
  lines.push('same => n,Goto(done)');

  lines.push(`same => n(found),NoOp(DIR ${label}: found)`);
  if (binding.match_mode !== 'on_no_match') {
    for (const app of generateBehaviorLines(binding, compiled, vpbxUserUid, routeTenantedContext, isAdmin)) {
      pushApp(lines, app);
    }
  }
  lines.push('same => n,Return()');

  lines.push(`same => n(nomatch),NoOp(DIR ${label}: not found)`);
  if (binding.match_mode === 'on_no_match') {
    for (const app of generateBehaviorLines(binding, compiled, vpbxUserUid, routeTenantedContext, isAdmin)) {
      pushApp(lines, app);
    }
  }
  lines.push('same => n,Return()');
  lines.push('same => n(done),Return()');

  return { name: ctxName, lines };
}
