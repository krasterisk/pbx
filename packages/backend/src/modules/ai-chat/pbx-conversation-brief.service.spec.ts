import { PbxConversationBriefService } from './pbx-conversation-brief.service';
import { emptyBrief } from './conversation-brief.types';

describe('PbxConversationBriefService', () => {
  const service = new PbxConversationBriefService();

  it('pins the first substantive user message as the anchor', () => {
    const brief = service.ensureAnchor(null, 10, 'Создай IVR Продажи с приветствием «Здравствуйте»');
    expect(brief.anchor).toContain('IVR Продажи');
    expect(brief.anchorMessageUid).toBe(10);
    expect(brief.version).toBe(1);
    expect(brief.facts.some((f) => f.key === 'entity.name' && f.value.includes('Продажи'))).toBe(true);
  });

  it('ignores short acknowledgements for the anchor', () => {
    const brief = service.ensureAnchor(null, 1, 'да');
    expect(brief.anchor).toBe('');
    expect(brief.version).toBe(0);
  });

  it('replaces a fact only when the new message quotes the new value', () => {
    const first = service.ensureAnchor(null, 1, 'Создай IVR Продажи');
    const next = service.compile(first, 2, 'Переименуй в Support вместо Продажи');
    expect(next.facts.find((f) => f.key === 'entity.name')?.value).toMatch(/Support/i);
    expect(next.replacements.length).toBeGreaterThan(0);
    expect(next.anchor).toContain('Продажи');
  });

  it('keeps the previous brief when compile would drop the anchor', () => {
    const first = service.ensureAnchor(null, 1, 'Создай IVR Продажи с цифрой 1 на 101');
    const broken = service.compile(first, 2, '');
    expect(broken.anchor).toBe(first.anchor);
  });

  it('emptyBrief starts idle', () => {
    expect(emptyBrief().workflowProgress.status).toBe('idle');
  });
});
