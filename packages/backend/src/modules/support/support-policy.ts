import { BadRequestException } from '@nestjs/common';
export const SUPPORT_READS = new Set([
  'list_endpoints', 'get_endpoint_configuration', 'list_contexts', 'list_routes',
  'describe_route_chain', 'get_compiled_dialplan', 'get_endpoint_registration',
  'get_queue_configuration', 'get_queue_runtime', 'list_queues', 'list_call_groups',
  'list_time_groups', 'evaluate_time_group', 'dialplan_dry_run',
  'list_voice_robots', 'describe_voice_robot', 'list_stt_engines', 'get_speech_diagnostics',
]);
export const SUPPORT_MUTATIONS = new Set(['update_route', 'create_time_group', 'update_time_group', 'speech_probe']);
export const SUPPORT_SCOPES = new Set([
  ...[...SUPPORT_READS].map(tool => `support:read:${tool}`),
  ...[...SUPPORT_MUTATIONS, 'propose_plan'].map(tool => `support:propose:${tool}`),
  'support:apply', 'support:reject', 'support:status',
]);
export function assertSupportArguments(value: unknown, depth = 0): void {
  if (depth > 12 || JSON.stringify(value).length > 20000) throw new BadRequestException('support_arguments_limit');
  if (Array.isArray(value)) { if (value.length > 100) throw new BadRequestException('support_arguments_limit'); for (const item of value) assertSupportArguments(item,depth+1); }
  else if (value && typeof value === 'object') {
    for (const [key,item] of Object.entries(value)) {
      if (/^(?:tenant.*|vpbx.*|user_uid|userUid|client_id|command|sql|argv|url|host|token|password|secret|authorization)$/i.test(key)) throw new BadRequestException('support_scope_argument_denied');
      assertSupportArguments(item,depth+1);
    }
  }
}


const SUPPORT_ROUTE_ACTIONS=new Set(['toexten','totrunk','toqueue','togroup','tolist','playback','hangup','toivr','toroute','schedule']);
/** Exact public grammar for discovery; native cmd is intentionally absent. */
export function supportRouteActionSchema():Record<string,unknown> {
 const common={id:{type:'string',pattern:'^[A-Za-z0-9_-]{1,80}$'},condition:{type:'object',additionalProperties:{},maxProperties:20},enabled:{type:'boolean'}};
 const action=(type:Record<string,unknown>,params:Record<string,unknown>)=>({type:'object',additionalProperties:false,required:['id','type','params'],properties:{...common,type,params}});
 return {oneOf:[
  action({type:'string',enum:['set_source']},{type:'object',additionalProperties:false,required:['value'],properties:{value:{type:'string',minLength:1,maxLength:160,description:'Literal source: letters, digits, spaces and ._+- only. No expressions.'}}}),
  action({type:'string',enum:[...SUPPORT_ROUTE_ACTIONS]},{type:'object',additionalProperties:{},maxProperties:30}),
 ]};
}
/** Public typed source assignment. Only the server emits the native command. */
export function normalizeSupportRouteChanges(args:any):any {
  assertSupportRouteChanges(args);
  if(args.actions===undefined)return args;
  return {...args,actions:args.actions.map((action:any)=>action.type==='set_source'
    ? {...action,type:'cmd',params:{command:'Set(__SOURCE='+action.params.value+')'}} : action)};
}
export function isSupportSourceAction(action:any):boolean {
  return action?.type==='cmd' && action.params && Object.keys(action.params).length===1
    && typeof action.params.command==='string'
    && /^Set\(__SOURCE=[\p{L}\p{N} ._+\-]{1,160}\)$/u.test(action.params.command);
}
/** No scripts, external requests or dynamic expressions through support. */
export function assertSupportRouteChanges(args:any):void {
  if(args.webhooks!==undefined)throw new BadRequestException('support_webhooks_require_owner');
  if(args.actions===undefined)return;
  if(!Array.isArray(args.actions)||args.actions.length>100)throw new BadRequestException('support_route_limit');
  const walk=(value:any)=>{
    if(typeof value==='string'&&(/[\r\n\0$(){}\[\]\\"';&?]/.test(value)||/^(?:\/|[A-Za-z]:[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value)||/\$\{|\b(?:System|SHELL|AGI|CURL)\s*\(/i.test(value)))throw new BadRequestException('support_dynamic_expression_denied');
    if(Array.isArray(value)){for(const item of value)walk(item);return;}
    if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
      if(/^(?:script|command|argv|sql|raw_dialplan|pre_command|path|url|uri|digitExitDest)$/i.test(key))throw new BadRequestException('support_executable_parameter_denied');walk(item);
    }
  };
  for(const action of args.actions){
    if(action?.type==='set_source'){
      if(!action.params||Object.keys(action.params).join(',')!=='value'||typeof action.params.value!=='string'||!action.params.value.trim()||!/^[\p{L}\p{N} ._+\-]{1,160}$/u.test(action.params.value))throw new BadRequestException('support_source_literal_invalid');
    }else if(!action||!SUPPORT_ROUTE_ACTIONS.has(action.type))throw new BadRequestException('support_route_action_requires_owner');
    if(Object.keys(action).some(k=>!['id','type','params','condition','enabled'].includes(k))||(action.id!==undefined&&(typeof action.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(action.id)))||!action.params||typeof action.params!=='object'||Array.isArray(action.params))throw new BadRequestException('support_route_step_invalid');
    if(action.type==='tolist'&&action.params.numbers!==undefined&&(typeof action.params.numbers!=='string'||!/^\s*[+*#0-9]+(?:\s*,\s*[+*#0-9]+)*\s*$/.test(action.params.numbers)))throw new BadRequestException('support_literal_numbers_required');
    if(action.condition?.source==='device_state'||action.condition?.device!==undefined)throw new BadRequestException('support_device_condition_requires_typed_tool');
    const fixed=(value:any):void=>{if(!value||typeof value!=='object')return;if(value.source!==undefined&&value.source!=='fixed')throw new BadRequestException('support_dynamic_target_denied');for(const child of Object.values(value))fixed(child);};
    fixed(action.params);walk(action);
  }
}

export function redactSupportRead(value:any):any {
  if(isSupportSourceAction(value))return redactSupportRead({...value,type:'set_source',params:{value:value.params.command.slice(13,-1)}});
  if(typeof value==='string'){try{const text=value.trim();if(text.startsWith('{')||text.startsWith('['))return JSON.stringify(redactSupportRead(JSON.parse(text)));}catch{}return value.split(/\r?\n/).slice(0,500).map(line=>/System\(|SHELL\(|AGI\(|Stasis\(|CURL\(|authorization|bearer |password|secret|api[_-]?key|token\s*[=:]/i.test(line)?'[external or secret-bearing step: redacted]':line.slice(0,1000)).join('\n');}
  if(Array.isArray(value))return value.slice(0,200).map(redactSupportRead);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,/pass(word)?|secret|api[_-]?key|token|authorization|credential|private[_-]?key/i.test(key)?'[REDACTED]':redactSupportRead(child)]));
  return value;
}
