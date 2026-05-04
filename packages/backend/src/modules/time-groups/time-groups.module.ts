import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TimeGroup } from './time-group.model';
import { TimeGroupsController } from './time-groups.controller';
import { TimeGroupsService } from './time-groups.service';

@Module({
  imports: [SequelizeModule.forFeature([TimeGroup])],
  controllers: [TimeGroupsController],
  providers: [TimeGroupsService],
  exports: [TimeGroupsService],
})
export class TimeGroupsModule {}
