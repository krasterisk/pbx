import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NumbersService } from './numbers.service';
import { RoutesService } from '../routes/routes.service';
import { pickBestAsteriskMatch } from '../directories/directory-pattern.util';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

interface NumberRow {
  id?: number;
  name?: string;
  number?: string;
  status?: string;
}

interface RouteRow {
  uid?: number;
  name?: string;
  extensions?: string[];
  actions?: unknown;
}

/**
 * NumbersAiAdapter — read-only DID tools (D-15).
 * List returns status and assignment; describe resolves the current destination
 * through the tenant's route lookup so the model does not match patterns by hand.
 */
@Injectable()
export class NumbersAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(NumbersAiAdapter.name);
  readonly domain = 'numbers';

  constructor(
    private readonly numbersService: NumbersService,
    private readonly registry: AiAdapterRegistryService,
    private readonly routesService: RoutesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('NumbersAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListNumbers(), this.toolDescribeNumber()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Номера
- Номер тенанта — DID или маска, не список доступа оператора.
- describe_number уже решает, какой маршрут ловит номер и куда он ведёт. Не сопоставляй шаблоны сам.
- Номер без маршрута возвращается как unrouted, а не как «номера нет».`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const rows = await this.numbersService.findAll(vpbxUserUid);
    if (rows.length === 0) return '';
    const labels = rows.map((row) => numberOf(row as NumberRow)).filter(Boolean);
    return labels.length ? `Номера: ${labels.join(', ')}` : '';
  }

  private toolListNumbers(): AiToolDefinition {
    return {
      name: 'list_numbers',
      description:
        'Список номеров тенанта со статусом и назначенным маршрутом. Куда ведёт номер — describe_number.',
      inputSchema: {},
      entityType: 'number',
      handler: async (_args, uid) => {
        const [rows, routes] = await Promise.all([
          this.numbersService.findAll(uid),
          this.routesService.findAll(uid),
        ]);
        return {
          numbers: rows.map((row) => {
            const value = numberOf(row as NumberRow);
            const match = matchRoute(routes as RouteRow[], value);
            return {
              id: row.id,
              name: row.name ?? null,
              number: value,
              status: (row as NumberRow).status ?? 'active',
              assignment: match?.name ?? null,
            };
          }),
        };
      },
    };
  }

  private toolDescribeNumber(): AiToolDefinition {
    return {
      name: 'describe_number',
      description:
        'Один номер: статус, маршрут и текущее назначение. Если маршрута нет — unrouted, не пропуск.',
      inputSchema: {
        number: { type: 'string', description: 'Номер или маска из list_numbers' },
        id: { type: 'number', description: 'UID записи номера' },
      },
      entityType: 'number',
      handler: async (args, uid) => {
        const rows = await this.numbersService.findAll(uid);
        const wanted = args.number != null ? String(args.number).trim() : '';
        const wantedId = args.id != null ? Number(args.id) : NaN;
        const row = rows.find((entry) => {
          if (Number.isFinite(wantedId) && entry.id === wantedId) return true;
          return wanted && numberOf(entry as NumberRow) === wanted;
        }) as NumberRow | undefined;
        const value = wanted || (row ? numberOf(row) : '');
        const routes = await this.routesService.findAll(uid);
        const match = matchRoute(routes as RouteRow[], value);
        if (!match) {
          return {
            id: row?.id ?? null,
            name: row?.name ?? null,
            number: value,
            status: row?.status ?? 'unknown',
            routed: false,
            route: null,
            destination: 'unrouted',
          };
        }
        return {
          id: row?.id ?? null,
          name: row?.name ?? null,
          number: value,
          status: row?.status ?? 'active',
          routed: true,
          route: { uid: match.uid ?? null, name: match.name ?? null },
          destination: destinationOf(match.actions),
        };
      },
    };
  }
}

function numberOf(row: NumberRow): string {
  if (typeof row.number === 'string' && row.number.trim()) return row.number.trim();
  if (typeof row.name === 'string' && /^\d+$/.test(row.name.trim())) return row.name.trim();
  return String(row.name ?? '').trim();
}

function matchRoute(routes: RouteRow[], value: string): RouteRow | undefined {
  if (!value) return undefined;
  const candidates = routes.flatMap((route) =>
    (route.extensions ?? []).map((pattern) => ({ route, pattern })),
  );
  return pickBestAsteriskMatch(candidates, (entry) => entry.pattern, value)?.route;
}

function destinationOf(actions: unknown): string {
  if (!Array.isArray(actions) || actions.length === 0) return 'нет';
  const first = actions[0];
  if (!first || typeof first !== 'object') return 'нет';
  const rec = first as Record<string, unknown>;
  const type = String(rec.type || '');
  const params = (rec.params && typeof rec.params === 'object' ? rec.params : {}) as Record<string, unknown>;
  const target = readTarget(params);
  return target ? `${type} ${target}` : type || 'нет';
}

function readTarget(params: Record<string, unknown>): string | null {
  if (params.ivr_uid != null) return String(params.ivr_uid);
  if (typeof params.queue === 'string') return params.queue;
  if (typeof params.trunk === 'string') return params.trunk;
  if (typeof params.exten === 'string') return params.exten;
  const target = params.target;
  if (typeof target === 'string') return target;
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    const rec = target as Record<string, unknown>;
    if (rec.value != null) return String(rec.value);
  }
  return null;
}
