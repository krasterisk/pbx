import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RouteTemplatesService } from './route-templates.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import type { ApplyRouteTemplateDto } from './dto/route-template.dto';

/**
 * RouteTemplatesAiAdapter — Domain AI Adapter for route templates (D-34).
 *
 * Tools are registered through AiAdapterRegistryService. Every handler receives
 * `vpbxUserUid` as a call parameter — never closed over.
 */
@Injectable()
export class RouteTemplatesAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(RouteTemplatesAiAdapter.name);
  readonly domain = 'route_templates';

  constructor(
    private readonly routeTemplatesService: RouteTemplatesService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('RouteTemplatesAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListTemplates(),
      this.toolApplyTemplate(),
      this.toolBuildFromDescription(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Шаблоны маршрутов (Route templates)
- Встроенные шаблоны (vpbx_user_uid = null) видны всем тенантам и только для чтения.
- Тенантные шаблоны — свои цепочки; create/update/delete только своих строк.
- Слоты типизированы: queue, group, ivr, trunk, recording, directory.
- apply_template возвращает новые actions с новыми id; dialplan не применяется до сохранения маршрута.
- build_from_description в этой фазе возвращает пустой черновик; полная сборка — Phase 15.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const templates = await this.routeTemplatesService.findAll(vpbxUserUid);
    if (templates.length === 0) return '';
    const lines = ['Шаблоны маршрутов:'];
    for (const template of templates) {
      const origin = template.vpbx_user_uid == null ? 'built-in' : 'tenant';
      lines.push(`  • "${template.name}" (${origin}, ${template.slots.length} slots)`);
    }
    return lines.join('\n');
  }

  private toolListTemplates(): AiToolDefinition {
    return {
      name: 'list_templates',
      description:
        'Список шаблонов маршрутов тенанта: встроенные и свои. Возвращает uid, имя, слоты, число действий.',
      inputSchema: {},
      entityType: 'route_template',
      handler: async (_args, uid) => {
        const templates = await this.routeTemplatesService.findAll(uid);
        return {
          templates: templates.map((template) => ({
            uid: template.uid,
            name: template.name,
            description: template.description,
            slots: template.slots,
            actionsCount: template.actions.length,
            builtin: template.vpbx_user_uid == null,
          })),
        };
      },
    };
  }

  private toolApplyTemplate(): AiToolDefinition {
    return {
      name: 'apply_template',
      description:
        'Подставляет слоты шаблона и возвращает новую цепочку actions. Dialplan не применяется.',
      inputSchema: {
        uid: { type: 'number', description: 'UID шаблона' },
        slotValues: {
          type: 'object',
          description: 'Карта slotId → { uid, name? } сущностей тенанта',
        },
        mode: { type: 'string', description: 'replace | append — учитывается на клиенте' },
      },
      entityType: 'route_template',
      handler: async (args, uid) => {
        return this.routeTemplatesService.apply(
          Number(args.uid),
          {
            slotValues: (args.slotValues ?? {}) as ApplyRouteTemplateDto['slotValues'],
            mode: args.mode === 'replace' || args.mode === 'append' ? args.mode : undefined,
          },
          uid,
        );
      },
    };
  }

  private toolBuildFromDescription(): AiToolDefinition {
    return {
      name: 'build_from_description',
      description:
        'Собрать черновик шаблона из текстового описания. В этой фазе возвращает пустой draft (Phase 15 заполнит).',
      inputSchema: {
        description: { type: 'string', description: 'Описание желаемого маршрута' },
      },
      entityType: 'route_template',
      handler: async (args, uid) => {
        return this.routeTemplatesService.buildFromDescription(uid, String(args.description ?? ''));
      },
    };
  }
}
