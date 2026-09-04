import { Module } from '@nestjs/common';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { ReportsCdrModule } from './cdr/reports-cdr.module';
import { ReportsAiAdapter } from './reports-ai.adapter';

/**
 * Reports domain module: hosts the call-records AI adapter (15-07).
 * CdrService stays in ReportsCdrModule; this module only adds the adapter.
 */
@Module({
  imports: [ReportsCdrModule, AiPlatformModule],
  providers: [ReportsAiAdapter],
  exports: [ReportsCdrModule],
})
export class ReportsModule {}
