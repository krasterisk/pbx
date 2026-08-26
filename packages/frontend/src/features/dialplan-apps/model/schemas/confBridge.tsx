import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

/**
 * ConfBridge on the D-07 schema surface (D-41).
 *
 * Only the room is editable here. The former options field wrote a flag string
 * into ConfBridge's second argument, which Asterisk reads as a bridge profile
 * name — the flags never took effect. Profiles, PIN, admin users, recording and
 * the DTMF menu belong to the conferences module.
 *
 * Accepted risk T-12-03-05 / T-12-13-03: the room argument is NOT tenant-scoped.
 * Two tenants that pick the same room number join the same conference.
 */
export function buildConfBridgeSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'room',
      kind: 'value-source',
      required: true,
      labelKey: 'routes.chain.confbridge.room',
      label: t('routes.chain.confbridge.room', 'Комната'),
      hintKey: 'routes.chain.confbridge.roomHint',
      hint: t(
        'routes.chain.confbridge.roomHint',
        'Номер комнаты. Два тенанта с одинаковым номером попадут в одну конференцию.',
      ),
    },
  ];
}
