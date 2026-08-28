import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Directory } from './directory.model';
import { DirectoryField } from './directory-field.model';
import { DirectoryRecord } from './directory-record.model';
import { RouteDirectoryBinding } from './route-directory-binding.model';
import { Route } from '../routes/route.model';
import { DirectoriesController } from './directories.controller';
import { DirectoryLookupController } from './directory-lookup.controller';
import { DirectoriesService } from './directories.service';
import { DirectoriesAiAdapter } from './directories-ai.adapter';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Directory,
      DirectoryField,
      DirectoryRecord,
      RouteDirectoryBinding,
      Route,
    ]),
    AiPlatformModule,
  ],
  controllers: [DirectoriesController, DirectoryLookupController],
  providers: [DirectoriesService, DirectoriesAiAdapter],
  exports: [DirectoriesService],
})
export class DirectoriesModule {}
