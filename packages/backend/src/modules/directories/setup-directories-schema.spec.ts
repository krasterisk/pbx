import { DIRECTORY_SCHEMA_STATEMENTS, setupDirectoriesSchema } from './setup-directories-schema';

const EXPECTED_TABLES = [
  'directories',
  'directory_fields',
  'directory_records',
  'route_directory_bindings',
];

function tableNamesFromSql(statements: string[]): string[] {
  const names = new Set<string>();
  const re = /create\s+table\s+if\s+not\s+exists\s+`?([a-z0-9_]+)`?/gi;
  for (const sql of statements) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(sql)) !== null) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

describe('setupDirectoriesSchema', () => {
  it('exports CREATE TABLE IF NOT EXISTS statements for only the four new tables', () => {
    expect(DIRECTORY_SCHEMA_STATEMENTS.length).toBeGreaterThan(0);
    const joined = DIRECTORY_SCHEMA_STATEMENTS.join('\n');
    expect(joined).not.toMatch(/drop\s+/i);
    expect(joined).not.toMatch(/phonebook/i);
    expect(tableNamesFromSql(DIRECTORY_SCHEMA_STATEMENTS)).toEqual([...EXPECTED_TABLES].sort());
  });

  it('is idempotent through a mocked query interface and targets only the four new tables', async () => {
    const executed: string[] = [];
    const query = jest.fn(async (sql: string) => {
      executed.push(sql);
      return [undefined, undefined];
    });
    const queryInterface = { sequelize: { query } };
    const sequelize = {
      query,
      getQueryInterface: () => queryInterface,
    };

    await setupDirectoriesSchema(sequelize as never);
    await setupDirectoriesSchema(sequelize as never);

    expect(query).toHaveBeenCalled();
    expect(executed.join('\n')).not.toMatch(/drop\s+/i);
    expect(executed.join('\n')).not.toMatch(/phonebook/i);
    expect(tableNamesFromSql(executed)).toEqual([...EXPECTED_TABLES].sort());
  });
});
