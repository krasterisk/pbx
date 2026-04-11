import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/sequelize';
import { PsEndpoint } from './src/modules/endpoints/ps-endpoint.model';
import { PsAuth } from './src/modules/endpoints/ps-auth.model';
import { PsAor } from './src/modules/endpoints/ps-aor.model';
import { PsContact } from './src/modules/endpoints/ps-contact.model';
import { PickupGroup } from './src/modules/endpoints/pickup-group.model';
import { ProvisionTemplate } from './src/modules/endpoints/provision-template.model';

async function bootstrap() {
  console.log('Bootstrapping app context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const psEndpoint = app.get(getModelToken(PsEndpoint));
  const psAuth = app.get(getModelToken(PsAuth));
  const psAor = app.get(getModelToken(PsAor));
  const psContact = app.get(getModelToken(PsContact));
  const pickupGroup = app.get(getModelToken(PickupGroup));
  const provisionTemplate = app.get(getModelToken(ProvisionTemplate));

  console.log('Force syncing ps_* tables...');
  
  // They depend on each other potentially, but dropping them is safe if we don't strict enforce FKs right now.
  // Actually, wait, do they have foreign keys?
  // Our Sequelize models do not enforce strict foreign key constraints between these.
  
  await psContact.sync({ force: true });
  console.log('ps_contacts re-created.');
  
  await psAuth.sync({ force: true });
  console.log('ps_auths re-created.');
  
  await psAor.sync({ force: true });
  console.log('ps_aors re-created.');
  
  await psEndpoint.sync({ force: true });
  console.log('ps_endpoints re-created.');
  
  await pickupGroup.sync({ force: true });
  console.log('pickup_groups re-created.');
  
  await provisionTemplate.sync({ force: true });
  console.log('provision_templates re-created.');

  console.log('Done.');
  await app.close();
}

bootstrap().catch(e => {
  console.error(e);
  process.exit(1);
});
