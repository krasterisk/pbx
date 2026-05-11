import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel, SequelizeModule } from '@nestjs/sequelize';
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
import { BUILTIN_PROVIDER_TEMPLATES } from './seed/providers.seed';

/**
 * Bootstraps the AI Agents module:
 * - registers all 7 Sequelize models with the global connection
 * - exposes 3 admin services + REST controller
 * - seeds built-in provider templates as `user_uid = 0` on first boot
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

  constructor(
    @InjectModel(CcAiProvider) private readonly providerModel: typeof CcAiProvider,
  ) {}

  async onModuleInit() {
    if (!process.env.CC_AI_KEY_SECRET) {
      this.logger.warn(
        '⚠️  CC_AI_KEY_SECRET is not set — AI provider keys are encrypted with a development fallback key. Set CC_AI_KEY_SECRET in your .env for production.',
      );
    }

    // Seed built-in templates once
    try {
      const count = await this.providerModel.count({ where: { user_uid: 0 } });
      if (count === 0) {
        const rows = BUILTIN_PROVIDER_TEMPLATES.map(t => ({
          name: t.name,
          kind: t.kind,
          vendor: t.vendor,
          endpoint: t.endpoint,
          auth_type: t.auth_type,
          encrypted_api_key: '',
          capabilities: t.capabilities,
          defaults: t.defaults,
          pricing: t.pricing,
          enabled: true,
          user_uid: 0,
        }));
        await this.providerModel.bulkCreate(rows);
        this.logger.log(`✅ Seeded ${rows.length} built-in AI provider templates`);
      }
    } catch (err: any) {
      this.logger.warn(`Provider seed failed (table may not exist yet): ${err.message}`);
    }
  }
}
