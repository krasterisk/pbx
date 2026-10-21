import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGetCompanyCallsQuery } from '@/shared/api/endpoints/callsApi';
import { usePhoneContactsQuery } from '@/shared/api/endpoints/phoneSessionApi';
import { PhoneList } from '@/shared/ui/SoftphoneWidget/PhoneList';
import { Text } from '@/shared/ui';

interface DialProps { canCall: boolean; onCall: (number: string) => void }
export function PhoneJournal({ extension, canCall, onCall }: DialProps & { identity: string; extension?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState<string>();
  useEffect(() => setCursor(undefined), [extension]);
  const { data, isFetching, isError, refetch } = useGetCompanyCallsQuery({ extension, limit: 20, cursor },
    { skip: !extension, pollingInterval: 30_000, refetchOnMountOrArgChange: true });
  if (!extension) return <Text variant="muted">{t('phoneNumber.journalConnect')}</Text>;
  return <PhoneList rows={(data?.rows || []).map(call => {
    const peer = call.caller.number === extension ? call.recipient : call.caller;
    const seconds = call.connectedSec;
    const time = new Intl.DateTimeFormat(undefined, { timeZone: data?.timezone || 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(call.startedAt));
    return { id: call.id, name: peer.name || peer.number || t('phoneNumber.unknownPeer'), number: peer.number || '',
      detail: `${time} · ${t(`calls.outcome.${call.outcome}`, call.outcome)}${seconds != null ? ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : ''}`,
      missed: call.outcome === 'missed' };
  })} loading={isFetching} error={isError ? t('phoneNumber.journalError') : undefined} empty={t('phoneNumber.journalEmpty')}
    retryLabel={t('phoneNumber.refresh')} onRetry={() => { setCursor(undefined); void refetch(); }}
    canCall={canCall} onCall={onCall} callLabel={t('phoneNumber.call')}
    onOpen={id => navigate(`/reports/calls?call=${encodeURIComponent(id)}`)} openLabel={t('phoneNumber.openCall')}
    hasMore={Boolean(data?.nextCursor)} onMore={() => setCursor(data?.nextCursor || undefined)} moreLabel={t('phoneNumber.nextCalls')}/>;
}
export function PhoneContacts({ identity, canCall, onCall }: DialProps & { identity: string }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim().slice(0, 80)), 250); return () => clearTimeout(timer); }, [search]);
  const { data, isFetching, isError, refetch } = usePhoneContactsQuery({identity, search: term}, {refetchOnMountOrArgChange: true});
  return <>
    <PhoneList rows={(data?.rows || []).map(row => ({...row, detail: t(row.kind === 'employee' ? 'phoneNumber.employee' : 'phoneNumber.contact')}))}
      search={search} onSearch={setSearch} placeholder={t('phoneNumber.contactSearch')}
      loading={isFetching} error={isError ? t('phoneNumber.contactsError') : undefined} empty={t('phoneNumber.contactsEmpty')}
      retryLabel={t('phoneNumber.refresh')} onRetry={() => void refetch()} canCall={canCall} onCall={onCall} callLabel={t('phoneNumber.call')}/>
    {data?.truncated && <Text variant="muted">{t('phoneNumber.refineContacts')}</Text>}
  </>;
}
