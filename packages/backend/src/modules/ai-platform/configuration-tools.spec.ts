import { EndpointsAiAdapter } from '../endpoints/endpoints-ai.adapter';
import { TrunksAiAdapter } from '../trunks/trunks-ai.adapter';
import { NotificationsAiAdapter } from '../notifications/notifications-ai.adapter';
import { PromptsAiAdapter } from '../prompts/prompts-ai.adapter';
import { speechConfigurationTool } from './speech-configuration.tool';
import { parseMutationInput, parseMutationArgs } from './ai-mutation.contract';
import { parseSecureConfirmationInputs } from '../ai-chat/dto/secure-confirmation.dto';

const ctx = { vpbxUserUid: 100, userUid: 11, role: 1, isAdmin: true };
const registry = { register: jest.fn() } as never;
const contexts = { findAll: async (uid: number) => uid === 100 ? [{ uid: 1, name: 'ctx100', is_default_for_endpoints: true, is_default_for_trunks: true }] : [] } as never;
describe('configuration tools: executable parameter and security parity', () => {
  it('shows the same endpoint patch that it applies, preserving unrelated settings', async () => {
    const current = { extension: '201', endpoint: { allow: 'alaw', callerid: '"Old" <201>', rtp_timeout: '20', password: 'hidden' } };
    const service = { findAll: async () => [{ extension: '201', sipUsername: 'e201_100' }], findOne: jest.fn(async () => current), update: jest.fn() };
    const tool = new EndpointsAiAdapter(service as never, registry, contexts).getTools().find(t => t.name === 'update_endpoint')!;
    const input = parseMutationInput(tool.mutation!, { sipId: '201', codecs: 'opus', displayName: 'Sales', advanced: { rtp_timeout: '60' }, permit: '10.0.0.0/8' });
    const proposal = await tool.mutation!.propose(input, ctx) as any;
    expect(proposal.after).toMatchObject({ allow: 'opus', callerid: '"Sales" <201>', rtp_timeout: '60', permit: '10.0.0.0/8' });
    expect(JSON.stringify(proposal)).not.toContain('hidden');
    const args = parseMutationArgs(tool.mutation!, proposal.applyPayload.args);
    await tool.mutation!.apply(args, ctx);
    expect(service.update).toHaveBeenCalledWith('e201_100', { endpoint: { allow: 'opus', callerid: '"Sales" <201>', rtp_timeout: '60', permit: '10.0.0.0/8' } }, 100);
    expect(() => parseMutationInput(tool.mutation!, { sipId: '201', advanced: { auth: 'foreign' } })).toThrow();
    expect(() => parseMutationInput(tool.mutation!, { sipId: '201', permit: '10.0.0.0/99' })).toThrow();
  });
  it('never puts a provider password in model arguments or the proposal', async () => {
    const service = { findAll: async () => [], create: jest.fn() };
    const tool = new TrunksAiAdapter(service as never, {} as never, registry, contexts).getTools().find(t => t.name === 'create_trunk')!;
    const proposal = await tool.mutation!.propose(parseMutationInput(tool.mutation!, { name: 'Carrier', host: 'sip.example.test', trunkType: 'auth', username: 'account' }), ctx) as any;
    expect(proposal.after.requiresSecureInput).toBe(true);
    const args = parseMutationArgs(tool.mutation!, proposal.applyPayload.args);
    await expect(tool.mutation!.apply(args, ctx)).rejects.toThrow('secure_input_required');
    const secure = parseSecureConfirmationInputs({ proposal: { password: 'human-secret' } });
    await tool.mutation!.apply(args, { ...ctx, secureInput: secure.proposal });
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ context: 'ctx100', password: 'human-secret' }), 100);
    expect(JSON.stringify(proposal)).not.toContain('human-secret');
    expect(() => parseMutationInput(tool.mutation!, { name: 'Carrier', host: 'sip.example.test', password: 'human-secret' })).toThrow();
    expect(() => parseSecureConfirmationInputs({ proposal: { password: 's', token: 'leak' } })).toThrow('Invalid secure confirmation');
  });
  it('refuses an unconfigured or foreign context before creating an endpoint', async () => {
    const tool = new EndpointsAiAdapter({ findAll: async () => [] } as never, registry, { findAll: async () => [] } as never).getTools().find(t => t.name === 'create_endpoint')!;
    expect(await tool.mutation!.propose({ extension: '201' }, ctx)).toMatchObject({ refused: true });
    expect(await tool.mutation!.propose({ extension: '201', context: 'foreign200' }, ctx)).toMatchObject({ refused: true });
  });
  it('merges notification configuration without touching credentials or sending', async () => {
    const service = { findOne: jest.fn(async () => ({ name: 'Ops', config: { chatId: 'old', format: 'html' } })), update: jest.fn(), dispatch: jest.fn() };
    const tool = new NotificationsAiAdapter(service as never, registry).getTools().find(t => t.name === 'update_notification_integration')!;
    await tool.mutation!.apply(parseMutationArgs(tool.mutation!, { uid: 3, config: { chatId: 'new' } }), ctx);
    expect(service.update).toHaveBeenCalledWith(3, { config: { chatId: 'new', format: 'html' } }, 100);
    expect(service.dispatch).not.toHaveBeenCalled();
    expect(() => parseMutationInput(tool.mutation!, { uid: 3, config: { token: 'secret' } })).toThrow('SECRET_ARG_FORBIDDEN');
  });
  it('allows prompt metadata changes but rejects an implicit billable synthesis', async () => {
    const service = { findOne: async () => ({ uid: 1, comment: 'Hello', description: '' }), update: jest.fn() };
    const tool = new PromptsAiAdapter(service as never, registry, {} as never).getTools().find(t => t.name === 'update_audio_prompt')!;
    await tool.mutation!.apply(parseMutationArgs(tool.mutation!, { uid: 1, description: 'Greeting' }), ctx);
    expect(service.update).toHaveBeenCalledWith(1, { description: 'Greeting' }, 100);
    expect(() => parseMutationInput(tool.mutation!, { uid: 1, tts: { text: 'New text' } })).toThrow();
  });
  it('updates only a tenant provider with the matching speech capability', async () => {
    const providers = { findOne: jest.fn(async (_id: number, tenant: number) => { if (tenant !== 100) throw new Error('not found'); return { name: 'Speech', capabilities: ['tts'], enabled: true }; }), update: jest.fn() };
    const tool = speechConfigurationTool(providers as never, 'tts');
    await tool.mutation!.apply({ uid: 4, enabled: false }, ctx);
    expect(providers.update).toHaveBeenCalledWith(4, { enabled: false }, 100);
    await expect(tool.mutation!.apply({ uid: 4, enabled: false }, { ...ctx, vpbxUserUid: 200 })).rejects.toThrow('not found');
    await expect(speechConfigurationTool(providers as never, 'stt').mutation!.propose({ uid: 4, name: 'Rename' }, ctx)).rejects.toThrow('Speech provider not found');
  });
});
