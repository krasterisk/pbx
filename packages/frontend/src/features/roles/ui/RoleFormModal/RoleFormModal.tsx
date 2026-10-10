import { toast } from 'react-toastify';
import { ModalBody, Flex, ModalSection } from '@/shared/ui';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  Dialog,
  FormDialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Text,
  Checkbox,
  InfoTooltip,
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
import styles from './RoleFormModal.module.scss';

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
  const [grantsOpen, setGrantsOpen] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setGrantsOpen(true);
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
      toast.error(t("modal.errors.save"));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <FormDialogContent
        className={styles.dialogContent}
       aria-describedby={undefined}>
        <DialogHeader className={`shrink-0 ${styles.header}`}>
          <DialogTitle>
            {isEditing ? t('roles.edit') : t('roles.add')}
          </DialogTitle>
        </DialogHeader>

        <Flex as="form" direction="column" align="stretch" onSubmit={handleSubmit} className={styles.form} autoComplete="off">
          <ModalBody className={styles.formBody}>
<ModalSection>
            <VStack align="stretch" gap="16" max>
              <VStack align="stretch" gap="8" max className={styles.field}>
                <Label htmlFor="role-name" className={styles.fieldLabel}>
                  {t('roles.name')} *
                </Label>
                <Input
                  id="role-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </VStack>

              <VStack align="stretch" gap="8" max className={styles.field}>
                <Label htmlFor="role-comment" className={styles.fieldLabel}>
                  {t('roles.comment')}
                </Label>
                <Input
                  id="role-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </VStack>

              <VStack align="stretch"
                gap={grantsOpen ? '12' : '0'}
                max
                className={styles.grantsGroup}
              >
                <HStack gap="8" align="center" max className={styles.grantsTitleRow}>
                  <button
                    type="button"
                    className={styles.grantsToggle}
                    aria-expanded={grantsOpen}
                    aria-controls="role-grants-editor"
                    onClick={() => setGrantsOpen((open) => !open)}
                  >
                    <HStack gap="8" align="center" max className={styles.grantsToggleInner}>
                      <Text className={styles.grantsTitle}>{t('roles.grantsTitle')}</Text>
                      <ChevronDown
                        className={`${styles.grantsChevron}${grantsOpen ? ` ${styles.grantsChevronOpen}` : ''}`}
                        aria-hidden
                      />
                    </HStack>
                  </button>
                  <InfoTooltip text={t('roles.grantsHint')} />
                </HStack>

                {grantsOpen && (
                  <VStack align="stretch" gap="12" max id="role-grants-editor" data-testid="role-grants-editor">
                    {BASELINE_MODULES.map((mod) => {
                      const pageIds = mod.pages.map((p) => p.id);
                      const allChecked =
                        pageIds.length > 0 &&
                        pageIds.every((id) => isPageGranted(grants, mod.code, id));
                      return (
                        <VStack align="stretch" key={mod.code} gap="8" max className={styles.moduleBlock} data-module={mod.code}>
                          <HStack
                            justify="between"
                            align="center"
                            className={styles.moduleHeader}
                            max
                          >
                            <Text className={styles.moduleName}>
                              {t(mod.labelKey)}
                            </Text>
                            <Label className={styles.pageRow}>
                              <Checkbox
                                className={styles.checkbox}
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
                              <Text>{t('roles.selectAll')}</Text>
                            </Label>
                          </HStack>
                          <div className={styles.pageGrid}>
                            {mod.pages.map((page) => (
                              <Label key={page.id} className={styles.pageRow}>
                                <Checkbox
                                  className={styles.checkbox}
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
                                <Text>{t(page.labelKey)}</Text>
                              </Label>
                            ))}
                          </div>
                        </VStack>
                      );
                    })}
                  </VStack>
                )}
              </VStack>
            </VStack>
          </ModalSection>
</ModalBody>

          <DialogFooter className={styles.footer}>
            <HStack gap="8" justify="end" max>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading || !name.trim()}>
                {isLoading && <Loader2 className={styles.iconSpin} />}
                {t('common.save')}
              </Button>
            </HStack>
          </DialogFooter>
        </Flex>
      </FormDialogContent>
    </Dialog>
  );
};
