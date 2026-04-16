import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/shared/ui/Dialog';
import { Button, VStack, HStack } from '@/shared/ui';
import { IIvr, IIvrMenuItem } from '@/entities/ivr';
import { useCreateIvrMutation, useUpdateIvrMutation } from '@/shared/api/endpoints/ivrsApi';
import { IvrMenuItemsEditor } from '../IvrMenuItemsEditor/IvrMenuItemsEditor';
import { IvrPromptsEditor } from '../IvrPromptsEditor/IvrPromptsEditor';
import { IvrMainTab } from '../IvrMainTab';

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
      <DialogContent size="large">
        <DialogHeader className="mb-4 shrink-0">
          <DialogTitle className="text-xl font-bold">
            {ivr ? t('ivrs.modal.edit', 'Редактировать IVR') : t('ivrs.modal.create', 'Создать IVR')}
          </DialogTitle>
        </DialogHeader>

        <HStack gap="4" className="border-b border-border mb-6 shrink-0 overflow-x-auto flex-nowrap pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {tabs.map(tab => (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 rounded-none text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${activeTab === tab.id
                  ? 'border-primary text-primary bg-transparent hover:bg-transparent hover:text-primary'
                  : 'border-transparent text-muted-foreground bg-transparent hover:text-foreground hover:border-border hover:bg-transparent'
                }`}
            >
              {tab.label}
            </Button>
          ))}
        </HStack>

        <VStack className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'main' && (
            <IvrMainTab
              name={name}
              onNameChange={setName}
              exten={exten}
              onExtenChange={setExten}
              timeoutMs={timeoutMs}
              onTimeoutMsChange={setTimeoutMs}
              maxCount={maxCount}
              onMaxCountChange={setMaxCount}
              active={active}
              onActiveChange={setActive}
              directDial={directDial}
              onDirectDialChange={setDirectDial}
            />
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
        </VStack>

        <DialogFooter className="mt-6 pt-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Отмена')}</Button>
          <Button onClick={onSubmit}>{t('common.save', 'Сохранить')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
