import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  VStack,
  HStack,
  Input,
  Label,
  Select,
  Textarea,
  Checkbox,
  Text,
  Badge,
} from '@/shared/ui';
import {
  useCreateServiceRequestMutation,
  useUpdateServiceRequestMutation,
  useGetCcSubjectsQuery,
  useGetCcDistrictsQuery,
} from '@/shared/api/endpoints/serviceRequestApi';
import type { IServiceRequest } from '@/entities/serviceRequest';
import {
  REQUEST_STATUS_OPTIONS,
  COUNTERPARTY_TYPE_OPTIONS,
  SMS_STATUS_OPTIONS,
} from '@/entities/serviceRequest';
import { toast } from 'react-toastify';
import { Phone, MapPin, User, FileText, MessageSquare, Factory, ClipboardList } from 'lucide-react';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: IServiceRequest;
}

// ─── Phone formatting ─────────────────────────────────────────
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  let d = digits;
  if (d.startsWith('8') && d.length > 1) d = '7' + d.slice(1);
  if (!d.startsWith('7') && d.length > 0) d = '7' + d;
  let r = '';
  if (d.length >= 1) r = '+' + d[0];
  if (d.length >= 2) r += ' (' + d.slice(1, Math.min(4, d.length));
  if (d.length >= 4) r += ') ';
  if (d.length >= 5) r += d.slice(4, Math.min(7, d.length));
  if (d.length >= 7) r += '-';
  if (d.length >= 8) r += d.slice(7, Math.min(9, d.length));
  if (d.length >= 9) r += '-';
  if (d.length >= 10) r += d.slice(9, Math.min(11, d.length));
  return r;
}
function stripPhone(formatted: string): string {
  return '+' + formatted.replace(/\D/g, '');
}

// ─── Section header ───────────────────────────────────────────
function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <HStack gap="8" align="center" className="pb-1 border-b border-border/50 mb-1">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <Text variant="small" className="font-semibold uppercase tracking-wider text-muted-foreground">{title}</Text>
    </HStack>
  );
}

// ─── Required label ───────────────────────────────────────────
function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs">
      {children} <Text variant="small" className="text-destructive inline">*</Text>
    </Label>
  );
}

/** Responsive field wrapper: 3 → 2 → 1 columns */
const FIELD_CLASS = 'min-w-[200px] flex-1 basis-[calc(33.333%-1rem)]';

type TabKey = 'request' | 'production';

export function ServiceRequestModal({ isOpen, onClose, record }: ServiceRequestModalProps) {
  const { t } = useTranslation();
  const [createReq, { isLoading: isCreating }] = useCreateServiceRequestMutation();
  const [updateReq, { isLoading: isUpdating }] = useUpdateServiceRequestMutation();

  const { data: subjects = [] } = useGetCcSubjectsQuery();
  const { data: districts = [] } = useGetCcDistrictsQuery();

  const isEdit = !!record;
  const isLoading = isCreating || isUpdating;

  // ─── Form state ──────────────────────────────────────────
  const [counterpartyType, setCounterpartyType] = useState<string>('individual');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [accountOrInn, setAccountOrInn] = useState('');
  const [phone, setPhone] = useState('');
  const [territorialZone, setTerritorialZone] = useState('');
  const [locality, setLocality] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [topic, setTopic] = useState('');
  const [comment, setComment] = useState('');
  const [requestStatus, setRequestStatus] = useState<string>('new');
  const [scheduleComment, setScheduleComment] = useState('');
  const [productionComment, setProductionComment] = useState('');
  const [sendSms, setSendSms] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('request');

  // ─── Cascading districts ─────────────────────────────────
  const territorialZones = useMemo(() => [...new Set(districts.map((d) => d.territorial_zone))], [districts]);
  const filteredDistricts = useMemo(() => {
    if (!territorialZone) return [];
    return districts.filter((d) => d.territorial_zone === territorialZone);
  }, [districts, territorialZone]);

  useEffect(() => {
    if (!isOpen) return;
    const belongsToZone = filteredDistricts.some((d) => d.district === district);
    if (!belongsToZone) setDistrict('');
  }, [territorialZone]);

  // ─── Init form ───────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      if (record) {
        setCounterpartyType(record.counterparty_type || 'individual');
        setCounterpartyName(record.counterparty_name || '');
        setAccountOrInn(record.account_or_inn || '');
        setPhone(record.phone ? formatPhoneInput(record.phone) : '');
        setTerritorialZone(record.territorial_zone || '');
        setLocality(record.locality || '');
        setDistrict(record.district || '');
        setAddress(record.address || '');
        setTopic(record.topic || '');
        setComment(record.comment || '');
        setRequestStatus(record.request_status || 'new');
        setScheduleComment(record.schedule_comment || '');
        setProductionComment('');
      } else {
        setCounterpartyType('individual');
        setCounterpartyName('');
        setAccountOrInn('');
        setPhone('');
        setTerritorialZone('');
        setLocality('');
        setDistrict('');
        setAddress('');
        setTopic('');
        setComment('');
        setRequestStatus('new');
        setScheduleComment('');
        setProductionComment('');
      }
      setSendSms(false);
      setActiveTab('request');
    }
  }, [isOpen, record]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') { setPhone(''); return; }
    setPhone(formatPhoneInput(raw));
  };

  // ─── Validation ──────────────────────────────────────────
  const isValid = useMemo(() => {
    return (
      counterpartyName.trim() !== '' &&
      phone.replace(/\D/g, '').length >= 11 &&
      topic !== '' &&
      territorialZone !== '' &&
      district !== '' &&
      address.trim() !== ''
    );
  }, [counterpartyName, phone, topic, territorialZone, district, address]);

  // ─── Save ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isValid) {
      toast.warning('Заполните все обязательные поля');
      setActiveTab('request');
      return;
    }
    try {
      const data: Partial<IServiceRequest> & { send_sms?: boolean } = {
        counterparty_type: counterpartyType as any,
        counterparty_name: counterpartyName,
        account_or_inn: accountOrInn,
        phone: phone ? stripPhone(phone) : '',
        territorial_zone: territorialZone,
        locality,
        district,
        address,
        topic,
        comment,
        request_status: requestStatus as any,
        schedule_comment: scheduleComment,
      };

      if (sendSms && scheduleComment.trim()) {
        data.send_sms = true;
      }

      if (isEdit && record) {
        await updateReq({ id: record.uid, data }).unwrap();
        toast.success(t('common.saved', 'Сохранено'));
      } else {
        await createReq(data).unwrap();
        toast.success(t('common.created', 'Создано'));
      }
      onClose();
    } catch (error: any) {
      toast.error(error.data?.message || t('common.error', 'Ошибка сохранения'));
    }
  };

  // ─── SMS status badge ────────────────────────────────────
  const smsStatusBadge = record ? (() => {
    const val = record.sms_status;
    const opt = SMS_STATUS_OPTIONS.find((o) => o.value === val);
    return (
      <Badge variant={val === 'delivered' ? 'default' : val === 'sent' ? 'secondary' : val === 'failed' ? 'destructive' : 'outline'}>
        {opt ? t(opt.labelKey, opt.fallback) : val}
      </Badge>
    );
  })() : null;

  // ─── Tab definitions ─────────────────────────────────────
  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'request', label: 'Заявка', icon: ClipboardList },
    { key: 'production', label: 'Комментарии производства', icon: Factory },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="large" className="max-h-[90vh] flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <Text>
              {isEdit
                ? `Редактировать заявку ${record?.request_number || ''}`
                : 'Новая заявка'}
            </Text>
          </DialogTitle>
        </DialogHeader>

        {/* ═══ Tabs menu (FSD standard) ═══ */}
        <VStack className="border-b border-border/50 mb-0 shrink-0" max>
          <HStack gap="8" className="-mb-[1px] overflow-x-auto">
            {tabs.map((tab) => (
              <Button
                key={tab.key}
                variant="ghost"
                className={`rounded-none relative px-4 py-2.5 ${activeTab === tab.key ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                <Text variant="small" className="font-medium">{tab.label}</Text>
                {activeTab === tab.key && (
                  <VStack className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary rounded-t-[1px]">{''}</VStack>
                )}
              </Button>
            ))}
          </HStack>
        </VStack>

        {/* ═══ TAB 1: Заявка ═══ */}
        {activeTab === 'request' && (
          <VStack className="flex-1 overflow-y-auto pr-1 pt-4 gap-5">

            {/* Контрагент — 3 per row responsive */}
            <VStack gap="8">
              <SectionHeader icon={User} title="Контрагент" />
              <HStack gap="12" className="flex-wrap">
                <VStack gap="4" className={FIELD_CLASS}>
                  <Label className="text-xs">{t('serviceRequests.counterpartyType', 'Тип контрагента')}</Label>
                  <Select value={counterpartyType} onChange={(e) => setCounterpartyType(e.target.value)}>
                    {COUNTERPARTY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{t(opt.labelKey, opt.fallback)}</option>
                    ))}
                  </Select>
                </VStack>
                <VStack gap="4" className={FIELD_CLASS}>
                  <RequiredLabel>{counterpartyType === 'individual' ? 'ФИО' : 'Наименование'}</RequiredLabel>
                  <Input
                    value={counterpartyName}
                    onChange={(e) => setCounterpartyName(e.target.value)}
                    placeholder={counterpartyType === 'individual' ? 'Иванов Иван Иванович' : 'ООО «Компания»'}
                  />
                </VStack>
                <VStack gap="4" className={FIELD_CLASS}>
                  <Label className="text-xs">{counterpartyType === 'individual' ? 'Лицевой счёт' : 'ИНН'}</Label>
                  <Input value={accountOrInn} onChange={(e) => setAccountOrInn(e.target.value)} />
                </VStack>
              </HStack>
              <HStack gap="12" className="flex-wrap">
                <VStack gap="4" className={FIELD_CLASS}>
                  <RequiredLabel>{t('serviceRequests.phone', 'Телефон')}</RequiredLabel>
                  <HStack className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="+7 (___) ___-__-__"
                      className="pl-9 w-full"
                      maxLength={18}
                    />
                  </HStack>
                </VStack>
                <VStack gap="4" className={FIELD_CLASS}>
                  <RequiredLabel>{t('serviceRequests.topic', 'Тема обращения')}</RequiredLabel>
                  <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
                    <option value="">— Выберите тему —</option>
                    {subjects.map((s) => (
                      <option key={s.uid} value={s.name}>{s.name}</option>
                    ))}
                  </Select>
                </VStack>
              </HStack>
            </VStack>

            {/* Территория — 3 per row responsive */}
            <VStack gap="8">
              <SectionHeader icon={MapPin} title="Территория" />
              <HStack gap="12" className="flex-wrap">
                <VStack gap="4" className={FIELD_CLASS}>
                  <RequiredLabel>{t('serviceRequests.territorialZone', 'Территориальная зона')}</RequiredLabel>
                  <Select value={territorialZone} onChange={(e) => setTerritorialZone(e.target.value)}>
                    <option value="">— Выберите зону —</option>
                    {territorialZones.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </Select>
                </VStack>
                <VStack gap="4" className={FIELD_CLASS}>
                  <RequiredLabel>{t('serviceRequests.district', 'Район')}</RequiredLabel>
                  <Select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!territorialZone}>
                    <option value="">{territorialZone ? '— Выберите район —' : '← Сначала выберите зону'}</option>
                    {filteredDistricts.map((d) => (
                      <option key={d.uid} value={d.district}>{d.district}</option>
                    ))}
                  </Select>
                </VStack>
                <VStack gap="4" className={FIELD_CLASS}>
                  <Label className="text-xs">{t('serviceRequests.locality', 'Населённый пункт')}</Label>
                  <Input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Красноярск" />
                </VStack>
              </HStack>
              <HStack gap="12" className="flex-wrap">
                <VStack gap="4" className="flex-1 min-w-[200px]">
                  <RequiredLabel>{t('serviceRequests.address', 'Адрес')}</RequiredLabel>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ул. Ленина, д. 1, кв. 10" />
                </VStack>
              </HStack>
            </VStack>

            {/* Суть обращения — full width */}
            <VStack gap="8">
              <SectionHeader icon={MessageSquare} title="Суть обращения" />
              <VStack gap="4">
                <Label className="text-xs">{t('serviceRequests.comment', 'Комментарий к заявке')}</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="h-20 resize-none"
                  placeholder="Опишите суть обращения..."
                />
              </VStack>
            </VStack>
          </VStack>
        )}

        {/* ═══ TAB 2: Комментарии производства ═══ */}
        {activeTab === 'production' && (
          <VStack className="flex-1 overflow-y-auto pr-1 pt-4 gap-5">

            {/* Номер заявки + Статус */}
            <HStack gap="12" align="end" className="flex-wrap">
              {isEdit && record?.request_number && (
                <HStack gap="8" align="center" className="bg-muted/30 p-3 rounded-lg border border-border flex-1 min-w-[200px]">
                  <Text variant="small" className="text-muted-foreground">Заявка:</Text>
                  <Text className="font-semibold text-primary">{record.request_number}</Text>
                </HStack>
              )}
              <VStack gap="4" className="min-w-[200px] flex-1">
                <Label className="text-xs">{t('serviceRequests.status.label', 'Статус заявки')}</Label>
                <Select value={requestStatus} onChange={(e) => setRequestStatus(e.target.value)}>
                  {REQUEST_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey, opt.fallback)}</option>
                  ))}
                </Select>
              </VStack>
            </HStack>

            <VStack gap="8">
              <SectionHeader icon={Factory} title="Производство" />
              <VStack gap="4">
                <Label className="text-xs">Комментарий производства</Label>
                <Textarea
                  value={productionComment}
                  onChange={(e) => setProductionComment(e.target.value)}
                  className="h-24 resize-none"
                  placeholder="Заметки для производства..."
                />
              </VStack>
            </VStack>

            <VStack gap="8">
              <SectionHeader icon={MessageSquare} title="Ответ клиенту" />
              <VStack gap="4">
                <Label className="text-xs">Ответ по срокам</Label>
                <Textarea
                  value={scheduleComment}
                  onChange={(e) => setScheduleComment(e.target.value)}
                  className="h-16 resize-none"
                  placeholder="Напр.: вывоз запланирован на 25.04.2026"
                />
              </VStack>
            </VStack>

            {/* СМС блок */}
            <VStack gap="8" className="bg-muted/30 p-4 rounded-lg border border-border">
              <HStack justify="between" align="center">
                <Label className={`flex items-center gap-2 m-0 ${!scheduleComment.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <Checkbox
                    checked={sendSms && !!scheduleComment.trim()}
                    onChange={(e) => setSendSms(e.target.checked)}
                    disabled={!scheduleComment.trim()}
                  />
                  <Text variant="small">Отправить СМС клиенту</Text>
                </Label>
                {isEdit && smsStatusBadge && (
                  <HStack gap="4" align="center">
                    <Text variant="small" className="text-muted-foreground">Статус СМС:</Text>
                    {smsStatusBadge}
                  </HStack>
                )}
              </HStack>

              {sendSms && scheduleComment.trim() && (
                <VStack gap="4" className="p-3 bg-background border border-border rounded-md animate-in fade-in slide-in-from-top-2">
                  <Text variant="small" className="font-semibold text-foreground">Предпросмотр:</Text>
                  <Text variant="small" className="text-muted-foreground italic leading-relaxed">
                    По вашему обращению № {record?.request_number || 'КЦ-...'}, сообщаем: {scheduleComment}
                  </Text>
                  <VStack className="border-t border-border pt-2 mt-1">
                    <Text variant="small" className="text-muted-foreground">
                      Номер: <Text variant="small" className="font-medium text-foreground inline">{phone || '(не указан)'}</Text>
                    </Text>
                  </VStack>
                </VStack>
              )}
            </VStack>
          </VStack>
        )}

        <DialogFooter className="mt-4 shrink-0 pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !isValid}>
            {isLoading ? t('common.saving', 'Сохранение...') : t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
