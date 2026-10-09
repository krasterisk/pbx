import { isContextIdentifier } from './contextIdentifier';
describe('context identifier product convention', () => {
  it.each(['from-internal', 'access_national', 'internal2', 'a', 'a'.repeat(64)])('accepts %s', (name) => expect(isContextIdentifier(name)).toBe(true));
  it.each(['', 'two words', ' internal', 'internal ', 'Межгород', 'Internal', '123', '-internal', '_internal', 'internal-', 'internal_', 'a--b', 'a__b', 'a-_b', 'a.b', 'a/b', 'a;b', 'a[b]', 'a@b', 'a\nb', 'a'.repeat(65)])('rejects %s', (name) => expect(isContextIdentifier(name)).toBe(false));
});
