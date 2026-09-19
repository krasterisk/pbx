import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiCaptureIntent, AiCaptureNodeBinding, AiCaptureReceipt, AiCaptureSegment,
} from './capture.models';

/** Capture contracts. Does not import AppModule or charge wallets. */
@Module({
  imports: [SequelizeModule.forFeature([
    AiCaptureNodeBinding, AiCaptureIntent, AiCaptureSegment, AiCaptureReceipt,
  ])],
  exports: [SequelizeModule],
})
export class RecordingCaptureModule {}
