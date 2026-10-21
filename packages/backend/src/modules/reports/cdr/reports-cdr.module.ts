import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Cdr } from './cdr.model';
import { CdrService } from './cdr.service';
import { CdrController } from './cdr.controller';
import { CdrPublicController } from './cdr-public.controller';
import { SystemSettingsModule } from '../../system-settings/system-settings.module';
import { CloudAdminModule } from '../../cloud-admin/cloud-admin.module';
import { PsEndpoint } from '../../endpoints/ps-endpoint.model';
import { User } from '../../users/user.model';
import { NumberList } from '../../numbers/number-list.model';
import { AiPlatformModule } from '../../ai-platform/ai-platform.module';
import { ReportsAiAdapter } from '../reports-ai.adapter';
import { DashboardModule } from '../../dashboard/dashboard.module';
import { CallsController } from '../calls/calls.controller';
import { CallsService } from '../calls/calls.service';
import { ActionLog } from '../../logger/action-log.model';
import { CallTranscriptService } from '../calls/call-transcript.service';
import { ProductAccessCoreModule } from '../../product-access/product-access-core.module';
import { CallTextSearchService } from '../calls/call-text-search.service';
import { CallSemanticIndexService } from '../calls/call-semantic-index.service';
import { CallSemanticGroundingService } from '../calls/call-semantic-grounding.service';
import { AiConnectivityModule } from '../../ai-connectivity/ai-connectivity.module';
import { CallAnalysisService } from '../calls/call-analysis.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Cdr, PsEndpoint, User, NumberList, ActionLog]),
    SystemSettingsModule,
    CloudAdminModule,
    AiPlatformModule,
    DashboardModule,
    ProductAccessCoreModule,
    AiConnectivityModule,
  ],
  controllers: [CdrController, CdrPublicController, CallsController],
  providers: [CdrService, ReportsAiAdapter, CallsService, CallTranscriptService, CallTextSearchService, CallSemanticIndexService, CallSemanticGroundingService, CallAnalysisService],
  exports: [CdrService, CallsService, CallTextSearchService, CallAnalysisService],
})
export class ReportsCdrModule {}
