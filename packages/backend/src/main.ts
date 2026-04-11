import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { execSync } from 'child_process';
import * as net from 'net';

/**
 * Check if a port is already in use.
 * Returns true if the port is occupied.
 */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

/**
 * Kill the process occupying a given port (Windows only).
 * Used during development to prevent EADDRINUSE when nest --watch
 * fails to cleanly terminate the previous instance.
 */
async function killPortProcess(port: number): Promise<void> {
  if (process.platform !== 'win32') return;

  try {
    const result = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { encoding: 'utf-8' },
    );
    const lines = result.trim().split('\n');
    const pids = new Set<string>();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && pid !== String(process.pid)) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf-8' });
        console.log(`⚠️  Killed stale process ${pid} on port ${port}`);
      } catch {
        // Process may have already exited
      }
    }
    // Brief pause to let the OS release the port
    if (pids.size > 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch {
    // No process found on port — nothing to kill
  }
}

async function bootstrap() {
  const port = Number(process.env.BACKEND_PORT) || 5010;

  // In development, auto-kill stale processes holding the port
  if (process.env.NODE_ENV === 'development' && (await isPortInUse(port))) {
    console.log(`⚠️  Port ${port} is in use, killing stale process...`);
    await killPortProcess(port);
  }

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3010',
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

  await app.listen(port);
  console.log(`🚀 Krasterisk v4 Backend running on port ${port}`);
  console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
