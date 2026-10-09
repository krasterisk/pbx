import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { wrapUntrustedData } from '../../shared/utils/prompt-injection.util';
import { AiAdapterRegistryService } from './ai-adapter-registry.service';
import { AiToolDefinition, DomainAiAdapter } from './ai-adapter.types';
import { jsonSchemaOf } from './ai-mutation.contract';
import { MODULE_COVERAGE, adapterDomainOf } from './module-coverage.registry';

export const SKILL_BODY_MAX_CHARS = 8000;
export const SKILL_BULK_READ_MAX = 4;
export const SKILLS_ROOT = 'SKILLS_ROOT';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const TRUNCATION_NOTE = '\n\n[truncated]';

export type SkillRisk = 'low' | 'medium' | 'high';

export interface SkillCatalogEntry {
  name: string;
  description: string;
  domains: string[];
  intents: string[];
  aliases: string[];
  related: string[];
  risk: SkillRisk;
}

interface LoadedSkill extends SkillCatalogEntry {
  body: string;
}

export function resolveSkillsRootCandidates(
  moduleDir: string = __dirname,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string[] {
  const compiled = path.resolve(moduleDir, '../../skills');
  const fromSrc = path.resolve(process.cwd(), 'src/skills');
  // Watch-mode must not depend on nest copying SKILL.md into dist (Windows EBUSY kills --watch).
  if (nodeEnv === 'development') {
    return [fromSrc, compiled];
  }
  return [compiled, fromSrc];
}

function pickScalar(head: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(head);
  return (match?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
}

function pickList(head: string, key: string): string[] {
  const inline = new RegExp(`^${key}:\\s*\\[(.*)\\]\\s*$`, 'm').exec(head);
  if (inline) {
    return inline[1]
      .split(',')
      .map((part) => part.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  const block = new RegExp(`^${key}:\\s*\\r?\\n((?:\\s*-\\s*.+\\r?\\n?)+)`, 'm').exec(head);
  if (block) {
    return block[1]
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  const scalar = pickScalar(head, key);
  return scalar ? [scalar] : [];
}

export function parseSkill(raw: string, fallbackName: string): LoadedSkill {
  const match = FRONTMATTER.exec(raw);
  if (!match) {
    return {
      name: fallbackName,
      description: '',
      domains: [fallbackName],
      intents: [],
      aliases: [],
      related: [],
      risk: 'medium',
      body: raw,
    };
  }
  const head = match[1];
  const name = pickScalar(head, 'name') || fallbackName;
  const domains = pickList(head, 'domains');
  const riskRaw = pickScalar(head, 'risk').toLowerCase();
  const risk: SkillRisk =
    riskRaw === 'low' || riskRaw === 'high' || riskRaw === 'medium' ? riskRaw : 'medium';
  return {
    name,
    description: pickScalar(head, 'description'),
    domains: domains.length ? domains : [name],
    intents: pickList(head, 'intents'),
    aliases: pickList(head, 'aliases'),
    related: pickList(head, 'related'),
    risk,
    body: match[2].trim(),
  };
}

/**
 * Repository-hosted skills with progressive disclosure (D-10, D-11).
 *
 * The system prompt carries the catalog (name + one-line description).
 * Selected skill bodies are injected by the server for the turn; `read_skill`
 * remains a fallback. Only bundled repository skills are trusted procedural text.
 */
@Injectable()
export class AgentSkillRegistryService implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(AgentSkillRegistryService.name);
  readonly domain = 'skills';
  private readonly skills = new Map<string, LoadedSkill>();

  constructor(
    private readonly registry: AiAdapterRegistryService,
    @Optional() @Inject(SKILLS_ROOT) skillsRootOverride?: string,
  ) {
    const skillsRoot = skillsRootOverride ?? this.resolveExistingRoot();
    this.loadSkills(skillsRoot);
  }

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('AgentSkillRegistryService registered');
  }

  getCatalog(): SkillCatalogEntry[] {
    return Array.from(this.skills.values())
      .map(({ body: _body, ...entry }) => entry)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getSkill(name: string): SkillCatalogEntry | undefined {
    const skill = this.skills.get(name);
    if (!skill) return undefined;
    const { body: _body, ...entry } = skill;
    return entry;
  }

  readSkill(name: string): string {
    const skill = this.skills.get(name);
    if (!skill) {
      return `Skill "${name}" not found.`;
    }
    return this.formatBody(name, skill.body);
  }

  /**
   * Budgeted bulk-read for server-side progressive disclosure (1–4 skills).
   * Bodies are returned as trusted procedural text for system-prompt injection
   * — still length-capped, but not wrapped as untrusted tool data.
   */
  readSkillsForPrompt(names: string[], max = SKILL_BULK_READ_MAX): string[] {
    const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, max);
    return unique
      .map((name) => {
        const skill = this.skills.get(name);
        if (!skill) return '';
        const body =
          skill.body.length <= SKILL_BODY_MAX_CHARS
            ? skill.body
            : `${skill.body.slice(0, SKILL_BODY_MAX_CHARS)}${TRUNCATION_NOTE}`;
        return `### skill:${name}\n${body}`;
      })
      .filter(Boolean);
  }

  findByDomain(domain: string): SkillCatalogEntry[] {
    return this.getCatalog().filter(
      (skill) => skill.domains.includes(domain) || skill.name === domain,
    );
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListSkills(), this.toolReadSkill(), this.toolConfigurationCapabilities()];
  }

  private toolConfigurationCapabilities(): AiToolDefinition {
    return {
      name: 'get_configuration_capabilities',
      description: 'Фактические возможности помощника по модулю/домену: операции, обязательные параметры, строгая схема конкретного инструмента, навыки и ограничения. Без домена — компактный каталог всех модулей. Используй перед настройкой неизвестного параметра.',
      entityType: 'configuration',
      inputSchema: { domain: { type: 'string' }, tool: { type: 'string' }, field: { type: 'string', description: 'Точная схема одного параметра, например advanced.dtmf_mode. Используй для больших схем.' } },
      handler: async (args) => {
        const tools = this.registry.getAllTools();
        if (typeof args.tool === 'string') {
          const tool = tools.find((entry) => entry.name === args.tool);
          if (!tool) return { error: 'Unknown tool', tool: args.tool };
          const raw = tool.inputSchema;
          const schema = tool.mutation ? jsonSchemaOf(tool.mutation.input)
            : raw.type === 'object' ? raw : { type: 'object', properties: raw };
          if (typeof args.field === 'string') {
            let fieldSchema: Record<string, any> = schema;
            for (const part of args.field.split('.')) {
              if (!fieldSchema.properties || !Object.hasOwn(fieldSchema.properties, part)) return { error: 'Unknown field', tool: tool.name, field: args.field };
              fieldSchema = fieldSchema.properties[part];
            }
            return { name: tool.name, field: args.field, schema: fieldSchema, confirmationRequired: !!tool.mutation || tool.proposes === true };
          }
          return { name: tool.name, description: tool.description, schema, mutation: !!tool.mutation,
            confirmationRequired: !!tool.mutation || tool.proposes === true,
            destructive: tool.destructive === true };
        }
        const domains = this.registry.getDomains();
        const requested = typeof args.domain === 'string' ? args.domain : null;
        const covered = Object.entries(MODULE_COVERAGE).filter(([module, entry]) => !requested || module === requested || adapterDomainOf(module, entry) === requested);
        return { modules: covered.map(([module, entry]) => ({ module, ...entry,
          registered: entry.kind === 'covered' && domains.includes(adapterDomainOf(module, entry)),
          skills: entry.kind === 'covered' ? [...new Set([...this.findByDomain(adapterDomainOf(module, entry)).map((skill) => skill.name), ...(entry.sharedSkill && this.getSkill(entry.sharedSkill) ? [entry.sharedSkill] : [])])] : [],
        })), tools: requested ? tools.filter((tool) => {
          const entry = MODULE_COVERAGE[requested];
          const adapter = this.registry.getAdapter(entry ? adapterDomainOf(requested, entry) : requested);
          return adapter?.getTools().some((candidate) => candidate.name === tool.name);
        }).map((tool) => ({ name: tool.name, description: tool.description, confirmationRequired: !!tool.mutation || tool.proposes === true })) : [],
        rule: 'Read the exact schema with tool=<name>. Configurations use a proposal and fresh tenant revalidation. Secrets are entered through a secure form, never chat. Missing capability is a limitation, not permission to invent an HTTP/SQL tool.' };
      },
    };
  }

  private formatBody(name: string, body: string): string {
    const clipped =
      body.length <= SKILL_BODY_MAX_CHARS
        ? body
        : `${body.slice(0, SKILL_BODY_MAX_CHARS)}${TRUNCATION_NOTE}`;
    return wrapUntrustedData(`skill:${name}`, clipped);
  }

  private resolveExistingRoot(): string | null {
    const candidates = resolveSkillsRootCandidates(__dirname);
    const found = candidates.find((dir) => {
      try {
        return fs.statSync(dir).isDirectory();
      } catch {
        return false;
      }
    });
    if (!found) {
      this.logger.error(
        `Skills directory not found. Tried: ${candidates.join(', ')}. Skills are mandatory (D-11).`,
      );
    }
    return found ?? null;
  }

  private loadSkills(skillsRoot: string | null): void {
    if (!skillsRoot) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
    } catch (err) {
      this.logger.error(`Failed to read skills directory "${skillsRoot}": ${String(err)}`);
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const skillFile = path.join(skillsRoot, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) {
        continue;
      }
      const parsed = parseSkill(fs.readFileSync(skillFile, 'utf8'), entry.name);
      this.skills.set(parsed.name, parsed);
    }

    const names = Array.from(this.skills.keys()).sort();
    this.logger.log(`Loaded ${this.skills.size} skill(s): ${names.join(', ') || '(none)'}`);
  }

  private toolListSkills(): AiToolDefinition {
    return {
      name: 'list_skills',
      description:
        'Catalog of available skills: name and one-line description only. Use read_skill for the body.',
      inputSchema: {},
      entityType: 'skill',
      handler: async (_args, _vpbxUserUid) => this.getCatalog(),
    };
  }

  private toolReadSkill(): AiToolDefinition {
    return {
      name: 'read_skill',
      description: 'Read one skill body by name. Catalog entries never include the body.',
      inputSchema: {
        name: { type: 'string', description: 'Skill name from list_skills' },
      },
      entityType: 'skill',
      handler: async (args, _vpbxUserUid) => this.readSkill(String(args.name ?? '')),
    };
  }
}
