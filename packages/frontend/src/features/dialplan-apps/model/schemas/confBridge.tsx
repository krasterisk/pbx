import type { FieldSchema } from '../schema.types';

type TFn = (...args: [key: string] | [key: string, fallback: string]) => string;

/**
 * ConfBridge on the D-08 schema surface.
 *
 * Only the room is editable here. Profiles, PIN, admin users, recording and
 * the DTMF menu belong to the conferences module. A fixed value is the room
 * uid as a decimal string; dynamic sources resolve through the tenant mask-index.
 */
export function buildConfBridgeSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'room',
      kind: 'value-source',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.confbridge.room',
      label: t('routes.chain.confbridge.room', 'Комната'),
      optionsSource: 'conferenceRooms',
      valueSourceMode: 'queue',
      hintKey: 'routes.chain.confbridge.roomHint',
      hint: t(
        'routes.chain.confbridge.roomHint',
        '**Комната из списка** - настройки, роли и лимит берутся из выбранной комнаты\n**B-номер маршрута** - номер, который набрал абонент, подбирает комнату с таким номером\n**Из переменной** - номер комнаты из переменной канала\nКомната должна быть создана заранее в разделе "Конференции".',
      ),
    },
  ];
}

export function summarizeConfBridge(
  params: Record<string, any>,
  t: (...args: [key: string] | [key: string, fallback: string]) => string,
  refs?: Record<string, unknown>,
): string {
  const room = params?.room;
  if (room?.source === 'route_pattern') {
    return t('routes.chain.summary.confbridge.routePattern', 'Комната: B-номер маршрута');
  }
  if (room?.source === 'variable') {
    return t('routes.chain.summary.confbridge.variable', 'Комната из переменной');
  }
  if (room?.source === 'directory') {
    return t('routes.chain.summary.confbridge.directory', 'Комната из справочника');
  }
  const uid = room?.source === 'fixed' ? String(room.value ?? '').trim() : '';
  if (uid) {
    const catalog = refs?.conferenceRooms as { items?: Array<{ value: string; label: string }> } | undefined;
    const item = catalog?.items?.find((entry) => entry.value === uid);
    return t('routes.chain.summary.confbridge.fixed', 'Комната {{room}}').replace(
      '{{room}}',
      item?.label ?? uid,
    );
  }
  return t('routes.chain.summary.confbridge.empty', 'Комната: не выбрана');
}
