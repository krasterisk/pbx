import { selectConfigurationContext } from './context-selection';
import { plannedEntitiesFromSteps } from '../ai-chat/pbx-workflow-compiler.service';
import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';
import { ContextsAiAdapter } from './contexts-ai.adapter';
import { EndpointsAiAdapter } from '../endpoints/endpoints-ai.adapter';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { PbxWorkflowCompilerService } from '../ai-chat/pbx-workflow-compiler.service';

const ctx = { vpbxUserUid: 100, userUid: 1, role: 1, isAdmin: true };
describe('designated configuration contexts', () => {
  it('compiles and applies context creation before an endpoint using that designated context', async () => {
    const catalog: any[] = [];
    const contextService = { findAll: async () => catalog, create: async (args: any) => { const row = { ...args, uid: 7 }; catalog.push(row); return row; } };
    const endpoints = { findAll: async () => [], createWithGeneratedCredentials: jest.fn() };
    const registry = new AiAdapterRegistryService();
    new ContextsAiAdapter(contextService as never, registry).onModuleInit();
    new EndpointsAiAdapter(endpoints as never, registry, contextService as never).onModuleInit();
    const compiled = await new PbxWorkflowCompilerService(registry).compile({ steps: [
      { id: 'context', tool: 'create_context', args: { name: 'office100', is_default_for_endpoints: true } },
      { id: 'endpoint', tool: 'create_endpoint', dependsOn: ['context'], args: { extension: '201', name: 'Sales' } },
    ] }, ctx);
    expect(compiled.steps[1].canonicalArgs.context).toBe('office100');
    expect(compiled.steps[1].dependsOn).toEqual(['context']);
    for (const step of compiled.steps) {
      const mutation = registry.getMutationTool(step.tool)!.mutation;
      const check = await mutation.revalidate(step.canonicalArgs, ctx);
      expect(check.ok).toBe(true);
      if (check.ok) await mutation.apply(check.args, ctx);
    }
    expect(endpoints.createWithGeneratedCredentials).toHaveBeenCalledWith(expect.objectContaining({ extension: '201', context: 'office100' }), 100);
  });
  const rows = [{ uid: 1, name: 'internal100', is_default_for_endpoints: true }, { uid: 2, name: 'carrier100', is_default_for_trunks: true }];
  const service = { findAll: jest.fn(async (tenant: number) => tenant === 100 ? rows : []) };
  it('chooses the correct kind and never borrows another tenant context', async () => {
    expect(await selectConfigurationContext(service as never, undefined, 'endpoints', ctx)).toBe('internal100');
    expect(await selectConfigurationContext(service as never, undefined, 'trunks', ctx)).toBe('carrier100');
    expect(await selectConfigurationContext(service as never, 'carrier200', 'trunks', ctx)).toBeNull();
    expect(await selectConfigurationContext(service as never, undefined, 'trunks', { ...ctx, vpbxUserUid: 200 })).toBeNull();
  });
  it('uses a preceding create/update default and honours explicit deselection', async () => {
    const planned = plannedEntitiesFromSteps([{ id: 'context', tool: 'create_context', args: { name: 'new100', is_default_for_endpoints: true } }] as never);
    expect(await selectConfigurationContext(service as never, undefined, 'endpoints', { ...ctx, planned })).toBe('new100');
    planned.contexts = [{ uid: 2, is_default_for_endpoints: true }];
    expect(await selectConfigurationContext(service as never, undefined, 'endpoints', { ...ctx, planned })).toBe('carrier100');
    planned.contexts = [{ uid: 1, is_default_for_endpoints: false }];
    expect(await selectConfigurationContext(service as never, undefined, 'endpoints', { ...ctx, planned })).toBeNull();
  });
  it('stores one scalar per kind and clears only a matching old UID in the same transaction', async () => {
    const row = { value: '0', update: jest.fn() };
    const model = { findOrCreate: jest.fn(), findOne: jest.fn(async () => row), update: jest.fn(), findAll: jest.fn(async () => [{ key: 'contexts.default_endpoints_uid', value: '12' }, { key: 'contexts.default_trunks_uid', value: 'invalid' }]) };
    const settings = new TenantSettingsService(model as never);
    const tx = { LOCK: { UPDATE: 'UPDATE' } } as never;
    await settings.setContextDefault(100, 'endpoints', 12, true, tx);
    await settings.setContextDefault(100, 'endpoints', 11, false, tx);
    expect(model.findOne).toHaveBeenCalledWith({ where: { vpbxUserUid: 100, key: 'contexts.default_endpoints_uid' }, transaction: tx, lock: 'UPDATE' });
    expect(row.update).toHaveBeenCalledWith({ value: '12' }, { transaction: tx });
    expect(model.update).toHaveBeenCalledWith({ value: '0' }, { where: { vpbxUserUid: 100, key: 'contexts.default_endpoints_uid', value: '11' }, transaction: tx });
    expect(await settings.getContextDefaults(100)).toEqual({ endpoints: 12, trunks: 0 });
    await expect(settings.setMany(100, { 'contexts.default_endpoints_uid': 999 })).rejects.toThrow('Unknown tenant setting');
  });
  it('rejects replacing an occupied default, but permits reselecting the same context', async () => {
    const row = { value: '7', update: jest.fn() };
    const model = { findOrCreate: jest.fn(), findOne: jest.fn(async () => row) };
    const settings = new TenantSettingsService(model as never);
    const tx = { LOCK: { UPDATE: 'UPDATE' } } as never;
    await expect(settings.setContextDefault(100, 'trunks', 8, true, tx)).rejects.toThrow('Сначала снимите');
    expect(row.update).not.toHaveBeenCalled();
    await settings.setContextDefault(100, 'trunks', 7, true, tx);
    expect(row.update).toHaveBeenCalledWith({ value: '7' }, { transaction: tx });
  });
});
