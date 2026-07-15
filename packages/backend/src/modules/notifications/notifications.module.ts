import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SequelizeModule } from '@nestjs/sequelize';
import { MailerModule } from '../mailer/mailer.module';
import { NotificationIntegration } from './notification-integration.model';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DialplanNotifyController } from './dialplan-notify.controller';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { TelegramProvider } from './providers/telegram.provider';
import { EmailProvider } from './providers/email.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { WebhookProvider } from './providers/webhook.provider';
import { MaxProvider } from './providers/max.provider';
import { VkProvider } from './providers/vk.provider';

@Module({
  imports: [
    SequelizeModule.forFeature([NotificationIntegration]),
    HttpModule.register({ timeout: 10_000 }),
    MailerModule,
  ],
  controllers: [NotificationsController, DialplanNotifyController],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    TelegramProvider,
    EmailProvider,
    WhatsAppProvider,
    WebhookProvider,
    MaxProvider,
    VkProvider,
  ],
  exports: [NotificationsService, WebhookProvider],
})
export class NotificationsModule {}
