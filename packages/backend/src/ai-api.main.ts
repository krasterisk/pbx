import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AiApiModule } from './process-roles/ai-api.module';
import { assertNoCloudEgress } from './process-roles/ai-readiness';

async function bootstrap(): Promise<void> {
  assertNoCloudEgress(process.env);
  const app = await NestFactory.create(AiApiModule);
  app.enableShutdownHooks();
  app.use(helmet());
  app.setGlobalPrefix('api');
  await app.listen(Number(process.env.BACKEND_PORT) || 5021);
}

void bootstrap();
