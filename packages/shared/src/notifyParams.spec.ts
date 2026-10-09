import { normalizeNotifyParams } from './notifyParams';
describe('Notify legacy parameters', () => {
  it('maps legacy message to body without changing the original', () => {
    const original = { integration_uid: '1', message: 'Звонок завершён', target: '' };
    expect(normalizeNotifyParams(original)).toEqual({
      integration_uid: '1',
      body: 'Звонок завершён',
      target: '',
    });
    expect(original).toHaveProperty('message');
  });
  it('preserves canonical body, including intentional empty text', () => {
    expect(normalizeNotifyParams({ body: '', message: 'old' })).toEqual({ body: '' });
    expect(normalizeNotifyParams({ body: 'new', message: 'old' })).toEqual({ body: 'new' });
  });
});
