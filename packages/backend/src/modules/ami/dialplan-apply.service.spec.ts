import { DialplanApplyService } from './dialplan-apply.service';

describe('DialplanApplyService', () => {
  let amiService: { action: jest.Mock; command: jest.Mock };
  let service: DialplanApplyService;

  beforeEach(() => {
    amiService = {
      action: jest.fn().mockResolvedValue({ response: 'Success' }),
      command: jest.fn().mockResolvedValue({ response: 'Success' }),
    };
    service = new DialplanApplyService(amiService as any);
  });

  it('sends DelCat (swallowing errors), NewCat, then Append batches of 20 with Var/Value parsing', async () => {
    amiService.action.mockImplementation((action: any) => {
      if (action['Action-000000'] === 'DelCat') {
        return Promise.reject(new Error('category does not exist'));
      }
      return Promise.resolve({ response: 'Success' });
    });

    const lines = Array.from({ length: 25 }, (_, i) => `same => n,NoOp(${i})`);
    lines[0] = 'exten=>same,1,NoOp(first)';
    lines.push('SOME_VAR=some_value');

    const result = await service.applyCategories('krasterisk/routes/extensions_ctx.conf', [
      { name: 'ctx', lines },
    ]);

    // 1 DelCat + 1 NewCat + 2 Append batches (20 + 6 lines)
    expect(amiService.action).toHaveBeenCalledTimes(4);

    const [delCall, newCatCall, batch1, batch2] = amiService.action.mock.calls.map((c) => c[0]);

    expect(delCall['Action-000000']).toBe('DelCat');
    expect(delCall['Cat-000000']).toBe('ctx');

    expect(newCatCall['Action-000000']).toBe('NewCat');
    expect(newCatCall['Cat-000000']).toBe('ctx');

    // First line has no '=>' at start since first line is 'exten=>same,1,NoOp(first)'
    expect(batch1['Action-000000']).toBe('Append');
    expect(batch1['Var-000000']).toBe('exten');
    expect(batch1['Value-000000']).toBe('> same,1,NoOp(first)');

    // '=>' split: Var/Value with '> ' prefix on Value
    expect(batch1['Var-000001']).toBe('same');
    expect(batch1['Value-000001']).toBe('> n,NoOp(1)');

    // Second batch: last appended line (index 5 within batch2, i.e. global 25) has no '=>' → split on '='
    expect(batch2['Var-000005']).toBe('SOME_VAR');
    expect(batch2['Value-000005']).toBe('some_value');

    expect(result).toEqual({ success: true, linesApplied: 26 });
  });

  it('throws when an Append batch response is an Error, including the AMI message', async () => {
    amiService.action.mockImplementation((action: any) => {
      if (action['Action-000000'] === 'Append') {
        return Promise.resolve({ response: 'Error', message: 'boom' });
      }
      return Promise.resolve({ response: 'Success' });
    });

    await expect(
      service.applyCategories('file.conf', [{ name: 'ctx', lines: ['a=b'] }]),
    ).rejects.toThrow('boom');
  });

  it('reload:true issues exactly one "dialplan reload" after all categories; reload:false issues none', async () => {
    await service.applyCategories('file.conf', [{ name: 'ctx', lines: ['a=b'] }], { reload: true });
    expect(amiService.command).toHaveBeenCalledTimes(1);
    expect(amiService.command).toHaveBeenCalledWith('dialplan reload');

    amiService.command.mockClear();
    await service.applyCategories('file.conf', [{ name: 'ctx', lines: ['a=b'] }], { reload: false });
    expect(amiService.command).not.toHaveBeenCalled();
  });

  it('applies multiple categories sequentially, in the order passed', async () => {
    const order: string[] = [];
    amiService.action.mockImplementation((action: any) => {
      if (action['Action-000000'] === 'NewCat') order.push(action['Cat-000000']);
      return Promise.resolve({ response: 'Success' });
    });

    const result = await service.applyCategories('file.conf', [
      { name: 'ctx_a', lines: ['a=1'] },
      { name: 'ctx_b', lines: ['b=2'] },
      { name: 'ctx_c', lines: ['c=3'] },
    ]);

    expect(order).toEqual(['ctx_a', 'ctx_b', 'ctx_c']);
    expect(result.linesApplied).toBe(3);
  });

  it('defensively filters blank lines, comments, and category headers', async () => {
    const lines = ['', '  ', '[should-be-ignored]', '; a comment', 'real=line'];
    const result = await service.applyCategories('file.conf', [{ name: 'ctx', lines }]);
    expect(result.linesApplied).toBe(1);

    const appendCall = amiService.action.mock.calls.find((c) => c[0]['Action-000000'] === 'Append')?.[0];
    expect(appendCall['Var-000000']).toBe('real');
    expect(appendCall['Value-000000']).toBe('line');
  });
});
