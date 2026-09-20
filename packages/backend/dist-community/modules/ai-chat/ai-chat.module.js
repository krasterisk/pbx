"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiChatModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const sequelize_1 = require("@nestjs/sequelize");
const ai_chat_controller_1 = require("./ai-chat.controller");
const platform_threads_controller_1 = require("./platform-threads.controller");
const pbx_context_builder_service_1 = require("./pbx-context-builder.service");
const ai_chat_settings_model_1 = require("./ai-chat-settings.model");
const ai_chat_settings_service_1 = require("./ai-chat-settings.service");
const agent_thread_model_1 = require("./models/agent-thread.model");
const agent_thread_message_model_1 = require("./models/agent-thread-message.model");
const agent_proposal_model_1 = require("./models/agent-proposal.model");
const agent_workflow_model_1 = require("./models/agent-workflow.model");
const agent_proposals_module_1 = require("./agent-proposals.module");
const ai_provider_model_1 = require("../ai-connectivity/ai-provider.model");
const ai_audit_log_model_1 = require("./models/ai-audit-log.model");
const pbx_agent_thread_service_1 = require("./pbx-agent-thread.service");
const agent_usage_service_1 = require("./agent-usage.service");
const agent_usage_controller_1 = require("./agent-usage.controller");
const jwt_or_service_token_guard_1 = require("../auth/jwt-or-service-token.guard");
const service_token_guard_1 = require("../auth/service-token.guard");
const endpoints_module_1 = require("../endpoints/endpoints.module");
const trunks_module_1 = require("../trunks/trunks.module");
const ivrs_module_1 = require("../ivrs/ivrs.module");
const queues_module_1 = require("../queues/queues.module");
const contexts_module_1 = require("../contexts/contexts.module");
const routes_module_1 = require("../routes/routes.module");
const ami_module_1 = require("../ami/ami.module");
const context_model_1 = require("../contexts/context.model");
const logger_module_1 = require("../logger/logger.module");
const ai_connectivity_module_1 = require("../ai-connectivity/ai-connectivity.module");
const pbx_agent_llm_client_1 = require("./pbx-agent-llm.client");
const pbx_state_ai_adapter_1 = require("./pbx-state-ai.adapter");
const pbx_agent_loop_service_1 = require("./pbx-agent-loop.service");
const mcp_module_1 = require("../mcp/mcp.module");
const tenant_model_1 = require("../cloud-admin/tenant.model");
const cloud_setting_model_1 = require("../cloud-admin/cloud-setting.model");
const pbx_conversation_brief_service_1 = require("./pbx-conversation-brief.service");
const agent_intent_classifier_service_1 = require("./agent-intent-classifier.service");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const plan_ai_adapter_1 = require("./plan-ai.adapter");
const thread_visibility_service_1 = require("./thread-visibility.service");
const user_model_1 = require("../users/user.model");
const number_list_model_1 = require("../numbers/number-list.model");
let AiChatModule = class AiChatModule {
};
exports.AiChatModule = AiChatModule;
exports.AiChatModule = AiChatModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            axios_1.HttpModule.register({ timeout: 60_000 }),
            sequelize_1.SequelizeModule.forFeature([
                context_model_1.Context,
                ai_chat_settings_model_1.AiChatSettings,
                agent_thread_model_1.AgentThread,
                agent_thread_message_model_1.AgentThreadMessage,
                agent_proposal_model_1.AgentProposal,
                agent_workflow_model_1.AgentWorkflow,
                agent_workflow_model_1.AgentWorkflowStep,
                ai_provider_model_1.CcAiProvider,
                ai_audit_log_model_1.CcAiAuditLog,
                tenant_model_1.Tenant,
                cloud_setting_model_1.CloudSetting,
                user_model_1.User,
                number_list_model_1.NumberList,
            ]),
            endpoints_module_1.EndpointsModule,
            trunks_module_1.TrunksModule,
            ivrs_module_1.IvrsModule,
            queues_module_1.QueuesModule,
            contexts_module_1.ContextsModule,
            routes_module_1.RoutesModule,
            ami_module_1.AmiModule,
            logger_module_1.LoggerModule,
            ai_connectivity_module_1.AiConnectivityModule,
            ai_platform_module_1.AiPlatformModule,
            agent_proposals_module_1.AgentProposalsModule,
            (0, common_1.forwardRef)(() => mcp_module_1.McpModule),
        ],
        controllers: [ai_chat_controller_1.AiChatController, agent_usage_controller_1.AgentUsageController, platform_threads_controller_1.PlatformAiThreadsController],
        providers: [
            agent_usage_service_1.AgentUsageService,
            pbx_agent_loop_service_1.PbxAgentLoopService,
            pbx_context_builder_service_1.PbxContextBuilderService,
            ai_chat_settings_service_1.AiChatSettingsService,
            pbx_agent_thread_service_1.PbxAgentThreadService,
            pbx_agent_llm_client_1.PbxAgentLlmClient,
            pbx_state_ai_adapter_1.PbxStateAiAdapter,
            plan_ai_adapter_1.PlanAiAdapter,
            pbx_conversation_brief_service_1.PbxConversationBriefService,
            agent_intent_classifier_service_1.AgentIntentClassifierService,
            thread_visibility_service_1.ThreadVisibilityService,
            jwt_or_service_token_guard_1.JwtOrServiceTokenGuard,
            service_token_guard_1.ServiceTokenGuard,
        ],
        exports: [
            pbx_context_builder_service_1.PbxContextBuilderService,
            ai_chat_settings_service_1.AiChatSettingsService,
            pbx_agent_thread_service_1.PbxAgentThreadService,
            pbx_agent_llm_client_1.PbxAgentLlmClient,
            pbx_agent_loop_service_1.PbxAgentLoopService,
            pbx_conversation_brief_service_1.PbxConversationBriefService,
            agent_intent_classifier_service_1.AgentIntentClassifierService,
        ],
    })
], AiChatModule);
//# sourceMappingURL=ai-chat.module.js.map