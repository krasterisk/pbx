import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DASHBOARD_LIMITS, type DashboardOverview, type DashboardQuery, type DashboardWarning, type DashboardBucket, type DashboardCloud } from '@krasterisk/shared';
import type { JwtPayloadUser } from '../auth/auth.service';
import { DashboardAccessService } from './dashboard-access.service';
import { DashboardCollectorService } from './dashboard-collector.service';
import { DashboardReadStore, emptyDashboardTotals, type DashboardSummary } from './dashboard-read-store.service';
import { DashboardCloudService } from './dashboard-cloud.service';
import { DashboardSystemService } from './dashboard-system.service';
import { DashboardCacheService } from './dashboard-cache.service';
import { resolveDashboardPeriod } from './dashboard-period';

/** Time buckets are merged, never truncated, to preserve counts within the payload budget. */
export function boundDashboardOverview(result:DashboardOverview):DashboardOverview {
  // The main card shows the most-used disk only; full paths/status stay in lazy /system detail.
  // Never serialize every long filesystem name into the aggregate overview.
  if(result.system) result.system=result.system.map(node=>{
    if(!node.current)return node;
    const sample=node.current;
    const worst=sample.disks.reduce((prior,disk)=>!prior||disk.usedPercent>prior.usedPercent?disk:prior,undefined as typeof sample.disks[number]|undefined);
    return {...node,current:{...sample,disks:worst?[worst]:[],
      omittedDisks:(sample.omittedDisks??0)+Math.max(0,sample.disks.length-(worst?1:0)),
      missingFilesystems:[],omittedMissingFilesystems:(sample.omittedMissingFilesystems??0)+(sample.missingFilesystems?.length??0)}};
  });
  result.warnings=result.warnings.slice(0,5);
  while(result.buckets.length>1&&(result.buckets.length>DASHBOARD_LIMITS.maxBuckets||Buffer.byteLength(JSON.stringify(result))>DASHBOARD_LIMITS.maxOverviewBytes)) {
    const merged:DashboardBucket[]=[];
    for(let i=0;i<result.buckets.length;i+=2) {
      const first=result.buckets[i],second=result.buckets[i+1];
      const next={...first,until:second?.until??first.until};
      if(second) for(const key of Object.keys(emptyDashboardTotals()) as Array<keyof ReturnType<typeof emptyDashboardTotals>>) next[key]+=second[key];
      merged.push(next);
    }
    result.buckets=merged;
  }
  if(Buffer.byteLength(JSON.stringify(result))>DASHBOARD_LIMITS.maxOverviewBytes)throw new InternalServerErrorException('Dashboard overview exceeds its payload budget');
  return result;
}
@Injectable()
export class DashboardService {
  private readonly sections=new DashboardCacheService();
  private readonly lastZones=new Map<number,string>();
  private readonly lastCloud=new Map<number,DashboardCloud>();
  private readonly lastHistory=new Map<string,DashboardSummary>();
  constructor(private readonly access:DashboardAccessService,private readonly collector:DashboardCollectorService,
    private readonly store:DashboardReadStore,private readonly cloud:DashboardCloudService,
    private readonly system:DashboardSystemService,private readonly config:ConfigService) {}
  private mode():'cloud'|'box'|'opensource' { const mode=this.config.get<string>('DEPLOYMENT_MODE','BOX').toLowerCase();return mode==='cloud'?'cloud':mode==='opensource'?'opensource':'box'; }
  async overview(user:JwtPayloadUser,query:DashboardQuery={}):Promise<DashboardOverview> {
    const ctx=await this.access.resolve(user);
    const zoneState=await this.sections.get('tz:'+ctx.tenant,5000,async()=>{
      try {const zone=await this.cloud.timezone(ctx.tenant);if(this.lastZones.size>=512)this.lastZones.delete(this.lastZones.keys().next().value!);this.lastZones.set(ctx.tenant,zone);return {zone,unavailable:false};}
      catch {return {zone:this.lastZones.get(ctx.tenant)||'UTC',unavailable:true};}
    });
    const timezone=zoneState.zone; const timezoneUnavailable=zoneState.unavailable;
    const period=resolveDashboardPeriod(query,timezone);
    const historyKey=JSON.stringify({tenant:ctx.tenant,permissions:ctx.permissionVersion,scope:ctx.scope,query,timezone,from:period.from});
    const [live,summary]=await Promise.all([
      this.collector.overview(ctx.tenant,ctx.scope),
      this.store.summary(ctx.tenant,query,timezone,ctx.scope,ctx.permissionVersion).then(value=>{if(value.source.state!=='unavailable'){if(this.lastHistory.size>=128)this.lastHistory.delete(this.lastHistory.keys().next().value!);this.lastHistory.set(historyKey,value);}return value;}).catch(()=>{const last=this.lastHistory.get(historyKey);return last?{...last,source:{...last.source,state:'stale' as const,message:'historyUnavailable'}}:{period,totals:emptyDashboardTotals(),buckets:[],source:{state:'unavailable' as const,updatedAt:null,message:'historyUnavailable'},version:'unavailable'};})
    ]);
    const result:DashboardOverview={deploymentMode:this.mode(),version:summary.version+':'+(live.source.updatedAt??'unknown'),historyVersion:summary.version,period:summary.period,live,
      totals:summary.totals,buckets:summary.buckets,historySource:summary.source,warnings:[],warningCount:0};
    const warnings:DashboardWarning[]=[];
    if((live.callsSource??live.source).state!=='ok') warnings.push({code:'telephonyUnavailable',severity:'critical',count:1,target:'calls'});
    if(live.inventorySource&&live.inventorySource.state!=='ok') warnings.push({code:'inventoryUnavailable',severity:'warning',count:1,target:'endpoints'});
    const offlineTrunks=Math.max(0,live.trunks.total-live.trunks.online-live.trunks.unknown);
    if(offlineTrunks) warnings.push({code:'trunksOffline',severity:'critical',count:offlineTrunks,target:'trunks'});
    if(timezoneUnavailable) warnings.push({code:'timezoneUnavailable',severity:'warning',count:1,target:'calls'});
    if(summary.source.state!=='ok') warnings.push({code:'historyIncomplete',severity:'warning',count:1,target:'calls'});
    if(result.deploymentMode==='cloud'&&ctx.pages.has('tenant_modules')) {
      const cached=await this.sections.get<DashboardCloud>('cloud:'+ctx.tenant+':'+ctx.permissionVersion,300000,async()=>{
        const next=await this.cloud.overview(ctx.tenant,live),last=this.lastCloud.get(ctx.tenant);
        if(next.source.state==='unavailable'&&last)return {...last,source:{...last.source,state:'stale' as const,message:'cloudDataUnavailable'}};
        if(next.source.state==='ok'){if(this.lastCloud.size>=512)this.lastCloud.delete(this.lastCloud.keys().next().value!);this.lastCloud.set(ctx.tenant,next);}
        return next;
      });
      result.cloud={...cached,usageSource:live.source,usage:{...cached.usage,extensions:live.endpoints.total,trunks:live.trunks.total,concurrentCalls:live.activeCalls}};
      if(cached.source.state!=='ok'||(cached.billingSource&&cached.billingSource.state!=='ok')) warnings.push({code:'cloudUnavailable',severity:'warning',count:1,target:'cloud'});
      if(cached.blocked) warnings.push({code:'balanceBlocked',severity:'critical',count:1,target:'cloud'});
      else if(cached.balanceKopecks!==null&&cached.balanceKopecks+(cached.creditLimitKopecks??0)<=0) warnings.push({code:'balanceLow',severity:'warning',count:1,target:'cloud'});
      if(cached.expiresAt) { const days=(Date.parse(cached.expiresAt)-Date.now())/86400000;if(days<=7)warnings.push({code:days<=0?'planExpired':'planExpiring',severity:days<=0?'critical':'warning',count:1,target:'cloud'}); }
      for(const [usage,limit] of [[live.endpoints.total,cached.limits.extensions],[live.trunks.total,cached.limits.trunks],[live.activeCalls,cached.limits.concurrentCalls]] as Array<[number,number|null]>) {
        if(limit!==null&&limit>0&&usage>=limit*0.85) {warnings.push({code:'planCapacity',severity:usage>=limit?'critical':'warning',count:1,target:'cloud'});break;}
      }
    }
    if(result.deploymentMode!=='cloud'&&ctx.pages.has('settings')) { result.system=await this.system.getOverview(); warnings.push(...this.system.getWarnings()); }
    warnings.sort((a,b)=>(a.severity==='critical'?0:1)-(b.severity==='critical'?0:1)||a.code.localeCompare(b.code));
    result.warningCount=warnings.length;result.warnings=warnings;
    return boundDashboardOverview(result);
  }
  async calls(user:JwtPayloadUser,query:DashboardQuery) {
    const ctx=await this.access.resolve(user);this.access.requirePage(ctx,'cdr');
    if(query.outcome==='active')return this.collector.calls(ctx.tenant,query,ctx.scope);
    const zone=await this.cloud.timezone(ctx.tenant);
    return this.store.calls(ctx.tenant,query,zone,ctx.scope,ctx.permissionVersion);
  }
  async inventory(user:JwtPayloadUser,kind:'endpoints'|'trunks',query:DashboardQuery) {
    const ctx=await this.access.resolve(user);this.access.requirePage(ctx,kind);
    return kind==='endpoints'?this.collector.endpoints(ctx.tenant,query):this.collector.trunks(ctx.tenant,query);
  }
  async systemDetail(user:JwtPayloadUser,nodeId?:string,range='24h') {
    const ctx=await this.access.resolve(user);this.access.requirePage(ctx,'settings');
    if(this.mode()==='cloud')throw new ForbiddenException('Host metrics are not exposed in cloud');
    if((nodeId!==undefined&&(typeof nodeId!=='string'||nodeId.length>64))||!['1h','24h','7d'].includes(range))throw new BadRequestException('Invalid system range');
    return this.system.detail(nodeId,range);
  }
}
