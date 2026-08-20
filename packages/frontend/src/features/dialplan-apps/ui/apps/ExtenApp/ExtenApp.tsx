import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldSchema } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';

type TFn = (key: string, fallback?: string) => string;

export function buildExtenSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'target',
      kind: 'value-source',
      required: true,
      labelKey: 'routes.chain.fields.exten',
      label: t('routes.chain.fields.exten', 'Абонент'),
    },
    {
      key: 'webrtc',
      kind: 'toggle',
      labelKey: 'routes.chain.toexten.webrtc',
      label: t('routes.chain.toexten.webrtc', 'Звонить на WebRTC'),
      hintKey: 'routes.chain.toexten.webrtc.hint',
      hint: t(
        'routes.chain.toexten.webrtc.hint',
        'Параллельно звонит браузерный телефон. Выключите, если нужен только настольный.',
      ),
    },
    {
      key: 'timeout',
      kind: 'duration',
      labelKey: 'routes.chain.fields.timeout',
      label: t('routes.chain.fields.timeout', 'Таймаут, сек'),
    },
    {
      key: 'options',
      kind: 'text',
      labelKey: 'routes.chain.fields.options',
      label: t('routes.chain.fields.options', 'Опции (tThH)'),
    },
  ];
}

export const ExtenApp: React.FC<IDialplanAppProps> = ({ params, onChange, readOnly }) => {
  const { t } = useTranslation();
  const schema = useMemo(() => buildExtenSchema((key, fallback) => t(key, fallback)), [t]);

  return (
    <SchemaFields
      schema={schema}
      params={params as Record<string, unknown>}
      readOnly={readOnly}
      showErrors
      onChange={onChange}
    />
  );
};
