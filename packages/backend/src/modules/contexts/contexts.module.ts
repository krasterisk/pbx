import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Context } from './context.model';
import { ContextsService } from './contexts.service';
import { ContextsController } from './contexts.controller';
import { AmiModule } from '../ami/ami.module';

@Module({
  imports: [SequelizeModule.forFeature([Context]), forwardRef(() => AmiModule)],
  providers: [ContextsService],
  controllers: [ContextsController],
  exports: [ContextsService],
})
export class ContextsModule {}
