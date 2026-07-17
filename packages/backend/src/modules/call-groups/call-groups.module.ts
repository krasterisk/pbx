import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CallGroup } from './call-group.model';
import { CallGroupMember } from './call-group-member.model';
import { CallGroupsController } from './call-groups.controller';
import { CallGroupsService } from './call-groups.service';
import { AmiModule } from '../ami/ami.module';
import { EndpointsModule } from '../endpoints/endpoints.module';

@Module({
  imports: [
    SequelizeModule.forFeature([CallGroup, CallGroupMember]),
    AmiModule,
    EndpointsModule,
  ],
  controllers: [CallGroupsController],
  providers: [CallGroupsService],
  exports: [CallGroupsService],
})
export class CallGroupsModule {}
