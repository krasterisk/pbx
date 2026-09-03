import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Route } from '../routes/route.model';
import { RouteDirectoryBinding } from '../directories/route-directory-binding.model';
import { RouteReferencesController } from './route-references.controller';
import { RouteReferencesService } from './route-references.service';

@Module({
  imports: [SequelizeModule.forFeature([Route, RouteDirectoryBinding])],
  controllers: [RouteReferencesController],
  providers: [RouteReferencesService],
  exports: [RouteReferencesService],
})
export class RouteReferencesModule {}
