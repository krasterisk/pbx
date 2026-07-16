import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CallCenterService } from './callcenter.service';
import { CallCenterStateService } from './callcenter-state.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

/**
 * CallCenterAiAdapter — Domain AI Adapter for call center (D-41b).
 *
 * Registers MCP/AI tools via AiAdapterRegistryService (auto-picked by
 * McpToolsService.getAllTools()). Every handler receives `vpbxUserUid` as a
 * call parameter — never closed over (D-42 / ASVS L1 HIGH, closes ARCHITECTURE §6 gap).
 *
 * D-44: no AI-agent-operator fields; tools only read/manage human agents.
 */
@Injectable()
export class CallCenterAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(CallCenterAiAdapter.name);
  readonly domain = 'callcenter';

  constructor(
    private readonly ccService: CallCenterService,
    private readonly stateService: CallCenterStateService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('CallCenterAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolGetQueueSnapshot(),
      this.toolGetAgents(),
      this.toolGetTodayKpi(),
      this.toolForcePauseAgent(),
      this.toolForceUnpauseAgent(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Колл-центр (Call Center) — модель сущностей
- Агент = SIP-интерфейс (PJSIP/ext_tenant) + статус: OFFLINE|READY|IN_CALL|RINGING|PAUSED|WRAPUP
- Очередь = name + strategy + waiting/talking + SLA%/ASR за сегодня (аккумуляторы metrics)
- Активный звонок = uniqueid + queue + agent + callerChannel; история в cc_queue_calls
- Супервизор может force-pause / force-unpause агента (деструктивные tools требуют confirm)
- Паузы имеют reason; per-operator settings (pickup, wrap-up) — отдельные сущности
- AI-агент как оператор очереди НЕ поддерживается (D-44) — только human-агенты
- Платный AI-voice (транскрипция) — отдельный модуль cc_ai_voice, не часть ядра КЦ`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const queues = this.stateService.getAllQueues(vpbxUserUid);
    const agents = this.stateService.getAllAgents(vpbxUserUid);
    if (queues.length === 0 && agents.length === 0) return '';

    const paused = agents.filter((a) => a.status === 'PAUSED');
    const waiting = queues.reduce((s, q) => s + (q.waiting || 0), 0);
    const talking = queues.reduce((s, q) => s + (q.talking || 0), 0);

    const lines: string[] = [
      `Колл-центр: ${queues.length} очередей, waiting=${waiting}, talking=${talking}, агентов=${agents.length}, на паузе=${paused.length}`,
    ];
    for (const q of queues.slice(0, 8)) {
      lines.push(
        `  • ${q.name}: SLA ${q.sla}% | ans=${q.calls?.answered ?? 0} abn=${q.calls?.abandoned ?? 0} | w=${q.waiting} t=${q.talking}`,
      );
    }
    if (paused.length > 0) {
      lines.push(
        `  Паузы: ${paused
          .slice(0, 5)
          .map((a) => `${a.interface}(${a.pauseReason || '—'})`)
          .join(', ')}`,
      );
    }
    return lines.join('\n');
  }

  private toolGetQueueSnapshot(): AiToolDefinition {
    return {
      name: 'cc_get_queue_snapshot',
      description:
        'Сводка очередей КЦ тенанта: waiting/talking, агенты (total/available/paused), SLA и counters за сегодня.',
      inputSchema: {},
      entityType: 'callcenter_queue',
      handler: async (_args, vpbxUserUid) => {
        const queues = this.stateService.getAllQueues(vpbxUserUid);
        return {
          queues: queues.map((q) => ({
            name: q.name,
            displayName: q.displayName,
            waiting: q.waiting,
            talking: q.talking,
            agents: q.agents,
            sla: q.sla,
            calls: q.calls,
            avgWait: q.avgWait,
            avgTalk: q.avgTalk,
          })),
        };
      },
    };
  }

  private toolGetAgents(): AiToolDefinition {
    return {
      name: 'cc_get_agents',
      description: 'Список агентов КЦ тенанта со статусами, паузами и очередями.',
      inputSchema: {},
      entityType: 'callcenter_agent',
      handler: async (_args, vpbxUserUid) => {
        const agents = this.stateService.getAllAgents(vpbxUserUid);
        return {
          agents: agents.map((a) => ({
            interface: a.interface,
            name: a.name,
            status: a.status,
            pauseReason: a.pauseReason,
            queues: a.queues,
            callsTaken: a.callsTaken,
            currentCall: a.currentCall,
          })),
        };
      },
    };
  }

  private toolGetTodayKpi(): AiToolDefinition {
    return {
      name: 'cc_get_today_kpi',
      description:
        'KPI очередей за сегодня из in-memory аккумуляторов: SLA, answered, abandoned, avgWait, avgTalk.',
      inputSchema: {},
      entityType: 'callcenter_queue',
      handler: async (_args, vpbxUserUid) => {
        const queues = this.stateService.getAllQueues(vpbxUserUid);
        return {
          kpi: queues.map((q) => {
            const answered = q.calls?.answered ?? 0;
            const abandoned = q.calls?.abandoned ?? 0;
            const total = q.calls?.total ?? answered + abandoned;
            const asr = total > 0 ? Math.round((answered / total) * 1000) / 10 : 100;
            return {
              queue: q.name,
              sla: q.sla,
              answered,
              abandoned,
              total,
              asr,
              avgWait: q.avgWait,
              avgTalk: q.avgTalk,
            };
          }),
        };
      },
    };
  }

  private toolForcePauseAgent(): AiToolDefinition {
    return {
      name: 'cc_force_pause_agent',
      description:
        'Принудительно поставить агента на паузу (supervisor force-pause). Деструктивная операция — требует confirm.',
      inputSchema: {
        agent_interface: { type: 'string', description: 'Интерфейс агента, напр. PJSIP/e101_42' },
        reason: { type: 'string', description: 'Причина паузы' },
      },
      entityType: 'callcenter_agent',
      destructive: true,
      handler: async (args, vpbxUserUid) => {
        const iface = String(args.agent_interface || '');
        const reason = args.reason != null ? String(args.reason) : undefined;
        return this.ccService.supervisorForcePause(iface, reason, vpbxUserUid);
      },
    };
  }

  private toolForceUnpauseAgent(): AiToolDefinition {
    return {
      name: 'cc_force_unpause_agent',
      description:
        'Снять агента с паузы (supervisor force-unpause). Деструктивная операция — требует confirm.',
      inputSchema: {
        agent_interface: { type: 'string', description: 'Интерфейс агента, напр. PJSIP/e101_42' },
      },
      entityType: 'callcenter_agent',
      destructive: true,
      handler: async (args, vpbxUserUid) => {
        const iface = String(args.agent_interface || '');
        return this.ccService.supervisorForceUnpause(iface, vpbxUserUid);
      },
    };
  }
}
