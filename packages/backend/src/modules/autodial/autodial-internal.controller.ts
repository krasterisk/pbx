import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeApiKeyEqual } from '../dialplan-bridge/dialplan-api-key';
import { AutodialAttemptService } from './autodial-attempt.service';

interface AttemptResultBody {
  api_key?: string;
  task?: string;
  campaign?: string;
  attempt?: string;
  answered?: string;
  billsec?: string;
  duration?: string;
  disposition?: string;
  amd?: string;
  queue?: string;
  agent?: string;
  dtmf?: string;
  uniqueid?: string;
  linkedid?: string;
}

interface AttemptMachineBody {
  api_key?: string;
  attempt?: string;
}

/**
 * Post-answer report from the `krsk-ac-finalize` hangup handler. This is the
 * only source for what happened *inside* the scenario — ARI sees the channel,
 * not the queue it landed in or the digits the subscriber pressed.
 *
 * Enrichment only: the ARI ChannelDestroyed handler decides the disposition, so
 * a lost CURL degrades detail rather than correctness.
 */
@Controller('internal/autodial')
export class AutodialInternalController {
  private readonly logger = new Logger(AutodialInternalController.name);
  private readonly apiKey: string;

  constructor(
    private readonly attempts: AutodialAttemptService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Post('attempt-result')
  @HttpCode(200)
  async attemptResult(@Body() body: AttemptResultBody): Promise<string> {
    if (!timingSafeApiKeyEqual(this.apiKey, body.api_key)) {
      this.logger.warn('Unauthorized autodial attempt-result');
      throw new UnauthorizedException('Invalid API key');
    }

    const attemptUid = parsePositiveInt(body.attempt);
    if (!attemptUid) return 'IGNORED';

    const billsec = parseNonNegativeInt(body.billsec);
    try {
      await this.attempts.applyScenarioResult(attemptUid, {
        amdResult: nonEmpty(body.amd),
        queueName: nonEmpty(body.queue),
        agentInterface: nonEmpty(body.agent),
        billsec,
        talkSec: billsec,
        uniqueid: nonEmpty(body.uniqueid),
        linkedid: nonEmpty(body.linkedid),
        scenarioResult: {
          dtmf: nonEmpty(body.dtmf),
          cdr_disposition: nonEmpty(body.disposition),
          duration: parseNonNegativeInt(body.duration),
        },
      });
      return 'OK';
    } catch (e) {
      this.logger.error(`attempt-result failed for ${attemptUid}: ${(e as Error).message}`);
      return 'ERROR';
    }
  }

  /**
   * The AMD machine branch calls this synchronously before it hangs up. Unlike
   * the regular report, this is a terminal classification that ARI must retain
   * when it processes ChannelDestroyed immediately afterwards.
   */
  @Post('attempt-machine')
  @HttpCode(200)
  async attemptMachine(@Body() body: AttemptMachineBody): Promise<string> {
    if (!timingSafeApiKeyEqual(this.apiKey, body.api_key)) {
      this.logger.warn('Unauthorized autodial attempt-machine');
      throw new UnauthorizedException('Invalid API key');
    }

    const attemptUid = parsePositiveInt(body.attempt);
    if (!attemptUid) return 'IGNORED';

    try {
      await this.attempts.markAmdMachine(attemptUid);
      return 'OK';
    } catch (e) {
      this.logger.error(`attempt-machine failed for ${attemptUid}: ${(e as Error).message}`);
      return 'ERROR';
    }
  }
}

function parsePositiveInt(raw?: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseNonNegativeInt(raw?: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function nonEmpty(raw?: string): string | null {
  const v = raw?.trim();
  return v ? v : null;
}
