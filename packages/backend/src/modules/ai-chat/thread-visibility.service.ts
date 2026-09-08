import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User, UserLevel } from '../users/user.model';
import { NumberList } from '../numbers/number-list.model';
import { parsePositiveIdList } from '../callcenter/callcenter-access-list.util';
import { AiChatSettingsService } from './ai-chat-settings.service';

export interface ThreadVisibilityScope {
  /** null = только свои. Иначе — список чужих авторов, доступных на чтение. */
  readableAuthors: number[] | null;
  /** true, когда админ тенанта включил «видеть все треды». */
  allTenantThreads: boolean;
}

const OWN_ONLY: ThreadVisibilityScope = { readableAuthors: null, allTenantThreads: false };

/**
 * Resolves which other authors' threads a caller may read.
 * Tenant-scoped user lookup only — no cross-tenant fallback.
 * Empty access list means nobody else's threads (unlike CDR).
 */
@Injectable()
export class ThreadVisibilityService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(NumberList) private readonly numberListModel: typeof NumberList,
    private readonly settings: AiChatSettingsService,
  ) {}

  async resolve(tenantUid: number, userUid: number, role: number): Promise<ThreadVisibilityScope> {
    if (role === UserLevel.SUPERADMIN) {
      return OWN_ONLY;
    }

    if (role === UserLevel.ADMIN && (await this.settings.getSeeAllThreads(tenantUid))) {
      return { readableAuthors: null, allTenantThreads: true };
    }

    const user = await this.userModel.findOne({
      where: { uniqueid: userUid, vpbx_user_uid: tenantUid },
      attributes: ['uniqueid', 'numbers_id'],
    });
    const numbersId = this.readValue<number | null | undefined>(user, 'numbers_id');
    if (!numbersId || numbersId <= 0) {
      return OWN_ONLY;
    }

    const list = await this.numberListModel.findOne({
      where: { id: numbersId, user_uid: tenantUid },
      attributes: ['id', 'numbers', 'user_uid'],
    });
    if (!list) {
      return OWN_ONLY;
    }

    const blob = this.readNumbersBlob(this.readValue(list, 'numbers'));
    const ids = parsePositiveIdList(blob?.aiThreads?.userIds);
    const authors = ids.filter((id) => id !== userUid);
    if (authors.length === 0) {
      return OWN_ONLY;
    }
    return { readableAuthors: authors, allTenantThreads: false };
  }

  private readValue<T>(model: { getDataValue?: (key: string) => unknown } | null, key: string): T | undefined {
    if (!model) return undefined;
    if (typeof model.getDataValue === 'function') {
      return model.getDataValue(key) as T;
    }
    return (model as Record<string, unknown>)[key] as T;
  }

  private readNumbersBlob(raw: unknown): { aiThreads?: { userIds?: unknown } } | null {
    if (raw == null) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as { aiThreads?: { userIds?: unknown } };
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') return raw as { aiThreads?: { userIds?: unknown } };
    return null;
  }
}
