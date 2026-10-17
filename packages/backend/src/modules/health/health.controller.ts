import { Controller, Get } from '@nestjs/common';
import { appIdentity } from './app-identity';

/**
 * Public liveness probe — no JWT required.
 * Global prefix `api` yields GET /api/health for CI wait-on (D-H06).
 * Version is the application release. SHA is the build. Schema is filled
 * after startup readiness and stays null when this process has not checked it.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      ...appIdentity(),
    };
  }
}
