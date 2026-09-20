"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentProposalsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ai_audit_log_model_1 = require("./models/ai-audit-log.model");
const logger_module_1 = require("../logger/logger.module");
const routes_module_1 = require("../routes/routes.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const agent_proposals_controller_1 = require("./agent-proposals.controller");
const agent_workflows_controller_1 = require("./agent-workflows.controller");
const agent_proposal_model_1 = require("./models/agent-proposal.model");
const agent_thread_model_1 = require("./models/agent-thread.model");
const agent_workflow_model_1 = require("./models/agent-workflow.model");
const pbx_agent_diff_service_1 = require("./pbx-agent-diff.service");
const pbx_workflow_compiler_service_1 = require("./pbx-workflow-compiler.service");
const pbx_workflow_runner_service_1 = require("./pbx-workflow-runner.service");
/**
 * Confirming a card resolves its write through the adapter registry, so this
 * module no longer imports the domain modules whose entities are being changed.
 * RoutesModule stays for the dialplan reload that follows a route confirmation.
 * Workflows provide staged multi-step Apply with the same adapter contract.
 */
let AgentProposalsModule = class AgentProposalsModule {
};
exports.AgentProposalsModule = AgentProposalsModule;
exports.AgentProposalsModule = AgentProposalsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([agent_proposal_model_1.AgentProposal, agent_thread_model_1.AgentThread, agent_workflow_model_1.AgentWorkflow, agent_workflow_model_1.AgentWorkflowStep, ai_audit_log_model_1.CcAiAuditLog]),
            routes_module_1.RoutesModule,
            logger_module_1.LoggerModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [agent_proposals_controller_1.AgentProposalsController, agent_workflows_controller_1.AgentWorkflowsController],
        providers: [pbx_agent_diff_service_1.PbxAgentDiffService, pbx_workflow_compiler_service_1.PbxWorkflowCompilerService, pbx_workflow_runner_service_1.PbxWorkflowRunnerService],
        exports: [pbx_agent_diff_service_1.PbxAgentDiffService, pbx_workflow_compiler_service_1.PbxWorkflowCompilerService, pbx_workflow_runner_service_1.PbxWorkflowRunnerService],
    })
], AgentProposalsModule);
//# sourceMappingURL=agent-proposals.module.js.map