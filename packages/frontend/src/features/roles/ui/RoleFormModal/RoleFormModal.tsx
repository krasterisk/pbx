import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Text,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useCreateRoleMutation, useUpdateRoleMutation } from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  getRolesPageIsModalOpen,
  getRolesPageSelectedRole,
  getRolesPageModalMode,
} from '../../model/selectors/rolesPageSelectors';
import { rolesPageActions } from '../../model/slice/rolesPageSlice';
import { BASELINE_MODULES } from '@/features/modules/lib/moduleRegistry';
import {
  parseRoleGrants,
  serializeRoleGrants,
  togglePageGrant,
  toggleModuleGrant,
  isPageGranted,
  type HubRoleGrants,
} from '../../lib/roleGrants';
import cls from './RoleFormModal.module.scss';

export const RoleFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isOpen = useAppSelector(getRolesPageIsModalOpen);
  const selectedRole = useAppSelector(getRolesPageSelectedRole);
  const modalMode = useAppSelector(getRolesPageModalMode);
  const isEditing = modalMode === 'edit' && !!selectedRole;

  const onClose = () => dispatch(rolesPageActions.closeModal());

  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
  const isLoading = isCreating || isUpdating;

  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [grants, setGrants] = useState<HubRoleGrants>({});

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && selectedRole) {
      setName(selectedRole.name || '');
      setComment(selectedRole.comment || '');
      setGrants(parseRoleGrants(selectedRole.role));
    } else {
      setName('');
      setComment('');
      setGrants({});
    }
  }, [isOpen, isEditing, selectedRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      comment: comment.trim() || undefined,
      role: serializeRoleGrants(grants),
    };
    try {
      if (isEditing && selectedRole) {
        await updateRole({ id: selectedRole.id, data: payload }).unwrap();
      } else {
        await createRole(payload).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save role:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('roles.edit') : t('roles.add')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="py-2" autoComplete="off">
          <VStack gap="16" max>
            <VStack gap="8" max>
              <label className="text-sm font-medium text-muted-foreground" htmlFor="role-name">
                {t('roles.name')} *
              </label>
              <Input
                id="role-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </VStack>

            <VStack gap="8" max>
              <label className="text-sm font-medium text-muted-foreground" htmlFor="role-comment">
                {t('roles.comment')}
              </label>
              <Input
                id="role-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </VStack>

            <VStack gap="8" max>
              <Text as="h3" className="text-sm font-medium">
                {t('roles.grantsTitle')}
              </Text>
              <Text variant="muted" className="text-xs">
                {t('roles.grantsHint')}
              </Text>
              <div className={cls.grantsScroll} data-testid="role-grants-editor">
                <VStack gap="12" max>
                  {BASELINE_MODULES.map((mod) => {
                    const pageIds = mod.pages.map((p) => p.id);
                    const allChecked =
                      pageIds.length > 0 &&
                      pageIds.every((id) => isPageGranted(grants, mod.code, id));
                    return (
                      <div key={mod.code} className={cls.moduleBlock} data-module={mod.code}>
                        <HStack
                          justify="between"
                          align="center"
                          className={cls.moduleHeader}
                          max
                        >
                          <Text className="font-medium text-sm">
                            {t(mod.labelKey)} ({mod.code})
                          </Text>
                          <label className={cls.pageRow}>
                            <input
                              type="checkbox"
                              className={cls.checkbox}
                              checked={allChecked}
                              onChange={(e) =>
                                setGrants(
                                  toggleModuleGrant(
                                    grants,
                                    mod.code,
                                    pageIds,
                                    e.target.checked,
                                  ),
                                )
                              }
                              aria-label={t('roles.selectModule', { module: t(mod.labelKey) })}
                            />
                            <span>{t('roles.selectAll')}</span>
                          </label>
                        </HStack>
                        <div className={cls.pageGrid}>
                          {mod.pages.map((page) => (
                            <label key={page.id} className={cls.pageRow}>
                              <input
                                type="checkbox"
                                className={cls.checkbox}
                                checked={isPageGranted(grants, mod.code, page.id)}
                                onChange={(e) =>
                                  setGrants(
                                    togglePageGrant(
                                      grants,
                                      mod.code,
                                      page.id,
                                      e.target.checked,
                                    ),
                                  )
                                }
                              />
                              <span>{t(page.labelKey)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </VStack>
              </div>
            </VStack>
          </VStack>

          <DialogFooter className="mt-6">
            <HStack gap="8" justify="end" max>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading || !name.trim()}>
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
