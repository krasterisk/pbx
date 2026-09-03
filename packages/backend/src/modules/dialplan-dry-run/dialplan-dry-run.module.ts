import { Module } from '@nestjs/common';
import { RoutesModule } from '../routes/routes.module';
import { IvrsModule } from '../ivrs/ivrs.module';
import { ContextsModule } from '../contexts/contexts.module';
import { RouteReferencesModule } from '../route-references/route-references.module';
import { DialplanDryRunController } from './dialplan-dry-run.controller';
import { DialplanDryRunService } from './dialplan-dry-run.service';

@Module({
  imports: [RoutesModule, IvrsModule, ContextsModule, RouteReferencesModule],
  controllers: [DialplanDryRunController],
  providers: [DialplanDryRunService],
  exports: [DialplanDryRunService],
})
export class DialplanDryRunModule {}
