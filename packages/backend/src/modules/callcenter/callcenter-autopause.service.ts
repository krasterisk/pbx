/**
 * D-15: Auto-pause rule engine (RONA + configurable missed_count/idle_time/
 * status_duration rules), evaluated from the existing AMI state-update path
 * (CallCenterAmiService.handleCallerAbandon/handleAgentStatusEvent/recordMissed
 * call sites — RESEARCH Pitfall 7). Rule evaluation is filled in by 09-09
 * Task 3 (callcenter-autopause.service.spec.ts); the public shape below is
 * wired into CallCenterAmiService/callcenter.module.ts by Task 1 so the
 * module compiles/boots ahead of the full rule logic.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AmiService } from '../ami/ami.service';
import { CallCenterStateService, AgentStatus } from './callcenter-state.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CcSettings } from './models/cc-settings.model';

@Injectable()
export class CallCenterAutoPauseService {
  private readonly logger = new Logger(CallCenterAutoPauseService.name);

  constructor(
    private readonly amiService: AmiService,
    private readonly stateService: CallCenterStateService,
    private readonly metricsService: CallCenterMetricsService,
    @InjectModel(CcSettings) private readonly settingsModel: typeof CcSettings,
  ) {}

  /** RONA (D-15): filled in by Task 3. */
  async evaluateRonaOnAbandon(_userUid: number, _queueName: string): Promise<void> {
    // Task 3 implements RONA firing here.
  }

  /** missed_count rule (D-15): filled in by Task 3. */
  async evaluateOnMissed(_userUid: number, _agentInterface: string, _queues: string[]): Promise<void> {
    // Task 3 implements missed_count firing here.
  }

  /** idle_time / status_duration rules (D-15): filled in by Task 3. */
  async evaluateOnStatusEvent(
    _userUid: number,
    _agentInterface: string,
    _status: AgentStatus,
    _queues: string[],
    _lastCallTime?: Date,
  ): Promise<void> {
    // Task 3 implements idle_time/status_duration firing here.
  }
}
