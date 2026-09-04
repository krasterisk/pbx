import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DirectoriesModule } from '../directories/directories.module';
import { RoutesModule } from '../routes/routes.module';
import { AgentProposalsController } from './agent-proposals.controller';
import { AgentProposal } from './models/agent-proposal.model';
import { PbxAgentDiffService } from './pbx-agent-diff.service';

@Module({
  imports: [
    SequelizeModule.forFeature([AgentProposal]),
    RoutesModule,
    DirectoriesModule,
  ],
  controllers: [AgentProposalsController],
  providers: [PbxAgentDiffService],
  exports: [PbxAgentDiffService],
})
export class AgentProposalsModule {}
