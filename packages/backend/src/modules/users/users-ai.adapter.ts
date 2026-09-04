import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserLevel } from './user.model';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

/** Explicit allow list — never project an entity by subtracting known secrets (T-15-73). */
export const PORTAL_USER_FIELDS = ['uid', 'name', 'role', 'last_activity'] as const;

export type PortalUserView = {
  uid: number | null;
  name: string;
  role: string;
  last_activity: string | null;
};

/**
 * UsersAiAdapter — read-only portal user tools (D-15, D-21, D-22).
 * Output is built from PORTAL_USER_FIELDS. Role changes are out of shape, not deferred.
 */
@Injectable()
export class UsersAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(UsersAiAdapter.name);
  readonly domain = 'users';

  constructor(
    private readonly usersService: UsersService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('UsersAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListPortalUsers(), this.toolDescribePortalUser()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Пользователи портала
- Пользователь портала — логин в веб-интерфейс, не SIP-абонент.
- Роли: SUPERADMIN, ADMIN, OPERATOR, SUPERVISOR, READONLY. Агент описывает, кто имеет доступ, и никогда не меняет роль.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const rows = await this.usersService.findAll(vpbxUserUid);
    if (rows.length === 0) return '';
    const names = rows.map((row) => toPortalUserView(row).name).filter(Boolean);
    return `Пользователи портала: ${names.join(', ')}`;
  }

  private toolListPortalUsers(): AiToolDefinition {
    return {
      name: 'list_portal_users',
      description:
        'Список пользователей портала тенанта: имя, роль, последняя активность. Без паролей и без изменения ролей.',
      inputSchema: {},
      entityType: 'user',
      handler: async (_args, uid) => {
        const rows = await this.usersService.findAll(uid);
        return { users: rows.map((row) => toPortalUserView(row)) };
      },
    };
  }

  private toolDescribePortalUser(): AiToolDefinition {
    return {
      name: 'describe_portal_user',
      description: 'Один пользователь портала: имя, роль, активность. Секреты и смена роли недоступны.',
      inputSchema: {
        uid: { type: 'number', description: 'UID пользователя портала' },
      },
      entityType: 'user',
      handler: async (args, uid) => {
        const found = await this.usersService.findById(Number(args.uid), uid);
        if (!found) {
          return { error: 'User not found' };
        }
        return toPortalUserView(found);
      },
    };
  }
}

export function toPortalUserView(user: {
  uniqueid?: number;
  uid?: number;
  name?: string;
  level?: UserLevel | number;
  last_activity?: string | Date | null;
  updatedAt?: Date | string;
  updated_at?: Date | string;
}): PortalUserView {
  const last = user.last_activity ?? user.updatedAt ?? user.updated_at ?? null;
  return {
    uid: user.uniqueid ?? user.uid ?? null,
    name: user.name ?? '',
    role: roleName(user.level),
    last_activity: last instanceof Date ? last.toISOString() : last,
  };
}

function roleName(level: UserLevel | number | undefined): string {
  if (typeof level === 'number' && UserLevel[level]) {
    return UserLevel[level];
  }
  return String(level ?? '');
}
