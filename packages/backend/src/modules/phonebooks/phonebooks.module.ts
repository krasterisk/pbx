import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoutePhonebook } from './phonebook.model';
import { PhonebookEntry } from './phonebook-entry.model';
import { RoutePhonebookBinding } from './route-phonebook-binding.model';
import { PhonebooksController } from './phonebooks.controller';
import { PhonebookLookupController } from './phonebook-lookup.controller';
import { PhonebooksService } from './phonebooks.service';
import { RoutesModule } from '../routes/routes.module';
import { AmiModule } from '../ami/ami.module';

@Module({
  imports: [
    SequelizeModule.forFeature([RoutePhonebook, PhonebookEntry, RoutePhonebookBinding]),
    RoutesModule,
    AmiModule,
  ],
  controllers: [PhonebooksController, PhonebookLookupController],
  providers: [PhonebooksService],
  exports: [PhonebooksService],
})
export class PhonebooksModule {}
