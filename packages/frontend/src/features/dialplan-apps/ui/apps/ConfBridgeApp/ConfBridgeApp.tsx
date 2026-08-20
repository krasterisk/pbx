import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldSchema } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';
import { OptionsEditor } from '../../OptionsEditor/OptionsEditor';
import styles from './ConfBridgeApp.module.scss';

type TFn = (key: string, fallback?: string) => string;

/**
 * ConfBridge on the D-07 schema surface (D-41).
 *
 * Not in this phase: conference profiles, PIN, admin-marked users, recording,
 * DTMF menu. Showing those as "coming soon" is worse than omitting them.
 *
 * Accepted risk T-12-03-05 / T-12-13-03: the room argument is NOT tenant-scoped.
 * Two tenants that pick the same room number join the same conference.
 * Tenant suffix is a later conferences-module phase.
 */
export function buildConfBridgeSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'room',
      kind: 'value-source',
      required: true,
      labelKey: 'routes.chain.confbridge.room',
      label: t('routes.chain.confbridge.room', 'Комната'),
      hintKey: 'routes.chain.confbridge.room.hint',
      hint: t(
        'routes.chain.confbridge.room.hint',
        'Номер комнаты. Два тенанта с одинаковым номером попадут в одну конференцию.',
      ),
    },
    {
      key: 'options',
      kind: 'custom',
      labelKey: 'routes.chain.confbridge.options',
      label: t('routes.chain.confbridge.options', 'Опции'),
      render: ({ params, onChange, readOnly }) => (
        <OptionsEditor
          value={String(params.options ?? '')}
          flags={['t', 'T', 'h', 'H', 'm']}
          readOnly={readOnly}
          onChange={(options) => onChange({ options })}
        />
      ),
    },
  ];
}

export function ConfBridgeApp({ params, onChange, readOnly }: IDialplanAppProps) {
  const { t } = useTranslation();
  const schema = useMemo(() => buildConfBridgeSchema((key, fallback) => t(key, fallback)), [t]);

  return (
    <div className={styles.root}>
      <SchemaFields
        schema={schema}
        params={params as Record<string, unknown>}
        readOnly={readOnly}
        showErrors
        onChange={onChange}
      />
    </div>
  );
}
