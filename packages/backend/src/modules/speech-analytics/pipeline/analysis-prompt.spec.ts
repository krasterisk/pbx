import { applyIndustryTemplate, defaultSaProjectConfig } from '@krasterisk/shared';
import { analysisToMetricRows, buildAnalysisPrompt, parseAnalysisResponse, PROMPT_VERSION, scoringMetrics } from './analysis-prompt';

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
      assessments: {
        greeting_quality: { rationale: 'есть приветствие', quote: 'здравствуйте' },
        csat: { rationale: 'клиент поблагодарил', quote: 'спасибо' },
      },
    }), config);
    expect(parsed.topicTagIds).toEqual(['sales']);
    expect(buildAnalysisPrompt(config, 'Алло')).toContain('CALL TOPIC TAGGING');
    expect(parsed.metrics.find((m) => m.id === 'greeting_quality')?.value).toBe(100);
    const rows = analysisToMetricRows(parsed, parsed.assessments);
    expect(rows.find((row) => row.id === 'success')).toMatchObject({ value: true });
    expect(rows.find((row) => row.id === 'csat')).toMatchObject({
      value: 5,
      rationale: 'клиент поблагодарил',
      quote: 'спасибо',
    });
  });

  it('scores only the project metrics and skips hidden standard scales', () => {
    const config = defaultSaProjectConfig();
    config.hiddenDefaultScales = ['greeting_quality'];
    config.customMetrics = [{ id: 'booking_made', name: 'Запись создана', type: 'boolean', description: 'Оператор записал клиента' }];
    const ids = scoringMetrics(config).map((metric) => metric.id);
    expect(ids).not.toContain('greeting_quality');
    expect(ids).toContain('booking_made');
    expect(ids).toContain('closing_quality');
    const prompt = buildAnalysisPrompt(config, 'Алло');
    expect(prompt).toContain('ALWAYS RETURN');
    const withoutSummary = defaultSaProjectConfig();
    withoutSummary.insights = {
      ...withoutSummary.insights,
      summary: { ...withoutSummary.insights.summary, enabled: false },
    };
    expect(buildAnalysisPrompt(withoutSummary, 'Алло')).not.toContain('summary (string');
    expect(prompt).toContain('success (boolean)');
    expect(prompt).toContain('обращение закрыто успешно');
    const withoutSuccess = defaultSaProjectConfig();
    withoutSuccess.insights = {
      ...withoutSuccess.insights,
      success: { ...withoutSuccess.insights.success, enabled: false },
    };
    expect(buildAnalysisPrompt(withoutSuccess, 'Алло')).not.toContain('success (boolean)');
    expect(prompt).toContain('csat (integer 1-5');
    expect(prompt).not.toContain('CALL TOPIC TAGGING');
    expect(prompt).toContain('booking_made');
    expect(prompt).not.toContain('greeting_quality');
  });

  it('reads a numeric score nested in the assessment when the top-level field is missing', () => {
    const config = defaultSaProjectConfig();
    const parsed = parseAnalysisResponse(JSON.stringify({
      summary: 'ok',
      customer_sentiment: 'Neutral',
      csat: 4,
      assessments: {
        greeting_quality: { value: '75', rationale: 'есть приветствие', quote: 'добрый день' },
      },
    }), config);
    expect(parsed.metrics.find((metric) => metric.id === 'greeting_quality')).toMatchObject({
      value: 75,
      rationale: 'есть приветствие',
      quote: 'добрый день',
    });
  });

  it('ignores a prose fragment and reads the JSON score after it', () => {
    const config = applyIndustryTemplate('custom');
    const answer = JSON.stringify({
      summary: 'клиент записался',
      customer_sentiment: 'Neutral',
      csat: 4,
      greeting_quality: 75,
    });
    const parsed = parseAnalysisResponse(
      `We need answer JSON only. assessments are {rationale, quote}. ${answer}`,
      config,
    );
    expect(parsed.summary).toBe('клиент записался');
    expect(parsed.metrics.find((metric) => metric.id === 'greeting_quality')?.value).toBe(75);
  });
});
