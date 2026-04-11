import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PsEndpoint } from './ps-endpoint.model';
import { PsAuth } from './ps-auth.model';
import { PsAor } from './ps-aor.model';
import { PsContact } from './ps-contact.model';
import { PickupGroup } from './pickup-group.model';
import { ProvisionTemplate } from './provision-template.model';
import { PickupGroupsService } from './pickup-groups.service';
import { PickupGroupsController } from './pickup-groups.controller';
import { ProvisionTemplatesService } from './provision-templates.service';
import { ProvisionTemplatesController } from './provision-templates.controller';
import { ProvisionController } from './provision.controller';
import { EndpointsService } from './endpoints.service';
import { EndpointsController } from './endpoints.controller';
import { ContextsModule } from '../contexts/contexts.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PsEndpoint, PsAuth, PsAor, PsContact, 
      PickupGroup, ProvisionTemplate
    ]),
    ContextsModule,
    LoggerModule,
  ],
  providers: [EndpointsService, PickupGroupsService, ProvisionTemplatesService],
  controllers: [EndpointsController, PickupGroupsController, ProvisionTemplatesController, ProvisionController],
  exports: [EndpointsService],
})
export class EndpointsModule {}
