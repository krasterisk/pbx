import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AcChannelReservation } from './models/ac-channel-reservation.model';

export const CHANNEL_RESERVATION_TTL_MS = 30_000;

@Injectable()
export class AutodialReservationService {
  private readonly logger = new Logger(AutodialReservationService.name);

  constructor(
    @InjectModel(AcChannelReservation)
    private readonly model: typeof AcChannelReservation,
  ) {}

  async reserve(input: {
    userUid: number;
    campaignUid: number;
    taskUid: number;
    trunkId: string;
    owner: string;
    ttlMs?: number;
  }): Promise<boolean> {
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? CHANNEL_RESERVATION_TTL_MS));
    try {
      await this.model.create({
        user_uid: input.userUid,
        campaign_uid: input.campaignUid,
        task_uid: input.taskUid,
        trunk_id: input.trunkId,
        owner: input.owner,
        expires_at: expiresAt,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Trunk reservation failed for task ${input.taskUid}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async release(taskUid: number): Promise<void> {
    await this.model.destroy({ where: { task_uid: taskUid } });
  }

  async sweepExpired(now = new Date()): Promise<number> {
    return this.model.destroy({ where: { expires_at: { [Op.lt]: now } } });
  }

  /** Open holds keyed by `${tenant}:${trunkId}` for capacity math. */
  async countOpenByTrunk(now = new Date()): Promise<Map<string, number>> {
    const rows = await this.model.findAll({
      where: { expires_at: { [Op.gt]: now } },
      attributes: ['user_uid', 'trunk_id'],
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.user_uid}:${row.trunk_id}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }
}
