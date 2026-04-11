import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Role } from './role.model';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [SequelizeModule.forFeature([Role]), LoggerModule],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule {}
