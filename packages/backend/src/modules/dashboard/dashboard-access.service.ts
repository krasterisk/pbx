import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { createHash } from 'crypto';
import type { JwtPayloadUser } from '../auth/auth.service';
import { ModulesRegistryService, type HubCatalogItem } from '../cloud-admin/modules-registry.service';
import { parseCdrAccessBlob, type CdrAccessScope } from '../reports/cdr/cdr-access-scope';
import { UserLevel } from '../users/user.model';

const legacy: Record<string,string> = { table_module_overview:'overview',table_module_pbx:'core',table_module_inbound:'core',table_module_outbound:'core',table_module_system:'system',table_module_reports:'analytics',table_module_analytics:'analytics',table_module_apps:'apps' };
const aliases: Record<string,string> = { peers:'endpoints',users_roles:'users',tenant_modules:'tenant-modules' };
export function dashboardGrants(raw: unknown): Record<string,string[]> {
  let value:any=raw;
  if(typeof value==='string') { try { value=JSON.parse(value); } catch { return {}; } }
  if(!value || typeof value!=='object' || Array.isArray(value)) return {};
  const out:Record<string,string[]>={};
  for(const [key,pages] of Object.entries(value.hub && typeof value.hub==='object'?value.hub:value)) {
    const hub=value.hub?key:legacy[key];
    if(!hub || !Array.isArray(pages)) continue;
    out[hub]=[...new Set([...(out[hub]??[]),...pages.filter(p=>typeof p==='string').map(p=>aliases[p]??p.replace(/_/g,'-'))])];
  }
  return out;
}
export interface DashboardContext {
  tenant:number; user:JwtPayloadUser; scope:CdrAccessScope|null; permissionVersion:string;
  pages:Set<string>;
}
@Injectable()
export class DashboardAccessService {
  private catalogs=new Map<number,{expires:number,value:Promise<HubCatalogItem[]>}>();
  constructor(private readonly sql:Sequelize,private readonly modules:ModulesRegistryService) {}
  private catalog(tenantId:number) {
    const cached=this.catalogs.get(tenantId);
    if(cached && cached.expires>Date.now()) return cached.value;
    if(this.catalogs.size>=512) this.catalogs.delete(this.catalogs.keys().next().value!);
    const value=this.modules.getHubCatalogForTenant(tenantId);
    this.catalogs.set(tenantId,{expires:Date.now()+5000,value});
    value.catch(()=>this.catalogs.delete(tenantId));
    return value;
  }
  async resolve(token:JwtPayloadUser,required='dashboard'):Promise<DashboardContext> {
    const tenant=Number(token?.vpbx_user_uid);
    if(!Number.isSafeInteger(tenant)||tenant<0||!Number.isSafeInteger(Number(token?.sub))) throw new UnauthorizedException();
    const rows=await this.sql.query<any>(`SELECT u.uniqueid,u.login,u.name,u.level,u.role,u.exten,u.numbers_id,u.vpbx_user_uid,
      r.role AS grants,n.numbers AS access_blob
      FROM users u LEFT JOIN roles r ON r.id=u.role AND r.vpbx_user_uid=u.vpbx_user_uid
      LEFT JOIN numbers n ON n.id=u.numbers_id AND n.vpbx_user_uid=u.vpbx_user_uid
      WHERE u.uniqueid=:id AND u.vpbx_user_uid=:tenant LIMIT 1`,{replacements:{id:token.sub,tenant},type:QueryTypes.SELECT});
    const record=rows[0];
    if(!record) throw new UnauthorizedException();
    if(record.level===null||record.level===undefined||typeof record.level==='boolean'||![UserLevel.SUPERADMIN,UserLevel.ADMIN,UserLevel.OPERATOR,UserLevel.SUPERVISOR,UserLevel.READONLY].some(level=>String(level)===String(record.level))) throw new UnauthorizedException('Invalid account level');
    const user={...token,level:Number(record.level),role:Number(record.role||0)};
    const admin=user.level===UserLevel.ADMIN||user.level===UserLevel.SUPERADMIN;
    const tenantId=(await this.modules.resolveTenantIdFromJwt({vpbx_user_uid:tenant}))??0;
    const catalog=await this.catalog(tenantId);
    const grants=dashboardGrants(record.grants);
    const pages=new Set<string>();
    for(const hub of catalog) {
      if(hub.licenseStatus!=='active'||hub.kind==='off') continue;
      for(const page of hub.pages) {
        const normalized=aliases[page.page_code]??page.page_code.replace(/_/g,'-');
        if(admin||!Number(record.role)||(grants[hub.code]??[]).includes(normalized)) pages.add(page.page_code);
      }
    }
    if(!pages.has(required)) throw new ForbiddenException('Dashboard interface is not available');
    let scope:CdrAccessScope|null=null;
    if(!admin) {
      let blob:any=record.access_blob;
      if(typeof blob==='string') { try { blob=JSON.parse(blob); } catch { throw new ForbiddenException('Invalid call access configuration'); } }
      const parsed=parseCdrAccessBlob(blob?.cdr);
      let operators=parsed.operators;
      if(parsed.operatorUserIds.length) {
        const staff=await this.sql.query<any>('SELECT exten,login FROM users WHERE vpbx_user_uid=:tenant AND uniqueid IN (:ids)',{replacements:{tenant,ids:parsed.operatorUserIds},type:QueryTypes.SELECT});
        operators=staff.map(s=>String(s.exten||(/^\d+$/.test(s.login)?s.login:''))).filter(Boolean);
        if(!operators.length) operators=['__denied__'];
      }
      if(operators.length||parsed.queues.length) scope={operators,queues:parsed.queues,ownExten:String(record.exten||(/^\d+$/.test(record.login)?record.login:''))||null};
    }
    if(!admin) for(const page of ['settings','tenant_modules','users_roles','roles','numbers']) pages.delete(page);
    return {tenant,user,scope,pages,permissionVersion:createHash('sha256').update(JSON.stringify([user.level,record.grants,record.access_blob,scope,[...pages].sort()])).digest('hex')};
  }
  requirePage(ctx:DashboardContext,page:string) { if(!ctx.pages.has(page)) throw new ForbiddenException('Interface is not available'); }
}
