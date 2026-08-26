import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.model';
import { LoggerModule } from '../logger/logger.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [SequelizeModule.forFeature([User]), LoggerModule, SystemSettingsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
