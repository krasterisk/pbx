import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CcAiAuditLog } from '../ai-agents/models/ai-audit-log.model';
import { DirectoriesModule } from '../directories/directories.module';
import { LoggerModule } from '../logger/logger.module';
import { RoutesModule } from '../routes/routes.module';
import { AgentProposalsController } from './agent-proposals.controller';
import { AgentProposal } from './models/agent-proposal.model';
import { PbxAgentDiffService } from './pbx-agent-diff.service';

@Module({
  imports: [
    SequelizeModule.forFeature([AgentProposal, CcAiAuditLog]),
    RoutesModule,
    DirectoriesModule,
    LoggerModule,
  ],
  controllers: [AgentProposalsController],
  providers: [PbxAgentDiffService],
  exports: [PbxAgentDiffService],
})
export class AgentProposalsModule {}
