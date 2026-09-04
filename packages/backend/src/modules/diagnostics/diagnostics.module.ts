import { Module } from '@nestjs/common';
import { AmiModule } from '../ami/ami.module';
import { ContextsModule } from '../contexts/contexts.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { DiagnosticsService } from './diagnostics.service';

@Module({
  imports: [AmiModule, ContextsModule, EndpointsModule],
  providers: [DiagnosticsService],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
