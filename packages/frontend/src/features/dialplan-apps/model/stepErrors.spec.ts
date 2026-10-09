import { describe, it, expect } from 'vitest';
import { mapStepErrors, localizeStepError } from './stepErrors';

const actions = [{ id: 'a' }, { id: 'b' }];

describe('mapStepErrors', () => {
  it('highlights only the matching step and field (backstop)', () => {
    const mapped = mapStepErrors(
      {
        errors: [{ actionId: 'b', path: 'params.target', message: 'required' }],
      },
      actions,
    );
    expect(mapped.byStep.has('a')).toBe(false);
    expect(mapped.byStep.get('b')).toEqual({ target: 'required' });
    expect(mapped.orphans).toEqual([]);
  });

  it('sends unknown actionId to orphans and keeps every error visible', () => {
    const mapped = mapStepErrors(
      {
        errors: [
          { actionId: 'b', path: 'params.target', message: 'required' },
          { actionId: 'zzz', path: 'params.x', message: 'gone' },
        ],
      },
      actions,
    );
    expect(mapped.byStep.get('b')).toEqual({ target: 'required' });
    expect(mapped.orphans).toEqual([{ actionId: 'zzz', path: 'params.x', message: 'gone' }]);
    expect(mapped.byStep.size + mapped.orphans.length).toBe(2);
  });
});

describe('Nest save-error responses', () => {
  const steps = [
    { id: 'a', type: 'noop' },
    { id: 'b', type: 'notify' },
    { id: 'cid', type: 'callerid' },
  ];
  it('maps message-array index paths and bracket paths without selecting another step', () => {
    const result = mapStepErrors(
      {
        message: [
          'actions.1.params.body must match /^[^\\n\\r;]*$/ regular expression',
          'actions[1].params.integration_uid must be a positive number',
        ],
      },
      steps,
    );
    expect([...result.byStep.keys()]).toEqual(['b']);
    expect(Object.keys(result.byStep.get('b')!)).toEqual(['body', 'integration_uid']);
    expect(result.orphans).toEqual([]);
  });
  it('maps nested class-validator errors and custom Caller ID fields', () => {
    const result = mapStepErrors(
      {
        errors: [
          {
            property: 'actions',
            children: [
              {
                property: '2',
                children: [
                  {
                    property: 'params',
                    children: [
                      {
                        property: 'number',
                        children: [
                          {
                            property: 'source',
                            constraints: { invalid: 'Invalid Caller ID v2 configuration' },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      steps,
    );
    expect(result.byStep.get('cid')).toEqual({ callerIdV2: 'Invalid Caller ID v2 configuration' });
  });
  it('supports index fallback IDs and groups nested fields under their editor', () => {
    const result = mapStepErrors(
      {
        errors: [
          { actionId: 'index:1', path: 'body', message: 'required' },
          { actionId: 'a', path: 'target.value', message: 'required' },
        ],
      },
      steps,
    );
    expect(result.byStep.get('b')).toEqual({ body: 'required' });
    expect(result.byStep.get('a')).toEqual({ target: 'required' });
  });
  it('does not guess a row for an out-of-range index or missing path', () => {
    expect(
      mapStepErrors(
        { message: ['actions.99.params.body must be a string', 'Internal validation exception'] },
        steps,
      ).byStep.size,
    ).toBe(0);
  });
  it('localizes validation instead of showing regexes or service internals', () => {
    const t = (key: string) => key;
    expect(
      localizeStepError('notify', 'body', 'body must match /^[^;]*$/ regular expression', t),
    ).toBe('routes.chain.notify.bodyInvalid');
    expect(localizeStepError('noop', 'timeout', 'timeout must be an integer number', t)).toBe(
      'routes.chain.fieldError.number',
    );
    expect(localizeStepError('noop', 'x', 'Internal service exception', t)).toBe(
      'routes.chain.fieldError.invalid',
    );
    expect(
      localizeStepError(
        'callerid',
        'callerIdV2',
        'routes.apps.calleridV2.accessListUnavailable',
        t,
      ),
    ).toBe('routes.apps.calleridV2.accessListUnavailable');
  });
});
