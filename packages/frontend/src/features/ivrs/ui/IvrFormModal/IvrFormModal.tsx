import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/shared/ui/Dialog';
import { Button, Input, VStack, HStack } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { IIvr, IIvrMenuItem } from '@/entities/ivr';
import { useCreateIvrMutation, useUpdateIvrMutation } from '@/shared/api/endpoints/ivrsApi';
import { IvrMenuItemsEditor } from '../IvrMenuItemsEditor/IvrMenuItemsEditor';
import { IvrPromptsEditor } from '../IvrPromptsEditor/IvrPromptsEditor';

interface IvrFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  ivr: IIvr | null;
}

export function IvrFormModal({ isOpen, onClose, ivr }: IvrFormModalProps) {
  const { t } = useTranslation();
  const [createIvr] = useCreateIvrMutation();
  const [updateIvr] = useUpdateIvrMutation();

  const [activeTab, setActiveTab] = useState('main');
  const [name, setName] = useState('');
  const [exten, setExten] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('10');
  const [maxCount, setMaxCount] = useState<number>(0);
  const [active, setActive] = useState(true);
  const [directDial, setDirectDial] = useState(true);
  
  const [menuItems, setMenuItems] = useState<IIvrMenuItem[]>([]);
  const [prompts, setPrompts] = useState<string[]>([]);

  useEffect(() => {
    if (ivr) {
      setName(ivr.name || '');
      setExten(ivr.exten || '');
      setTimeoutMs(ivr.timeout ? String(ivr.timeout) : '10');
      setMaxCount(ivr.max_count || 0);
      setActive(ivr.active === 1);
      setDirectDial(ivr.direct_dial === 1);
      setMenuItems(ivr.menu_items || []);
      setPrompts(ivr.prompts || []);
    } else {
      setName('');
      setExten('');
      setTimeoutMs('10');
      setMaxCount(0);
      setActive(true);
      setDirectDial(true);
      setMenuItems([]);
      setPrompts([]);
    }
  }, [ivr, isOpen]);

  const onSubmit = async () => {
    if (!name.trim()) return;
    
    const payload = {
      name,
      exten,
      timeout: timeoutMs,
      max_count: Number(maxCount),
      active: active ? 1 : 0,
      direct_dial: directDial ? 1 : 0,
      prompts,
      menu_items: menuItems,
    };

    try {
      if (ivr) {
        await updateIvr({ uid: ivr.uid, data: payload }).unwrap();
      } else {
        await createIvr(payload).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save IVR', err);
    }
  };

  const tabs = [
    { id: 'main', label: t('ivrs.tabs.main', 'Основные') },
    { id: 'sounds_prompts', label: t('ivrs.tabs.sounds_prompts', 'Записи') },
    { id: 'routes', label: t('ivrs.tabs.routes', 'Вложенные маршруты') },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full flex flex-col p-6">
        <DialogHeader className="mb-4 shrink-0">
          <DialogTitle className="text-xl font-bold">
            {ivr ? t('ivrs.modal.edit', 'Редактировать IVR') : t('ivrs.modal.create', 'Создать IVR')}
          </DialogTitle>
        </DialogHeader>

        <HStack gap="4" className="border-b border-border mb-6 shrink-0 overflow-x-auto flex-nowrap pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </HStack>

          <div className="flex-1 overflow-y-auto pr-1">
            {activeTab === 'main' && (
              <VStack gap="16">
                {/* Name — without tooltip per requirement */}
                <VStack gap="4">
                  <label className="text-sm font-medium text-muted-foreground">{t('ivrs.fields.name', 'Системное имя')}</label>
                  <Input placeholder={t('ivrs.placeholders.name', 'Например: Основное меню')} value={name} onChange={e => setName(e.target.value)} />
                </VStack>

                {/* Exten — with tooltip */}
                <VStack gap="4">
                  <HStack align="center" gap="4">
                    <label className="text-sm font-medium text-muted-foreground">{t('ivrs.fields.exten', 'Внутренний номер меню (Exten)')}</label>
                    <InfoTooltip text={t('ivrs.tooltips.exten', 'Внутренний номер, по которому будет доступно голосовое меню. Абоненты, набравшие этот номер, попадут в IVR')} />
                  </HStack>
                  <Input placeholder="5000" value={exten} onChange={e => setExten(e.target.value)} />
                </VStack>

                {/* Timeout — merged from timers tab */}
                <VStack gap="4">
                  <HStack align="center" gap="4">
                    <label className="text-sm font-medium text-muted-foreground">{t('ivrs.fields.timeout', 'Таймаут ожидания ввода (сек)')}</label>
                    <InfoTooltip text={t('ivrs.tooltips.timeout', 'Время ожидания (в секундах) после воспроизведения приветствия, в течение которого система ожидает DTMF-ввода от абонента')} />
                  </HStack>
                  <Input placeholder="10" value={timeoutMs} onChange={e => setTimeoutMs(e.target.value)} />
                </VStack>

                {/* Max Count — merged from timers tab */}
                <VStack gap="4">
                  <HStack align="center" gap="4">
                    <label className="text-sm font-medium text-muted-foreground">{t('ivrs.fields.maxCount', 'Ограничение переходов (0 - без предела)')}</label>
                    <InfoTooltip text={t('ivrs.tooltips.maxCount', 'Максимальное количество ошибочных попыток ввода, после которого вызов будет обработан по маршруту ошибки. 0 — без ограничений')} />
                  </HStack>
                  <Input type="number" placeholder="3" value={maxCount} onChange={e => setMaxCount(parseInt(e.target.value, 10) || 0)} />
                </VStack>

                {/* Active — with tooltip */}
                <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background">
                  <HStack align="center" gap="4">
                    <label className="text-sm font-medium text-muted-foreground select-none cursor-pointer" htmlFor="ivr-active">
                      {t('ivrs.fields.active', 'Активно')}
                    </label>
                    <InfoTooltip text={t('ivrs.tooltips.active', 'Включает/отключает обработку вызовов в данном IVR. Отключённое меню будет пропускать вызовы')} />
                  </HStack>
                  <input 
                    id="ivr-active"
                    type="checkbox" 
                    className="w-4 h-4 accent-primary cursor-pointer"
                    checked={active}
                    onChange={e => setActive(e.target.checked)} 
                  />
                </HStack>

                {/* Direct Dial — with tooltip */}
                <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background">
                  <HStack align="center" gap="4">
                    <label className="text-sm font-medium text-muted-foreground select-none cursor-pointer" htmlFor="ivr-direct-dial">
                      {t('ivrs.fields.directDial', 'Прямой донабор')}
                    </label>
                    <InfoTooltip text={t('ivrs.tooltips.directDial', 'Позволяет абоненту набрать внутренний номер напрямую, не дожидаясь окончания голосового приветствия')} />
                  </HStack>
                  <input 
                    id="ivr-direct-dial"
                    type="checkbox" 
                    className="w-4 h-4 accent-primary cursor-pointer"
                    checked={directDial}
                    onChange={e => setDirectDial(e.target.checked)} 
                  />
                </HStack>
              </VStack>
            )}

            {activeTab === 'sounds_prompts' && (
              <IvrPromptsEditor
                value={prompts}
                onChange={setPrompts}
              />
            )}

            {activeTab === 'routes' && (
              <IvrMenuItemsEditor
                menuItems={menuItems}
                onChange={setMenuItems}
              />
            )}
          </div>

          <DialogFooter className="mt-6 pt-4 border-t border-border shrink-0">
            <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Отмена')}</Button>
            <Button onClick={onSubmit}>{t('common.save', 'Сохранить')}</Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
