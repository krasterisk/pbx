import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { DialplanBridgeController } from './dialplan-bridge.controller';
import { DialplanBridgeService } from './dialplan-bridge.service';
import { NumbersModule } from '../numbers/numbers.module';
import { MailerModule } from '../mailer/mailer.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AiConnectivityModule } from '../ai-connectivity/ai-connectivity.module';
import { IvrsModule } from '../ivrs/ivrs.module';
import { Route } from '../routes/route.model';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({ timeout: 5_000 }),
    SequelizeModule.forFeature([Route]),
    NumbersModule,
    MailerModule,
    TelegramModule,
    AiConnectivityModule,
    IvrsModule,
  ],
  controllers: [DialplanBridgeController],
  providers: [DialplanBridgeService],
  exports: [DialplanBridgeService],
})
export class DialplanBridgeModule {}
