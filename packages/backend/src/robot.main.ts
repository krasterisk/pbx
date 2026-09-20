import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
  const swagger = new DocumentBuilder()
    .setTitle('Krasterisk Robot API')
    .setDescription('Standalone AI-voice robots onboarding and JWT /api/v1/ai-voice')
    .setVersion('4.0')
    .addTag('AI Voice')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  const port = Number(process.env.BACKEND_PORT) || 5012;
  await app.listen(port);
}

void bootstrap();
