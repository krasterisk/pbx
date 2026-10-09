import type {
  IDirectoryLookupParams,
  IRouteDirectoryBinding,
} from './types/directory.types';
import type { IRouteAction } from './types/route.types';
import { DIALPLAN_ACTION_META } from './types/dialplan-action-meta';
const uid = (value: unknown) =>
  (typeof value === 'number' ||
    (typeof value === 'string' && /^[0-9]+$/.test(value))) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const variable = (value: unknown) =>
  typeof value === 'string' &&
  /^[A-Z][A-Z0-9_]{1,63}$/.test(value) &&
  !value.startsWith('KRSK_') &&
  !['CALLERID', 'EXTEN', 'UNIQUEID'].includes(value);
export function directoryStepErrors(value: unknown): Record<string, string> {
  if (!object(value)) return { behavior: 'invalid' };
  const errors: Record<string, string> = {};
  if (!uid(value.directoryUid)) errors.directoryUid = 'required';
  const source = value.keySource;
  if (
    !object(source) ||
    ![
      'original_caller',
      'current_caller',
      'route_pattern',
      'fixed',
      'variable',
      'autodial_field',
    ].includes(String(source.source)) ||
    (source.source === 'fixed' && typeof source.value !== 'string') ||
    (['variable', 'autodial_field'].includes(String(source.source)) &&
      (typeof source.name !== 'string' ||
        !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(source.name)))
  )
    errors.keySource = 'required';
  const outputs = Array.isArray(value.outputs) ? value.outputs : [];
  const names = new Set<string>();
  if (
    !Array.isArray(value.outputs) ||
    outputs.some(
      (row) =>
        !object(row) ||
        !uid(row.fieldUid) ||
        !variable(row.targetVariable) ||
        names.has(String(row.targetVariable)) ||
        !names.add(String(row.targetVariable)),
    )
  )
    errors.outputs = 'invalid';
  if (!['keep', 'empty'].includes(String(value.onMissing)))
    errors.onMissing = 'invalid';
  if (value.behavior === undefined || value.behavior === '') return errors;
  if (!['on_match', 'on_no_match'].includes(String(value.matchMode)))
    errors.matchMode = 'required';
  if (
    ![
      'set_name',
      'set_number',
      'redirect',
      'drop',
      'map_fields',
      'custom',
    ].includes(String(value.behavior))
  )
    errors.behavior = 'invalid';
  if (value.behaviorParams !== undefined && !object(value.behaviorParams))
    errors.behavior = 'invalid';
  const params = object(value.behaviorParams) ? value.behaviorParams : {};
  const literal =
    value.behavior === 'redirect' ? params.fixedExten : params.fixed;
  if (['set_name', 'set_number', 'redirect'].includes(String(value.behavior))) {
    if (literal === undefined) {
      if (!uid(params.fieldUid)) errors.behavior = 'required';
    } else if (
      typeof literal !== 'string' ||
      !literal.length ||
      literal.length > 128 ||
      (value.behavior !== 'set_name' && !/^[+0-9*#]+$/.test(literal))
    )
      errors.behavior = 'invalid';
  }
  if (
    params.targetContext !== undefined &&
    (typeof params.targetContext !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,78}$/.test(params.targetContext) ||
      /^(__|dir_policy_|krsk-|krs_)/i.test(params.targetContext))
  )
    errors.behavior = 'invalid';
  if (
    value.behavior === 'map_fields' &&
    (!Array.isArray(params.mappings) ||
      !params.mappings.length ||
      params.mappings.some(
        (row) =>
          !object(row) || !uid(row.fieldUid) || !variable(row.targetVariable),
      ) ||
      new Set(params.mappings.map((row) => row.targetVariable)).size !==
        params.mappings.length)
  )
    errors.behavior = 'required';
  if (
    value.behavior === 'custom' &&
    (!Array.isArray(value.actions) ||
      value.actions.length > 200 ||
      value.actions.some(
        (action) =>
          !object(action) ||
          !object(action.params) ||
          !DIALPLAN_ACTION_META[
            String(action.type) as keyof typeof DIALPLAN_ACTION_META
          ]?.allowedIn.includes('directory_policy') ||
          (action.type === 'directory_lookup' &&
            action.params.behavior !== undefined),
      ))
  )
    errors.behavior = 'invalid';
  return errors;
}
/** Local, lossless conversion. Caller decides when to save and clear legacy bindings. */
export function directoryBindingsToSteps(
  bindings: IRouteDirectoryBinding[],
  existing: IRouteAction[] = [],
): IRouteAction[] {
  const ids = new Set(existing.map((action) => action.id));
  return [...bindings]
    .sort((a, b) => a.position - b.position)
    .map((binding, index) => {
      const base = 'directory_' + String(binding.uid ?? index);
      let id = base;
      let collision = 0;
      while (ids.has(id)) id = base + '_' + ++collision;
      ids.add(id);
      const params: IDirectoryLookupParams = {
        directoryUid: binding.directory_uid,
        keySource: structuredClone(binding.key_source),
        outputs: [],
        onMissing: 'keep',
        matchMode: binding.match_mode,
        behavior: binding.behavior_type,
        behaviorParams: structuredClone(binding.behavior_params ?? {}),
        actions: structuredClone(binding.actions ?? []),
      };
      return { id, type: 'directory_lookup', params, condition: {} };
    });
}
