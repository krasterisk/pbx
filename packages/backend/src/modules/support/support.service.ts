import { QueryTypes } from 'sequelize';
import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { IntegrationPrincipal, IntegrationGrant } from '../integration-credentials/integration-credential.models';
import { ProductResourceResolverRegistry } from '../integration-credentials/product-resource.authorization';
import type { TenantContext } from '../integration-credentials/tenant-context';
import { User, UserLevel } from '../users/user.model';
import { PbxWorkflowRunnerService } from '../ai-chat/pbx-workflow-runner.service';
import { PbxWorkflowCompilerService, type DeclarativeWorkflowStep } from '../ai-chat/pbx-workflow-compiler.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { redactSecrets } from '../ai-platform/ai-secret-redaction';
import { SupportPlan } from './support-plan.model';
import { SUPPORT_READS, SUPPORT_MUTATIONS, assertSupportArguments, assertSupportRouteChanges, normalizeSupportRouteChanges, supportRouteActionSchema, redactSupportRead } from './support-policy';
import { SupportRuntimeVerifier } from './support-runtime-verifier';

function stable(value:unknown):unknown { return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value; }
function hash(value:unknown):string { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
const ID=/^[a-f0-9]{64}$/;
@Injectable()
export class SupportService implements OnModuleInit {
  constructor(
    @InjectModel(IntegrationPrincipal) private readonly principals:typeof IntegrationPrincipal,
    @InjectModel(IntegrationGrant) private readonly grants:typeof IntegrationGrant,
    @InjectModel(User) private readonly users:typeof User,
    @InjectModel(SupportPlan) private readonly plans:typeof SupportPlan,
    private readonly db:Sequelize, private readonly mcp:McpToolsService,
    private readonly workflows:PbxWorkflowRunnerService, private readonly compiler:PbxWorkflowCompilerService,
    private readonly registry:AiAdapterRegistryService, private readonly resources:ProductResourceResolverRegistry,
    private readonly verifier:SupportRuntimeVerifier,
  ) {}
  onModuleInit():void {
    this.resources.register({product:'pbx_support',resourceKind:'pbx',
      findForTenant:(tenant,id)=>this.principals.findOne({where:{id,tenant_uid:tenant,product:'pbx_support',status:'active'}}),
      canAct:async (ctx,action,resource)=>{
        if(ctx.principalKind==='user'){const id=Number(ctx.principalId.replace(/^user:/,''));const u=await this.users.findOne({where:{uniqueid:id,vpbx_user_uid:ctx.tenantUid,level:UserLevel.ADMIN}});return !!u&&(!u.activationCode||!!u.isActivated);}
        const p=resource as IntegrationPrincipal;if(p.id!==ctx.principalId||String(p.permission_revision)!==ctx.permissionRevision)return false;
        return !!await this.grants.findOne({where:{principal_id:p.id,tenant_uid:ctx.tenantUid,resource_kind:'pbx',resource_id:p.id,scope:action}});
      },
    });
  }
  private async identity(ctx:TenantContext) {
    if(ctx.principalKind!=='integration')throw new ForbiddenException('support_integration_key_required');
    const p=await this.principals.findOne({where:{id:ctx.principalId,tenant_uid:ctx.tenantUid,product:'pbx_support',status:'active'}});
    if(!p||String(p.permission_revision)!==ctx.permissionRevision)throw new ForbiddenException('support_permissions_changed');
    const user=await this.users.findOne({where:{uniqueid:p.created_by,vpbx_user_uid:ctx.tenantUid,level:UserLevel.ADMIN}});
    if(!user||(!user.isActivated&&!!user.activationCode))throw new ForbiddenException('support_owner_inactive');
    const rows=await this.grants.findAll({where:{principal_id:p.id,tenant_uid:ctx.tenantUid,resource_kind:'pbx',resource_id:p.id},limit:100});
    return {p,scopes:new Set(rows.map(r=>r.scope)),actor:{vpbxUserUid:ctx.tenantUid,userUid:user.uniqueid,role:user.level,threadUid:0}};
  }
  private require(scopes:Set<string>,scope:string):void {if(!scopes.has(scope))throw new ForbiddenException('support_tool_not_granted');}
  async capabilities(ctx:TenantContext) {
    const {scopes}=await this.identity(ctx);
    const tools=this.mcp.getToolsList(ctx.tenantUid).map(t=>{
      if(t.name==='update_route'){
        const schema=JSON.parse(JSON.stringify(t.inputSchema));delete schema.properties?.webhooks;schema.properties={...schema.properties,actions:{type:'array',minItems:1,maxItems:100,items:supportRouteActionSchema()}};
        return {...t,inputSchema:schema};
      }
      if(!['create_time_group','update_time_group'].includes(t.name)||!t.inputSchema.properties?.intervals?.items)return t;
      const schema=JSON.parse(JSON.stringify(t.inputSchema));const item=schema.properties.intervals.items;item.required=[...new Set([...(item.required??[]),'days_of_week','timezone'])];return {...t,inputSchema:schema};
    });
    for(const t of tools)if(t.name==='update_route')t.description+=' Support: actions may be inserted, edited, removed or reordered; type set_source uses params {value: literal source name}, never command. Native tenant target validation and exact approval are required.';
    const operations=tools.filter(t=>SUPPORT_READS.has(t.name)&&scopes.has('support:read:'+t.name)||SUPPORT_MUTATIONS.has(t.name)&&scopes.has('support:propose:'+t.name)).map(t=>({id:t.name,tool:t.name,description:t.description,effect:t.name==='speech_probe'?'paid_probe':SUPPORT_READS.has(t.name)?'read':'propose',schema:t.inputSchema}));
    if(scopes.has('support:propose:propose_plan')) {
      const choices=tools.filter(t=>SUPPORT_MUTATIONS.has(t.name)&&scopes.has('support:propose:'+t.name)).map(t=>({type:'object',additionalProperties:false,required:['id','tool','args'],properties:{id:{type:'string',maxLength:64},tool:{type:'string',enum:[t.name]},args:t.inputSchema,dependsOn:{type:'array',items:{type:'string',maxLength:64},maxItems:20},label:{type:'string',maxLength:200}}}));
      if(choices.length)operations.push({id:'propose_plan',tool:'propose_plan',description:'Один согласуемый план зависимых изменений',effect:'propose',schema:{type:'object',additionalProperties:false,required:['title','steps'],properties:{title:{type:'string',maxLength:200},steps:{type:'array',minItems:1,maxItems:20,items:{oneOf:choices}}}}});
    }
    // Only registered tools with explicit per-tool grants enter discovery.
    return {product:'krasterisk_v4',version:'support-1.1.0',limitations:['typed route steps and literal set_source are supported; scripts, webhooks and raw dialplan are unavailable through support'],tenant_id:ctx.tenantUid,permission_revision:ctx.permissionRevision,lifecycle_scopes:[...scopes].filter(s=>['support:apply','support:reject','support:status'].includes(s)).sort(),operations};
  }
  async read(ctx:TenantContext,tool:string,args:Record<string,unknown>) {
    const {scopes,actor}=await this.identity(ctx);
    if(!SUPPORT_READS.has(tool))throw new ForbiddenException('support_read_tool_denied');this.require(scopes,'support:read:'+tool);
    assertSupportArguments(args);
    const parts=await this.mcp.callTool(tool,args,ctx.tenantUid,actor);
    const values=parts.map(part=>{
      if(part.type!=='text'||typeof part.text!=='string'||part.text.startsWith('Ошибка:'))throw new ConflictException('support_read_unavailable');
      try{return JSON.parse(part.text);}catch{return part.text;}
    });
    if(values.some(value=>value&&typeof value==='object'&&(value.refused===true||value.status==='refused')))throw new ConflictException('support_read_unavailable');
    return {tenant_id:ctx.tenantUid,data:redactSupportRead(values.length===1?values[0]:values),as_of:new Date().toISOString()};
  }
  private steps(body:Record<string,unknown>,scopes:Set<string>):{title:string;steps:DeclarativeWorkflowStep[]} {
    if(Object.keys(body).sort().join(',')!=='arguments,operation,request_id'||typeof body.operation!=='string'||!body.arguments||typeof body.arguments!=='object')throw new BadRequestException('support_proposal_invalid');
    assertSupportArguments(body.arguments);
    const args=JSON.parse(JSON.stringify(body.arguments)) as Record<string,unknown>;
    const draft=body.operation==='propose_plan'?args:{title:body.operation,steps:[{id:'change',tool:body.operation,args}]};
    if(body.operation==='propose_plan')this.require(scopes,'support:propose:propose_plan');
    if(typeof draft.title!=='string'||draft.title.length>200||!Array.isArray(draft.steps)||!draft.steps.length||draft.steps.length>20)throw new BadRequestException('support_plan_limit');
    for(const step of draft.steps){if(!step||typeof step!=='object'||!SUPPORT_MUTATIONS.has(step.tool))throw new ForbiddenException('support_plan_tool_denied');this.require(scopes,'support:propose:'+step.tool);
      if(step.tool==='update_route')step.args=normalizeSupportRouteChanges(step.args);
      if(['create_time_group','update_time_group'].includes(step.tool)&&step.args?.intervals){
        if(!Array.isArray(step.args.intervals)||step.args.intervals.some((i:any)=>!i||typeof i.days_of_week!=='string'||!i.days_of_week||typeof i.timezone!=='string'||!i.timezone))throw new BadRequestException('support_schedule_days_timezone_required');
      }
    }
    return draft as {title:string;steps:DeclarativeWorkflowStep[]};
  }
  private async compile(draft:{title:string;steps:DeclarativeWorkflowStep[]},actor:any) {
    try{return await this.compiler.compile(draft,actor);}catch{throw new ConflictException('support_plan_validation_failed');}
  }
  private async validateCalendars(steps:DeclarativeWorkflowStep[],tenant:number):Promise<void> {
    for(const step of steps)if(step.tool==='update_time_group'&&step.args.intervals!==undefined){
      const consumers=await this.verifier.calendarConsumers(Number(step.args.uid),tenant);
      for(const uid of consumers)if(!steps.some(other=>other.tool==='update_route'&&Number(other.args.id)===uid&&other.dependsOn?.includes(step.id)))throw new ConflictException('support_calendar_consumers_need_regeneration');
    }
    for(const step of steps)if(step.tool==='update_route')await this.verifier.assertRouteParameters(step.args,tenant);
    for(const [index,step] of steps.entries())if(step.tool==='update_route'){
      const walk=async(value:any):Promise<void>=>{
        if(!value||typeof value!=='object')return;
        if(Object.prototype.hasOwnProperty.call(value,'time_group_uid')){
          const uid=value.time_group_uid;
          if(Number.isSafeInteger(uid)&&uid>0)await this.verifier.assertCalendarScope(uid,tenant);
          else if(typeof uid==='string'){
            const ref=/^steps\.([A-Za-z0-9_-]+)\.result\.uid$/.exec(uid);
            const parent=ref&&steps.slice(0,index).find(s=>s.id===ref[1]&&s.tool==='create_time_group');
            if(!parent||!step.dependsOn?.includes(parent.id))throw new BadRequestException('support_calendar_dependency_invalid');
          }else throw new BadRequestException('support_calendar_reference_invalid');
        }
        for(const child of Object.values(value))if(Array.isArray(child)){for(const item of child)await walk(item);}else await walk(child);
      };await walk(step.args.actions);
    }
  }
  async propose(ctx:TenantContext,body:Record<string,unknown>) {
    const {scopes,actor}=await this.identity(ctx);const draft=this.steps(body,scopes);await this.validateCalendars(draft.steps,ctx.tenantUid);
    if(typeof body.request_id!=='string'||!/^[A-Za-z0-9_-]{12,80}$/.test(body.request_id))throw new BadRequestException('support_request_id_invalid');
    const id=hash([ctx.tenantUid,ctx.principalId,body.request_id]);
    const compiled=await this.compile(draft,actor);
    if(compiled.steps.some(step=>step.requiresSecureInput))throw new ForbiddenException('support_secure_input_not_supported');
    const stateHash=hash([draft,compiled.steps,ctx.permissionRevision]);
    return this.db.transaction(async tx=>{
      const [row,created]=await this.plans.findOrCreate({where:{id,tenant_uid:ctx.tenantUid,principal_id:ctx.principalId},defaults:{id,tenant_uid:ctx.tenantUid,principal_id:ctx.principalId,permission_revision:ctx.permissionRevision,draft:{...draft,operation:body.operation,compiled:compiled.steps},view_json:{},approval_hash:stateHash,status:'preparing',expires_at:new Date(Date.now()+86400000),updated_at:new Date()},transaction:tx});
      if(!created){if(hash((row.draft as any).steps)!==hash(draft.steps))throw new ConflictException('support_request_conflict');return this.view(row);}
      const workflow=await this.workflows.createFromCompiled(compiled,actor);
      await row.update({workflow_id:workflow.workflowId,view_json:redactSecrets(workflow),status:'pending',updated_at:new Date()},{transaction:tx});
      return this.view(row);
    });
  }
  private async owned(ctx:TenantContext,id:string) {
    if(!ID.test(id))throw new NotFoundException('support_plan_not_found');
    const row=await this.plans.findOne({where:{id,tenant_uid:ctx.tenantUid,principal_id:ctx.principalId}});
    if(!row)throw new NotFoundException('support_plan_not_found');return row;
  }
  private view(row:SupportPlan) {
    const v=row.view_json as any;
    return {proposal_id:row.id,hash:row.approval_hash,tenant_id:row.tenant_uid,status:row.status,expires_at:new Date(row.expires_at).toISOString(),summary:v.summary??[],changes:((row.draft as any).steps??[]).map((s:any)=>({step:s.id,tool:s.tool,arguments:redactSecrets(s.args)})),steps:(v.steps??[]).map((s:any)=>({tool:s.tool,label:s.entityLabel,status:s.status,requires_secure_input:s.requiresSecureInput})),diagnostics:v.diagnostics??[],execution:(v.steps??[]).map((s:any)=>({step:s.stepKey,status:s.status}))};
  }
  async status(ctx:TenantContext,id:string) {const {scopes}=await this.identity(ctx);this.require(scopes,'support:status');return this.view(await this.owned(ctx,id));}
  async reject(ctx:TenantContext,id:string,approvalHash:string) {
    const {scopes,actor}=await this.identity(ctx);this.require(scopes,'support:reject');const row=await this.owned(ctx,id);
    if(row.approval_hash!==approvalHash||row.status!=='pending')throw new ConflictException('support_plan_stale');
    const [claimed]=await this.plans.update({status:'rejected',updated_at:new Date()},{where:{id,status:'pending',approval_hash:approvalHash}});
    if(!claimed)throw new ConflictException('support_plan_stale');await this.workflows.reject(row.workflow_id!,actor);return this.view(await row.reload());
  }
  async apply(ctx:TenantContext,id:string,approvalHash:string) {
    const {scopes,actor}=await this.identity(ctx);this.require(scopes,'support:apply');const row=await this.owned(ctx,id);
    if(row.approval_hash!==approvalHash)throw new ConflictException('support_plan_stale');
    if(row.status==='verified')return this.view(row);
    if(row.status!=='pending'||row.permission_revision!==ctx.permissionRevision||new Date(row.expires_at).getTime()<=Date.now())throw new ConflictException('support_plan_not_pending');
    const draft=row.draft as any;
    if(draft.operation==='propose_plan')this.require(scopes,'support:propose:propose_plan');
    for(const step of draft.steps)this.require(scopes,'support:propose:'+step.tool);
    await this.validateCalendars(draft.steps,ctx.tenantUid);
    const latest=await this.compile({title:draft.title,steps:draft.steps},actor);
    if(hash(latest.steps)!==hash(draft.compiled))throw new ConflictException('support_configuration_changed');
    const [claimed]=await this.plans.update({status:'executing',updated_at:new Date()},{where:{id,status:'pending',approval_hash:approvalHash}});
    if(!claimed)throw new ConflictException('support_plan_stale');
    try {
      const result=await this.workflows.apply(row.workflow_id!,actor);
      // The generic domain runner provides DB/generation/reload evidence. Runtime
      // reconciliation is separate; applied is deliberately not called verified.
      await row.update({status:JSON.stringify(result).includes('speech_probe_result_unknown')?'uncertain':result.status==='applied'?'partial':result.status==='failed'?'partial':'uncertain',view_json:redactSecrets(result),updated_at:new Date()});
      return this.verify(ctx,id);
    }catch {await row.update({status:'uncertain',updated_at:new Date()});return this.view(row);}
  }
  async verify(ctx:TenantContext,id:string) {
    const {scopes,actor}=await this.identity(ctx);this.require(scopes,'support:status');const row=await this.owned(ctx,id);
    if(!row.workflow_id||!['executing','partial','uncertain','verified'].includes(row.status))return this.view(row);
    const workflow=await this.workflows.getOwned(row.workflow_id,actor);
    // Reconciliation never invokes Apply or retries a failed workflow.
    const evidence=await this.verifyEntities(ctx,row,workflow.status);
    await row.update({view_json:{...redactSecrets(workflow),diagnostics:evidence.diagnostics},status:evidence.valid?'verified':workflow.status==='failed'&&row.status!=='uncertain'?'partial':row.status,updated_at:new Date()});return this.view(row);
  }
  private async verifyEntities(ctx:TenantContext,row:SupportPlan,status:string):Promise<{valid:boolean;diagnostics:Record<string,unknown>[]}> {
    if(status!=='applied')return {valid:false,diagnostics:[]};
    const draft=row.draft as any;
    const rows=await this.db.query<{step_key:string;result_json:Record<string,unknown>}>('SELECT s.step_key,s.result_json FROM ai_agent_workflow_steps s JOIN ai_agent_workflows w ON w.uid=s.workflow_uid WHERE w.workflow_id=:workflow AND w.vpbx_user_uid=:tenant AND w.user_uid=:actor',{replacements:{workflow:row.workflow_id,tenant:ctx.tenantUid,actor:(await this.identity(ctx)).actor.userUid},type:QueryTypes.SELECT});
    const results=new Map(rows.map(r=>[r.step_key,typeof r.result_json==='string'?JSON.parse(r.result_json):r.result_json]));
    const diagnostics:Record<string,unknown>[]=[];
    for(const step of draft.compiled??[]){
      const tool=this.registry.getMutationTool(step.tool);
      if(!tool||tool.mutation.schemaVersion!==step.schemaVersion)return {valid:false,diagnostics:[]};
      // Explicit adapter verification is mandatory; a reload ACK alone is insufficient.
      if(step.tool==='speech_probe'){
        const evidence=results.get(step.stepKey)?.probe as any;
        if(!evidence?.completed||evidence.pipelineHash!==step.canonicalArgs.expected_hash||evidence.audioSeconds!==1)return {valid:false,diagnostics:[]};
        diagnostics.push({tool:'speech_probe',completed:true,responseObserved:!!evidence.responseObserved,recognitionObserved:!!evidence.recognitionObserved,errorCode:typeof evidence.errorCode==='number'?evidence.errorCode:null,errorProtocol:['http','grpc'].includes(evidence.errorProtocol)?evidence.errorProtocol:null,latencyMs:Number(evidence.latencyMs),audioSeconds:1,speechQualityVerified:false,callerAudioVerified:false});
      }else if(!await this.verifier.verifyStep(step.tool,resolveSupportReferences(step.canonicalArgs,results),ctx.tenantUid))return {valid:false,diagnostics:[]};
    }
    return {valid:true,diagnostics};
  }
}

export function resolveSupportReferences(value:any,results:Map<string,Record<string,unknown>>):any {
  if(typeof value==='string'){
    const match=/^steps\.([A-Za-z0-9_-]+)\.result\.([A-Za-z0-9_]+)$/.exec(value);
    if(!match)return value;
    if(['__proto__','constructor','prototype'].includes(match[2]))throw new Error('support_reference_invalid');
    const row=results.get(match[1]);if(!row||!Object.prototype.hasOwnProperty.call(row,match[2]))throw new Error('support_dependency_result_missing');return row[match[2]];
  }
  if(Array.isArray(value))return value.map(v=>resolveSupportReferences(v,results));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolveSupportReferences(v,results)]));
  return value;
}
