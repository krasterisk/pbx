import type {
  IDirectoryBehaviorParams,
  IRouteAction,
  IRouteDirectoryBinding,
} from '@krasterisk/shared';
import {
  compileDirectoryLookup,
  validateAction,
  type CompiledDirectoryLookup,
} from './directory-lookup-dialplan.util';
export type DirectoryPolicyInput = Omit<
  IRouteDirectoryBinding,
  'uid' | 'directory'
> & { uid: string | number };
export interface DirectoryPolicyCompileRequest {
  binding: DirectoryPolicyInput;
  directory: { uid: number; name?: string };
  vpbxUserUid: number;
  routeTenantedContext: string;
  backendBaseUrl: string;
  apiKey: string;
  contextName?: string;
  preserveExten?: boolean;
  sanitize: (value?: string) => string;
  render: (actions: IRouteAction[]) => string;
}
export interface GeneratedDialplanCategory {
  name: string;
  lines: string[];
}

function collectFieldUids(binding: DirectoryPolicyInput): number[] {
  const params: IDirectoryBehaviorParams = binding.behavior_params || {};
  if (binding.behavior_type === 'map_fields') {
    return (params.mappings ?? [])
      .map((m) => m.fieldUid)
      .filter((uid) => Number.isInteger(uid) && uid > 0);
  }
  if (
    (binding.behavior_type === 'set_name' ||
      binding.behavior_type === 'set_number' ||
      binding.behavior_type === 'redirect') &&
    Number.isInteger(params.fieldUid) &&
    (params.fieldUid as number) > 0
  ) {
    return [params.fieldUid as number];
  }
  return [];
}

function collectOutputs(binding: DirectoryPolicyInput) {
  if (binding.behavior_type !== 'map_fields') return undefined;
  return (binding.behavior_params?.mappings ?? []).filter(
    (m) => validateAction(m).length === 0,
  );
}

function pushApp(lines: string[], app: string): void {
  if (!app) return;
  lines.push(app.startsWith('same =>') ? app : `same => n,${app}`);
}

function generateBehaviorLines(
  binding: DirectoryPolicyInput,
  compiled: CompiledDirectoryLookup,
  vpbxUserUid: number,
  routeTenantedContext: string,
  req: DirectoryPolicyCompileRequest,
): string[] {
  const params: IDirectoryBehaviorParams = binding.behavior_params || {};

  switch (binding.behavior_type) {
    case 'set_name': {
      if (params.fixed) {
        return req.preserveExten
          ? [
              'Set(CALLERID(name)=${BASE64_DECODE(' +
                Buffer.from(params.fixed, 'utf8').toString('base64') +
                ')})',
            ]
          : ['Set(CALLERID(name)=' + req.sanitize(params.fixed) + ')'];
      }
      const valueVar = compiled.valueVars.get(params.fieldUid as number);
      if (!valueVar) return [];
      return [`Set(CALLERID(name)=\${${valueVar}})`];
    }
    case 'set_number': {
      if (params.fixed) {
        return [`Set(CALLERID(num)=${req.sanitize(params.fixed)})`];
      }
      const valueVar = compiled.valueVars.get(params.fieldUid as number);
      if (!valueVar) return [];
      return [`Set(CALLERID(num)=\${${valueVar}})`];
    }
    case 'drop':
      return ['Hangup()'];
    case 'redirect': {
      const rawContext = req.sanitize(params.targetContext);
      const ctx = rawContext
        ? req.preserveExten && !rawContext.endsWith(String(vpbxUserUid))
          ? rawContext + vpbxUserUid
          : rawContext
        : routeTenantedContext;
      if (params.fixedExten) {
        return [`Goto(${ctx},${req.sanitize(params.fixedExten)},1)`];
      }
      const valueVar = compiled.valueVars.get(params.fieldUid as number);
      if (!valueVar) return [];
      return [`Goto(${ctx},\${${valueVar}},1)`];
    }
    case 'map_fields':
      return [];
    case 'custom': {
      const actions: IRouteAction[] = binding.actions || [];
      const dp = req.render(actions);
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
export function compileDirectoryPolicy(
  req: DirectoryPolicyCompileRequest,
): GeneratedDialplanCategory {
  const { binding, directory, vpbxUserUid, routeTenantedContext } = req;
  const ctxName = req.contextName ?? `dir_policy_${binding.uid}_${vpbxUserUid}`;
  const compiled = compileDirectoryLookup({
    token: `P${binding.uid}`,
    directoryUid: directory.uid,
    userUid: vpbxUserUid,
    keySource: binding.key_source,
    fieldUids: collectFieldUids(binding),
    outputs: collectOutputs(binding),
    onMissing: 'keep',
    backendBaseUrl: req.backendBaseUrl,
    apiKey: req.apiKey,
  });

  const label = req.sanitize(directory.name) || String(directory.uid);
  const lines: string[] = [];
  const extraContexts: string[] = [];
  const behaviorLines = generateBehaviorLines(
    binding,
    compiled,
    vpbxUserUid,
    routeTenantedContext,
    req,
  );
  const extraIndex = behaviorLines.findIndex((line) => line.startsWith('['));
  if (extraIndex >= 0) extraContexts.push(...behaviorLines.splice(extraIndex));
  lines.push(`[${ctxName}]`);
  lines.push(
    `exten => ${req.preserveExten ? '_.' : 's'},1,NoOp(DIR policy ${binding.uid} / ${binding.behavior_type})`,
  );
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
    for (const app of behaviorLines) {
      pushApp(lines, app);
    }
  }
  lines.push('same => n,Return()');

  lines.push(`same => n(nomatch),NoOp(DIR ${label}: not found)`);
  if (binding.match_mode === 'on_no_match') {
    for (const app of behaviorLines) {
      pushApp(lines, app);
    }
  }
  lines.push('same => n,Return()');
  lines.push('same => n(done),Return()');

  if (req.preserveExten) {
    // User labels start with a letter; internal branch labels cannot collide.
    for (let i = 0; i < lines.length; i++)
      lines[i] = lines[i]
        .replace(/\?(found|nomatch|done)\)/g, '?_KRSK_DIR_$1)')
        .replace(/Goto\((found|nomatch|done)\)/g, 'Goto(_KRSK_DIR_$1)')
        .replace(/n\((found|nomatch|done)\)/g, 'n(_KRSK_DIR_$1)');
  }
  lines.push(...extraContexts);
  return { name: ctxName, lines };
}
