import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Route } from './route.model';
import { ContextInclude } from './context-include.model';
import { RoutesService } from './routes.service';
import { ContextIncludesService } from './context-includes.service';
import { RoutesController } from './routes.controller';
import { ContextIncludesController } from './context-includes.controller';
import { AmiModule } from '../ami/ami.module';
import { ContextsModule } from '../contexts/contexts.module';
import { Context } from '../contexts/context.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Route, ContextInclude, Context]),
    AmiModule,
    ContextsModule,
  ],
  controllers: [RoutesController, ContextIncludesController],
  providers: [RoutesService, ContextIncludesService],
  exports: [RoutesService, ContextIncludesService],
})
export class RoutesModule {}
