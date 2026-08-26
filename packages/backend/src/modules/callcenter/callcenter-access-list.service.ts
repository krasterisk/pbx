/**
 * Resolves the call-center access list (numbers) for a user.
 *
 * Operators are users (OPERATOR / SUPERVISOR), not SIP endpoints.
 * An operator may have no extension until shift start.
 */
import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { User, UserLevel } from '../users/user.model';
import { NumberList } from '../numbers/number-list.model';
import { CallCenterStateService } from './callcenter-state.service';
import {
  hasOperatorUserIdsKey,
  isUnrestrictedAccessList,
  normalizeAccessToken,
  normalizeAccessTokenSet,
  parsePositiveIdList,
} from './callcenter-access-list.util';
import { interfaceToExtension } from '../endpoints/endpoint-ids.util';

export const CC_OPERATOR_USER_LEVELS = [UserLevel.OPERATOR, UserLevel.SUPERVISOR];

export interface AccessScope {
  /** null = unrestricted (no numbers_id or empty arrays). User uniqueids. */
  operators: Set<number> | null;
  queues: Set<string> | null;
}

export interface AccessCandidate {
  userId: number;
  name: string;
  /** Current shift / directory extension; empty until shift start. */
  exten: string;
  /** Live PJSIP interface; empty when offline / no shift. */
  interface: string;
  online: boolean;
  /** Filename under tenant avatars dir; null when no photo. */
  avatar: string | null;
}

