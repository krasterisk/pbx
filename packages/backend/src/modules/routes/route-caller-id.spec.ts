import { RoutesService } from './routes.service';
import { routeExecutionContext } from '@krasterisk/shared';
function fixture(rows: any[]) {
  const service = new RoutesService({ findAll: jest.fn(async () => rows) } as never, {} as never, {} as never, {} as never, { findAll: async () => [] } as never);
  service.findAllByContext = jest.fn(async () => rows);
  return service;
}
const route = (uid: number, extensions: string[]) => ({ uid, name: 'Route', context_uid: 1, active: 1, extensions, actions: [{ type: 'cmd', params: { command: 'NoOp(Test)' } }], options: {} });
describe('Caller ID route generation', () => {
  it('keeps unrestricted rules direct and isolates only restricted rules preserving EXTEN', async () => {
    const text = await fixture([route(42, ['100', '200/201', '300/_2XX'])]).generateContextDialplan(1,100,'entry',[]);
    expect(text).toContain('exten => 100,1,NoOp(Route: Route)');
    expect(text).toContain('exten => 200/201,1,Goto(' + routeExecutionContext(42,100) + ',${EXTEN},1)');
    expect(text).toContain('[' + routeExecutionContext(42,100) + ']');
    expect(text).toContain('exten => 200,1,NoOp(Route: Route)');
    expect(text).toContain('exten => 300,1,NoOp(Route: Route)');
  });
  it('does not create any execution category for ordinary routes', async () => {
    const text = await fixture([route(42,['100'])]).generateContextDialplan(1,100,'entry',[]);
    expect(text).not.toContain('__krs_route_');
  });
  it('refuses duplicate pairs before generating a conflicting file', async () => {
    await expect(fixture([route(1,['100/201']),route(2,['100/201'])]).generateContextDialplan(1,100,'entry',[])).rejects.toThrow('Duplicate');
  });

  it('allows explicitly clearing a raw override while adding Caller ID rules', async () => {
    const existing={...route(42,['100']),raw_dialplan:'exten => 100,1,Hangup()',update:jest.fn()};
    const model={findAll:jest.fn(async()=>[]),findOne:jest.fn(async()=>existing)};
    const service=new RoutesService(model as never,{} as never,{} as never,{} as never,{findAll:async()=>[]} as never);
    await service.update(42,{extensions:['100/201'],raw_dialplan:null},100);
    expect(existing.update).toHaveBeenCalledWith({extensions:['100/201'],raw_dialplan:null});
  });
});
