import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CcAiAuditLog } from '../ai-agents/models/ai-audit-log.model';
import { LoggerModule } from '../logger/logger.module';
import { RoutesModule } from '../routes/routes.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { AgentProposalsController } from './agent-proposals.controller';
import { AgentWorkflowsController } from './agent-workflows.controller';
import { AgentProposal } from './models/agent-proposal.model';
import { AgentWorkflow, AgentWorkflowStep } from './models/agent-workflow.model';
import { PbxAgentDiffService } from './pbx-agent-diff.service';
import { PbxWorkflowCompilerService } from './pbx-workflow-compiler.service';
import { PbxWorkflowRunnerService } from './pbx-workflow-runner.service';

/**
 * Confirming a card resolves its write through the adapter registry, so this
 * module no longer imports the domain modules whose entities are being changed.
 * RoutesModule stays for the dialplan reload that follows a route confirmation.
 * Workflows provide staged multi-step Apply with the same adapter contract.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([AgentProposal, AgentWorkflow, AgentWorkflowStep, CcAiAuditLog]),
    RoutesModule,
    LoggerModule,
    AiPlatformModule,
  ],
  controllers: [AgentProposalsController, AgentWorkflowsController],
  providers: [PbxAgentDiffService, PbxWorkflowCompilerService, PbxWorkflowRunnerService],
  exports: [PbxAgentDiffService, PbxWorkflowCompilerService, PbxWorkflowRunnerService],
})
export class AgentProposalsModule {}
