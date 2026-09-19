import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiMediaAsset, AiUpload } from './media-asset.models';

/** Storage/probe contracts. Public analysis HTTP remains AI-04. Not imported by AppModule. */
@Module({
  imports: [SequelizeModule.forFeature([AiMediaAsset, AiUpload])],
  exports: [SequelizeModule],
})
export class MediaAssetsModule {}
