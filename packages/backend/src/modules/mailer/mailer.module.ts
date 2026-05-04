import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { DialplanNotifyController } from './dialplan-notify.controller';

@Module({
  controllers: [DialplanNotifyController],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
