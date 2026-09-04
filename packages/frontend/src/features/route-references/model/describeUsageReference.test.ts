import { describe, expect, it } from 'vitest';
import type { IRoute } from '@krasterisk/shared';
import {
  actionTypeLabel,
  describeUsageReference,
  formatReferenceLocation,
} from './describeUsageReference';

const t = (key: string, fallback: string, options?: Record<string, unknown>) => {
  if (key === 'routes.action.toivr') return 'IVR';
  if (key === 'routes.action.toqueue') return 'Очередь';
  if (!options) return fallback;
  return fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''));
};

const inbound: IRoute = {
  uid: 5,
  context_uid: 1,
  name: 'Очередь',
  extensions: ['700'],
  priority: 1,
  active: 1,
  options: null,
  webhooks: null,
  actions: [{ id: 'a1', type: 'toivr', params: { ivr_uid: 7 }, condition: {} }],
  raw_dialplan: null,
  user_uid: 1,
  created_at: '',
  updated_at: '',
};

describe('describeUsageReference', () => {
  it('labels a route hit with the route name, numbers and action title', () => {
    const view = describeUsageReference(
      {
        routeUid: 5,
        actionOrBindingId: 'a1',
        location: 'Route 5 action a1',
        host: 'route',
        routeName: 'Очередь',
        extensions: ['700'],
        actionType: 'toivr',
        actionIndex: 1,
      },
      inbound,
      t,
    );

    expect(view.title).toBe('Маршрут «Очередь»');
    expect(view.subtitle).toBe('Номера: 700');
    expect(view.location).toBe('Действие 1 — IVR');
    expect(view.location).not.toContain('toivr');
    expect(view.href).toBe('/routes');
  });

  it('labels an IVR menu hit with the menu name and digit', () => {
    const view = describeUsageReference(
      {
        routeUid: 0,
        actionOrBindingId: 'q1',
        location: 'IVR 4 digit 1 action q1',
        host: 'ivr',
        ivrUid: 4,
        ivrName: 'Главное меню',
        menuDigit: '1',
        actionType: 'toqueue',
        actionIndex: 1,
      },
      undefined,
      t,
    );

    expect(view.title).toBe('IVR «Главное меню»');
    expect(view.location).toBe('Кнопка 1 · Действие 1 — Очередь');
    expect(view.href).toBe('/ivrs');
  });

  it('keeps directory bindings as route directories', () => {
    expect(
      formatReferenceLocation(
        { routeUid: 5, actionOrBindingId: '12', location: 'Route 5 binding 12', host: 'binding' },
        inbound,
        t,
      ),
    ).toBe('Справочники маршрута');
  });

  it('maps raw action types to catalog labels', () => {
    expect(actionTypeLabel('toivr', t)).toBe('IVR');
    expect(actionTypeLabel('toqueue', t)).toBe('Очередь');
  });
});
