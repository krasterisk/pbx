import { Module } from '@nestjs/common';
import { AmiModule } from '../ami/ami.module';
import { AuthModule } from '../auth/auth.module';
import { CloudAdminModule } from '../cloud-admin/cloud-admin.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardAccessService } from './dashboard-access.service';
import { DashboardGateway } from './dashboard.gateway';
import { DashboardCollectorService } from './dashboard-collector.service';
import { DashboardReadStore } from './dashboard-read-store.service';
import { DashboardProjectionService } from './dashboard-projection.service';
import { DashboardCloudService } from './dashboard-cloud.service';
import { DashboardSystemService } from './dashboard-system.service';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardAiAdapter } from './dashboard-ai.adapter';
@Module({
 imports:[AmiModule,AuthModule,CloudAdminModule,AiPlatformModule],
 controllers:[DashboardController],
 providers:[DashboardService,DashboardAccessService,DashboardGateway,DashboardCollectorService,DashboardReadStore,DashboardProjectionService,DashboardCloudService,DashboardSystemService,DashboardCacheService,DashboardAiAdapter],
 exports:[DashboardService,DashboardReadStore,DashboardAccessService]
})
export class DashboardModule {}
