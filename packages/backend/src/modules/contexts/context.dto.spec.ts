import { validateSync } from 'class-validator';
import { CreateContextDto, UpdateContextDto } from './context.dto';
describe('context identifier HTTP validation', () => {
  it.each([CreateContextDto, UpdateContextDto])('validates identifier on %p', (Dto) => {
    for (const name of ['from-internal', 'access_national', 'a'.repeat(64)]) {
      expect(validateSync(Object.assign(new Dto(), { name }))).toHaveLength(0);
    }
    for (const name of ['', 'two words', 'Межгород', 'Internal', 'a.b', 'a_', 'a--b', 'a'.repeat(65)]) {
      expect(validateSync(Object.assign(new Dto(), { name })).some((error) => error.property === 'name')).toBe(true);
    }
  });
});
