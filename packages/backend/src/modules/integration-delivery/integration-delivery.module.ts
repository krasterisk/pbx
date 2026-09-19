import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { IntegrationCredentialsModule } from '../integration-credentials/integration-credentials.module';
import { AiWebhookAttempt, AiWebhookDelivery, AiWebhookEndpoint } from './webhook.models';
import { IntegrationDeliveryController } from './integration-delivery.controller';

@Module({
  imports: [
    IntegrationCredentialsModule,
    SequelizeModule.forFeature([AiWebhookEndpoint, AiWebhookDelivery, AiWebhookAttempt]),
  ],
  controllers: [IntegrationDeliveryController],
  exports: [SequelizeModule],
})
export class IntegrationDeliveryModule {}
