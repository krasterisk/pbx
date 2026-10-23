import { BadRequestException } from '@nestjs/common';
import type { TenantContext } from '../integration-credentials/tenant-context';
import type { SupportService } from './support.service';

const planId={type:'string',pattern:'^[a-f0-9]{64}$'};
const identity={proposal_id:planId,hash:planId};
const schema=(properties:Record<string,unknown>,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
export async function supportMcpTools(service:SupportService,ctx:TenantContext) {
  const cap=await service.capabilities(ctx);
  const changes=cap.operations.filter(o=>o.effect!=='read');
  const tools=cap.operations.filter(o=>o.effect==='read').map(o=>({name:o.tool,description:o.description,inputSchema:o.schema}));
  if(changes.length)tools.push({name:'support_propose',description:'Prepare an immutable change for separate exact approval. No PBX effect.',inputSchema:{type:'object',oneOf:changes.map(o=>schema({operation:{type:'string',enum:[o.id]},arguments:o.schema,request_id:{type:'string',pattern:'^[A-Za-z0-9_-]{12,80}$'}}))} as any});
  // Discovery is filtered by current grants; execution checks them again.
  for(const [name,scope,properties]of [
    ['support_apply','support:apply',identity],['support_reject','support:reject',identity],
    ['support_status','support:status',{proposal_id:planId}],['support_verify','support:status',{proposal_id:planId}],
  ] as const)if(cap.lifecycle_scopes.includes(scope))tools.push({name,description:name==='support_apply'?'Apply only the separately approved exact proposal hash.':'Access the owned proposal; verify never reapplies a change.',inputSchema:schema(properties)} as any);
  return tools;
}
export async function supportMcpCall(service:SupportService,ctx:TenantContext,name:string,args:Record<string,unknown>) {
  if(!args||typeof args!=='object'||Array.isArray(args))throw new BadRequestException('support_mcp_arguments_invalid');
  if(name==='support_propose')return service.propose(ctx,args);
  const handlers={support_apply:'apply',support_reject:'reject',support_status:'status',support_verify:'verify'} as const;
  if(Object.prototype.hasOwnProperty.call(handlers,name)){
    const method=handlers[name as keyof typeof handlers];const exact=['apply','reject'].includes(method);
    if(Object.keys(args).sort().join(',')!==(exact?'hash,proposal_id':'proposal_id')||typeof args.proposal_id!=='string'||!/^[a-f0-9]{64}$/.test(args.proposal_id)||(exact&&(typeof args.hash!=='string'||!/^[a-f0-9]{64}$/.test(args.hash))))throw new BadRequestException('support_mcp_identity_invalid');
    return exact?service[method as 'apply'|'reject'](ctx,args.proposal_id,args.hash as string):service[method as 'status'|'verify'](ctx,args.proposal_id);
  }
  // Calling update_route directly remains denied: it is not a support read.
  return service.read(ctx,name,args);
}

export function supportMcpError(error:any):Record<string,unknown> {
 const code=error?.getResponse?.()?.message;
 return {code:-32602,message:'Support operation refused',...(typeof code==='string'&&/^support_[a-z_]{1,80}$/.test(code)?{data:{code}}:{})};
}
