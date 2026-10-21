import {
  clipToolResult,
  diagnoseNeedsEvidence,
  parseTurnModeDecision,
  toolsForMode,
  selectAgentToolBudget,
  isExplicitReadOnlyRequest,
} from './turn-mode';

describe('turn mode', () => {
  it('keeps exact report research reads without allowing arbitrary search/resolve mutations', () => {
    const reports = ['search_calls', 'summarize_calls', 'get_cdr_summary', 'resolve_call_employees', 'summarize_employee_calls', 'search_call_content', 'summarize_call_conversations'];
    const tools = [...reports, 'resolve_ticket', 'search_delete_calls', 'summarize_remove_calls', 'create_route'].map(name => ({name}));
    for (const mode of ['read', 'diagnose'] as const) expect(toolsForMode(tools, mode, false).map(tool => tool.name)).toEqual(reports);
    expect(toolsForMode(tools, 'configure', true).map(tool => tool.name)).toEqual(reports);
  });
  it('distinguishes scoped field constraints from a global read-only request', () => {
    expect(isExplicitReadOnlyRequest('Измени описание карточки, поля не меняй')).toBe(false);
    expect(isExplicitReadOnlyRequest('Проверь регистрацию. Настройки не меняй')).toBe(true);
    expect(isExplicitReadOnlyRequest('Прочитай карточку, только чтение')).toBe(true);
    expect(isExplicitReadOnlyRequest('Покажи как изменить карточку. Ничего не меняй')).toBe(true);
  });
  it('parses a mode decision and falls open on garbage', () => {
    expect(parseTurnModeDecision('{"mode":"diagnose","domain":"diagnostics","missing":[]}')).toEqual({
      mode: 'diagnose',
      domain: 'diagnostics',
      missing: [],
    });
    expect(parseTurnModeDecision('not json')).toBeNull();
  });

  it('hides mutations in diagnose and read', () => {
    const tools = [
      { name: 'describe_number' },
      { name: 'get_compiled_dialplan' },
      { name: 'propose_plan' },
      { name: 'create_route' },
    ];
    expect(toolsForMode(tools, 'diagnose', false).map((tool) => tool.name)).toEqual([
      'describe_number',
      'get_compiled_dialplan',
    ]);
    expect(toolsForMode(tools, 'configure', false)).toEqual(tools);
  });

  it('blocks a cause until an evidence tool has run', () => {
    expect(diagnoseNeedsEvidence('Причина: маршрут смотрит не туда.', new Set())).toBe(true);
    expect(diagnoseNeedsEvidence('Причина: маршрут смотрит не туда.', new Set(['describe_number']))).toBe(false);
    expect(diagnoseNeedsEvidence('У вас три очереди.', new Set())).toBe(false);
  });

  it('keeps call-center list reads available without admitting mutations', () => {
    expect(toolsForMode([{ name: 'cc_list_card_templates' }, { name: 'cc_list_pause_reasons' }, { name: 'cc_update_card_template' }], 'read', true).map(tool => tool.name))
      .toEqual(['cc_list_card_templates', 'cc_list_pause_reasons']);
  });

  it('retains all requested robot tools plus discovery inside a 128-tool model budget', () => {
    const tools = [...Array.from({ length: 130 }, (_, i) => ({ name: `other_${i}` })),
      { name: 'create_voice_robot' }, { name: 'get_configuration_capabilities' }, { name: 'test_voice_robot_match' }];
    const result = selectAgentToolBudget(tools, ['create_voice_robot', 'test_voice_robot_match']);
    expect(result).toHaveLength(128);
    expect(result.map(t => t.name)).toEqual(expect.arrayContaining(['create_voice_robot', 'get_configuration_capabilities', 'test_voice_robot_match']));
    expect(toolsForMode(tools, 'diagnose', false).map(t => t.name)).toContain('test_voice_robot_match');
    expect(toolsForMode(tools, 'read', false).map(t => t.name)).not.toContain('create_voice_robot');
  });

  it('does not clip a single-object dialplan read', () => {
    const body = 'x'.repeat(5000);
    expect(clipToolResult('get_compiled_dialplan', body, 4000)).toBe(body);
    expect(clipToolResult('list_routes', body, 4000)).toMatch(/\[truncated\]$/);
  });
  it('preserves complete compact CDR totals and rows beyond the ordinary text limit', () => {
    const report = { total: 13, rows: Array.from({length:13}, (_,id)=>({id,summary:'business fact '.repeat(30)})) };
    const result = clipToolResult('search_calls', JSON.stringify(report, null, 2), 4000);
    expect(result.length).toBeGreaterThan(4000);
    expect(JSON.parse(result)).toEqual(report);
  });
  it.each(['search_calls', 'get_call_analysis', 'summarize_call_conversations'])(
    'returns a structured limitation rather than a cut report for %s', tool => {
      const result = JSON.parse(clipToolResult(tool, JSON.stringify({total:99,rows:[{summary:'x'.repeat(13_000)}]}), 4000));
      expect(result).toMatchObject({error:'report_result_too_large'});
      expect(result).not.toHaveProperty('total');
      expect(result).not.toHaveProperty('rows');
    },
  );
  it('makes a failed report result explicit without guessing a zero count', () => {
    const result = JSON.parse(clipToolResult('summarize_calls', 'Error: report read failed', 4000));
    expect(result).toMatchObject({error:'report_result_invalid'});
    expect(result).not.toHaveProperty('total');
  });
});
