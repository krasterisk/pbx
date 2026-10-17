import { Module } from '@nestjs/common';
import { CloudAdminModule } from '../cloud-admin/cloud-admin.module';
import { AutodialIntegrationKeyService } from './autodial-integration-key.service';
import { AutodialIntegrationKeyGuard } from './autodial-integration-key.guard';
import { AutodialIntegrationKeysController } from './autodial-integration-keys.controller';

/** Shared by the CRM controller and MCP transport; never imports the autodial engine. */
@Module({ imports: [CloudAdminModule], providers: [AutodialIntegrationKeyService, AutodialIntegrationKeyGuard],
  controllers: [AutodialIntegrationKeysController], exports: [AutodialIntegrationKeyService, AutodialIntegrationKeyGuard] })
export class AutodialIntegrationModule {}
