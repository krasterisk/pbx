import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DialplanBridgeController } from './dialplan-bridge.controller';
import { DialplanBridgeService } from './dialplan-bridge.service';
import { NumbersModule } from '../numbers/numbers.module';
import { MailerModule } from '../mailer/mailer.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TtsEnginesModule } from '../tts-engines/tts-engines.module';
import { IvrsModule } from '../ivrs/ivrs.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({ timeout: 5_000 }),
    NumbersModule,
    MailerModule,
    TelegramModule,
    TtsEnginesModule,
    IvrsModule,
  ],
  controllers: [DialplanBridgeController],
  providers: [DialplanBridgeService],
  exports: [DialplanBridgeService],
})
export class DialplanBridgeModule {}
