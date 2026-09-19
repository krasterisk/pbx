import { NestFactory } from '@nestjs/core';
import { AiWorkerModule } from './process-roles/ai-worker.module';
import { assertNoCloudEgress } from './process-roles/ai-readiness';
import { beginGracefulShutdown } from './process-roles/ai-shutdown';

async function bootstrap(): Promise<void> {
  assertNoCloudEgress(process.env);
  const app = await NestFactory.createApplicationContext(AiWorkerModule);
  app.enableShutdownHooks();
  process.on('SIGTERM', () => {
    beginGracefulShutdown({ claiming: true, inflight: 1, draining: false });
    void app.close();
  });
}

void bootstrap();
