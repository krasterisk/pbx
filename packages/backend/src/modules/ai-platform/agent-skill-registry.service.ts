import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { wrapUntrustedData } from '../../shared/utils/prompt-injection.util';
import { AiAdapterRegistryService } from './ai-adapter-registry.service';
import { AiToolDefinition, DomainAiAdapter } from './ai-adapter.types';

export const SKILL_BODY_MAX_CHARS = 8000;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const TRUNCATION_NOTE = '\n\n[truncated]';

export interface SkillCatalogEntry {
  name: string;
  description: string;
}

interface LoadedSkill extends SkillCatalogEntry {
  body: string;
}

export function resolveSkillsRootCandidates(moduleDir: string = __dirname): string[] {
  return [path.resolve(moduleDir, '../../skills'), path.resolve(process.cwd(), 'src/skills')];
}

function pickFrontmatterField(head: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(head);
  return (match?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
}

function parseSkill(raw: string, fallbackName: string): LoadedSkill {
  const match = FRONTMATTER.exec(raw);
  if (!match) {
    return { name: fallbackName, description: '', body: raw };
  }
  return {
    name: pickFrontmatterField(match[1], 'name') || fallbackName,
    description: pickFrontmatterField(match[1], 'description'),
    body: match[2].trim(),
  };
}

/**
 * Repository-hosted skills with progressive disclosure (D-10, D-11).
 *
 * The system prompt carries the catalog (name + one-line description).
 * Bodies are loaded on demand through `read_skill` and never merged into the prompt.
 */
@Injectable()
export class AgentSkillRegistryService implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(AgentSkillRegistryService.name);
  readonly domain = 'skills';
  private readonly skills = new Map<string, LoadedSkill>();

  constructor(
    private readonly registry: AiAdapterRegistryService,
    skillsRootOverride?: string,
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
      .map(({ name, description }) => ({ name, description }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  readSkill(name: string): string {
    const skill = this.skills.get(name);
    if (!skill) {
      return `Skill "${name}" not found.`;
    }
    const body = skill.body.length <= SKILL_BODY_MAX_CHARS
      ? skill.body
      : `${skill.body.slice(0, SKILL_BODY_MAX_CHARS)}${TRUNCATION_NOTE}`;
    return wrapUntrustedData(`skill:${name}`, body);
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListSkills(), this.toolReadSkill()];
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
