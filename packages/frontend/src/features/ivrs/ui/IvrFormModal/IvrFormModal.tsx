import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Button, Input, Form, FormField, FormItem, FormLabel, FormControl, VStack, HStack, Switch
} from '@/shared/ui';
import { useForm } from 'react-hook-form';
import { IIvr, IIvrMenuItem } from '@/entities/ivr';
import { useCreateIvrMutation, useUpdateIvrMutation } from '@/shared/api/endpoints/ivrsApi';
import { IvrMenuItemsEditor } from '../IvrMenuItemsEditor/IvrMenuItemsEditor';

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
  const [menuItems, setMenuItems] = useState<IIvrMenuItem[]>([]);
  const [prompts, setPrompts] = useState<string>('');

  const form = useForm({
    defaultValues: {
      name: '',
      exten: '',
      timeout: '10',
      max_count: 0,
      active: true,
      direct_dial: true,
    },
  });

  useEffect(() => {
    if (ivr) {
      form.reset({
        name: ivr.name,
        exten: ivr.exten,
        timeout: ivr.timeout || '',
        max_count: ivr.max_count || 0,
        active: ivr.active === 1,
        direct_dial: ivr.direct_dial === 1,
      });
      setMenuItems(ivr.menu_items || []);
      setPrompts(ivr.prompts ? ivr.prompts.join('\n') : '');
    } else {
      form.reset();
      setMenuItems([]);
      setPrompts('');
    }
  }, [ivr, form]);

  const onSubmit = async (values: any) => {
    const payload = {
      name: values.name,
      exten: values.exten,
      timeout: values.timeout,
      max_count: Number(values.max_count),
      active: values.active ? 1 : 0,
      direct_dial: values.direct_dial ? 1 : 0,
      prompts: prompts.split('\n').map(p => p.trim()).filter(Boolean),
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#09090b] border-[#27272a] text-slate-200">
        <DialogHeader>
          <DialogTitle>{ivr ? t('ivrs.modal.edit', 'Редактировать IVR') : t('ivrs.modal.create', 'Создать IVR')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-[#18181b] p-1 border border-[#27272a] mb-4">
                <TabsTrigger value="main">{t('ivrs.tabs.main', 'Основные')}</TabsTrigger>
                <TabsTrigger value="timers">{t('ivrs.tabs.timers', 'Таймауты')}</TabsTrigger>
                <TabsTrigger value="prompts">{t('ivrs.tabs.prompts', 'Звуки')}</TabsTrigger>
                <TabsTrigger value="routes" className="data-[state=active]:bg-indigo-600">
                  {t('ivrs.tabs.routes', 'Вложенные маршруты')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ivrs.fields.name', 'Системное имя')}</FormLabel>
                      <FormControl>
                        <Input placeholder="Например: Основное меню" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="exten"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ivrs.fields.exten', 'Внутренний номер меню (Exten)')}</FormLabel>
                      <FormControl>
                        <Input placeholder="5000" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between border border-[#27272a] p-3 rounded">
                      <FormLabel className="mb-0">{t('ivrs.fields.active', 'Активно')}</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="direct_dial"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between border border-[#27272a] p-3 rounded">
                      <FormLabel className="mb-0">{t('ivrs.fields.directDial', 'Прямой донабор')}</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="timers" className="space-y-4">
                <FormField
                  control={form.control}
                  name="timeout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ivrs.fields.timeout', 'Таймаут ожидания ввода (сек)')}</FormLabel>
                      <FormControl>
                        <Input placeholder="10" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ivrs.fields.maxCount', 'Предел ошибочных переходов (0 - без предела)')}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="3" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="prompts" className="space-y-4">
                <FormItem>
                  <FormLabel>{t('ivrs.fields.promptsList', 'Файлы звуков или TTS (каждый с новой строки)')}</FormLabel>
                  <FormControl>
                    <textarea 
                      className="flex w-full rounded-md border border-[#27272a] bg-[#09090b] px-3 py-2 text-sm text-slate-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 min-h-[150px]"
                      placeholder="hello.wav\ntts:Добро пожаловать в компанию"
                      value={prompts}
                      onChange={(e) => setPrompts(e.target.value)}
                    />
                  </FormControl>
                </FormItem>
              </TabsContent>

              <TabsContent value="routes" className="space-y-4">
                <IvrMenuItemsEditor
                  menuItems={menuItems}
                  onChange={setMenuItems}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#27272a]">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel', 'Отмена')}
              </Button>
              <Button type="submit">
                {t('common.save', 'Сохранить')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
