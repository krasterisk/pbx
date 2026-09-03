import { Module } from '@nestjs/common';
import { RoutesModule } from '../routes/routes.module';
import { IvrsModule } from '../ivrs/ivrs.module';
import { ContextsModule } from '../contexts/contexts.module';
import { RouteReferencesModule } from '../route-references/route-references.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { DialplanDryRunController } from './dialplan-dry-run.controller';
import { DialplanDryRunService } from './dialplan-dry-run.service';
import { DialplanDryRunAiAdapter } from './dialplan-dry-run-ai.adapter';

@Module({
  imports: [RoutesModule, IvrsModule, ContextsModule, RouteReferencesModule, AiPlatformModule],
  controllers: [DialplanDryRunController],
  providers: [DialplanDryRunService, DialplanDryRunAiAdapter],
  exports: [DialplanDryRunService],
})
export class DialplanDryRunModule {}
