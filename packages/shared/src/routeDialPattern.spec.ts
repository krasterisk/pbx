import { isRouteDialPattern, parseRouteDialPattern, serializeRouteDialPattern, validateRouteDialPatterns, routeDialPatternKey } from './routeDialPattern';
import { resolveExactRoute } from './utils/dialplan-walk/exactRouteResolver';
describe('Caller ID dial rules', () => {
  it.each(['100','100/201','100/_2XX','_8XXXXXXXXXX/_3XX','100/','s','_X.','_!','_[2-5]XX'])('round trips %s', value => expect(serializeRouteDialPattern(parseRouteDialPattern(value))).toBe(value));
  it.each(['', '100/201/1','100,1','100/201\n','100/201;evil','100/../bad','_[bad','_','two words'])('rejects injection or invalid rule %s', value => expect(isRouteDialPattern(value)).toBe(false));
  it('distinguishes any caller from anonymous and rejects canonical duplicate pairs', () => {
    expect(parseRouteDialPattern('100').callerId).toBeUndefined();
    expect(parseRouteDialPattern('100/').callerId).toBe('');
    expect(() => validateRouteDialPatterns(['100/201','100/2-01'])).toThrow('Duplicate');
    expect(routeDialPatternKey('_[2-5]XX/201')).toBe('_[2-5]XX/201');
  });
  it('resolves exact Caller ID before generic and remains honest about unknown/masked Caller ID', () => {
    const rows = [{uid:1,active:1,extensions:['100']},{uid:2,active:1,extensions:['100/201']}];
    expect(resolveExactRoute('ctx','100',rows,'201')).toMatchObject({kind:'enter',route:{uid:2}});
    expect(resolveExactRoute('ctx','100',rows,'202')).toMatchObject({kind:'enter',route:{uid:1}});
    expect(resolveExactRoute('ctx','100',rows)).toMatchObject({kind:'caller_id_required'});
    expect(resolveExactRoute('ctx','100',[{uid:3,active:1,extensions:['100/_2XX']}],'201')).toMatchObject({kind:'caller_id_pattern'});
    expect(resolveExactRoute('ctx','100',[{uid:4,active:1,extensions:['100/']}],'')).toMatchObject({kind:'enter',route:{uid:4}});
  });
});
