import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { getIvrPromptsValidationIssues, normalizeIvrPrompts, type IIvrPhrase } from '@krasterisk/shared';
import { IIvr, IIvrMenuItem } from '@/entities/ivr';
import { toast } from 'react-toastify';
import { useCreateIvrMutation, useUpdateIvrMutation } from '@/shared/api/endpoints/ivrsApi';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { getPhraseValidationMessage } from '../../lib/ivrPromptsValidation';
import { IvrMenuItemsEditor } from '../IvrMenuItemsEditor/IvrMenuItemsEditor';
import { IvrPromptsEditor } from '../IvrPromptsEditor/IvrPromptsEditor';
import { IvrMainTab } from '../IvrMainTab';
import cls from './IvrFormModal.module.scss';

interface IvrFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  ivr: IIvr | null;
  mode?: 'create' | 'edit' | 'copy';
}

export function IvrFormModal({ isOpen, onClose, ivr, mode = ivr ? 'edit' : 'create' }: IvrFormModalProps) {
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
  const [prompts, setPrompts] = useState<IIvrPhrase[]>([]);
  const [invalidPhraseIndexes, setInvalidPhraseIndexes] = useState<number[]>([]);
  const { data: ttsEngines = [] } = useGetTtsEnginesQuery();

  const phraseValidationIssues = useMemo(
    () => getIvrPromptsValidationIssues(prompts, {
      engines: ttsEngines.map((e) => ({
        uid: e.uid,
        type: e.type,
        settings: e.settings,
      })),
    }),
    [prompts, ttsEngines],
  );

  const canSave = Boolean(name.trim()) && phraseValidationIssues.length === 0;

  useEffect(() => {
    if ((mode === 'edit' || mode === 'copy') && ivr) {
      setName(mode === 'copy' ? '' : (ivr.name || ''));
      setExten(mode === 'copy' ? '' : (ivr.exten || ''));
      setTimeoutMs(ivr.timeout ? String(ivr.timeout) : '10');
      setMaxCount(ivr.max_count || 0);
      setActive(ivr.active === 1);
      setDirectDial(ivr.direct_dial === 1);
      setMenuItems(ivr.menu_items || []);
      setPrompts(normalizeIvrPrompts(ivr.prompts || []));
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
  }, [ivr, isOpen, mode]);

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.warning(t('ivrs.validation.nameRequired', 'Укажите название IVR'));
      setActiveTab('main');
      return;
    }

    if (phraseValidationIssues.length > 0) {
      setInvalidPhraseIndexes(phraseValidationIssues.map((i) => i.index));
      toast.error(getPhraseValidationMessage(phraseValidationIssues[0], t));
      setActiveTab('sounds_prompts');
      return;
    }

    setInvalidPhraseIndexes([]);

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

    const isCreateMode = mode === 'create' || mode === 'copy';

    try {
      if (!isCreateMode && ivr) {
        await updateIvr({ uid: ivr.uid, data: payload }).unwrap();
      } else {
        await createIvr(payload).unwrap();
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || t('common.error', 'Ошибка сохранения'));
    }
  };

  const tabs = [
    { id: 'main', label: t('ivrs.tabs.main', 'Основные') },
    { id: 'sounds_prompts', label: t('ivrs.tabs.sounds_prompts', 'Фразы') },
    { id: 'routes', label: t('ivrs.tabs.routes', 'Пункты') },
  ];

  const title =
    mode === 'edit'
      ? t('ivrs.modal.edit', 'Редактировать IVR')
      : mode === 'copy'
        ? t('ivrs.modal.copy', 'Копировать IVR')
        : t('ivrs.modal.create', 'Создать IVR');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className={cls.tabsWrap}>
          <div className={cls.tabsRow} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={[cls.tab, activeTab === tab.id && cls.tabActive].filter(Boolean).join(' ')}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <VStack max className={cls.body}>
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
              key={ivr?.uid ?? `new-${mode}`}
              value={prompts}
              onChange={(next) => {
                setPrompts(next);
                setInvalidPhraseIndexes([]);
              }}
              invalidPhraseIndexes={invalidPhraseIndexes}
            />
          )}

          {activeTab === 'routes' && (
            <IvrMenuItemsEditor menuItems={menuItems} onChange={setMenuItems} />
          )}
        </VStack>

        <DialogFooter className={cls.footer}>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button onClick={onSubmit} disabled={!canSave}>
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
