import { Injectable,OnModuleInit,ForbiddenException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import type { DomainAiAdapter,AiToolDefinition } from '../ai-platform/ai-adapter.types';
import type { JwtPayloadUser } from '../auth/auth.service';
import { DashboardService } from './dashboard.service';
import { parseDashboardQuery } from './dashboard-query';
@Injectable()
export class DashboardAiAdapter implements DomainAiAdapter,OnModuleInit {
 readonly domain = 'dashboard';
 constructor(private readonly registry:AiAdapterRegistryService,private readonly service:DashboardService,private readonly sql:Sequelize) {}
 onModuleInit(){this.registry.register(this);}
 getTools():AiToolDefinition[] {
   return [{name:'get_pbx_dashboard',description:'Сводка состояния АТС, звонков и ресурсов с учётом прав пользователя. Только чтение.',inputSchema:{period:{type:'string',enum:['today','yesterday','7d','30d']}},entityType:'dashboard',
     handler:async(args,tenant,ctx)=>{
       if(!ctx?.userUid)throw new ForbiddenException('User context is required');
       const [user]=await this.sql.query<any>('SELECT uniqueid AS sub,login,name,level,role,vpbx_user_uid FROM users WHERE uniqueid=:id AND vpbx_user_uid=:tenant LIMIT 1',{replacements:{id:ctx.userUid,tenant},type:QueryTypes.SELECT});
       if(!user)throw new ForbiddenException();
       return this.service.overview(user as JwtPayloadUser,parseDashboardQuery(args)) as unknown as Record<string,any>;
     }}];
 }
 getStateProvider(){return {domain:this.domain,buildSummary:async()=>''};}
 getKnowledgeBlock(){return 'Dashboard считает логические звонки, не каналы. IVR/голосовая почта не принятый звонок. Недоступные или неполные источники не равны нулю. Не выводи детали сверх scope пользователя.';}
}
