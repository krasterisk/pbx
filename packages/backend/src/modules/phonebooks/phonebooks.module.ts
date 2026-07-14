import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoutePhonebook } from './phonebook.model';
import { PhonebookEntry } from './phonebook-entry.model';
import { RoutePhonebookBinding } from './route-phonebook-binding.model';
import { PhonebooksController } from './phonebooks.controller';
import { PhonebookLookupController } from './phonebook-lookup.controller';
import { PhonebooksService } from './phonebooks.service';
import { PhonebooksAiAdapter } from './phonebooks-ai.adapter';
import { RoutesModule } from '../routes/routes.module';
import { AmiModule } from '../ami/ami.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [
    SequelizeModule.forFeature([RoutePhonebook, PhonebookEntry, RoutePhonebookBinding]),
    RoutesModule,
    AmiModule,
    AiPlatformModule,
  ],
  controllers: [PhonebooksController, PhonebookLookupController],
  providers: [PhonebooksService, PhonebooksAiAdapter],
  exports: [PhonebooksService],
})
export class PhonebooksModule {}
