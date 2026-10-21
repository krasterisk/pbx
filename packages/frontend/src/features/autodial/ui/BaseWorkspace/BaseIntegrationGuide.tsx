import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IAutodialBase } from '@krasterisk/shared';
import { Button, Card, CardContent, CardHeader, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { AutodialIntegrationKeys } from '../CampaignWorkspace/AutodialIntegrationKeys';
import cls from './BaseWorkspace.module.scss';

export function BaseIntegrationGuide({ base }: { base: IAutodialBase }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false), [copyFailed, setCopyFailed] = useState(false);
  const fields = [...base.fields].sort((a, b) => a.position - b.position);
  const values = Object.fromEntries(fields.filter((field) => !field.is_phone && field.type !== 'phone').map((field) => [field.key,
    field.type === 'boolean' ? true : ['number', 'money'].includes(field.type) ? 100
      : field.type === 'date' ? '2026-10-25' : field.type === 'enum' ? field.enum_values?.[0] ?? '' : t('autodial.workspace.apiExampleValue')]));
  const example = `POST /api/autodial/api/v1/bases/${base.uid}/contacts/bulk\nAuthorization: Bearer <integration-token>\nIdempotency-Key: crm-batch-0001\nContent-Type: application/json\n\n${JSON.stringify({ expected_revision: base.revision,
    contacts: [{ external_id: 'crm-client-001', values, phones: [{ raw: '+7 900 000-00-01', is_primary: true, tz_offset_min: 420 }] }] }, null, 2)}`;
  return <VStack gap="16" max align="stretch">
    <Card><CardHeader><Text as="h2" variant="h2">{t('autodial.workspace.apiGuideTitle')}</Text></CardHeader><CardContent>
      <VStack gap="12" max align="stretch">
        <Text>{t('autodial.workspace.apiGuideHint')}</Text>
        <Text variant="muted">{t('autodial.workspace.apiGuideScope')}</Text>
        <pre className={cls.code} tabIndex={0} aria-label={t('autodial.workspace.apiExample')}>{example}</pre>
        <Button variant="outline" className={cls.compactAction} onClick={async () => {
          setCopied(false); setCopyFailed(false);
          try { await navigator.clipboard.writeText(example); setCopied(true); } catch { setCopyFailed(true); }
        }}>{t('autodial.workspace.apiCopyExample')}</Button>
        {copied && <Text role="status">{t('autodial.workspace.apiCopied')}</Text>}
        {copyFailed && <Text role="status">{t('autodial.workspace.apiCopyManual')}</Text>}
        <Text>{t('autodial.workspace.apiImportHint', { uid: base.uid })}</Text>
        <Text variant="muted">{t('autodial.workspace.apiResultHint', { uid: base.uid })}</Text>
      </VStack>
    </CardContent></Card>
    <Card><CardContent><AutodialIntegrationKeys /></CardContent></Card>
  </VStack>;
}
