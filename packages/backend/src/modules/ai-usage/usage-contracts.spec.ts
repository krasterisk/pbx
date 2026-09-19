import * as fs from 'fs';
import * as path from 'path';
import { D1_JOB_ASSET_TABLES, D4_USAGE_TABLES } from './usage-contracts';

const migrations = [
  path.resolve(__dirname, '../../../database/migrations/0008-ai-jobs-assets.sql'),
  path.resolve(__dirname, '../../../database/migrations/postgres/0008-ai-jobs-assets.sql'),
];

describe('D1 usage contract boundary', () => {
  it('creates job/asset tables and leaves D4 ledger tables for later', () => {
    for (const file of migrations) {
      const sql = fs.readFileSync(file, 'utf8');
      for (const table of D1_JOB_ASSET_TABLES) {
        expect(sql).toMatch(new RegExp(`CREATE TABLE ${table} \\(`));
      }
      for (const table of D4_USAGE_TABLES) {
        expect(sql).not.toMatch(new RegExp(`CREATE TABLE ${table}\\b`));
      }
    }
  });
});
