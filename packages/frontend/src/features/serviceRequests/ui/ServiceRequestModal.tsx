import { useState, useEffect } from 'react';
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
  Text
} from '@/shared/ui';
import {
  useCreateServiceRequestMutation,
  useUpdateServiceRequestMutation,
} from '@/shared/api/endpoints/serviceRequestApi';
import type { IServiceRequest } from '@/entities/serviceRequest';
import {
  REQUEST_STATUS_OPTIONS,
  COUNTERPARTY_TYPE_OPTIONS,
} from '@/entities/serviceRequest';
import { toast } from 'react-toastify';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: IServiceRequest;
}

export function ServiceRequestModal({ isOpen, onClose, record }: ServiceRequestModalProps) {
  const { t } = useTranslation();
  const [createReq, { isLoading: isCreating }] = useCreateServiceRequestMutation();
  const [updateReq, { isLoading: isUpdating }] = useUpdateServiceRequestMutation();

  const isEdit = !!record;
  const isLoading = isCreating || isUpdating;

  // Форма
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

  // СМС
  const [sendSms, setSendSms] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (record) {
        setCounterpartyType(record.counterparty_type || 'individual');
        setCounterpartyName(record.counterparty_name || '');
        setAccountOrInn(record.account_or_inn || '');
        setPhone(record.phone || '');
        setTerritorialZone(record.territorial_zone || '');
        setLocality(record.locality || '');
        setDistrict(record.district || '');
        setAddress(record.address || '');
        setTopic(record.topic || '');
        setComment(record.comment || '');
        setRequestStatus(record.request_status || 'new');
        setScheduleComment(record.schedule_comment || '');
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
      }
      setSendSms(false);
    }
  }, [isOpen, record]);

  const handleSave = async () => {
    try {
      const data: Partial<IServiceRequest> & { send_sms?: boolean } = {
        counterparty_type: counterpartyType as any,
        counterparty_name: counterpartyName,
        account_or_inn: accountOrInn,
        phone,
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="large" className="max-h-[90vh] flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('serviceRequests.editTitle', 'Редактировать заявку') : t('serviceRequests.createTitle', 'Новая заявка')}
            {isEdit && ` #${record?.request_number || ''}`}
          </DialogTitle>
        </DialogHeader>

        <VStack className="flex-1 overflow-y-auto pr-2" gap="16">
          <HStack gap="16">
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.counterpartyType', 'Тип контрагента')}</Label>
              <Select value={counterpartyType} onChange={(e) => setCounterpartyType(e.target.value)}>
                {COUNTERPARTY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey, opt.fallback)}
                  </option>
                ))}
              </Select>
            </VStack>
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.status.label', 'Статус заявки')}</Label>
              <Select value={requestStatus} onChange={(e) => setRequestStatus(e.target.value)}>
                {REQUEST_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey, opt.fallback)}
                  </option>
                ))}
              </Select>
            </VStack>
          </HStack>

          <HStack gap="16">
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.counterpartyName', 'ФИО / Наименование')}</Label>
              <Input
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                placeholder={t('serviceRequests.counterpartyNamePlaceholder', 'Введите ФИО или наименование')}
              />
            </VStack>
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.accountOrInn', 'Л/С или ИНН')}</Label>
              <Input
                value={accountOrInn}
                onChange={(e) => setAccountOrInn(e.target.value)}
              />
            </VStack>
          </HStack>

          <HStack gap="16">
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.phone', 'Телефон')}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7XXXXXXXXXX"
              />
            </VStack>
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.topic', 'Тема обращения')}</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </VStack>
          </HStack>

          <HStack gap="16">
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.territorialZone', 'Территориальная зона')}</Label>
              <Input
                value={territorialZone}
                onChange={(e) => setTerritorialZone(e.target.value)}
              />
            </VStack>
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.district', 'Район')}</Label>
              <Input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </VStack>
          </HStack>

          <HStack gap="16">
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.locality', 'Населенный пункт')}</Label>
              <Input
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
              />
            </VStack>
            <VStack gap="8" className="flex-1">
              <Label>{t('serviceRequests.address', 'Полный адрес')}</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </VStack>
          </HStack>

          <VStack gap="8">
            <Label>{t('serviceRequests.comment', 'Комментарий к заявке')}</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="h-24"
            />
          </VStack>

          <VStack gap="8">
            <Label>{t('serviceRequests.scheduleComment', 'Ответ по срокам (комментарий)')}</Label>
            <Textarea
              value={scheduleComment}
              onChange={(e) => setScheduleComment(e.target.value)}
              className="h-16"
            />
          </VStack>

          <VStack gap="12" className="bg-muted/30 p-4 rounded-md border border-border">
            <HStack className="items-center justify-between">
              <Label className={`flex items-center gap-2 m-0 ${!scheduleComment.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <Checkbox
                  checked={sendSms && !!scheduleComment.trim()}
                  onChange={(e) => setSendSms(e.target.checked)}
                  disabled={!scheduleComment.trim()}
                />
                {t('serviceRequests.sendSmsToggle', 'Отправить СМС-сообщение клиенту')}
              </Label>
            </HStack>

            {!scheduleComment.trim() && (
              <Text variant="small" className="text-muted-foreground mt-2">
                СМС можно отправить только если заполнено поле "Ответ по срокам"
              </Text>
            )}

            {sendSms && scheduleComment.trim() && (
              <VStack gap="8" className="mt-2 animate-in fade-in slide-in-from-top-2 p-3 bg-background border border-border rounded-md">
                <Text variant="small" className="font-semibold">
                  Текст сообщения:
                </Text>
                <Text variant="small" className="text-muted-foreground italic">
                  По вашему обращению № {record?.request_number || 'КЦ-...'}, сообщаем: {scheduleComment}
                </Text>
                <Text variant="small" className="text-muted-foreground mt-2 border-t border-border pt-2">
                  {t('serviceRequests.smsPhoneHint', 'Будет отправлено на номер')}: <span className="font-medium text-foreground">{phone || t('serviceRequests.smsNoPhone', '(не указан)')}</span>
                </Text>
              </VStack>
            )}
          </VStack>
        </VStack>

        <DialogFooter className="mt-4 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? t('common.saving', 'Сохранение...') : t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
