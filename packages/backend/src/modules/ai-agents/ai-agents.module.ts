import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CcAiAgent } from './models/ai-agent.model';
import { CcAiProvider } from './models/ai-provider.model';
import { CcAiToolset } from './models/ai-toolset.model';
import { CcAiCdr } from './models/ai-cdr.model';
import { CcAiBilling } from './models/ai-billing.model';
import { CcAiInvoice } from './models/ai-invoice.model';
import { CcAiAuditLog } from './models/ai-audit-log.model';
import { AiAgentsService } from './ai-agents.service';
import { AiProvidersService } from './ai-providers.service';
import { AiToolsetsService } from './ai-toolsets.service';
import { AiAgentsController } from './ai-agents.controller';

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
    SequelizeModule.forFeature([
      CcAiAgent, CcAiProvider, CcAiToolset,
      CcAiCdr, CcAiBilling, CcAiInvoice, CcAiAuditLog,
    ]),
  ],
  providers: [AiAgentsService, AiProvidersService, AiToolsetsService],
  controllers: [AiAgentsController],
  exports: [AiAgentsService, AiProvidersService, AiToolsetsService],
})
export class AiAgentsModule implements OnModuleInit {
  private readonly logger = new Logger(AiAgentsModule.name);

  async onModuleInit() {
    if (!process.env.CC_AI_KEY_SECRET) {
      this.logger.warn(
        '⚠️  CC_AI_KEY_SECRET is not set — AI provider keys are encrypted with a development fallback key. Set CC_AI_KEY_SECRET in your .env for production.',
      );
    }
  }
}
