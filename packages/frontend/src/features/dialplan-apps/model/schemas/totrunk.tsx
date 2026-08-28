import type { FieldSchema } from '../schema.types';
import type { TrunkCallerIdSource } from '@krasterisk/shared';
import {
  TrunkCarouselTrunksField,
  TrunkSingleCidField,
} from '../../ui/TrunkCarouselTrunksField/TrunkCarouselTrunksField';
import { renderDialModifyDest } from '../../ui/DialModifyField/DialModifyField';

type TFn = (key: string, fallback?: string) => string;

export function buildToTrunkSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'trunkMode',
      kind: 'mode',
      group: 'primary',
      labelKey: 'routes.chain.totrunk.trunkMode',
      label: t('routes.chain.totrunk.trunkMode', 'Режим набора'),
      options: [
        {
          value: 'single',
          labelKey: 'routes.chain.totrunk.modeSingle',
          label: t('routes.chain.totrunk.modeSingle', 'Один транк'),
        },
        {
          value: 'carousel',
          labelKey: 'routes.chain.totrunk.modeCarousel',
          label: t('routes.chain.totrunk.modeCarousel', 'Карусель транков'),
        },
      ],
    },
    {
      key: 'trunk',
      kind: 'select',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.fields.trunk',
      label: t('routes.chain.fields.trunk', 'Транк'),
      optionsSource: 'trunks',
      visibleWhen: { key: 'trunkMode', equals: ['single', ''] },
    },
    {
      key: 'callerId',
      kind: 'custom',
      group: 'primary',
      hideLabel: true,
      labelKey: 'routes.apps.trunkCarousel.cidMode',
      label: t('routes.apps.trunkCarousel.cidMode', 'Источник CID'),
      render: ({ params, onChange, readOnly }) => (
        <TrunkSingleCidField params={params} onChange={onChange} readOnly={readOnly} />
      ),
      visibleWhen: { key: 'trunkMode', equals: ['single', ''] },
    },
    {
      key: 'mode',
      kind: 'mode',
      group: 'primary',
      labelKey: 'routes.chain.trunkCarousel.mode',
      label: t('routes.chain.trunkCarousel.mode', 'Порядок обхода'),
      options: [
        {
          value: 'random_then_failover',
          labelKey: 'routes.chain.trunkCarousel.modeRandom',
          label: t('routes.chain.trunkCarousel.modeRandom', 'Случайный, затем по списку'),
        },
        {
          value: 'sequential',
          labelKey: 'routes.chain.trunkCarousel.modeSequential',
          label: t('routes.chain.trunkCarousel.modeSequential', 'По порядку'),
        },
      ],
      visibleWhen: { key: 'trunkMode', equals: 'carousel' },
    },
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
      visibleWhen: { key: 'trunkMode', equals: 'carousel' },
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

export function summarizeToTrunk(params: Record<string, unknown>, t: TFn): string {
  if (params.trunkMode === 'carousel') {
    const count = Array.isArray(params.trunks) ? params.trunks.length : 0;
    const mode =
      params.mode === 'sequential'
        ? t('routes.chain.trunkCarousel.modeSequential', 'По порядку')
        : t('routes.chain.trunkCarousel.modeRandom', 'Случайный, затем по списку');
    return count
      ? t('routes.chain.totrunk.summaryCarousel', '{{mode}}: {{count}} транк(ов)')
          .replace('{{mode}}', mode)
          .replace('{{count}}', String(count))
      : t('routes.chain.totrunk.summaryCarouselEmpty', 'Карусель транков: список пуст');
  }
  const trunk = String(params.trunk ?? '').trim() || '…';
  const base = t('routes.chain.totrunk.summary', 'Транк {{trunk}}').replace('{{trunk}}', trunk);
  const callerId = params.callerId as TrunkCallerIdSource | undefined;
  if (callerId?.mode === 'directory') {
    return `${base} (CID: ${t('routes.apps.trunkCarousel.cidDirectory', 'справочник')})`;
  }
  const staticCid = callerId?.mode === 'static' ? callerId.value : params.callerid;
  if (staticCid) {
    return `${base} (CID: ${String(staticCid)})`;
  }
  return base;
}
