import { Injectable } from '@nestjs/common';
import {
  AgentSkillRegistryService,
  SKILL_BULK_READ_MAX,
  type SkillCatalogEntry,
} from '../ai-platform/agent-skill-registry.service';
import type { ConversationBrief } from './conversation-brief.types';

export interface IntentClassification {
  intents: string[];
  skillNames: string[];
  domains: string[];
  confidence: number;
  source: 'deterministic' | 'brief' | 'fallback';
}

const ALWAYS_AVAILABLE_TOOLS = new Set([
  'list_skills',
  'read_skill',
  'get_pbx_state',
  'list_contexts',
  'get_cdr_summary',
  'find_cdr_calls',
  'propose_plan',
]);

const DOMAIN_TOOL_PREFIX: Record<string, string[]> = {
  ivrs: ['list_ivrs', 'create_ivr', 'update_ivr', 'delete_ivr', 'list_tts_engines'],
  endpoints: ['list_endpoints', 'create_endpoint', 'create_endpoints_bulk', 'delete_endpoint', 'update_endpoint'],
  'call-groups': ['list_call_groups', 'create_call_group', 'update_call_group', 'delete_call_group'],
  queues: ['list_queues', 'create_queue', 'update_queue', 'delete_queue'],
  routes: ['list_routes', 'create_route', 'delete_route', 'update_route'],
  trunks: ['list_trunks', 'create_trunk', 'delete_trunk', 'update_trunk'],
  contexts: ['list_contexts', 'create_context', 'update_context', 'delete_context'],
  directories: ['list_directories', 'create_directory', 'delete_directory', 'remove_directory_records'],
  moh: ['list_moh_classes', 'assign_moh_class', 'create_moh_class'],
  diagnostics: ['get_pbx_state', 'get_cdr_summary', 'find_cdr_calls'],
};

/**
 * Server-side intent → skill selection. Prefer deterministic matches against the
 * new user turn, pinned brief and active workflow; fall back to a broad but
 * still budgeted catalog slice when confidence is low.
 */
@Injectable()
export class AgentIntentClassifierService {
  constructor(private readonly skills: AgentSkillRegistryService) {}

  classify(input: {
    message: string;
    brief?: ConversationBrief | null;
    activeWorkflowDomains?: string[];
  }): IntentClassification {
    const message = input.message.trim();
    const catalog = this.skills.getCatalog();
    const scores = new Map<string, number>();

    const bump = (name: string, weight: number) => {
      scores.set(name, (scores.get(name) ?? 0) + weight);
    };

    for (const skill of catalog) {
      const haystacks = [skill.name, ...skill.aliases, ...skill.intents, ...skill.domains];
      for (const token of haystacks) {
        if (!token) continue;
        if (this.includesToken(message, token)) bump(skill.name, 3);
      }
      for (const related of skill.related) {
        if (this.includesToken(message, related)) bump(skill.name, 1);
      }
    }

    if (
      this.includesAny(message, ['настрой атс', 'pbx setup', 'с нуля', 'greenfield', 'первичн'])
    ) {
      bump('pbx-setup', 7);
      bump('contexts', 3);
      bump('trunks', 3);
      bump('routes', 3);
    }

    // Clear multi-domain IVR brief: ivrs + endpoints + call-groups.
    if (
      this.includesAny(message, ['ivr', 'голосовое меню', 'меню']) &&
      this.includesAny(message, ['абонент', 'endpoint', '101', '102', '103']) &&
      this.includesAny(message, [
        'групп',
        'timeout',
        'таймаут',
        'ничего не нажал',
        'не нажал',
        'оставайтесь на линии',
        'остаться на линии',
      ])
    ) {
      bump('ivrs', 8);
      bump('endpoints', 6);
      bump('call-groups', 6);
    }

    if (input.brief?.goal) {
      for (const skill of catalog) {
        if (skill.intents.includes(input.brief.goal) || skill.name === this.goalToSkill(input.brief.goal)) {
          bump(skill.name, 4);
        }
      }
      for (const fact of input.brief.facts) {
        if (fact.key.startsWith('ivr.')) bump('ivrs', 2);
        if (fact.key.startsWith('group.')) bump('call-groups', 2);
        if (fact.key.startsWith('route.')) bump('routes', 2);
      }
    }

    for (const domain of input.activeWorkflowDomains ?? []) {
      for (const skill of this.skills.findByDomain(domain)) {
        bump(skill.name, 5);
      }
    }

    const ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .filter(([, score]) => score > 0);

    if (!ranked.length) {
      const fallback = this.fallbackSkills(catalog);
      return {
        intents: ['general'],
        skillNames: fallback.map((s) => s.name),
        domains: [...new Set(fallback.flatMap((s) => s.domains))],
        confidence: 0.2,
        source: 'fallback',
      };
    }

    const topScore = ranked[0][1];
    const selectedNames = ranked
      .filter(([, score]) => score >= Math.max(2, topScore * 0.5))
      .slice(0, SKILL_BULK_READ_MAX)
      .map(([name]) => name);

    const selected = selectedNames
      .map((name) => this.skills.getSkill(name))
      .filter((skill): skill is SkillCatalogEntry => !!skill);

    // Pull related companions within budget — skip domains that compete with a clear IVR brief.
    const skipRelated = new Set<string>();
    if (selectedNames.includes('ivrs')) {
      skipRelated.add('queues');
      skipRelated.add('callcenter');
    }
    for (const skill of [...selected]) {
      for (const related of skill.related) {
        if (selectedNames.length >= SKILL_BULK_READ_MAX) break;
        if (skipRelated.has(related)) continue;
        if (!selectedNames.includes(related) && this.skills.getSkill(related)) {
          selectedNames.push(related);
        }
      }
    }

    const finalSkills = selectedNames
      .slice(0, SKILL_BULK_READ_MAX)
      .map((name) => this.skills.getSkill(name))
      .filter((skill): skill is SkillCatalogEntry => !!skill);

    const confidence = Math.min(1, topScore / 10);
    return {
      intents: [...new Set(finalSkills.flatMap((s) => s.intents))],
      skillNames: finalSkills.map((s) => s.name),
      domains: [...new Set(finalSkills.flatMap((s) => s.domains))],
      confidence,
      source: input.brief?.version ? 'brief' : 'deterministic',
    };
  }

