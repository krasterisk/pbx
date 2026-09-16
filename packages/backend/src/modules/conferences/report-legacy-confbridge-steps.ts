/**
 * Report (and optionally strip) leftover confbridge step `options` keys.
 * Default is dry-run — no writes. Pass --apply to delete only that dead key.
 *
 * Run: npm run db:report:legacy-confbridge -w @krasterisk/backend
 *      npm run db:report:legacy-confbridge -w @krasterisk/backend -- --apply
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  classifyLegacyConfbridgeStep,
  stripLegacyConfbridgeKeys,
} from './legacy-confbridge-steps.util';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const APPLY = process.argv.includes('--apply');

type RouteRow = {
  uid: number;
  user_uid: number;
  actions: unknown;
};

type RoomRow = {
  user_uid: number;
  number: string;
};

function parseActions(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function roomBrief(step: Record<string, unknown>): { source: string; value: string } {
  const params = (step.params ?? {}) as Record<string, unknown>;
  const room = params.room;
  if (room && typeof room === 'object' && !Array.isArray(room)) {
    const src = room as { source?: unknown; value?: unknown; name?: unknown };
    return {
      source: typeof src.source === 'string' ? src.source : '',
      value: typeof src.value === 'string' ? src.value : typeof src.name === 'string' ? src.name : '',
    };
  }
  if (typeof room === 'string') {
    return { source: 'fixed', value: room };
  }
  return { source: '', value: '' };
}

async function main(): Promise<void> {
  const { Sequelize } = await import('sequelize-typescript');
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: false,
  });

  const [routes] = (await sequelize.query(
    'SELECT uid, user_uid, actions FROM routes',
  )) as [RouteRow[], unknown];
  const [rooms] = (await sequelize.query(
    'SELECT vpbx_user_uid AS user_uid, number FROM conference_rooms',
  )) as [RoomRow[], unknown];

  const numbersByTenant = new Map<number, Set<string>>();
  for (const room of rooms) {
    const set = numbersByTenant.get(room.user_uid) ?? new Set<string>();
    set.add(String(room.number));
    numbersByTenant.set(room.user_uid, set);
  }

  const applied: number[] = [];
  let printed = 0;

  for (const route of routes) {
    const actions = parseActions(route.actions);
    const tenantNumbers = numbersByTenant.get(route.user_uid) ?? new Set<string>();
    let changed = false;
    const nextActions = actions.map((step, index) => {
      const verdict = classifyLegacyConfbridgeStep(step, tenantNumbers);
      if (!verdict.applicable) return step;
      printed += 1;
      const brief = roomBrief(step);
      const stepId = step.id ?? step.uid ?? index;
      console.log(
        [
          `tenant=${route.user_uid}`,
          `route=${route.uid}`,
          `step=${stepId}`,
          `source=${brief.source || '-'}`,
          `value=${brief.value || '-'}`,
          `static=${verdict.staticSource}`,
          `numberKnown=${verdict.numberKnown}`,
          `deadKey=${verdict.hasDeadKey}`,
        ].join(' '),
      );
      if (!APPLY || !verdict.hasDeadKey) return step;
      const params = (step.params ?? {}) as Record<string, unknown>;
      const stripped = stripLegacyConfbridgeKeys(params);
      if (!stripped.changed) return step;
      changed = true;
      return { ...step, params: stripped.params };
    });

    if (APPLY && changed) {
      await sequelize.query('UPDATE routes SET actions = :actions WHERE uid = :uid', {
        replacements: { actions: JSON.stringify(nextActions), uid: route.uid },
      });
      applied.push(route.uid);
    }
  }

  if (printed === 0) {
    console.log('No confbridge steps found.');
  }
  if (APPLY) {
    if (applied.length) {
      console.log(
        `Stripped dead options on routes: ${applied.join(', ')}. Dialplan of these routes reapplies on the next route save.`,
      );
    } else {
      console.log('Apply flag set; no routes needed an options strip.');
    }
  } else {
    console.log('Dry-run only — pass --apply to strip the dead options key.');
  }

  await sequelize.close();
}

const isDirectRun =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
