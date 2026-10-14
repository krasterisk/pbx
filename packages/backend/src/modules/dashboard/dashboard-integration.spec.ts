import { ForbiddenException,UnauthorizedException } from '@nestjs/common';
import { DashboardAccessService,dashboardGrants } from './dashboard-access.service';
import { parseDashboardQuery } from './dashboard-query';
import { boundDashboardOverview,DashboardService } from './dashboard.service';
import { emptyDashboardTotals } from './dashboard-read-store.service';
import type { DashboardOverview } from '@krasterisk/shared';
import { monitoringTargets } from './dashboard-system.service';
import { parseNodeExporter } from './dashboard-node-exporter';
const token={sub:42,login:'user',name:'User',level:2,role:7,vpbx_user_uid:91};
const catalog=[{code:'overview',kind:'base',licenseStatus:'active',pages:[{page_code:'dashboard'}]},{code:'analytics',kind:'market',licenseStatus:'active',pages:[{page_code:'cdr'}]}];
describe('Dashboard security integration',()=>{
 const sql:any={query:jest.fn()};
 const modules:any={resolveTenantIdFromJwt:jest.fn().mockResolvedValue(123),getHubCatalogForTenant:jest.fn().mockResolvedValue(catalog)};
 beforeEach(()=>jest.clearAllMocks());
 it('matches legacy and v2 page grants',()=>{
   expect(dashboardGrants(JSON.stringify({table_module_overview:['dashboard']}))).toEqual({overview:['dashboard']});
   expect(dashboardGrants({version:2,hub:{overview:['dashboard'],system:['tenant_modules']}})).toEqual({overview:['dashboard'],system:['tenant-modules']});
   expect(dashboardGrants('{broken')).toEqual({});
 });
 it('rejects another tenant and missing grant',async()=>{
   sql.query.mockResolvedValueOnce([]);
   await expect(new DashboardAccessService(sql,modules).resolve(token)).rejects.toThrow(UnauthorizedException);
   sql.query.mockResolvedValueOnce([{...token,uniqueid:42,grants:JSON.stringify({version:2,hub:{analytics:['cdr']}})}]);
   await expect(new DashboardAccessService(sql,modules).resolve(token)).rejects.toThrow(ForbiddenException);
   expect(sql.query.mock.calls[0][1].replacements).toEqual({id:42,tenant:91});
 });
 it('isolates effective scope and changes permission version with live role changes',async()=>{
   const base={...token,uniqueid:42,exten:'101',grants:JSON.stringify({version:2,hub:{overview:['dashboard'],analytics:['cdr']}})};
   sql.query.mockResolvedValueOnce([{...base,access_blob:{cdr:{operators:['102'],queues:['700']}}}]);
   const access=new DashboardAccessService(sql,modules);const first=await access.resolve(token);
   expect(first.scope).toEqual({operators:['102'],queues:['700'],ownExten:'101'});
   sql.query.mockResolvedValueOnce([{...base,access_blob:{cdr:{operators:['103'],queues:[]}}}]);
   const second=await access.resolve(token);
   expect(second.permissionVersion).not.toBe(first.permissionVersion);
   expect(first.pages.has('cdr')).toBe(true);
 });
 it.each([null,undefined,4,1.2,'invalid','',false])('rejects malformed persisted account level %s rather than granting SUPERADMIN',async(level)=>{
   sql.query.mockResolvedValueOnce([{...token,uniqueid:42,level,grants:JSON.stringify({version:2,hub:{overview:['dashboard'],analytics:['cdr']}})}]);
   await expect(new DashboardAccessService(sql,modules).resolve(token)).rejects.toThrow(UnauthorizedException);
 });
 it('resolves numeric-login staff and own extension without widening scope',async()=>{
   sql.query.mockResolvedValueOnce([{...token,uniqueid:42,exten:'',login:'101',grants:JSON.stringify({version:2,hub:{overview:['dashboard'],analytics:['cdr']}}),access_blob:{cdr:{operatorUserIds:[55],queues:[]}}}]);
   sql.query.mockResolvedValueOnce([{exten:'',login:'102'}]);
   const context=await new DashboardAccessService(sql,modules).resolve(token);
   expect(context.scope).toEqual({operators:['102'],queues:[],ownExten:'101'});
   expect(sql.query.mock.calls[1][1].replacements).toEqual({tenant:91,ids:[55]});
 });
 it('does not grant technical/financial interfaces to a non-admin fallback',async()=>{
   sql.query.mockResolvedValueOnce([{...token,role:0,uniqueid:42}]);
   const ctx=await new DashboardAccessService(sql,modules).resolve(token);
   expect(ctx.pages.has('settings')).toBe(false);
 });
});
describe('Dashboard public budget',()=>{
 it('rejects unbounded pages and invalid enum/query shapes',()=>{
   expect(()=>parseDashboardQuery({limit:10000})).toThrow();
   expect(()=>parseDashboardQuery({period:['today']})).toThrow();
   expect(()=>parseDashboardQuery({search:'x'.repeat(101)})).toThrow();
   expect(parseDashboardQuery({limit:'50',state:'talking',status:'offline',tenant:999})).toEqual({limit:50,state:'talking',status:'offline'});
 });
 it('merges graph buckets without losing totals and bounds warnings',()=>{
   const totals={...emptyDashboardTotals(),total:100,incoming:100,accepted:80,missed:20};
   const view:DashboardOverview={deploymentMode:'box',version:'1',period:{from:'2026-10-01T00:00:00Z',to:'2026-10-02T00:00:00Z',timezone:'UTC'},live:{activeCalls:1000,ringing:100,talking:800,waiting:100,endpoints:{total:10000,online:9000,unknown:0},trunks:{total:100,online:100,unknown:0},source:{state:'ok',updatedAt:new Date().toISOString()}},totals,buckets:Array.from({length:1000},(_,i)=>({at:new Date(i*300000).toISOString(),until:new Date((i+1)*300000).toISOString(),...totals})),historySource:{state:'ok',updatedAt:null},warnings:Array.from({length:100},()=>({code:'offline',severity:'warning' as const,count:1000,target:'trunks' as const})),warningCount:100};
   const bounded=boundDashboardOverview(view);
   expect(Buffer.byteLength(JSON.stringify(bounded))).toBeLessThanOrEqual(50*1024);
   expect(bounded.buckets.length).toBeLessThanOrEqual(300);
   expect(bounded.warnings.length).toBe(5);
   expect(bounded.buckets.reduce((n,b)=>n+b.total,0)).toBe(100000);
   expect(bounded.buckets[0].at).toBe(new Date(0).toISOString());expect(bounded.buckets.at(-1)?.until).toBe(new Date(1000*300000).toISOString());
   expect(bounded.buckets.slice(1).every((row,i)=>bounded.buckets[i].until===row.at)).toBe(true);
   expect(bounded).not.toHaveProperty('endpoints');
 });
 it.each(['available','missing'])('bounds eight nodes with maximal valid filesystem metadata (%s) and keeps full detail unchanged',kind=>{
   const mounts=Array.from({length:8},(_,i)=>'/'+String(i)+'界'.repeat(253));
   const targets=monitoringTargets(JSON.stringify(Array.from({length:8},(_,i)=>({id:'node'+i,label:'界'.repeat(128),role:'asterisk',url:'http://127.0.0.1:9100/metrics',recordsMount:mounts[0],filesystems:mounts}))));
   const metrics=kind==='missing'?'node_memory_MemTotal_bytes 1000\nnode_memory_MemAvailable_bytes 500':mounts.map((mount,i)=>`node_filesystem_size_bytes{mountpoint="${mount}",fstype="ext4"} 1000\nnode_filesystem_avail_bytes{mountpoint="${mount}",fstype="ext4"} ${900-i*100}`).join('\n').replace(/\\n/g,'\n');
   const samples=targets.map(target=>parseNodeExporter(metrics,Date.now(),target.recordsMount,undefined,target.filesystems).sample);
   const system=targets.map((target,i)=>({id:target.id,label:target.label,role:target.role,source:{state:'ok' as const,updatedAt:samples[i].at},current:samples[i]}));
   const totals=emptyDashboardTotals();
   const view:DashboardOverview={deploymentMode:'box',version:'1',period:{from:'2026-10-01T00:00:00Z',to:'2026-10-02T00:00:00Z',timezone:'UTC'},live:{activeCalls:0,ringing:0,talking:0,waiting:0,endpoints:{total:0,online:0,unknown:0},trunks:{total:0,online:0,unknown:0},source:{state:'ok',updatedAt:null}},totals,buckets:[{at:'2026-10-01T00:00:00Z',until:'2026-10-02T00:00:00Z',...totals}],historySource:{state:'ok',updatedAt:null},warnings:[],warningCount:0,system};
   const original=JSON.stringify(system);const bounded=boundDashboardOverview(view);
   expect(Buffer.byteLength(JSON.stringify(bounded))).toBeLessThanOrEqual(50*1024);
   expect(JSON.stringify(system)).toBe(original);
   for(const node of bounded.system!) {
     expect(node.current!.missingFilesystems).toEqual([]);
     if(kind==='available'){expect(node.current!.disks).toEqual([samples[0].disks[7]]);expect(node.current!.omittedDisks).toBe(7);expect(node.current!.omittedMissingFilesystems).toBe(0);}
     else {expect(node.current!.disks).toEqual([]);expect(node.current!.omittedMissingFilesystems).toBe(8);}
   }
 });
 it('overview never calls list methods or a raw CDR service',async()=>{
   const access:any={resolve:jest.fn().mockResolvedValue({tenant:91,scope:null,permissionVersion:'a',pages:new Set()})};
   const live={activeCalls:0,ringing:0,talking:0,waiting:0,endpoints:{total:10000,online:9000,unknown:0},trunks:{total:0,online:0,unknown:0},source:{state:'ok',updatedAt:null}};
   const collector:any={overview:jest.fn().mockResolvedValue(live),calls:jest.fn(),endpoints:jest.fn(),trunks:jest.fn()};
   const store:any={summary:jest.fn().mockResolvedValue({period:{from:'2026-01-01T00:00:00Z',to:'2026-01-02T00:00:00Z',timezone:'UTC'},totals:emptyDashboardTotals(),buckets:[],source:{state:'ok',updatedAt:null},version:'1'})};
   const cloud:any={timezone:jest.fn().mockResolvedValue('UTC')};
   const result=await new DashboardService(access,collector,store,cloud,{} as any,{get:()=> 'BOX'} as any).overview(token);
   expect(result.live.endpoints.total).toBe(10000);
   expect(collector.endpoints).not.toHaveBeenCalled();expect(collector.trunks).not.toHaveBeenCalled();
   expect(store.summary).toHaveBeenCalledWith(91,{},'UTC',null,'a');
 });
});
