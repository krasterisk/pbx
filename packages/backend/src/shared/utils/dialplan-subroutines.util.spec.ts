import { DialplanSubroutinesUtil } from './dialplan-subroutines.util';

describe('DialplanSubroutinesUtil', () => {
  it('emits a single _X! extension in krsk-click-to-call', () => {
    const content = DialplanSubroutinesUtil.generate('http://127.0.0.1:5010/api');
    const matches = content.match(/exten\s*=>\s*_X!/g) ?? [];
    expect(matches).toHaveLength(1);

    const clickToCall = content.split('[krsk-click-to-call]')[1] ?? '';
    expect((clickToCall.match(/Hangup\(\)/g) ?? []).length).toBe(1);
  });

  it('parseCategories drops a duplicated click-to-call extension', () => {
    const content = [
      '[krsk-click-to-call]',
      'exten => _X!,1,NoOp(first)',
      'same => n,Hangup()',
      'exten =>  _X!,1,NoOp(first)',
      'same =>  n,Hangup()',
    ].join('\n');

    const contexts = DialplanSubroutinesUtil.parseCategories(content);
    expect(contexts).toEqual([
      {
        name: 'krsk-click-to-call',
        lines: [
          'exten => _X!,1,NoOp(first)',
          'same => n,Hangup()',
        ],
      },
    ]);
  });
});
