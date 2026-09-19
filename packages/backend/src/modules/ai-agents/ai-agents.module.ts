import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CcAiAgent } from './models/ai-agent.model';
import { CcAiProvider } from './models/ai-provider.model';
import { CcAiToolset } from './models/ai-toolset.model';
import { CcAiCdr } from './models/ai-cdr.model';
import { CcAiBilling } from './models/ai-billing.model';
import { CcAiInvoice } from './models/ai-invoice.model';
import { CcAiAuditLog } from './models/ai-audit-log.model';
import { AiRobotDraft } from '../ai-voice/ai-voice.models';
import { AiAgentsService } from './ai-agents.service';
import { AiToolsetsService } from './ai-toolsets.service';
import { AiAgentInventoryService } from './ai-agent-inventory.service';
import { AiAgentsController } from './ai-agents.controller';
import { AiConnectivityModule } from '../ai-connectivity/ai-connectivity.module';

/**
 * Bootstraps the AI Agents module:
 * - registers all 7 Sequelize models with the global connection
 * - exposes 3 admin services + REST controller
 *
 * `user_uid = 0` is a real tenant on BOX installs (admin.vpbx_user_uid).
 * Do not delete those rows on boot.
 */
@Module({
  imports: [
    AiConnectivityModule,
    SequelizeModule.forFeature([
      CcAiAgent, CcAiProvider, CcAiToolset,
      CcAiCdr, CcAiBilling, CcAiInvoice, CcAiAuditLog, AiRobotDraft,
    ]),
  ],
  providers: [AiAgentsService, AiToolsetsService, AiAgentInventoryService],
  controllers: [AiAgentsController],
  exports: [AiAgentsService, AiConnectivityModule, AiToolsetsService, AiAgentInventoryService],
})
export class AiAgentsModule {}
