import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProductAccessCoreModule } from '../product-access/product-access-core.module';
import { IntegrationCredentialsModule } from '../integration-credentials/integration-credentials.module';
import { AiBusinessConnection, AiRobotToolBinding, AiToolRevision } from './tool.models';
import { AiToolConnectivityService } from './ai-tool-connectivity.service';
import { AiToolConnectivityJwtController } from './ai-tool-connectivity-jwt.controller';

@Module({
  imports: [
    IntegrationCredentialsModule,
    ProductAccessCoreModule,
    SequelizeModule.forFeature([AiBusinessConnection, AiToolRevision, AiRobotToolBinding]),
  ],
  providers: [AiToolConnectivityService],
  controllers: [AiToolConnectivityJwtController],
  exports: [AiToolConnectivityService, SequelizeModule],
})
export class AiToolConnectivityModule {}
