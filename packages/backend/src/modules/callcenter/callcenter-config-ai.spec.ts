import { CallCenterSettingsAiTools } from './callcenter-settings-ai.tools';
import { CallCenterCardsAiTools } from './callcenter-cards-ai.tools';
import { ccSettingsSchemas } from './callcenter-ai-settings.schemas';
import { parseMutationInput } from '../ai-platform/ai-mutation.contract';
import { CallCenterAiAdapter } from './callcenter-ai.adapter';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { McpToolsService } from '../mcp/mcp-tools.service';

describe('Call center configuration AI contracts', () => {
  const ctx = { userUid: 58, role: 1, vpbxUserUid: 7, isAdmin: true };
  let current: Record<string, unknown>;
  let settings: any;
  let wallboard: any;
  let adapter: CallCenterSettingsAiTools;
  beforeEach(() => {
    current = { default_sla_threshold: 20, short_abandon_sec: 5 };
    settings = { getTenantSettings: jest.fn(async () => ({ ...current })), updateTenantSettings: jest.fn(), getOperatorSettings: jest.fn(async () => ({ volume: 50 })), updateOperatorSettings: jest.fn() };
    wallboard = { listTokens: jest.fn(async () => [{ uid: 12, label: 'TV', token: 'do-not-expose', expires_at: null, revoked_at: null }]), generateToken: jest.fn() };
    adapter = new CallCenterSettingsAiTools(settings, {} as any, wallboard, {} as any, {} as any);
  });
  const pick = (a: CallCenterSettingsAiTools, name: string) => a.getTools().find(t => t.name === name)!;

  it('registers unique discoverable tools for every settings section and cards', () => {
    const cards = new CallCenterCardsAiTools({} as any);
    const tools = [...adapter.getTools(), ...cards.getTools()];
    expect(new Set(tools.map(t => t.name)).size).toBe(tools.length);
    for (const name of ['cc_update_tenant_settings', 'cc_update_operator_settings', 'cc_update_operator_ui', 'cc_update_operator_permissions', 'cc_update_operator_notifications', 'cc_update_permission_defaults', 'cc_update_ui_defaults', 'cc_update_notification_defaults', 'cc_create_pause_reason', 'cc_update_watched_agents', 'cc_add_queue_member', 'cc_update_report_schedule', 'cc_create_display_token', 'cc_update_alert_routing', 'cc_update_card_template']) expect(tools.some(t => t.name === name)).toBe(true);
    expect(tools.filter(t => t.mutation).every(t => t.proposes && t.mutation!.reload.kind === 'none')).toBe(true);
  });
  it('exposes settings and cards through the existing callcenter MCP domain', () => {
    const registry = new AiAdapterRegistryService();
    const root = new CallCenterAiAdapter({} as any, {} as any, registry, adapter, new CallCenterCardsAiTools({} as any));
    root.onModuleInit();
    const mcp = new McpToolsService(registry, {} as any, {} as any); mcp.registerAll();
    const names = mcp.getToolNamesForDomains(['callcenter']);
    expect(names).toContain('cc_update_card_template'); expect(names).toContain('cc_update_tenant_settings');
    expect(names.length).toBe(46);
    expect(mcp.getToolsList(7).map(t => t.name)).toEqual(names);
    expect(root.getKnowledgeBlock()).toContain('универсальные');
  });
  it('proposal never writes; confirmation applies scoped services and rejects a concurrent edit', async () => {
    const tool = pick(adapter, 'cc_update_tenant_settings'); const mutation = tool.mutation!;
    const input = parseMutationInput(mutation, { patch: { default_sla_threshold: 30 } });
    const proposal = await mutation.propose(input, ctx) as any;
    expect(settings.updateTenantSettings).not.toHaveBeenCalled();
    expect(proposal.before.configuration.default_sla_threshold).toBe(20);
    expect(await mutation.revalidate(proposal.applyPayload.args, ctx)).toEqual({ ok: true, args: proposal.applyPayload.args });
    await mutation.apply(proposal.applyPayload.args, ctx);
    expect(settings.updateTenantSettings).toHaveBeenCalledWith(7, { default_sla_threshold: 30 });
    current.default_sla_threshold = 40;
    expect((await mutation.revalidate(proposal.applyPayload.args, ctx)).ok).toBe(false);
    await expect(mutation.apply(proposal.applyPayload.args, ctx)).rejects.toThrow('изменились');
    expect(settings.updateTenantSettings).toHaveBeenCalledTimes(1);
  });
  it.each([2, 5, -1])('role %s cannot propose/apply tenant configuration', async role => {
    const mutation = pick(adapter, 'cc_update_tenant_settings').mutation!;
    await expect(mutation.propose({ patch: { journal_depth: 20 } }, { ...ctx, role })).rejects.toThrow();
    await expect(mutation.apply({ input: { patch: { journal_depth: 20 } }, revision: 'x' }, { ...ctx, role })).rejects.toThrow();
    expect(settings.updateTenantSettings).not.toHaveBeenCalled();
  });
  it('uses authenticated self identity; a model cannot address another operator', async () => {
    const tool = pick(adapter, 'cc_update_operator_settings');
    const caller = { userUid: 19, role: 2, threadUid: 1 };
    const proposal = await tool.handler({ patch: { volume: 60 } }, 7, caller) as any;
    expect(settings.getOperatorSettings).toHaveBeenCalledWith(7, 19);
    await tool.mutation!.apply(proposal.applyPayload.args, { ...ctx, userUid: 19, role: 2 });
    expect(settings.updateOperatorSettings).toHaveBeenCalledWith(7, 19, { volume: 60 });
    await expect(tool.handler({ operatorId: 20, patch: { volume: 70 } }, 7, caller)).rejects.toThrow();
    await expect(tool.handler({ patch: { volume: 70 } }, 7)).rejects.toThrow();
  });
  it('rejects cross-tenant aliases, unknown nested fields, invalid limits and supports real callback enums', () => {
    const mutation = pick(adapter, 'cc_update_tenant_settings').mutation!;
    for (const raw of [{ patch: { journal_depth: 501 } }, { patch: { shift_policy: { user_uid: 8 } } }, { patch: { extra: 1 } }, { patch: { short_abandon_sec: -1 } }]) expect(() => parseMutationInput(mutation, raw)).toThrow();
    expect(ccSettingsSchemas.tenant.parse({ callback_policy: { order_mode: 'queue_abandon', dial_order: 'caller_first' } })).toBeDefined();
  });
  it('does not disclose TV bearer tokens to the model or confirmation preview', async () => {
    const caller = { ...ctx, threadUid: 1 };
    const list = await pick(adapter, 'cc_list_display_tokens').handler({}, 7, caller);
    const proposal = await pick(adapter, 'cc_create_display_token').handler({ label: 'Test' }, 7, caller);
    expect(JSON.stringify([list, proposal])).not.toContain('do-not-expose');
    expect(wallboard.generateToken).not.toHaveBeenCalled();
  });
  it('cards preserve the full field contract, validate dictionaries and apply only after confirmation', async () => {
    const state = { uid: 4, name: 'Card', fields: [{ field_key: 'topic', label: 'Тема', field_type: 'select' }] };
    const service = { findTemplate: jest.fn(async () => state), validateTemplateFields: jest.fn(), updateTemplate: jest.fn() };
    const cards = new CallCenterCardsAiTools(service as any);
    const tool = cards.getTools().find(t => t.name === 'cc_update_card_template')!;
    const input = parseMutationInput(tool.mutation!, { id: 4, patch: { fields: [{ ...state.fields[0], options: { source: 'directory', directoryUid: 3, valueFieldUid: 10, labelFieldUid: 11 } }] } });
    const proposal = await tool.mutation!.propose(input, ctx) as any;
    expect(service.validateTemplateFields).toHaveBeenCalledWith(input.patch.fields, 7);
    expect(service.updateTemplate).not.toHaveBeenCalled();
    await tool.mutation!.apply(proposal.applyPayload.args, ctx);
    expect(service.updateTemplate).toHaveBeenCalledWith(4, input.patch, 7);
  });
});
