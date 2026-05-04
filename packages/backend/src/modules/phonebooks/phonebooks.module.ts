import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoutePhonebook } from './phonebook.model';
import { PhonebookEntry } from './phonebook-entry.model';
import { PhonebooksController } from './phonebooks.controller';
import { PhonebooksService } from './phonebooks.service';

@Module({
  imports: [SequelizeModule.forFeature([RoutePhonebook, PhonebookEntry])],
  controllers: [PhonebooksController],
  providers: [PhonebooksService],
  exports: [PhonebooksService],
})
export class PhonebooksModule {}
