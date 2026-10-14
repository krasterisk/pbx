import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { StandaloneVoiceRobotsModule } from './module';

async function bootstrap(): Promise<void> {
  for (const name of ['VOICE_ROBOTS_PUBLIC_API_KEY', 'CC_AI_KEY_SECRET', 'DB_PASSWORD', 'ARI_PASSWORD']) {
    if (!process.env[name]) throw new Error(`Required standalone setting: ${name}`);
  }
  const app = await NestFactory.create(StandaloneVoiceRobotsModule, { bodyParser: false });
  app.use(json({ limit: '4mb' }));
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  await app.listen(Number(process.env.BACKEND_PORT) || 5013, '127.0.0.1');
}
void bootstrap();
