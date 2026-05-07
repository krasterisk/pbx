import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RedisModule } from './modules/redis/redis.module';
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
// import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { VoiceRobotsModule } from './modules/voice-robots/voice-robots.module';
import { AriModule } from './modules/ari/ari.module';
import { QueuesModule } from './modules/queues/queues.module';
import { ServiceRequestsModule } from './modules/service-requests/service-requests.module';
import { TimeGroupsModule } from './modules/time-groups/time-groups.module';
import { PhonebooksModule } from './modules/phonebooks/phonebooks.module';
import { SmsModule } from './modules/sms/sms.module';
import { CloudAdminModule } from './modules/cloud-admin/cloud-admin.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import { McpModule } from './modules/mcp/mcp.module';
import { Tenant } from './modules/cloud-admin/tenant.model';
import { ModuleRegistry } from './modules/cloud-admin/module-registry.model';
import { TenantModule } from './modules/cloud-admin/tenant-module.model';
import { CloudSetting } from './modules/cloud-admin/cloud-setting.model';
import { BillingBalance } from './modules/cloud-admin/billing/models/billing-balance.model';
import { BillingTransaction } from './modules/cloud-admin/billing/models/billing-transaction.model';
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
import { WebhookFailure } from './modules/routes/webhook-failure.model';
import { Ivr } from './modules/ivrs/ivr.model';
import { MohClass } from './modules/moh/moh-class.model';
import { MohEntry } from './modules/moh/moh-entry.model';
import { SystemSetting } from './modules/system-settings/system-setting.model';
import { VoiceRobot } from './modules/voice-robots/voice-robot.model';
import { VoiceRobotKeywordGroup } from './modules/voice-robots/keyword-group.model';
import { VoiceRobotKeyword } from './modules/voice-robots/keyword.model';
import { VoiceRobotLog } from './modules/voice-robots/voice-robot-log.model';
import { VoiceRobotCdr } from './modules/voice-robots/voice-robot-cdr.model';
import { VoiceRobotDataList } from './modules/voice-robots/data-list.model';
import { ServiceRequest } from './modules/service-requests/service-request.model';
import { TimeGroup } from './modules/time-groups/time-group.model';
import { RoutePhonebook } from './modules/phonebooks/phonebook.model';
import { PhonebookEntry } from './modules/phonebooks/phonebook-entry.model';
import { CcSubject } from './modules/service-requests/cc-subject.model';
import { CcDistrict } from './modules/service-requests/cc-district.model';
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
        Route, ContextInclude, WebhookFailure, Ivr, Prompt, TtsEngine, SttEngine,
        MohClass, MohEntry,
        SystemSetting, VoiceRobot, VoiceRobotKeywordGroup, VoiceRobotKeyword, VoiceRobotLog, VoiceRobotCdr, VoiceRobotDataList,
        Queue, QueueMember,
        ServiceRequest, CcSubject, CcDistrict,
        TimeGroup,
        RoutePhonebook, PhonebookEntry,
        // Cloud-admin
        Tenant, ModuleRegistry, TenantModule, CloudSetting,
        BillingBalance, BillingTransaction,
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
    // Rate limiting: 60 requests per minute globally, stricter for AI endpoints
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60000, limit: 60 },
      { name: 'ai', ttl: 60000, limit: 10 }, // AI chat: 10 req/min
    ]),
    RedisModule,
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
    // SystemSettingsModule, // TEMPORARILY DISABLED for debugging
    VoiceRobotsModule,
    AriModule,
    QueuesModule,
    ServiceRequestsModule,
    SmsModule,
    TimeGroupsModule,
    PhonebooksModule,
    LoggerModule,
    MailerModule,
    TelegramModule,
    CloudAdminModule,
    AiChatModule,
    McpModule,
  ],
  providers: [
    // Global rate limiting guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule { }
