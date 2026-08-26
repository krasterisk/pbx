import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, VStack, HStack, Input, Label, Select, Textarea, Checkbox, Text, Badge, TagInput,
} from '@/shared/ui';
import {
  useCreateKomandorClaimMutation,
  useUpdateKomandorClaimMutation,
  useGetKomandorStoresQuery,
  useGetKomandorDictQuery,
} from '@/shared/api/endpoints/komandorClaimApi';
import type { IKomandorClaim, IKomandorPerson, KomandorSentiment } from '@/entities/komandorClaim';
import { KOMANDOR_STATUS_OPTIONS, KOMANDOR_SENTIMENT_OPTIONS } from '@/entities/komandorClaim';
import { toast } from 'react-toastify';
import { Store, Users, FileText, MessageSquare, Phone } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  record?: IKomandorClaim;
}

type TabKey = 'claim' | 'reply';

function peopleToChips(list?: IKomandorPerson[] | null): string[] {
  if (!list?.length) return [];
  return list.map((p) => (p.email ? `${p.name} <${p.email}>` : p.name)).filter(Boolean);
}

function parsePersonChip(raw: string): IKomandorPerson | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  if (t.includes('@')) return { name: t, email: t };
  return { name: t };
}

function chipsToPeople(chips: string[]): IKomandorPerson[] {
  return chips.map(parsePersonChip).filter(Boolean) as IKomandorPerson[];
}

function parseEmailChips(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => s.includes('@'));
}

/** Mask: +7(901)-123-45-67 (same idea as ServiceRequestModal). */
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  let d = digits;
  if (d.startsWith('8') && d.length > 1) d = `7${d.slice(1)}`;
  if (!d.startsWith('7') && d.length > 0) d = `7${d}`;
  d = d.slice(0, 11);
  let r = '';
  if (d.length >= 1) r = `+${d[0]}`;
  if (d.length >= 2) r += `(${d.slice(1, Math.min(4, d.length))}`;
  if (d.length >= 4) r += ')';
  if (d.length >= 5) r += `-${d.slice(4, Math.min(7, d.length))}`;
  if (d.length >= 7) r += `-${d.slice(7, Math.min(9, d.length))}`;
  if (d.length >= 9) r += `-${d.slice(9, Math.min(11, d.length))}`;
  return r;
}

