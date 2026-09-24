import { applyIndustryTemplate } from '@krasterisk/shared';
import { buildAnalysisPrompt, parseAnalysisResponse, PROMPT_VERSION } from './analysis-prompt';

describe('analysis prompt', () => {
  it('fills the draft from an industry template and keeps the builtin rubric', () => {
    const config = applyIndustryTemplate('real_estate');
    expect(config.systemPrompt).toContain('недвижимости');
    expect(config.metrics.some((m) => m.id === 'property_match')).toBe(true);
    expect(config.metrics.some((m) => m.id === 'greeting_quality' && m.sourceScaleId === 'greeting_quality')).toBe(true);
    const prompt = buildAnalysisPrompt(config, 'Алло, здравствуйте');
    expect(prompt).toContain('Greeting/ID:');
    expect(prompt).toContain('property_match');
    expect(prompt).toContain('недвижимости');
    expect(PROMPT_VERSION).toBe('2026-09-22.1');
  });

  it('drops unknown topic ids', () => {
    const config = applyIndustryTemplate('custom');
    config.callTaxonomy = [{ id: 'sales', name: 'Продажа', aliases: [] }];
    const parsed = parseAnalysisResponse(JSON.stringify({
      summary: 'ok',
      customer_sentiment: 'Positive',
      csat: 5,
      success: true,
      topic_tag_ids: ['sales', 'invented'],
      greeting_quality: 100,
      assessments: { greeting_quality: { rationale: 'есть приветствие', quote: 'здравствуйте' } },
    }), config);
    expect(parsed.topicTagIds).toEqual(['sales']);
    expect(parsed.metrics.find((m) => m.id === 'greeting_quality')?.value).toBe(100);
  });
});
