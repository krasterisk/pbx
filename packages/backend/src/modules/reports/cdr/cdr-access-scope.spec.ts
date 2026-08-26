import {
  parseCdrAccessBlob,
  isCdrUnrestricted,
  buildCdrAccessClause,
  buildCdrLinkedidAccessClause,
} from './cdr-access-scope';

describe('cdr-access-scope', () => {
  it('treats empty cdr as unrestricted', () => {
    expect(isCdrUnrestricted(parseCdrAccessBlob(undefined))).toBe(true);
    expect(isCdrUnrestricted(parseCdrAccessBlob({ operators: [], queues: [] }))).toBe(true);
  });

  it('parses new {operators,queues} shape and legacy string[] as operators', () => {
    expect(parseCdrAccessBlob({ operators: ['201', 'PJSIP/e202_0'], queues: ['q700_0'] })).toEqual({
      operators: ['201', '202'],
      queues: ['700'],
      operatorUserIds: [],
    });
    expect(parseCdrAccessBlob(['201', 'e112_0'])).toEqual({
      operators: ['201', '112'],
      queues: [],
      operatorUserIds: [],
    });
  });

  it('builds OR clause for own + operators + queues', () => {
    const clause = buildCdrAccessClause('c', 0, {
      operators: ['201'],
      queues: ['700'],
      ownExten: '100',
    });
    expect(clause).not.toBeNull();
    expect(Object.values(clause!.replacements)).toEqual(
      expect.arrayContaining(['100', '201', '700', '%e100_0%', '%q700_0%']),
    );
  });

  it('keeps sibling legs of a visible linkedid', () => {
    const clause = buildCdrLinkedidAccessClause('c', 0, {
      operators: ['201'],
      queues: [],
      ownExten: '100',
    });
    expect(clause!.sql).toContain('EXISTS');
    expect(clause!.sql).toContain('x.linkedid = c.linkedid');
  });
});
