import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { RobotAppModule } from './compositions/robot-app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(RobotAppModule);
  app.enableShutdownHooks();
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
  }));
  const port = Number(process.env.BACKEND_PORT) || 5012;
  await app.listen(port);
}

void bootstrap();
