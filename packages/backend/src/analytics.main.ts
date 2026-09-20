import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AnalyticsAppModule } from './compositions/analytics-app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AnalyticsAppModule);
  app.enableShutdownHooks();
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
  }));
  const swagger = new DocumentBuilder()
    .setTitle('Krasterisk Analytics API')
    .setDescription('Standalone speech-analytics public analysis and tenant onboarding')
    .setVersion('4.0')
    .addTag('Speech Analytics Public')
    .addTag('AI Integrations')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  const port = Number(process.env.BACKEND_PORT) || 5011;
  await app.listen(port);
}

void bootstrap();
