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
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { ReportsCdrModule } from './modules/reports/cdr/reports-cdr.module';
import { Cdr } from './modules/reports/cdr/cdr.model';
import { VoiceRobotsModule } from './modules/voice-robots/voice-robots.module';
import { AriModule } from './modules/ari/ari.module';
import { QueuesModule } from './modules/queues/queues.module';
import { ServiceRequestsModule } from './modules/service-requests/service-requests.module';
import { TimeGroupsModule } from './modules/time-groups/time-groups.module';
import { PhonebooksModule } from './modules/phonebooks/phonebooks.module';
import { CallGroupsModule } from './modules/call-groups/call-groups.module';
import { CallGroup } from './modules/call-groups/call-group.model';
import { CallGroupMember } from './modules/call-groups/call-group-member.model';
import { SmsModule } from './modules/sms/sms.module';
import { CloudAdminModule } from './modules/cloud-admin/cloud-admin.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import { McpModule } from './modules/mcp/mcp.module';
import { HealthModule } from './modules/health/health.module';
import { CallCenterModule } from './modules/callcenter/callcenter.module';
import { AiAgentsModule } from './modules/ai-agents/ai-agents.module';
import { CcAiAgent } from './modules/ai-agents/models/ai-agent.model';
import { CcAiProvider } from './modules/ai-agents/models/ai-provider.model';
import { CcAiToolset } from './modules/ai-agents/models/ai-toolset.model';
import { CcAiCdr } from './modules/ai-agents/models/ai-cdr.model';
import { CcAiBilling } from './modules/ai-agents/models/ai-billing.model';
import { CcAiInvoice } from './modules/ai-agents/models/ai-invoice.model';
import { CcAiAuditLog } from './modules/ai-agents/models/ai-audit-log.model';
import { CcPauseReason } from './modules/callcenter/models/pause-reason.model';
import { CcAgentSession } from './modules/callcenter/models/agent-session.model';
import { CcAgentEvent } from './modules/callcenter/models/agent-event.model';
import { CcAgentQueue } from './modules/callcenter/models/agent-queue.model';
import { CcMissedCall } from './modules/callcenter/models/missed-call.model';
import { CcContact } from './modules/callcenter/models/cc-contact.model';
import { CcQueueCall } from './modules/callcenter/models/queue-call.model';
import { CcDailyQueueStats } from './modules/callcenter/models/daily-queue-stats.model';
import { CcDailyAgentStats } from './modules/callcenter/models/daily-agent-stats.model';
import { CcOperatorSettings } from './modules/callcenter/models/operator-settings.model';
import { CcSettings } from './modules/callcenter/models/cc-settings.model';
import { CcDisplayToken } from './modules/callcenter/models/display-token.model';
import { CcAlertConfig } from './modules/callcenter/models/alert-config.model';
import { CcChatMessage } from './modules/callcenter/models/chat-message.model';
import { CcChatChannel } from './modules/callcenter/models/chat-channel.model';
import { CcCardTemplate } from './modules/callcenter/models/card-template.model';
import { CcCardField } from './modules/callcenter/models/card-field.model';
import { CcCardData } from './modules/callcenter/models/card-data.model';
import { CcReportSchedule } from './modules/callcenter/models/report-schedule.model';
import { Tenant } from './modules/cloud-admin/tenant.model';
import { ModuleRegistry } from './modules/cloud-admin/module-registry.model';
import { TenantModule } from './modules/cloud-admin/tenant-module.model';
import { CloudSetting } from './modules/cloud-admin/cloud-setting.model';
import { HubModule } from './modules/cloud-admin/models/hub-module.model';
import { HubModulePage } from './modules/cloud-admin/models/hub-module-page.model';
import { RoleStartDefault, TenantRoleStart } from './modules/cloud-admin/models/role-start.model';
import { DeviceToken } from './modules/cloud-admin/models/device-token.model';
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
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationIntegration } from './modules/notifications/notification-integration.model';
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
import { RoutePhonebookBinding } from './modules/phonebooks/route-phonebook-binding.model';
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
        SystemSetting, Cdr, VoiceRobot, VoiceRobotKeywordGroup, VoiceRobotKeyword, VoiceRobotLog, VoiceRobotCdr, VoiceRobotDataList,
        Queue, QueueMember,
        ServiceRequest, CcSubject, CcDistrict,
        CcPauseReason, CcAgentSession, CcAgentEvent, CcAgentQueue, CcMissedCall, CcContact, CcQueueCall,
        CcDailyQueueStats, CcDailyAgentStats, CcOperatorSettings, CcSettings,
        CcDisplayToken, CcAlertConfig,
        CcChatMessage, CcChatChannel,
        CcCardTemplate, CcCardField, CcCardData,
        CcReportSchedule,
        CcAiAgent, CcAiProvider, CcAiToolset, CcAiCdr, CcAiBilling, CcAiInvoice, CcAiAuditLog,
        TimeGroup,
        RoutePhonebook, PhonebookEntry, RoutePhonebookBinding,
        NotificationIntegration,
        CallGroup, CallGroupMember,
        // Cloud-admin
        Tenant, ModuleRegistry, TenantModule, CloudSetting,
        HubModule, HubModulePage,
        RoleStartDefault, TenantRoleStart,
        DeviceToken,
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
    // Rate limiting: 60 requests per minute app-wide (named 'global').
    // Stricter AI budget (10/min) is applied only on AI POST /message via route-scoped @Throttle — not a second forRoot profile.
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60000, limit: 60 },
    ]),
    RedisModule,
    HealthModule,
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
    ReportsCdrModule,
    AriModule,
    QueuesModule,
    ServiceRequestsModule,
    SmsModule,
    TimeGroupsModule,
    PhonebooksModule,
    CallGroupsModule,
    LoggerModule,
    MailerModule,
    NotificationsModule,
    TelegramModule,
    CloudAdminModule,
    AiChatModule,
    McpModule,
    CallCenterModule,
    AiAgentsModule,
  ],
  providers: [
    // Global rate limiting guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule { }
