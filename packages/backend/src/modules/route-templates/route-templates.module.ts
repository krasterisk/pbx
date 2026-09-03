import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RouteTemplate } from './route-template.model';
import { RouteTemplatesController } from './route-templates.controller';
import { RouteTemplatesService } from './route-templates.service';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [
    SequelizeModule.forFeature([RouteTemplate]),
    AiPlatformModule,
  ],
  controllers: [RouteTemplatesController],
  providers: [RouteTemplatesService],
  exports: [RouteTemplatesService],
})
export class RouteTemplatesModule {}