  filterToolNames(
    allToolNames: string[],
    classification: IntentClassification,
  ): string[] {
    const allowed = new Set<string>(ALWAYS_AVAILABLE_TOOLS);
    for (const domain of classification.domains) {
      for (const name of DOMAIN_TOOL_PREFIX[domain] ?? []) {
        allowed.add(name);
      }
      for (const name of allToolNames) {
        if (name.includes(domain.replace(/-/g, '_')) || name.includes(domain)) {
          allowed.add(name);
        }
      }
    }
    // Low confidence: keep discovery tools plus everything (fail open on reads).
    if (classification.confidence < 0.35) {
      return allToolNames;
    }
    return allToolNames.filter((name) => allowed.has(name) || ALWAYS_AVAILABLE_TOOLS.has(name));
  }

  isAlwaysAvailableTool(name: string): boolean {
    return ALWAYS_AVAILABLE_TOOLS.has(name);
  }

  private fallbackSkills(catalog: SkillCatalogEntry[]): SkillCatalogEntry[] {
    const preferred = ['diagnostics', 'contexts', 'endpoints'];
    return preferred
      .map((name) => catalog.find((skill) => skill.name === name))
      .filter((skill): skill is SkillCatalogEntry => !!skill)
      .slice(0, SKILL_BULK_READ_MAX);
  }

  private goalToSkill(goal: string): string | null {
    if (goal.includes('ivr')) return 'ivrs';
    if (goal.includes('trunk')) return 'trunks';
    if (goal.includes('endpoint')) return 'endpoints';
    if (goal.includes('call_group') || goal.includes('group')) return 'call-groups';
    if (goal.includes('queue')) return 'queues';
    if (goal.includes('pbx_setup')) return 'pbx-setup';
    return null;
  }

  private includesAny(haystack: string, needles: string[]): boolean {
    return needles.some((needle) => this.includesToken(haystack, needle));
  }

  private includesToken(haystack: string, token: string): boolean {
    const h = haystack.toLowerCase();
    const t = token.toLowerCase().trim();
    if (!t) return false;
    if (t.length <= 2) return new RegExp(`(^|\\D)${t}(\\D|$)`).test(h);
    return h.includes(t);
  }
}
