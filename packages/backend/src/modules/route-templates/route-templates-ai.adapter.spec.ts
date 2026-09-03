import { RouteTemplatesAiAdapter } from './route-templates-ai.adapter';

describe('RouteTemplatesAiAdapter', () => {
  let service: {
    findAll: jest.Mock;
    apply: jest.Mock;
    buildFromDescription: jest.Mock;
  };
  let registry: { register: jest.Mock };
  let adapter: RouteTemplatesAiAdapter;

  const TOOL_NAMES = ['list_templates', 'apply_template', 'build_from_description'];
  const getTool = (name: string) => adapter.getTools().find((tool) => tool.name === name)!;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      apply: jest.fn().mockResolvedValue({ actions: [] }),
      buildFromDescription: jest.fn().mockResolvedValue({ actions: [], slots: [], name: 'Draft' }),
    };
    registry = { register: jest.fn() };
    adapter = new RouteTemplatesAiAdapter(service as any, registry as any);
  });

  it('exposes the three template tools in order', () => {
    expect(adapter.getTools().map((tool) => tool.name)).toEqual(TOOL_NAMES);
  });

  it('registers itself on init and marks no tool as destructive', () => {
    adapter.onModuleInit();
    expect(registry.register).toHaveBeenCalledWith(adapter);
    for (const name of TOOL_NAMES) {
      expect(getTool(name).destructive).toBeFalsy();
      expect(getTool(name).entityType).toBe('route_template');
    }
  });

  it('passes call-time vpbxUserUid into every handler', async () => {
    await getTool('list_templates').handler({}, 111);
    await getTool('list_templates').handler({}, 222);
    expect(service.findAll).toHaveBeenNthCalledWith(1, 111);
    expect(service.findAll).toHaveBeenNthCalledWith(2, 222);

    await getTool('apply_template').handler({ uid: 5, slotValues: { queue: { uid: 'q1' } } }, 111);
    expect(service.apply).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ slotValues: { queue: { uid: 'q1' } } }),
      111,
    );

    await getTool('build_from_description').handler({ description: 'night IVR' }, 333);
    expect(service.buildFromDescription).toHaveBeenCalledWith(333, 'night IVR');
  });
});