function stripPhone(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export function KomandorClaimModal({ isOpen, onClose, record }: Props) {
  const [createReq, { isLoading: creating }] = useCreateKomandorClaimMutation();
  const [updateReq, { isLoading: updating }] = useUpdateKomandorClaimMutation();
  const { data: stores = [] } = useGetKomandorStoresQuery();
  const { data: dict = [] } = useGetKomandorDictQuery();

  const isEdit = !!record;
  const isLoading = creating || updating;

  const [tab, setTab] = useState<TabKey>('claim');
  const [storeId, setStoreId] = useState<string>('');
  const [storeQuery, setStoreQuery] = useState('');
  const [directors, setDirectors] = useState<string[]>([]);
  const [zdf, setZdf] = useState<string[]>([]);
  const [extraRecipients, setExtraRecipients] = useState<string[]>([]);
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [requestDate, setRequestDate] = useState('');
  const [channel, setChannel] = useState('Телефония');
  const [topic, setTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmails, setClientEmails] = useState<string[]>([]);
  const [sentiment, setSentiment] = useState<KomandorSentiment>('neutral');
  const [status, setStatus] = useState('new');
  const [departmentNote, setDepartmentNote] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [sendToStore, setSendToStore] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  const channels = useMemo(() => dict.filter((d) => d.kind === 'channel'), [dict]);
  const topics = useMemo(() => dict.filter((d) => d.kind === 'topic'), [dict]);
  const subtopics = useMemo(
    () => dict.filter((d) => d.kind === 'subtopic' && (!topic || d.parent_name === topic)),
    [dict, topic],
  );
  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      [s.code, s.name, s.address, s.city].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [stores, storeQuery]);

  useEffect(() => {
    if (!isOpen) return;
    if (record) {
      setStoreId(record.store_id ? String(record.store_id) : '');
      setDirectors(peopleToChips(record.directors));
      setZdf(peopleToChips(record.zdf));
      setExtraRecipients(peopleToChips(record.extra_recipients));
      setExtraEmails(parseEmailChips(record.extra_emails));
      setRequestDate(record.request_date?.slice(0, 10) || '');
      setChannel(record.channel || 'Телефония');
      setTopic(record.topic || '');
      setSubtopic(record.subtopic || '');
      setDescription(record.description || '');
      setContactInfo(record.contact_info || '');
      setClientPhone(record.client_phone ? formatPhoneInput(record.client_phone) : '');
      setClientEmails(parseEmailChips(record.client_email));
      setSentiment(record.sentiment || 'neutral');
      setStatus(record.request_status || 'new');
      setCustomerResponse(record.customer_response || '');
      setAttachmentName(record.attachment_name || '');
    } else {
      setStoreId('');
      setDirectors([]);
      setZdf([]);
      setExtraRecipients([]);
      setExtraEmails([]);
      setRequestDate(new Date().toISOString().slice(0, 10));
      setChannel('Телефония');
      setTopic('');
      setSubtopic('');
      setDescription('');
      setContactInfo('');
      setClientPhone('');
      setClientEmails([]);
      setSentiment('neutral');
      setStatus('new');
      setCustomerResponse('');
      setAttachmentName('');
    }
    setDepartmentNote('');
    setSendToStore(false);
    setSendSms(false);
    setSendEmail(false);
    setTab('claim');
    setStoreQuery('');
  }, [isOpen, record]);

  const onStoreChange = (id: string) => {
    setStoreId(id);
    const store = stores.find((s) => String(s.uid) === id);
    if (store) {
      setDirectors(peopleToChips(store.directors));
      setZdf(peopleToChips(store.zdf));
    }
  };

  const isValid = storeId !== '' && topic !== '' && description.trim() !== '';

  const save = async () => {
    if (!isValid) {
      toast.error('Заполните магазин, тематику и описание ситуации');
      return;
    }
    const store = stores.find((s) => String(s.uid) === storeId);
    const payload = {
      store_id: Number(storeId),
      store_code: store?.code || null,
      store_name: store?.name || null,
      store_address: store?.address || null,
      directors: chipsToPeople(directors),
      zdf: chipsToPeople(zdf),
      extra_recipients: chipsToPeople(extraRecipients),
      extra_emails: extraEmails.join(', '),
      request_date: requestDate || undefined,
      channel,
      topic,
      subtopic,
      description,
      contact_info: contactInfo,
      client_phone: stripPhone(clientPhone) || null,
      client_email: clientEmails.join(', ') || null,
      sentiment,
      request_status: status as IKomandorClaim['request_status'],
      customer_response: customerResponse,
      attachment_name: attachmentName || null,
      send_to_store: sendToStore,
      send_sms: sendSms,
      send_email: sendEmail,
      department_note: departmentNote || undefined,
    };
    try {
      if (isEdit && record) {
        await updateReq({ id: record.uid, data: payload }).unwrap();
        toast.success('Рекламация обновлена');
      } else {
        await createReq(payload).unwrap();
        toast.success('Рекламация создана');
      }
      onClose();
    } catch {
      toast.error('Не удалось сохранить рекламацию');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent size="large" className="min-w-0" aria-describedby={undefined}>
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEdit ? `Рекламация ${record?.request_number || record?.uid}` : 'Новая рекламация Командор'}
          </DialogTitle>
        </DialogHeader>

        <HStack gap="8" className="border-b border-border/50 pb-2 shrink-0">
          <Button variant={tab === 'claim' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('claim')}>Рекламация</Button>
          <Button variant={tab === 'reply' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('reply')}>Ответы и отправка</Button>
        </HStack>

        {tab === 'claim' && (
          <VStack max gap="16" className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pr-1">
            <VStack max gap="8">
              <HStack gap="8" align="center"><Store className="w-4 h-4" /><Text variant="small" className="font-semibold">Магазин и ответственные</Text></HStack>
              <Input placeholder="Поиск магазина..." value={storeQuery} onChange={(e) => setStoreQuery(e.target.value)} />
              <div className="w-full min-w-0">
                <Label className="text-xs">Магазин *</Label>
                <Select value={storeId} onChange={(e) => onStoreChange(e.target.value)}>
                  <option value="">Выберите магазин...</option>
                  {filteredStores.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {[s.code, s.city, s.address, s.name].filter(Boolean).join(' — ')}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full min-w-0">
                <div className="min-w-0">
                  <Label className="text-xs">Директор магазина</Label>
                  <TagInput
                    value={directors}
                    onChange={setDirectors}
                    placeholder="Имя <email> и Enter"
                  />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">ЗДФ</Label>
                  <TagInput
                    value={zdf}
                    onChange={setZdf}
                    placeholder="Имя <email> и Enter"
                  />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">Получатели дополнительно</Label>
                  <TagInput
                    value={extraRecipients}
                    onChange={setExtraRecipients}
                    placeholder="Имя <email> и Enter"
                  />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">Получатели дополнительно (Email)</Label>
                  <TagInput
                    value={extraEmails}
                    onChange={setExtraEmails}
                    placeholder="email и Enter"
                  />
                </div>
              </div>
            </VStack>

            <VStack max gap="8">
              <HStack gap="8" align="center"><FileText className="w-4 h-4" /><Text variant="small" className="font-semibold">Обращение</Text></HStack>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full min-w-0">
                <div className="min-w-0">
                  <Label className="text-xs">Дата обращения</Label>
                  <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">Канал</Label>
                  <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                    {channels.map((c) => <option key={c.uid} value={c.name}>{c.name}</option>)}
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">Статус</Label>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {KOMANDOR_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">Тематика *</Label>
                  <Select value={topic} onChange={(e) => { setTopic(e.target.value); setSubtopic(''); }}>
                    <option value="">Выберите...</option>
                    {topics.map((t) => <option key={t.uid} value={t.name}>{t.name}</option>)}
                  </Select>
                </div>
                <div className="md:col-span-2 min-w-0">
                  <Label className="text-xs">Подтема</Label>
                  <Select value={subtopic} onChange={(e) => setSubtopic(e.target.value)} disabled={!topic}>
                    <option value="">{topic ? 'Выберите...' : '← Сначала тематика'}</option>
                    {subtopics.map((s) => <option key={s.uid} value={s.name}>{s.name}</option>)}
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Описание ситуации *</Label>
                <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Вложение (имя файла)</Label>
                <Input value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} placeholder="Нет данных" />
              </div>
            </VStack>

            <VStack max gap="8">
              <HStack gap="8" align="center"><Phone className="w-4 h-4" /><Text variant="small" className="font-semibold">Клиент</Text></HStack>
              <div>
                <Label className="text-xs">Контактная информация</Label>
                <Textarea rows={2} value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full min-w-0">
                <div className="min-w-0">
                  <Label className="text-xs">Телефон клиента (для СМС)</Label>
                  <HStack className="relative w-full min-w-0">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={clientPhone}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') { setClientPhone(''); return; }
                        setClientPhone(formatPhoneInput(raw));
                      }}
                      placeholder="+7(___)-___-__-__"
                      className="pl-9 w-full"
                      maxLength={17}
                      inputMode="tel"
                    />
                  </HStack>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">Email клиента</Label>
                  <TagInput
                    value={clientEmails}
                    onChange={setClientEmails}
                    placeholder="email и Enter"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Тональность</Label>
                <HStack gap="8">
                  {KOMANDOR_SENTIMENT_OPTIONS.map((o) => (
                    <Button
                      key={o.value}
                      type="button"
                      size="sm"
                      variant={sentiment === o.value ? 'default' : 'outline'}
                      className={
                        o.value === 'negative' ? 'border-red-300' : o.value === 'positive' ? 'border-green-300' : 'border-amber-300'
                      }
                      onClick={() => setSentiment(o.value)}
                    >
                      {o.label}
                    </Button>
                  ))}
                </HStack>
              </div>
            </VStack>
          </VStack>
        )}

        {tab === 'reply' && (
          <VStack max gap="16" className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pr-1">
            {!!record?.department_log?.length && (
              <VStack gap="8">
                <HStack gap="8" align="center"><Users className="w-4 h-4" /><Text variant="small" className="font-semibold">Ответы подразделения</Text></HStack>
                {record.department_log.map((m, i) => (
                  <div key={i} className="rounded border border-border/50 p-2 text-sm">
                    <Text variant="small" className="text-muted-foreground">
                      {new Date(m.at).toLocaleString('ru-RU')} {m.author}
                    </Text>
                    <Text variant="small">{m.text}</Text>
                  </div>
                ))}
              </VStack>
            )}
            <div>
              <Label className="text-xs">Новый ответ подразделения</Label>
              <Textarea rows={3} value={departmentNote} onChange={(e) => setDepartmentNote(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Ответ покупателю</Label>
              <Textarea rows={3} value={customerResponse} onChange={(e) => setCustomerResponse(e.target.value)} />
            </div>
            <VStack gap="8">
              <HStack gap="8" align="center"><MessageSquare className="w-4 h-4" /><Text variant="small" className="font-semibold">Отправка</Text></HStack>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={sendToStore} onChange={(e) => setSendToStore(e.target.checked)} />
                Отправить рекламацию на почту магазина / ответственных
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} disabled={stripPhone(clientPhone).length < 12} />
                Отправить СМС клиенту
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} disabled={clientEmails.length === 0} />
                Отправить email клиенту
              </label>
              {isEdit && (
                <HStack gap="8">
                  <Badge variant="outline">СМС: {record?.sms_status}</Badge>
                  <Badge variant="outline">Email: {record?.email_status}</Badge>
                  <Badge variant="outline">Магазин: {record?.store_email_status}</Badge>
                </HStack>
              )}
            </VStack>
          </VStack>
        )}

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={save} disabled={isLoading || !isValid}>
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
