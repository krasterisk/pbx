import { randomUUID } from 'node:crypto';
import { AutodialAiDataTools } from './autodial-ai-data.tools';
import { AutodialAiPrivacyService } from './autodial-ai-privacy.service';

describe('Autodial AI data contracts', () => {
  const base = { uid: 8, name: 'Base', revision: 2, phone_normalization: 'digits', fields: [
    { uid: 1, key: 'phone', label: 'Phone', type: 'phone', required: true, is_phone: true },
  ] };
  const context = { vpbxUserUid: 41, userUid: 99, role: 1, isAdmin: true };
  const bases = { findOne: jest.fn(), validateFields: jest.fn(), create: jest.fn(), createContacts: jest.fn(), findContact: jest.fn() };
  const testCalls = { call: jest.fn() };
  const preview = { preview: jest.fn() };
  const privacy = new AutodialAiPrivacyService({ query: jest.fn().mockResolvedValue([]) } as never);
  const campaigns = { findOne: jest.fn() };
  const importer = { upsertProfile: jest.fn() };
  const schemas = { preview: jest.fn(), apply: jest.fn() };
  const selections = { preview: jest.fn(), createBase: jest.fn() };
  const tools = new AutodialAiDataTools(bases as never, campaigns as never, importer as never, preview as never,
    schemas as never, privacy, {} as never, testCalls as never, {} as never, {} as never, {} as never, selections as never);
  const tool = (name: string) => tools.getTools().find((entry) => entry.name === name)!;
  beforeEach(() => {
    jest.clearAllMocks(); bases.findOne.mockImplementation(async (tenant) => { if (tenant !== 41) throw new Error('Not found'); return base; });
    bases.create.mockResolvedValue({ uid: 9, revision: 1 }); campaigns.findOne.mockResolvedValue({ uid: 4, base_uid: 8, revision: 3, name: 'Campaign' });
  });
  it('does not expose lifecycle or arbitrary destination calls', () => {
    expect(tools.getTools().map((entry) => entry.name).some((name) => /^(start|resume|stop)_/.test(name))).toBe(false);
    expect(() => tool('request_autodial_test_call').mutation!.input.parse({ campaign_uid: 4, contact_uid: 1,
      expected_revision: 3, idempotency_key: randomUUID(), destination: '+79001234567' })).toThrow();
  });
  it('redacts schema samples and refuses a migration when its preview changed', async () => {
    const hash = 'a'.repeat(64), migration = { expected_revision: 2, fields: base.fields, preview_hash: hash };
    schemas.preview.mockResolvedValue({ ready: true, preview_hash: hash, sample: [{ name: 'Private' }], removed_fields: [], expected_revision: 2 });
    expect(await tool('get_autodial_schema_preview').handler!({ base_uid: 8, migration }, 41)).toMatchObject({ sample: [] });
    const mutation = tool('migrate_autodial_base_schema').mutation!;
    await mutation.propose({ base_uid: 8, migration }, context); expect(schemas.apply).not.toHaveBeenCalled();
    schemas.preview.mockResolvedValue({ ready: false, preview_hash: hash });
    expect(await mutation.revalidate({ base_uid: 8, migration }, context)).toMatchObject({ ok: false });
  });
  it('requires the same nonempty report selection before creating a base proposal', async () => {
    const hash = 'a'.repeat(64), args = { filter: { from: '2026-10-01', to: '2026-10-17', campaign_uids: [4], dimension: 'disposition' as const }, name: 'Selected', preview_hash: hash };
    selections.preview.mockResolvedValue({ preview_hash: hash, contact_count: 2 });
    const mutation = tool('create_autodial_base_from_report').mutation!;
    await mutation.propose(args, context); expect(selections.createBase).not.toHaveBeenCalled();
    selections.preview.mockResolvedValue({ preview_hash: 'b'.repeat(64), contact_count: 2 });
    expect(await mutation.revalidate(args, context)).toMatchObject({ ok: false });
  });
  it('proposes base creation without writes and applies only through the mutation', async () => {
    const entry = tool('create_autodial_base'); const input = { name: 'New', fields: [{ key: 'phone', label: 'Phone', type: 'phone' }] };
    const draft = await entry.mutation!.propose(input, context);
    expect(draft).toMatchObject({ applyPayload: { tool: 'create_autodial_base' } }); expect(bases.create).not.toHaveBeenCalled();
    await entry.mutation!.apply(input, context); expect(bases.create).toHaveBeenCalledWith(41, input);
  });
  it('refuses a stale or foreign base before making a contact proposal', async () => {
    const input = { base_uid: 8, expected_revision: 1, contacts: [{ phones: [{ raw: '123' }], values: {} }] };
    await expect(tool('create_autodial_contacts').mutation!.propose(input, context)).rejects.toThrow('AC_REVISION_CONFLICT');
    await expect(tool('create_autodial_contacts').mutation!.propose({ ...input, expected_revision: 2 }, { ...context, vpbxUserUid: 42 })).rejects.toThrow('Not found');
    expect(bases.createContacts).not.toHaveBeenCalled();
  });
  it('does not expose private values in scenario preview while masking is enabled', async () => {
    preview.preview.mockResolvedValue({ campaign_uid: 4, revision: 3, variables: [{ name: 'AC_NAME', type: 'string', value: 'Private' }],
      steps: [{ id: 'x', type: 'tts', text: 'Private 1500' }], dialplan: 'Private 79001234567' });
    const result = await tool('get_autodial_scenario_preview').handler({ campaign_uid: 4, contact_uid: 1 }, 41);
    expect(JSON.stringify(result)).not.toMatch(/Private|1500|79001234567/);
  });
  it('binds a confirmed test call to the authenticated actor and not a model-supplied endpoint', async () => {
    const args = { campaign_uid: 4, contact_uid: 1, expected_revision: 3, idempotency_key: randomUUID() };
    await tool('request_autodial_test_call').mutation!.apply(args, context);
    expect(testCalls.call).toHaveBeenCalledWith(41, 99, 4, { contact_uid: 1, expected_revision: 3, idempotency_key: args.idempotency_key });
  });
  it('uses the DNC entity type and rejects ambiguous, foreign or expired bulk scope before a card', async () => {
    const entry = tool('add_autodial_dnc_bulk'), input = { scope: 'base' as const, scope_uid: 8, phones: ['79001234567'] };
    expect(await entry.mutation!.propose(input, context)).toMatchObject({ entityType: 'autodial_dnc' });
    await expect(entry.mutation!.propose({ ...input, scope: 'global' }, context)).rejects.toThrow('AC_DNC_SCOPE');
    await expect(entry.mutation!.propose({ ...input, phones: ['invalid'] }, context)).rejects.toThrow('AC_DNC_INVALID_PHONE');
    await expect(entry.mutation!.propose(input, { ...context, vpbxUserUid: 42 })).rejects.toThrow('Not found');
    await expect(entry.mutation!.propose({ ...input, expires_at: '2020-01-01T00:00:00Z' }, context)).rejects.toThrow('AC_DNC_INPUT');
  });
});
