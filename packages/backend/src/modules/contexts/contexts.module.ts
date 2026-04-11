import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Context } from './context.model';
import { ContextsService } from './contexts.service';
import { ContextsController } from './contexts.controller';

@Module({
  imports: [SequelizeModule.forFeature([Context])],
  providers: [ContextsService],
  controllers: [ContextsController],
  exports: [ContextsService],
})
export class ContextsModule {}
