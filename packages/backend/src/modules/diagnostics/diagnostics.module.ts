import { Module } from '@nestjs/common';
import { AmiModule } from '../ami/ami.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { ContextsModule } from '../contexts/contexts.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { ReportsCdrModule } from '../reports/cdr/reports-cdr.module';
import { DiagnosticsAiAdapter } from './diagnostics-ai.adapter';
import { DiagnosticsService } from './diagnostics.service';

@Module({
  imports: [AmiModule, ContextsModule, EndpointsModule, ReportsCdrModule, AiPlatformModule],
  providers: [DiagnosticsService, DiagnosticsAiAdapter],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