@Injectable()
export class CallCenterAccessListService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(NumberList) private readonly numberListModel: typeof NumberList,
    @Optional() private readonly stateService?: CallCenterStateService,
  ) {}

  async resolveScope(userUid: number, userId: number): Promise<AccessScope> {
    const user = await this.userModel.findOne({
      where: { uniqueid: userId, vpbx_user_uid: userUid },
      attributes: ['uniqueid', 'numbers_id'],
    });
    const row = user ?? await this.userModel.findOne({
      where: { uniqueid: userId },
      attributes: ['uniqueid', 'numbers_id', 'vpbx_user_uid'],
    });
    const numbersId = row?.getDataValue('numbers_id') as number | null | undefined;
    if (!numbersId || numbersId <= 0) {
      return { operators: null, queues: null };
    }

    const list = await this.numberListModel.findOne({
      where: { id: numbersId },
      attributes: ['id', 'numbers', 'user_uid'],
    });
    if (!list) {
      return { operators: null, queues: null };
    }

    const raw = this.readNumbersBlob(list.getDataValue('numbers'));
    const queues = normalizeAccessTokenSet(raw?.queues);

    let operators: Set<number> | null = null;
    if (hasOperatorUserIdsKey(raw)) {
      const ids = parsePositiveIdList(raw?.operatorUserIds);
      operators = isUnrestrictedAccessList(ids) ? null : new Set(ids);
    } else {
      const legacy = normalizeAccessTokenSet(raw?.operators);
      if (isUnrestrictedAccessList(legacy)) {
        operators = null;
      } else {
        operators = await this.mapExtensToUserIds(userUid, legacy);
      }
    }

    return {
      operators,
      queues: isUnrestrictedAccessList(queues) ? null : queues,
    };
  }

  isOperatorUserAllowed(scope: AccessScope, operatorUserId: number): boolean {
    if (scope.operators == null) return true;
    return scope.operators.has(Number(operatorUserId));
  }

  isQueueAllowed(scope: AccessScope, queueName: string): boolean {
    if (scope.queues == null) return true;
    return scope.queues.has(normalizeAccessToken(queueName));
  }

  /**
   * Users (operator / supervisor) the supervisor may add to their watchlist.
   * Extension is optional — assigned at shift start.
   */
  async listCandidateOperators(
    userUid: number,
    scope: AccessScope,
  ): Promise<AccessCandidate[]> {
    const users = await this.userModel.findAll({
      where: {
        vpbx_user_uid: userUid,
        level: { [Op.in]: CC_OPERATOR_USER_LEVELS },
      },
      attributes: ['uniqueid', 'name', 'login', 'exten', 'level', 'avatar'],
    });

    const liveByUser = new Map<number, { interface: string; exten: string; online: boolean }>();
    if (this.stateService) {
      for (const agent of this.stateService.getAllAgents(userUid)) {
        if (!agent.userId) continue;
        const exten = normalizeAccessToken(agent.interface);
        const online = agent.status !== 'OFFLINE';
        liveByUser.set(agent.userId, {
          interface: agent.interface,
          exten,
          online,
        });
      }
    }

    const out: AccessCandidate[] = [];
    for (const u of users) {
      const userId = Number(u.getDataValue('uniqueid') || 0);
      if (!userId) continue;
      if (!this.isOperatorUserAllowed(scope, userId)) continue;
      const live = liveByUser.get(userId);
      const dirExten =
        normalizeAccessToken(u.getDataValue('exten') as string)
        || this.numericLogin(u.getDataValue('login') as string);
      const name =
        String(u.getDataValue('name') || '').trim()
        || String(u.getDataValue('login') || '').trim()
        || String(userId);
      const avatarRaw = u.getDataValue('avatar');
      const avatar = typeof avatarRaw === 'string' && avatarRaw.trim() ? avatarRaw.trim() : null;
      out.push({
        userId,
        name,
        exten: live?.exten || dirExten || '',
        interface: live?.interface || '',
        online: Boolean(live?.online),
        avatar,
      });
    }

    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  serializeScope(scope: AccessScope): {
    operators: number[] | null;
    queues: string[] | null;
  } {
    return {
      operators: scope.operators ? [...scope.operators] : null,
      queues: scope.queues ? [...scope.queues] : null,
    };
  }

  normalizeExten(value: string): string {
    return normalizeAccessToken(value) || interfaceToExtension(value);
  }

  async mapWatchlistToUserIds(
    userUid: number,
    raw: unknown,
  ): Promise<number[]> {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const asIds = parsePositiveIdList(raw);
    if (asIds.length === raw.length) {
      const users = await this.userModel.findAll({
        where: { uniqueid: { [Op.in]: asIds }, vpbx_user_uid: userUid },
        attributes: ['uniqueid'],
      });
      const known = new Set(users.map((u) => Number(u.getDataValue('uniqueid'))));
      if (asIds.every((id) => known.has(id))) return asIds;
    }
    const tokens = normalizeAccessTokenSet(raw);
    const mapped = await this.mapExtensToUserIds(userUid, tokens);
    return [...mapped];
  }

  private async mapExtensToUserIds(userUid: number, tokens: Set<string>): Promise<Set<number>> {
    const ids = new Set<number>();
    if (tokens.size === 0) return ids;
    const users = await this.userModel.findAll({
      where: { vpbx_user_uid: userUid, level: { [Op.in]: CC_OPERATOR_USER_LEVELS } },
      attributes: ['uniqueid', 'exten', 'login'],
    });
    for (const u of users) {
      const exten =
        normalizeAccessToken(u.getDataValue('exten') as string)
        || this.numericLogin(u.getDataValue('login') as string);
      if (exten && tokens.has(exten)) ids.add(Number(u.getDataValue('uniqueid')));
    }
    if (this.stateService) {
      for (const agent of this.stateService.getAllAgents(userUid)) {
        if (agent.userId > 0 && tokens.has(normalizeAccessToken(agent.interface))) {
          ids.add(agent.userId);
        }
      }
    }
    return ids;
  }

  private readNumbersBlob(raw: unknown): { queues?: unknown; operators?: unknown; operatorUserIds?: unknown } | null {
    if (raw == null) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as { queues?: unknown; operators?: unknown; operatorUserIds?: unknown };
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') return raw as { queues?: unknown; operators?: unknown; operatorUserIds?: unknown };
    return null;
  }

  private numericLogin(login: string | null | undefined): string {
    const s = String(login || '').trim();
    if (/^\d+$/.test(s)) return s;
    return '';
  }
}
