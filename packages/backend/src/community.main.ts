import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { CommunityPbxModule } from './compositions/community-pbx.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(CommunityPbxModule);
  app.enableShutdownHooks();
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
  }));
  const port = Number(process.env.BACKEND_PORT) || 5010;
  await app.listen(port);
}

void bootstrap();
