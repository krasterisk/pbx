import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { NotificationIntegration } from './notification-integration.model';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [SequelizeModule.forFeature([NotificationIntegration])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
