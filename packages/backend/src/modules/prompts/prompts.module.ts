import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Prompt } from './prompt.model';
import { PromptsService } from './prompts.service';
import { PromptsController } from './prompts.controller';
import { AmiModule } from '../ami/ami.module';
import { IvrsModule } from '../ivrs/ivrs.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Prompt]),
    AmiModule,
    IvrsModule,
    SystemSettingsModule,
  ],
  controllers: [PromptsController],
  providers: [PromptsService],
  exports: [PromptsService],
})
export class PromptsModule {}
