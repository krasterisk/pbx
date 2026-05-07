import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, Logger, Inject, ParseIntPipe,
} from '@nestjs/common';
import { SystemSettingsService, ServerConfig } from './system-settings.service';
import { DialplanSubroutinesService } from './dialplan-subroutines.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserLevel } from '../users/user.model';
import { REDIS_CLIENT } from '../redis/redis.module';
import { WebhookQueueService } from '../routes/webhook-queue.service';

@Controller('system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserLevel.ADMIN)
export class SystemSettingsController {
  private readonly logger = new Logger(SystemSettingsController.name);

  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly subroutinesService: DialplanSubroutinesService,
    private readonly webhookQueueService: WebhookQueueService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  @Get()
  async findAll() {
    return this.systemSettingsService.findAll();
  }

  // ---------------------------------------------------------------------------
  // Redis / Queue status
  // ---------------------------------------------------------------------------

  /**
   * Returns Redis connection status and BullMQ webhook queue stats.
   * Useful for admin health dashboard.
   */
  @Get('redis-status')
  async getRedisStatus() {
    const isConnected = (this.redis as any).status === 'ready';
    if (!isConnected) {
      return { connected: false, message: 'Redis not connected — using in-memory fallback' };
    }
    const info = await this.redis.info('server').catch(() => '');
    const versionMatch = info.match(/redis_version:(\S+)/);
    return {
      connected: true,
      version: versionMatch?.[1] ?? 'unknown',
      host: this.redis.options?.host,
      port: this.redis.options?.port,
    };
  }

  // ---------------------------------------------------------------------------
  // Server Config — Records, Security, Integration
  // ---------------------------------------------------------------------------

  /**
   * Get server configuration values (from DB overrides or .env fallback).
   * Webhook secret is always masked in the response (••••••••).
   */
  @Get('server-config')
  async getServerConfig() {
    return this.systemSettingsService.getServerConfig();
  }

  /**
   * Update server configuration values.
   * Saves overrides to system_settings table — no SSH/restart required.
   * Empty string clears DB override and falls back to .env.
   */
  @Put('server-config')
  @HttpCode(200)
  async updateServerConfig(@Body() body: Partial<ServerConfig>) {
    return this.systemSettingsService.updateServerConfig(body);
  }

  // ---------------------------------------------------------------------------
  // ffmpeg status check
  // ---------------------------------------------------------------------------

  /**
   * Check if ffmpeg is available on the backend server.
   * Returns { available: boolean, version?, error? }.
   * NOTE: This checks the BACKEND server PATH — which is the Asterisk server in production.
   */
  @Get('ffmpeg-status')
  async getFfmpegStatus() {
    return this.systemSettingsService.checkFfmpeg();
  }

  // ---------------------------------------------------------------------------
  // Dialplan subroutines
  // ---------------------------------------------------------------------------

  /**
   * Regenerate and apply global Asterisk subroutines file.
   * Writes [krsk-on-answer] and [krsk-hangup-handler] contexts
   * to krasterisk/subroutines/subroutines.conf via AMI and reloads dialplan.
   * Auto-picked up by: #include krasterisk/*\/*.conf (already in extensions.conf).
   *
   * Called automatically at backend startup (onModuleInit).
   * Can also be triggered manually from System Settings UI.
   */
  @Post('apply-subroutines')
  @HttpCode(200)
  async applySubroutines() {
    try {
      return await this.subroutinesService.applySubroutines();
    } catch (err: any) {
      this.logger.error(`Failed to apply subroutines: ${err?.message}`);
      return { success: false, linesApplied: 0, error: err?.message || 'Unknown error' };
    }
  }

  // ---------------------------------------------------------------------------
  // Webhook Failures — Dead-letter management
  // ---------------------------------------------------------------------------

  /**
   * List failed webhook deliveries with pagination and optional filters.
   * Query params: page, limit, resolved (true/false), event
   */
  @Get('webhook-failures')
  async getWebhookFailures(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('resolved') resolved?: string,
    @Query('event') event?: string,
  ) {
    return this.webhookQueueService.getFailures({
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 200) : 50,
      resolved: resolved !== undefined ? resolved === 'true' : false, // default: unresolved only
      event: event || undefined,
    });
  }

  /**
   * Retry a specific failed webhook delivery.
   * Re-enqueues into BullMQ (or in-memory fallback) and sets retried_at.
   */
  @Post('webhook-failures/:id/retry')
  @HttpCode(200)
  async retryWebhookFailure(@Param('id', ParseIntPipe) id: number) {
    return this.webhookQueueService.retryFailure(id);
  }

  /**
   * Mark a specific failure as resolved (dismiss without retry).
   */
  @Delete('webhook-failures/:id')
  @HttpCode(200)
  async resolveWebhookFailure(@Param('id', ParseIntPipe) id: number) {
    await this.webhookQueueService.resolveFailure(id);
    return { resolved: true };
  }

  /**
   * Bulk-resolve all unresolved failures (optionally filter by route_uid).
   */
  @Post('webhook-failures/resolve-all')
  @HttpCode(200)
  async resolveAllWebhookFailures(@Body('route_uid') routeUid?: string) {
    const count = await this.webhookQueueService.resolveAll(routeUid);
    return { resolved: count };
  }
}
