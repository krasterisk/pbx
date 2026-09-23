import {
  clipToolResult,
  diagnoseNeedsEvidence,
  parseTurnModeDecision,
  toolsForMode,
} from './turn-mode';

describe('turn mode', () => {
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

  it('does not clip a single-object dialplan read', () => {
    const body = 'x'.repeat(5000);
    expect(clipToolResult('get_compiled_dialplan', body, 4000)).toBe(body);
    expect(clipToolResult('list_routes', body, 4000)).toMatch(/\[truncated\]$/);
  });
});
