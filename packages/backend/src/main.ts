import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { assertDevelopmentPortAvailable } from './shared/runtime/development-port';

/** 50MB audio as base64 is about 67MB of JSON. Nest's default 100kb parser rejects it before the module cap. */
const JSON_BODY_LIMIT = '72mb';

/**
 * Log process-level exit signals and fatal errors to backend-out.log.
 * Helps distinguish PM2 restart (SIGTERM), crash (uncaughtException), and OOM (SIGKILL, no log).
 */
function registerProcessDiagnostics(): void {
  const diag = (event: string, detail?: string) => {
    const msg = detail
      ? `[Process] ${event}: ${detail}`
      : `[Process] ${event}`;
    console.error(
      `${msg} pid=${process.pid} uptime=${process.uptime().toFixed(1)}s rss=${Math.round(process.memoryUsage().rss / 1024 / 1024)}MiB`,
    );
  };

  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    process.on(signal, () => diag(`received ${signal}`));
  }

  process.on('uncaughtExceptionMonitor', (err) => {
    diag('uncaughtException', err.message);
    console.error(err.stack);
  });

  process.on('unhandledRejection', (reason) => {
    const detail = reason instanceof Error ? reason.message : String(reason);
    diag('unhandledRejection', detail);
    if (reason instanceof Error && reason.stack) {
      console.error(reason.stack);
    }
    throw reason instanceof Error ? reason : new Error(detail);
  });

  process.on('exit', (code) => {
    diag('exit', `code=${code}`);
  });
}

async function bootstrap() {
  registerProcessDiagnostics();

  const port = Number(process.env.BACKEND_PORT) || 5010;

  if (process.env.NODE_ENV === 'development') {
    await assertDevelopmentPortAvailable(port);
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: JSON_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
  app.enableShutdownHooks();

  // HTTP-only / self-hosted boxes: disable HSTS and CSP upgrade-insecure-requests
  // (otherwise the browser rewrites http:// to https:// and playback fails without TLS).
  const strictSecurityHeaders = process.env.HELMET_HSTS === 'true';
  app.use(
    helmet({
      hsts: strictSecurityHeaders ? undefined : false,
      crossOriginOpenerPolicy: strictSecurityHeaders ? undefined : false,
      crossOriginEmbedderPolicy: strictSecurityHeaders ? undefined : false,
      // Allow <img>/<audio> from the SPA origin (different port) to load API streams.
      // Default helmet CORP=same-origin blocks cross-origin subresource loads.
      crossOriginResourcePolicy: strictSecurityHeaders
        ? undefined
        : { policy: 'cross-origin' },
      contentSecurityPolicy: strictSecurityHeaders
        ? undefined
        : {
            directives: {
              ...helmet.contentSecurityPolicy.getDefaultDirectives(),
              'upgrade-insecure-requests': null,
            },
          },
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Krasterisk v4 API')
    .setDescription('IP PBX Krasterisk REST API')
    .setVersion('4.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  if (process.env.BACKEND_HOST) {
    await app.listen(port, process.env.BACKEND_HOST);
  } else {
    await app.listen(port);
  }
  console.log(
    `🚀 Krasterisk v4 Backend running on port ${port} (pid=${process.pid})`,
  );
  console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

void bootstrap();
