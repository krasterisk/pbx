import { DIALPLAN_ACTION_META, type ActionType } from '@krasterisk/shared';
import type { DialplanHost } from './types';

export function allowedTypesForHost(host: DialplanHost): ActionType[] {
  return (Object.keys(DIALPLAN_ACTION_META) as ActionType[]).filter((type) =>
    DIALPLAN_ACTION_META[type].allowedIn.includes(host),
  );
}
