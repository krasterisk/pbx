import { describe, expect, it } from 'vitest';
import {
  buildSupervisorLink,
  buildSupervisorSearch,
  parseSupervisorUrl,
} from './supervisorUrlState';

describe('supervisorUrlState (U0.8)', () => {
  it('parses view, queue filter, agentId, group and sort from search params', () => {
    const parsed = parseSupervisorUrl(
      new URLSearchParams('view=calls&q=700,701&agent=42&group=status&sort=missed'),
    );
    expect(parsed).toEqual({
      view: 'calls',
      queues: ['700', '701'],
      agentId: 42,
      group: 'status',
      sort: 'missed',
    });
  });

  it('falls back to safe defaults for missing or invalid values', () => {
    const parsed = parseSupervisorUrl(new URLSearchParams('view=bad&agent=abc&group=x&sort=y'));
    expect(parsed).toEqual({
      view: 'agents',
      queues: [],
      agentId: null,
      group: 'none',
      sort: 'time',
    });
  });

  it('omits defaults when building search string and link', () => {
    expect(buildSupervisorSearch({ view: 'agents', queues: [], group: 'none', sort: 'time' })).toBe('');
    expect(buildSupervisorLink({ queues: ['701'] })).toBe('/callcenter/supervisor?q=701');
  });
});
