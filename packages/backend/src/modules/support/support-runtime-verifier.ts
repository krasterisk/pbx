import { ConflictException, Injectable } from '@nestjs/common';
import { RoutesService } from '../routes/routes.service';
import { TimeGroupsService } from '../time-groups/time-groups.service';
import { ContextsService } from '../contexts/contexts.service';
import { AmiService } from '../ami/ami.service';
import { extractCommandText } from '../diagnostics/diagnostics.service';
import { formatTimeGroupInterval } from '../../shared/utils/dialplan.util';
import { stateFingerprint } from '../ai-platform/ai-state-fingerprint';

type Rule={exten:string;priority:number;application:string};
export function generatedRules(text:string):Map<string,Rule[]> {
  const result=new Map<string,Rule[]>();let context='',exten='',priority=0;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();const heading=/^\[([^\]]+)\]$/.exec(line);
    if(heading){context=heading[1];exten='';priority=0;result.set(context,[]);continue;}
    const row=/^(exten|same)\s*=>\s*(.*)$/.exec(line);if(!row)continue;
    const payload=row[2];let rest=payload;
    if(row[1]==='exten'){const comma=rest.indexOf(',');if(comma<0)throw new Error('generated_rule_invalid');exten=rest.slice(0,comma);rest=rest.slice(comma+1);}
    const comma=rest.indexOf(',');if(comma<0)throw new Error('generated_rule_invalid');const label=rest.slice(0,comma);
    priority=/^n(?:\(|$)/.test(label)?priority+1:Number.parseInt(label,10);
    if(!exten||!Number.isInteger(priority))throw new Error('generated_rule_invalid');
    const rules=result.get(context)??[];rules.push({exten,priority,application:rest.slice(comma+1).replace(/;.*$/,'').trim()});result.set(context,rules);
  }
  return result;
}
export function runtimeRules(text:string):Rule[] {
  const rules:Rule[]=[];let exten='';
  for(const raw of text.split(/\r?\n/)){
    const line=raw.replace(new RegExp(String.fromCharCode(27)+'\\[[0-9;]*m','g'),'');const named=/^\s*'([^']+)'\s*=>\s*(\d+)\.\s*(.*?)\s*(?:\[[^\]]+:\d+\])?$/.exec(line);
    if(named){exten=named[1];rules.push({exten,priority:Number(named[2]),application:named[3]});continue;}
    const next=/^\s*(?:\[[^\]]+\]\s*)?(\d+)\.\s*(.*?)\s*(?:\[[^\]]+:\d+\])?$/.exec(line);if(next&&exten)rules.push({exten,priority:Number(next[1]),application:next[2]});
  }return rules;
}
@Injectable()
export class SupportRuntimeVerifier {
  constructor(private readonly routes:RoutesService,private readonly groups:TimeGroupsService,private readonly contexts:ContextsService,private readonly ami:AmiService) {}
  async assertRouteParameters(args:any,tenant:number):Promise<void>{
    const route=await this.routes.findOne(args.id,tenant);
    if(route.raw_dialplan?.trim())throw new ConflictException('support_raw_route_requires_owner');
    if(args.actions===undefined)return;
    const existing=new Map((route.actions??[]).map((action:any,index:number)=>[String(action.id??action.uid??index),action]));
    const ordered=(route.actions??[]).map((action:any,index:number)=>String(action.id??action.uid??index));let previous=-1;
    for(const action of args.actions){
      const index=ordered.indexOf(String(action.id??action.uid));if(index<=previous)throw new ConflictException('support_route_order_change_requires_typed_tool');previous=index;
      const before:any=existing.get(String(action.id??action.uid));
      // This release can remove a selected forwarding step and attach a scoped
      // calendar. It cannot install new targets, direct SIP addresses or scripts.
      if(!before||before.type!==action.type||stateFingerprint(before.params??{})!==stateFingerprint(action.params??{}))throw new ConflictException('support_route_target_change_requires_typed_tool');
      const identity=(value:any)=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='condition'));
      if(stateFingerprint(identity(before))!==stateFingerprint(identity(action)))throw new ConflictException('support_route_step_change_requires_typed_tool');
      const withoutCalendar=(condition:any)=>Object.fromEntries(Object.entries(condition??{}).filter(([key])=>key!=='time_group_uid'));
      if(stateFingerprint(withoutCalendar(before.condition))!==stateFingerprint(withoutCalendar(action.condition)))throw new ConflictException('support_route_condition_change_requires_typed_tool');
    }
  }
  async calendarConsumers(uid:number,tenant:number):Promise<number[]> {
    await this.groups.findOne(uid,tenant);
    const consumes=(node:any):boolean=>!!node&&typeof node==='object'&&(Number(node.time_group_uid)===uid||Object.values(node).some(v=>Array.isArray(v)?v.some(consumes):consumes(v)));
    return (await this.routes.findAll(tenant)).filter(route=>consumes(route.actions)).map(route=>route.uid);
  }
  async assertCalendarScope(uid:number,tenant:number):Promise<void>{await this.groups.findOne(uid,tenant);}
  private matches(actual:any,patch:any):boolean {return Object.entries(patch).filter(([k])=>!['id','uid','context_uid','expected_hash'].includes(k)).every(([k,v])=>k==='options'?Object.entries(v as object).every(([field,value])=>stateFingerprint(actual.options?.[field])===stateFingerprint(value)):stateFingerprint(k==='active'?!!actual[k]:actual[k])===stateFingerprint(v));}
  async verifyStep(tool:string,args:any,tenant:number):Promise<boolean> {
    if(tool==='update_route'){
      const route=await this.routes.findOne(args.id,tenant);if(!this.matches(route,args)||route.raw_dialplan?.trim())return false;
      return this.verifyRoute(route,tenant);
    }
    if(tool==='create_time_group'||tool==='update_time_group'){
      const rows=tool==='update_time_group'?[await this.groups.findOne(args.uid,tenant)]:(await this.groups.findAll(tenant)).filter(r=>r.name===args.name);
      if(rows.length!==1||!this.matches(rows[0],args))return false;
      // Verify every route that actually consumes the calendar through the same generator.
      const all=await this.routes.findAll(tenant);
      const consumes=(node:any):boolean=>!!node&&typeof node==='object'&&(Number(node.time_group_uid)===Number(rows[0].uid)||Object.values(node).some(v=>Array.isArray(v)?v.some(consumes):consumes(v)));
      for(const route of all.filter(r=>consumes(r.actions)))if(!await this.verifyRoute(route,tenant))return false;
      return true;
    }return false;
  }
  private async verifyRoute(route:any,tenant:number):Promise<boolean> {

    const context=await this.contexts.findOne(route.context_uid,tenant);const name=context.name.endsWith(String(tenant))?context.name:context.name+tenant;
    const timezone=await this.groups.timezone(tenant);
    const intervals=new Map((await this.groups.findAll(tenant)).map(g=>[g.uid,(g.intervals??[]).map(i=>formatTimeGroupInterval(i,timezone))]));
    const generated='['+name+']\n'+this.routes.generateRouteDialplan(route,tenant,true,intervals,name);
    const expected=generatedRules(generated);
    if(!route.active){
      if(!/^[A-Za-z0-9_-]{1,160}$/.test(name))return false;
      const actual=runtimeRules(extractCommandText(await this.ami.command('dialplan show '+name)));
      const owned=expected.get(name)??[];
      return owned.length>0&&!actual.some(r=>owned.some(e=>e.exten===r.exten));
    }
    for(const [category,rules] of expected){
      if(!/^[A-Za-z0-9_-]{1,160}$/.test(category))return false;
      const actual=runtimeRules(extractCommandText(await this.ami.command('dialplan show '+category)));
      const canonical=(s:string)=>s.trim().replace(/^([A-Za-z][A-Za-z0-9_]*)\(/,(_,app:string)=>app.toLowerCase()+'(');
      for(const wanted of rules)if(!actual.some(r=>r.exten===wanted.exten&&r.priority===wanted.priority&&canonical(r.application)===canonical(wanted.application)))return false;
    }
    return expected.size>0;
  }
}
