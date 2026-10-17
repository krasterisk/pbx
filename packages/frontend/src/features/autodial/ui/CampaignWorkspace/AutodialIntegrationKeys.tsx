import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Label, MultiSelect, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectUserLevel } from '@/entities/User';
import { useGetAutodialIntegrationKeysQuery, useCreateAutodialIntegrationKeyMutation, useRevokeAutodialIntegrationKeyMutation } from '@/shared/api/endpoints/autodialApi';

const scopes = ['autodial:read', 'autodial:contacts:write', 'autodial:imports:write', 'autodial:dnc:write', 'autodial:proposals:write', 'autodial:webhooks:write'];
export function AutodialIntegrationKeys() {
  const { t, i18n } = useTranslation(), level = useAppSelector(selectUserLevel), allowed = [0, 1].includes(Number(level));
  const { currentData, isError } = useGetAutodialIntegrationKeysQuery(undefined, { skip: !allowed });
  const [create, result] = useCreateAutodialIntegrationKeyMutation(), [revoke, revoking] = useRevokeAutodialIntegrationKeyMutation();
  const [label, setLabel] = useState(''), [selected, setSelected] = useState(['autodial:read']);
  const [expiry, setExpiry] = useState(() => new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)), [failed, setFailed] = useState(false);
  const reset = result.reset;
  useEffect(() => () => reset(), [reset]);
  if (!allowed) return null;
  return <VStack gap="8" max>
    <Text>{t('autodial.workspace.apiKeysTitle')}</Text><Text variant="muted">{t('autodial.workspace.apiKeysHint')}</Text>
    <Label htmlFor="autodial-api-key-label">{t('autodial.workspace.apiKeyLabel')}</Label>
    <Input id="autodial-api-key-label" value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} />
    <Label htmlFor="autodial-api-key-expiry">{t('autodial.workspace.apiKeyExpiry')}</Label>
    <Input id="autodial-api-key-expiry" type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
    <MultiSelect options={scopes.map((scope) => ({ value: scope, label: t(`autodial.workspace.apiScopes.${scope}`, { nsSeparator: false }) }))} value={selected} onChange={setSelected} />
    <Button disabled={!label.trim() || !expiry || !selected.length || result.isLoading || !!result.data} onClick={async () => {
      setFailed(false); try { await create({ label: label.trim(), scopes: selected, expires_at: `${expiry}T23:59:59.000Z` }).unwrap(); } catch { setFailed(true); }
    }}>{t('autodial.workspace.apiKeyCreate')}</Button>
    {result.data && <VStack gap="4" max><Text>{t('autodial.workspace.apiKeyOnce')}</Text>
      <Input readOnly value={result.data.token} aria-label={t('autodial.workspace.apiKeySecret')} autoComplete="off" />
      <Button variant="secondary" onClick={() => reset()}>{t('autodial.workspace.apiKeyHide')}</Button></VStack>}
    {(failed || isError) && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
    {(currentData ?? []).map((key) => <HStack key={key.uid} gap="8" wrap="wrap" justify="between" max>
      <VStack gap="4"><Text>{key.label}</Text><Text variant="muted">{key.scopes.map((scope) => t(`autodial.workspace.apiScopes.${scope}`, { nsSeparator: false })).join(', ')} · {new Date(key.expires_at).toLocaleString(i18n.language)}</Text></VStack>
      <Button variant="ghost" disabled={!!key.revoked_at || revoking.isLoading} onClick={async () => {
        if (!window.confirm(t('autodial.workspace.apiKeyRevokeConfirm', { label: key.label }))) return;
        setFailed(false); try { await revoke(key.uid).unwrap(); } catch { setFailed(true); }
      }}>{t(key.revoked_at ? 'autodial.workspace.apiKeyRevoked' : 'autodial.workspace.apiKeyRevoke')}</Button>
    </HStack>)}
  </VStack>;
}
