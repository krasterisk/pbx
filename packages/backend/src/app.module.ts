import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EndpointsModule } from './modules/endpoints/endpoints.module';
import { ContextsModule } from './modules/contexts/contexts.module';
import { RolesModule } from './modules/roles/roles.module';
import { NumbersModule } from './modules/numbers/numbers.module';
import { AmiModule } from './modules/ami/ami.module';
import { TrunksModule } from './modules/trunks/trunks.module';
import { RoutesModule } from './modules/routes/routes.module';
import { IvrsModule } from './modules/ivrs/ivrs.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { TtsEnginesModule } from './modules/tts-engines/tts-engines.module';
import { SttEnginesModule } from './modules/stt-engines/stt-engines.module';
import { MohModule } from './modules/moh/moh.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { VoiceRobotsModule } from './modules/voice-robots/voice-robots.module';
import { AriModule } from './modules/ari/ari.module';
import { QueuesModule } from './modules/queues/queues.module';
import { Queue } from './modules/queues/queue.model';
import { QueueMember } from './modules/queues/queue-member.model';
import { Prompt } from './modules/prompts/prompt.model';
import { TtsEngine } from './modules/tts-engines/tts-engine.model';
import { SttEngine } from './modules/stt-engines/stt-engine.model';
import { User } from './modules/users/user.model';
import { PsEndpoint } from './modules/endpoints/ps-endpoint.model';
import { PsAuth } from './modules/endpoints/ps-auth.model';
import { PsAor } from './modules/endpoints/ps-aor.model';
import { PsContact } from './modules/endpoints/ps-contact.model';
import { Context } from './modules/contexts/context.model';
import { Role } from './modules/roles/role.model';
import { NumberList } from './modules/numbers/number-list.model';
import { ActionLog } from './modules/logger/action-log.model';
import { LoggerModule } from './modules/logger/logger.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { UserSession } from './modules/auth/user-session.model';
import { PickupGroup } from './modules/endpoints/pickup-group.model';
import { ProvisionTemplate } from './modules/endpoints/provision-template.model';
import { PsRegistration } from './modules/trunks/ps-registration.model';
import { PsEndpointIdIp } from './modules/trunks/ps-endpoint-id-ip.model';
import { Route } from './modules/routes/route.model';
import { ContextInclude } from './modules/routes/context-include.model';
import { Ivr } from './modules/ivrs/ivr.model';
import { MohClass } from './modules/moh/moh-class.model';
import { MohEntry } from './modules/moh/moh-entry.model';
import { SystemSetting } from './modules/system-settings/system-setting.model';
import { VoiceRobot } from './modules/voice-robots/voice-robot.model';
import { VoiceRobotKeywordGroup } from './modules/voice-robots/keyword-group.model';
import { VoiceRobotKeyword } from './modules/voice-robots/keyword.model';
import { VoiceRobotLog } from './modules/voice-robots/voice-robot-log.model';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../.env'),
    }),
    SequelizeModule.forRoot({
      dialect: (process.env.DB_DIALECT as any) || 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'krasterisk',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'krasterisk',
      models: [
        User, Role, NumberList, ActionLog, UserSession, Context,
        PsEndpoint, PsAuth, PsAor, PsContact,
        PickupGroup, ProvisionTemplate,
        PsRegistration, PsEndpointIdIp,
        Route, ContextInclude, Ivr, Prompt, TtsEngine, SttEngine,
        MohClass, MohEntry,
        SystemSetting, VoiceRobot, VoiceRobotKeywordGroup, VoiceRobotKeyword, VoiceRobotLog,
        Queue, QueueMember,
      ],
      autoLoadModels: false,
      synchronize: false, // IMPORTANT: never auto-sync with existing DB
      logging: false,
      define: {
        timestamps: false, // existing tables have no timestamps
        freezeTableName: true,
      },
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    AuthModule,
    UsersModule,
    EndpointsModule,
    ContextsModule,
    RolesModule,
    NumbersModule,
    AmiModule,
    TrunksModule,
    RoutesModule,
    IvrsModule,
    PromptsModule,
    TtsEnginesModule,
    SttEnginesModule,
    MohModule,
    SystemSettingsModule,
    VoiceRobotsModule,
    AriModule,
    QueuesModule,
    LoggerModule,
    MailerModule,
    TelegramModule,
  ],
})
export class AppModule {}
