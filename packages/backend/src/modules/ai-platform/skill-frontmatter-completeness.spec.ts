import { AgentSkillRegistryService } from './agent-skill-registry.service';
import { AiAdapterRegistryService } from './ai-adapter-registry.service';

describe('skill frontmatter completeness', () => {
  it('every bundled skill declares domains, intents, aliases, related and risk', () => {
    const registry = new AiAdapterRegistryService();
    const skills = new AgentSkillRegistryService(registry);
    const catalog = skills.getCatalog();
    expect(catalog.length).toBeGreaterThan(10);

    for (const skill of catalog) {
      expect(skill.name).toBeTruthy();
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.domains.length).toBeGreaterThan(0);
      expect(Array.isArray(skill.intents)).toBe(true);
      expect(Array.isArray(skill.aliases)).toBe(true);
      expect(Array.isArray(skill.related)).toBe(true);
      expect(['low', 'medium', 'high']).toContain(skill.risk);
    }
  });
});
