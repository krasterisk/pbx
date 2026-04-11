import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useCreateUserMutation, useUpdateUserMutation, useGetNumbersQuery, useGetRolesQuery } from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { selectIsModalOpen, selectSelectedUser } from '../../model/selectors/usersPageSelectors';
import { usersPageActions } from '../../model/slice/usersPageSlice';
import { LEVEL_OPTIONS } from '@/entities/User';
import type { IUser } from '@/entities/User';

export const UserFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isOpen = useAppSelector(selectIsModalOpen);
  const selectedUser = useAppSelector(selectSelectedUser);
  const isEditing = !!selectedUser;

  const onClose = () => dispatch(usersPageActions.closeModal());

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const { data: numbersList = [] } = useGetNumbersQuery();
  const { data: roles = [] } = useGetRolesQuery();

  const isLoading = isCreating || isUpdating;

  const [activeTab, setActiveTab] = useState<'general' | 'callcenter'>('general');

  const [formData, setFormData] = useState({
    login: '',
    name: '',
    passwd: '',
    email: '',
    exten: '',
    level: 2,
    role: '',
    permit_extens: '',
    numbers_id: '',
    inactive_time: 0,
    outbound_posttime: 0,
    suspension_time: 0,
    listbook_edit: 0,
    oper_chanspy: 0,
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
      if (selectedUser) {
        setFormData({
          login: selectedUser.login || '',
          name: selectedUser.name || '',
          passwd: '',
          email: selectedUser.email || '',
          exten: selectedUser.exten || '',
          level: selectedUser.level || 2,
          role: String(selectedUser.role || ''),
          permit_extens: selectedUser.permit_extens || '',
          numbers_id: String(selectedUser.numbers_id || ''),
          inactive_time: selectedUser.inactive_time || 0,
          outbound_posttime: selectedUser.outbound_posttime || 0,
          suspension_time: selectedUser.suspension_time || 0,
          listbook_edit: selectedUser.listbook_edit || 0,
          oper_chanspy: selectedUser.oper_chanspy || 0,
        });
      } else {
        setFormData({
          login: '',
          name: '',
          passwd: '',
          email: '',
          exten: '',
          level: 2,
          role: '',
          permit_extens: '',
          numbers_id: '',
          inactive_time: 0,
          outbound_posttime: 0,
          suspension_time: 0,
          listbook_edit: 0,
          oper_chanspy: 0,
        });
      }
    }
  }, [isOpen, selectedUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...formData };
      
      if (!payload.passwd) {
        delete payload.passwd;
      }
      
      const finalPayload = {
        ...payload,
        password: payload.passwd,
        role: payload.role ? Number(payload.role) : undefined,
        level: Number(payload.level),
        numbers_id: payload.numbers_id ? Number(payload.numbers_id) : undefined,
        inactive_time: Number(payload.inactive_time) || 0,
        outbound_posttime: Number(payload.outbound_posttime) || 0,
        suspension_time: Number(payload.suspension_time) || 0,
      };

      if (isEditing) {
        await updateUser({ id: selectedUser!.uniqueid, data: finalPayload }).unwrap();
      } else {
        await createUser(finalPayload).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save user:', err);
    }
  };

  const levelOptions = LEVEL_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.i18nKey),
  }));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('users.edit') : t('users.add')}
          </DialogTitle>
        </DialogHeader>

        <HStack className="border-b border-border mt-2" gap="0">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('general')}
          >
            {t('users.tabGeneral')}
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'callcenter'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('callcenter')}
          >
            {t('users.tabCallCenter')}
          </button>
        </HStack>

        <form onSubmit={handleSubmit} className="py-2" autoComplete="off">
          {activeTab === 'general' && (
            <VStack gap="16" max>
              <VStack gap="8" max>
                <label className="text-sm font-medium text-muted-foreground">{t('auth.loginPlaceholder')} *</label>
                <Input
                  required
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  autoComplete="off"
                  data-lpignore="true"
                />
              </VStack>
              
              <VStack gap="8" max>
                <label className="text-sm font-medium text-muted-foreground">{t('auth.passwordPlaceholder')} {isEditing ? t('users.passwordUnchanged') : '*'}</label>
                <HStack gap="8" max>
                  <Input
                    required={!isEditing}
                    type="password"
                    className="flex-1"
                    value={formData.passwd}
                    onChange={(e) => setFormData({ ...formData, passwd: e.target.value })}
                    autoComplete="new-password"
                    data-lpignore="true"
                  />
                  {!isEditing && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setFormData({ ...formData, passwd: Math.random().toString(36).slice(-8) })}
                      title={t('users.generatePassword')}
                    >
                      {t('users.generateShort')}
                    </Button>
                  )}
                </HStack>
              </VStack>

              <VStack gap="8" max>
                <label className="text-sm font-medium text-muted-foreground">{t('peers.name')} *</label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </VStack>

              <HStack gap="16" max className="grid grid-cols-1 sm:flex">
                <VStack gap="8" className="flex-1" max>
                  <label className="text-sm font-medium text-muted-foreground">{t('peers.exten')}</label>
                  <Input
                    value={formData.exten}
                    onChange={(e) => setFormData({ ...formData, exten: e.target.value })}
                  />
                </VStack>
                <VStack gap="8" className="flex-1" max>
                  <label className="text-sm font-medium text-muted-foreground">E-mail</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </VStack>
              </HStack>

              <HStack gap="16" max className="grid grid-cols-1 sm:flex">
                <VStack gap="8" className="flex-1" max>
                  <label className="text-sm font-medium text-muted-foreground">{t('users.level')}</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                  >
                    {levelOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </VStack>

                <VStack gap="8" className="flex-1" max>
                  <label className="text-sm font-medium text-muted-foreground">{t('users.role')}</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="" className="bg-background text-foreground">{t('users.roleNone')}</option>
                    {roles.map((r: any) => (
                      <option key={r.id} value={r.id} className="bg-background text-foreground">
                        {r.name}
                      </option>
                    ))}
                  </select>
                </VStack>
              </HStack>
            </VStack>
          )}

          {activeTab === 'callcenter' && (
            <VStack gap="16" max>
              <VStack gap="8" max>
                <label className="text-sm font-medium text-muted-foreground" title={t('users.permitExtensHint')}>
                  {t('users.permitExtens')}
                </label>
                <Input
                  value={formData.permit_extens}
                  onChange={(e) => setFormData({ ...formData, permit_extens: e.target.value })}
                  placeholder={t('users.permitExtensPlaceholder')}
                />
              </VStack>

              <VStack gap="8" max>
                <label className="text-sm font-medium text-muted-foreground" title={t('users.numbersIdHint')}>
                  {t('users.numbersId')}
                </label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.numbers_id}
                  onChange={(e) => setFormData({ ...formData, numbers_id: e.target.value })}
                >
                  <option value="" className="bg-background text-foreground">{t('users.numbersIdNone')}</option>
                  {numbersList.map((n: any) => (
                    <option key={n.id} value={n.id} className="bg-background text-foreground">
                      {n.name}
                    </option>
                  ))}
                </select>
              </VStack>

              <HStack gap="16" max className="grid grid-cols-1 sm:flex">
                <VStack gap="8" className="flex-1" max>
                  <label className="text-sm font-medium text-muted-foreground" title={t('users.inactiveTimeHint')}>
                    {t('users.inactiveTime')}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.inactive_time}
                    onChange={(e) => setFormData({ ...formData, inactive_time: Number(e.target.value) })}
                  />
                </VStack>
                <VStack gap="8" className="flex-1" max>
                  <label className="text-sm font-medium text-muted-foreground" title={t('users.outboundPosttimeHint')}>
                    {t('users.outboundPosttime')}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.outbound_posttime}
                    onChange={(e) => setFormData({ ...formData, outbound_posttime: Number(e.target.value) })}
                  />
                </VStack>
              </HStack>

              <VStack gap="8" max>
                <label className="text-sm font-medium text-muted-foreground" title={t('users.suspensionTimeHint')}>
                  {t('users.suspensionTime')}
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.suspension_time}
                  onChange={(e) => setFormData({ ...formData, suspension_time: Number(e.target.value) })}
                />
              </VStack>

              <VStack gap="12" max className="pt-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-600 bg-background/50 text-primary focus:ring-primary focus:ring-offset-background"
                    checked={formData.listbook_edit === 1}
                    onChange={(e) => setFormData({ ...formData, listbook_edit: e.target.checked ? 1 : 0 })}
                  />
                  <span>{t('users.listbookEdit')}</span>
                </label>
                
                <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-600 bg-background/50 text-primary focus:ring-primary focus:ring-offset-background"
                    checked={formData.oper_chanspy === 1}
                    onChange={(e) => setFormData({ ...formData, oper_chanspy: e.target.checked ? 1 : 0 })}
                  />
                  <span>{t('users.operChanspy')}</span>
                </label>
              </VStack>
            </VStack>
          )}

          <DialogFooter className="mt-6">
            <HStack gap="8" justify="end" max>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </HStack>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
