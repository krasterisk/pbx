import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReportsAiAdapter } from './reports-ai.adapter';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { AgentSkillRegistryService } from '../ai-platform/agent-skill-registry.service';
import { AgentIntentClassifierService } from '../ai-chat/agent-intent-classifier.service';
import { selectAgentToolBudget, toolsForMode } from '../ai-chat/turn-mode';
const ctx = { userUid: 58, role: 2, threadUid: 7 };
const actor = { sub: 58, vpbx_user_uid: 5 };
describe('ReportsAiAdapter unified logical-call tools', () => {
  let calls: Record<string, jest.Mock>, adapter: ReportsAiAdapter;
  const tool = (name: string) =>
    adapter.getTools().find((t) => t.name === name)!;
  it('keeps the shipped company skill consistent with registered tools and evidence limits', () => {
    const skill = readFileSync(join(__dirname, '../../skills/reports/SKILL.md'), 'utf8');
    for (const definition of adapter.getTools()) expect(skill).toContain(definition.name);
    expect(skill).toContain('policy.windowHours');
    expect(skill).toContain('UTC-смещением');
    expect(skill).toContain('не предоставляют расшифровки');
    expect(skill).toContain('не являются персональным рейтингом');
    expect(skill).not.toContain('ANSWERED` — дошли');
  });
  beforeEach(() => {
    calls = {
      aiActor: jest.fn().mockResolvedValue(actor),
      aiOwnEmployee: jest.fn().mockResolvedValue('101'),
      list: jest
        .fn()
        .mockResolvedValue({
          rows: [],
          total: 3,
          summary: { total: 3 },
          source: { state: 'ok' },
        }),
      overview: jest.fn().mockResolvedValue({ summary: { total: 3 } }),
      detail: jest.fn().mockResolvedValue({ call: { id: 'a'.repeat(64) } }),
      attention: jest
        .fn()
        .mockResolvedValue({ rows: [], totals: { waiting: 1 } }),
      auditResearch: jest.fn(),
    };
    adapter = new ReportsAiAdapter(
      calls as never,
      { register: jest.fn() } as never,
    );
  });
  it.each(['search_calls', 'find_cdr_calls'])(
    '%s resolves the actual actor, preserves filters and clamps results',
    async (name) => {
      const result = await tool(name).handler(
        { employees: ['101', '102'], limit: 500, direction: 'int' },
        5,
        ctx,
      );
      expect(calls.aiActor).toHaveBeenCalledWith(5, 58);
      expect(calls.list).toHaveBeenCalledWith(
        actor,
        expect.objectContaining({
          employees: ['101', '102'],
          limit: 50,
          direction: 'internal',
        }),
      );
      expect(calls.auditResearch).toHaveBeenCalledWith(actor, 'call_search');
      expect(result).toMatchObject({
        total: 3,
        url: expect.stringContaining('employees=101&employees=102'),
      });
    },
  );
  it.each(['summarize_calls', 'get_cdr_summary'])(
    '%s delegates to the same overview without raw ASR',
    async (name) => {
      const result = await tool(name).handler(
        { dateFrom: '2026-10-01', dateTo: '2026-10-18' },
        5,
        ctx,
      );
      expect(calls.overview).toHaveBeenCalledWith(
        actor,
        expect.objectContaining({
          dateFrom: '2026-10-01',
          dateTo: '2026-10-18',
        }),
      );
      expect(result).toMatchObject({ summary: { total: 3 } });
      expect(result).not.toHaveProperty('ASR');
    },
  );
  it('qualifies unknown CDR timing consistently in search and card tools', async () => {
    const call = {id:'a'.repeat(64),outcome:'unknown',connectedSec:186,timingSource:'cdr'};
    calls.list.mockResolvedValue({rows:[call],total:1,summary:{total:1}});
    calls.detail.mockResolvedValue({call});
    const search = await tool('search_calls').handler({},5,ctx);
    const card = await tool('get_call').handler({id:call.id},5,ctx);
    for (const presented of [search.rows[0], card.call]) {
      expect(presented).toMatchObject({outcome:'unknown',connectedSec:null,
        connectionTiming:{seconds:186,precision:'estimated',conversationConfirmed:false}});
    }
    expect(call.connectedSec).toBe(186);
    expect(adapter.getKnowledgeBlock()).toContain('не пиши «разговор состоялся»');
  });
  it('resolves own metadata searches from the current user and refuses unmapped or conflicting identities', async () => {
    await tool('search_calls').handler({ mine: true }, 5, ctx);
    expect(calls.aiOwnEmployee).toHaveBeenCalledWith(actor);
    expect(calls.list).toHaveBeenLastCalledWith(actor, expect.objectContaining({ focusEmployee: '101' }));
    expect(calls.list.mock.calls[0][1]).not.toHaveProperty('mine');
    calls.list.mockClear();
    await expect(tool('search_calls').handler({ mine: true, focusEmployee: '999' }, 5, ctx)).rejects.toThrow(BadRequestException);
    calls.aiOwnEmployee.mockResolvedValue(null);
    await expect(tool('search_calls').handler({ mine: true }, 5, ctx)).rejects.toThrow(BadRequestException);
    await expect(tool('search_calls').handler({ mine: 'true' }, 5, ctx)).rejects.toThrow(BadRequestException);
    expect(calls.list).not.toHaveBeenCalled();
  });
  it('looks up a card through permission-checked detail and provides a usable link', async () => {
    const id = 'a'.repeat(64),
      result = await tool('get_call').handler({ id }, 5, ctx);
    expect(calls.detail).toHaveBeenCalledWith(actor, id);
    expect(result).toMatchObject({
      url: expect.stringContaining('/reports/calls/' + id),
    });
  });
  it('returns only open attention cases using the real actor and audit', async () => {
    await tool('list_unreturned_missed').handler({}, 5, ctx);
    expect(calls.attention).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ attentionView: 'open', limit: 20 }),
    );
    expect(calls.auditResearch).toHaveBeenCalledWith(actor, 'call_attention');
  });
  it.each([
    'search_calls',
    'get_call',
    'summarize_calls',
    'list_unreturned_missed',
    'find_cdr_calls',
    'get_cdr_summary',
  ])('%s refuses missing identity', async (name) => {
    await expect(tool(name).handler({}, 5)).rejects.toThrow(ForbiddenException);
    await expect(
      tool(name).handler({}, 5, { userUid: 0, role: 0, threadUid: 0 }),
    ).rejects.toThrow(ForbiddenException);
    expect(calls.aiActor).not.toHaveBeenCalled();
  });
  it.each([
    { limit: 0 },
    { limit: 'bad' },
    { employees: Array(31).fill('101') },
    { direction: 'sql' },
    { tenantId: 999 },
  ])('validates direct tool arguments', async (args) => {
    await expect(tool('search_calls').handler(args, 5, ctx)).rejects.toThrow(
      BadRequestException,
    );
    expect(calls.list).not.toHaveBeenCalled();
  });
  it('registers six unique read-only tool names and describes scope/uncertainty', () => {
    const tools = adapter.getTools();
    expect(new Set(tools.map((t) => t.name)).size).toBe(6);
    expect(tools.every((t) => !t.destructive && !t.proposes)).toBe(true);
    expect(adapter.getKnowledgeBlock()).toMatch(/Unknown/);
  });
  it('registers all eleven tools when production content and analysis services are connected', () => {
    const connected = new ReportsAiAdapter(calls as never,{register:jest.fn()} as never,{search:jest.fn()} as never,{read:jest.fn()} as never);
    expect(new Set(connected.getTools().map(tool=>tool.name)).size).toBe(11);
    const skill = readFileSync(join(__dirname, '../../skills/reports/SKILL.md'), 'utf8');
    for(const tool of connected.getTools())expect(skill).toContain(tool.name);
    expect(connected.getTools().every(tool=>!tool.destructive&&!tool.proposes)).toBe(true);
  });
  it.each([
    'Сколько звонков сделала Мария Иванова и какая общая длительность разговоров?',
    'Дай общую сводку вчерашних разговоров Петрова Ивана',
    'Найди номер и с кем я разговаривал на прошлой неделе по поводу башенного крана',
  ])('retains report tools in actual read-mode classification and a crowded provider tool budget: %s', message => {
    const registry = new AiAdapterRegistryService();
    const connected = new ReportsAiAdapter(calls as never, registry, {search:jest.fn()} as never, {read:jest.fn()} as never);
    connected.onModuleInit();
    const skills = new AgentSkillRegistryService(registry);
    const classification = new AgentIntentClassifierService(skills).classify({message});
    expect(classification.domains).toContain('reports');
    const names = connected.getTools().map(tool=>tool.name);
    const crowded = [...Array.from({length:140},(_,i)=>({name:`get_other_${i}`})),...connected.getTools()];
    const visible = selectAgentToolBudget(toolsForMode(crowded, 'read', true),names);
    expect(visible).toHaveLength(128);
    expect(visible.map(tool=>tool.name)).toEqual(expect.arrayContaining(names));
  });
});
