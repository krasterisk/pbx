import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProductAccessCoreModule } from '../product-access/product-access-core.module';
import { IntegrationCredentialsModule } from '../integration-credentials/integration-credentials.module';
import {
  KbAccessBinding, KbBase, KbChunk, KbDocument, KbDocumentRevision, KbEmbeddingRevision,
  KbRelease, KbReleaseMember,
} from './knowledge.models';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeJwtController } from './knowledge-jwt.controller';

@Module({
  imports: [
    IntegrationCredentialsModule,
    ProductAccessCoreModule,
    SequelizeModule.forFeature([
      KbBase, KbDocument, KbDocumentRevision, KbChunk, KbEmbeddingRevision,
      KbRelease, KbReleaseMember, KbAccessBinding,
    ]),
  ],
  providers: [KnowledgeService],
  controllers: [KnowledgeJwtController],
  exports: [KnowledgeService, SequelizeModule],
})
export class KnowledgeModule {}
