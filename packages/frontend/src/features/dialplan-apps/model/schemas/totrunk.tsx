import type { FieldSchema } from '../schema.types';
import type { ITrunkCarouselItem, TrunkCallerIdSource } from '@krasterisk/shared';
import { TrunkCarouselTrunksField } from '../../ui/TrunkCarouselTrunksField/TrunkCarouselTrunksField';
import { renderDialModifyDest } from '../../ui/DialModifyField/DialModifyField';

type TFn = (...args: [key: string] | [key: string, fallback: string]) => string;

const DEFAULT_TRUNK_TIMEOUT = 60;

/** Lift legacy single-trunk params into a one-item `trunks` list for the editor. */
export function normalizeToTrunkParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const trunks = Array.isArray(params.trunks) ? (params.trunks as ITrunkCarouselItem[]) : [];
  if (trunks.length > 0) {
    return {
      ...params,
      trunks,
      mode: params.mode === 'sequential' ? 'sequential' : 'random_then_failover',
    };
  }

  const trunkRaw = String(params.trunk ?? '').trim();
  if (!trunkRaw && !params.callerId && !params.callerid) {
    return {
      ...params,
      trunks: [{
        trunkId: '',
        callerId: { mode: 'static', value: '' },
        timeout: Number(params.timeout) || DEFAULT_TRUNK_TIMEOUT,
      }],
      mode: params.mode === 'sequential' ? 'sequential' : 'random_then_failover',
    };
  }

  // Legacy single: trunk may be name or PJSIP/id — keep as trunkId for dual-read compile.
  const legacyCaller = params.callerId as TrunkCallerIdSource | undefined;
  let callerId: TrunkCallerIdSource;
  if (legacyCaller?.mode === 'directory') {
    callerId = legacyCaller;
  } else if (legacyCaller?.mode === 'pool') {
    callerId = legacyCaller;
  } else {
    const value =
      legacyCaller?.mode === 'static'
        ? (legacyCaller.value ?? '')
        : String(params.callerid ?? '');
    callerId = { mode: 'static', value };
  }

  return {
    ...params,
    trunks: [{
      trunkId: trunkRaw,
      callerId,
      timeout: Number(params.timeout) || DEFAULT_TRUNK_TIMEOUT,
    }],
    mode: params.mode === 'sequential' ? 'sequential' : 'random_then_failover',
  };
}

export function buildToTrunkSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'trunks',
      kind: 'custom',
      required: true,
      group: 'primary',
      hideLabel: true,
      labelKey: 'routes.chain.trunkCarousel.trunks',
      label: t('routes.chain.trunkCarousel.trunks', 'Транки'),
      render: ({ params, onChange, readOnly }) => (
        <TrunkCarouselTrunksField params={params} onChange={onChange} readOnly={readOnly} />
      ),
    },
    {
      key: 'dest',
      kind: 'value-source',
      group: 'primary',
      labelKey: 'routes.chain.fields.dest',
      label: t('routes.chain.fields.dest', 'Назначение'),
      valueSourceMode: 'dial',
      hintKey: 'routes.chain.source.dialHint',
      hint:
        '**B-номер маршрута** - набираем номер, который набрал звонящий\n**Фиксированное значение** - постоянный номер для набора\n**Из переменной** - номер из переменной канала\n**Из справочника** - номер из поля записи по CallerID',
      row: 'destTimeout',
      rowWeight: 70,
    },
    {
      key: 'timeout',
      kind: 'duration',
      group: 'primary',
      labelKey: 'routes.chain.fields.timeoutDefault',
      label: t('routes.chain.fields.timeoutDefault', 'Таймаут по умолчанию, сек'),
      row: 'destTimeout',
      rowWeight: 30,
    },
    {
      key: 'rewrite',
      kind: 'custom',
      group: 'primary',
      hideLabel: true,
      labelKey: 'routes.chain.modify.title',
      label: t('routes.chain.modify.title', 'Модификация номера'),
      render: renderDialModifyDest,
    },
  ];
}

function summarizeCid(callerId: TrunkCallerIdSource | undefined, t: TFn): string | null {
  if (!callerId) return null;
  if (callerId.mode === 'directory') {
    return t('routes.apps.trunkCarousel.cidDirectory', 'справочник');
  }
  if (callerId.mode === 'pool') {
    const count = Array.isArray(callerId.numbers) ? callerId.numbers.length : 0;
    return t('routes.apps.trunkCarousel.cidPoolSummary', 'пул {{count}}')
      .replace('{{count}}', String(count));
  }
  if (callerId.mode === 'static' && callerId.value) {
    return String(callerId.value);
  }
  return null;
}

export function summarizeToTrunk(params: Record<string, unknown>, t: TFn): string {
  const trunks = Array.isArray(params.trunks) ? (params.trunks as ITrunkCarouselItem[]) : [];
  const filled = trunks.filter((row) => String(row?.trunkId ?? '').trim());

  if (filled.length >= 2) {
    const mode =
      params.mode === 'sequential'
        ? t('routes.chain.trunkCarousel.modeSequential', 'По порядку')
        : t('routes.chain.trunkCarousel.modeRandom', 'Случайный, затем по списку');
    return t('routes.chain.totrunk.summaryCarousel', '{{mode}}: {{count}} транк(ов)')
      .replace('{{mode}}', mode)
      .replace('{{count}}', String(filled.length));
  }

  if (filled.length === 1) {
    const row = filled[0];
    const trunk = String(row.trunkId).trim() || '…';
    const base = t('routes.chain.totrunk.summary', 'Транк {{trunk}}').replace('{{trunk}}', trunk);
    const cid = summarizeCid(row.callerId, t);
    return cid ? `${base} (CID: ${cid})` : base;
  }

  // Legacy single dual-read
  const trunk = String(params.trunk ?? '').trim();
  if (trunk) {
    const base = t('routes.chain.totrunk.summary', 'Транк {{trunk}}').replace('{{trunk}}', trunk);
    const callerId = params.callerId as TrunkCallerIdSource | undefined;
    const cid = summarizeCid(callerId, t)
      ?? (params.callerid ? String(params.callerid) : null);
    return cid ? `${base} (CID: ${cid})` : base;
  }

  return t('routes.chain.totrunk.summaryCarouselEmpty', 'Карусель транков: список пуст');
}
