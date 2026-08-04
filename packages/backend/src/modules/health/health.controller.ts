import { Controller, Get } from '@nestjs/common';

/**
 * Public liveness probe — no JWT required.
 * Global prefix `api` yields GET /api/health for CI wait-on (D-H06).
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
