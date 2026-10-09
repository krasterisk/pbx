import type { FieldSchema } from '../schema.types';
import { normalizeCallerIdParams } from '@krasterisk/shared';
import { CallerIdEditor } from '../../ui/CallerIdEditor/CallerIdEditor';
type TFn = (...args: [key:string] | [key:string,fallback:string])=>string;
export function buildCallerIdSchema(t:TFn):FieldSchema[] {
 return [{key:'callerIdV2',kind:'custom',group:'primary',hideLabel:true,labelKey:'routes.action.callerid',label:t('routes.action.callerid','Caller ID'),
 render:ctx=><CallerIdEditor params={ctx.params} onChange={ctx.onChange} readOnly={ctx.readOnly} tenantUid={ctx.tenantUid} />}];
}
export function summarizeCallerId(params:Record<string,unknown>,t:TFn):string {
 const normalized=normalizeCallerIdParams(params);
 const fields=['number','name'].filter(key=>normalized[key as 'number'|'name']);
 return t('routes.action.callerid','Caller ID')+': '+(fields.length?fields.map(key=>t('routes.apps.calleridV2.'+key+'Tab')).join(', '):t('routes.apps.calleridV2.current'));
}
