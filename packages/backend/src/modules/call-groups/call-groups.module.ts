import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CallGroup } from './call-group.model';
import { CallGroupMember } from './call-group-member.model';
import { CallGroupsController } from './call-groups.controller';
import { CallGroupsService } from './call-groups.service';
import { AmiModule } from '../ami/ami.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { RouteReferencesModule } from '../route-references/route-references.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { CallGroupsAiAdapter } from './call-groups-ai.adapter';

@Module({
  imports: [
    SequelizeModule.forFeature([CallGroup, CallGroupMember]),
    AmiModule,
    EndpointsModule,
    RouteReferencesModule,
    AiPlatformModule,
  ],
  controllers: [CallGroupsController],
  providers: [CallGroupsService, CallGroupsAiAdapter],
  exports: [CallGroupsService],
})
export class CallGroupsModule {}
