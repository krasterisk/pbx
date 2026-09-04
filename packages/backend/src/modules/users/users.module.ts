import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersAiAdapter } from './users-ai.adapter';
import { User } from './user.model';
import { LoggerModule } from '../logger/logger.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [SequelizeModule.forFeature([User]), LoggerModule, SystemSettingsModule, AiPlatformModule],
  providers: [UsersService, UsersAiAdapter],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
