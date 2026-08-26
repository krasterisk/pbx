import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Stars, Loader2, Upload, Trash2, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  PasswordInput,
  Label,
  Select,
  Text,
  Avatar,
  InfoTooltip,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useCreateUserMutation,
  useUpdateUserMutation,
  useGetNumbersQuery,
  useGetRolesQuery,
  useUploadUserAvatarMutation,
  useDeleteUserAvatarMutation,
} from '@/shared/api/api';
import type { ICreateUser, IUpdateUser } from '@krasterisk/shared';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { selectIsModalOpen, selectSelectedUser } from '../../model/selectors/usersPageSelectors';
import { usersPageActions } from '../../model/slice/usersPageSlice';
import {
  LEVEL_OPTIONS,
  PLATFORM_LEVEL_OPTIONS,
  selectIsSuperAdmin,
  UserLevel,
} from '@/entities/User';
import { patchAuthUser } from '@/features/auth/model/authSlice';
import { buildUserAvatarUrl } from '@/shared/lib/userAvatarUrl';
import styles from './UserFormModal.module.scss';

function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Optional email: empty OK; otherwise local@domain.tld */
function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const UserFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const fileRef = useRef<HTMLInputElement>(null);

  const isOpen = useAppSelector(selectIsModalOpen);
  const selectedUser = useAppSelector(selectSelectedUser);
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const authUserId = useAppSelector((s) => s.auth.user?.uniqueid);
  const isEditing = !!selectedUser;

  const onClose = () => dispatch(usersPageActions.closeModal());

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [uploadAvatar, { isLoading: isUploadingAvatar }] = useUploadUserAvatarMutation();
  const [deleteAvatar, { isLoading: isDeletingAvatar }] = useDeleteUserAvatarMutation();
  const { data: numbersList = [] } = useGetNumbersQuery();
  const { data: roles = [] } = useGetRolesQuery();

  const isLoading = isCreating || isUpdating;

  const [formData, setFormData] = useState({
    login: '',
    name: '',
    passwd: '',
    email: '',
    level: 2,
    role: '',
    numbers_id: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [avatarFilename, setAvatarFilename] = useState<string | null>(null);
  const [accessExtrasOpen, setAccessExtrasOpen] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setShowPassword(false);
    setEmailError('');
    if (selectedUser) {
      const role = String(selectedUser.role || '');
      const numbersId = String(selectedUser.numbers_id || '');
      setFormData({
        login: selectedUser.login || '',
        name: selectedUser.name || '',
        passwd: '',
        email: selectedUser.email || '',
        level: selectedUser.level || 2,
        role,
        numbers_id: numbersId,
      });
      setAvatarFilename(selectedUser.avatar ?? null);
      setAccessExtrasOpen(Boolean(role || numbersId));
    } else {
      setFormData({
        login: '',
        name: '',
        passwd: '',
        email: '',
        level: 2,
        role: '',
        numbers_id: '',
      });
      setAvatarFilename(null);
      setAccessExtrasOpen(false);
    }
  }, [isOpen, selectedUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = formData.email.trim();
    if (!isValidEmail(email)) {
      setEmailError(t('users.emailInvalid'));
      return;
    }
    setEmailError('');
    try {
      if (isEditing) {
        const payload: IUpdateUser = {
          login: formData.login,
          name: formData.name,
          email,
          level: Number(formData.level) as UserLevel,
          role: formData.role ? Number(formData.role) : undefined,
          numbers_id: formData.numbers_id ? Number(formData.numbers_id) : undefined,
        };
        if (formData.passwd) payload.password = formData.passwd;
        await updateUser({ id: selectedUser!.uniqueid, data: payload }).unwrap();
      } else {
        const payload: ICreateUser = {
          login: formData.login,
          name: formData.name,
          password: formData.passwd,
          email,
          level: Number(formData.level) as UserLevel,
          role: formData.role ? Number(formData.role) : undefined,
        };
        await createUser(payload).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save user:', err);
    }
  };

  const syncAuthAvatar = (userId: number, avatar: string | null) => {
    if (authUserId === userId) {
      dispatch(patchAuthUser({ avatar }));
    }
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedUser) return;
    try {
      const updated = await uploadAvatar({ id: selectedUser.uniqueid, file }).unwrap();
      setAvatarFilename(updated.avatar ?? null);
      syncAuthAvatar(selectedUser.uniqueid, updated.avatar ?? null);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
    }
  };

  const handleAvatarRemove = async () => {
    if (!selectedUser) return;
    try {
      const updated = await deleteAvatar(selectedUser.uniqueid).unwrap();
      setAvatarFilename(updated.avatar ?? null);
      syncAuthAvatar(selectedUser.uniqueid, null);
    } catch (err) {
      console.error('Failed to remove avatar:', err);
    }
  };

  const levelSource = isSuperAdmin ? PLATFORM_LEVEL_OPTIONS : LEVEL_OPTIONS;
  const levelOptions = levelSource.map((opt) => ({
    value: opt.value,
    label: t(opt.i18nKey),
  }));

  const passwordLabel = isEditing
    ? t('users.password')
    : `${t('users.password')} *`;

  const avatarSrc = isEditing && selectedUser
    ? buildUserAvatarUrl(selectedUser.uniqueid, avatarFilename, accessToken)
    : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`flex flex-col gap-0 overflow-hidden max-h-[min(90vh,90dvh)] ${styles.dialogContent}`}
      >
        <DialogHeader className={`shrink-0 ${styles.header}`}>
          <DialogTitle>
            {isEditing ? t('users.edit') : t('users.add')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.form} autoComplete="off">
          <div className={styles.formBody}>
            <VStack gap="16" max>
              {isEditing && selectedUser ? (
                <VStack gap="12" align="center" max className={styles.avatarRow}>
                  <Avatar name={formData.name || selectedUser.name} src={avatarSrc} size={72} />
                  <HStack gap="8" align="center" className={styles.avatarActions}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingAvatar}
                      onClick={() => fileRef.current?.click()}
                    >
                      {isUploadingAvatar ? <Loader2 className={styles.iconSpin} /> : <Upload className={styles.icon} />}
                      {t('users.avatarUpload')}
                    </Button>
                    <InfoTooltip text={t('users.avatarHint')} />
                    {avatarFilename && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isDeletingAvatar}
                        onClick={() => void handleAvatarRemove()}
                        title={t('users.avatarRemove')}
                        aria-label={t('users.avatarRemove')}
                      >
                        <Trash2 className={styles.icon} />
                      </Button>
                    )}
                  </HStack>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className={styles.hiddenFile}
                    onChange={(e) => void handleAvatarPick(e)}
                  />
                </VStack>
              ) : null}

              <VStack gap="8" max className={styles.field}>
                <Label htmlFor="user-name" className={styles.fieldLabel}>
                  {t('users.name')} *
                </Label>
                <Input
                  id="user-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </VStack>

              <VStack gap="8" max className={styles.field}>
                <Label htmlFor="user-login" className={styles.fieldLabel}>
                  {t('users.login')} *
                </Label>
                <Input
                  id="user-login"
                  required
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  autoComplete="off"
                  data-lpignore="true"
                />
              </VStack>

              <VStack gap="8" max className={styles.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="user-password" className={styles.fieldLabel}>
                    {passwordLabel}
                  </Label>
                  {isEditing && <InfoTooltip text={t('users.passwordUnchanged')} />}
                </HStack>
                <HStack gap="8" max className={styles.passwordRow}>
                  <PasswordInput
                    id="user-password"
                    required={!isEditing}
                    value={formData.passwd}
                    revealed={showPassword}
                    onRevealedChange={setShowPassword}
                    onChange={(e) => setFormData({ ...formData, passwd: e.target.value })}
                    autoComplete="new-password"
                    data-lpignore="true"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={styles.generateBtn}
                    onClick={() => {
                      setFormData({ ...formData, passwd: generatePassword() });
                      setShowPassword(true);
                    }}
                    title={t('users.generatePassword')}
                    aria-label={t('users.generatePassword')}
                  >
                    <Stars className={styles.icon} />
                  </Button>
                </HStack>
              </VStack>

              <VStack gap="8" max className={styles.field}>
                <Label htmlFor="user-email" className={styles.fieldLabel}>
                  {t('users.email')}
                </Label>
                <Input
                  id="user-email"
                  type="email"
                  inputMode="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (emailError) setEmailError('');
                  }}
                  onBlur={() => {
                    if (!isValidEmail(formData.email)) {
                      setEmailError(t('users.emailInvalid'));
                    }
                  }}
                  onInvalid={(e) => {
                    e.preventDefault();
                    setEmailError(t('users.emailInvalid'));
                  }}
                  autoComplete="off"
                  data-lpignore="true"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'user-email-error' : undefined}
                />
                {emailError ? (
                  <Text id="user-email-error" className={styles.fieldError}>
                    {emailError}
                  </Text>
                ) : null}
              </VStack>

              <VStack gap="8" max className={styles.primaryField}>
                <HStack gap="4" align="center">
                  <Label htmlFor="user-level" className={styles.fieldLabel}>
                    {t('users.level')}
                  </Label>
                  <InfoTooltip text={t('users.levelHint')} />
                </HStack>
                <Select
                  id="user-level"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                >
                  {levelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </VStack>

              <VStack
                gap={accessExtrasOpen ? '12' : '0'}
                max
                className={styles.accessGroup}
              >
                <HStack gap="8" align="center" max className={styles.accessGroupTitleRow}>
                  <button
                    type="button"
                    className={styles.accessGroupToggle}
                    aria-expanded={accessExtrasOpen}
                    aria-controls="user-access-extras"
                    onClick={() => setAccessExtrasOpen((open) => !open)}
                  >
                    <HStack gap="8" align="center" max className={styles.accessGroupToggleInner}>
                      <Text className={styles.accessGroupTitle}>{t('users.accessExtrasTitle')}</Text>
                      <ChevronDown
                        className={`${styles.accessGroupChevron}${accessExtrasOpen ? ` ${styles.accessGroupChevronOpen}` : ''}`}
                        aria-hidden
                      />
                    </HStack>
                  </button>
                  <InfoTooltip text={t('users.accessExtrasHint')} />
                </HStack>

                {accessExtrasOpen && (
                  <VStack gap="12" max id="user-access-extras">
                    <VStack gap="8" max className={styles.field}>
                      <HStack gap="4" align="center">
                        <Label htmlFor="user-role" className={styles.fieldLabel}>
                          {t('users.role')}
                        </Label>
                        <InfoTooltip text={t('users.roleHint')} />
                      </HStack>
                      <Select
                        id="user-role"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      >
                        <option value="">{t('users.roleNone')}</option>
                        {roles.map((r: { id: number; name: string }) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </Select>
                    </VStack>

                    <VStack gap="8" max className={styles.field}>
                      <HStack gap="4" align="center">
                        <Label htmlFor="user-numbers" className={styles.fieldLabel}>
                          {t('users.numbersId')}
                        </Label>
                        <InfoTooltip text={t('users.numbersIdLinkHint')} />
                      </HStack>
                      <Select
                        id="user-numbers"
                        value={formData.numbers_id}
                        onChange={(e) => setFormData({ ...formData, numbers_id: e.target.value })}
                      >
                        <option value="">{t('users.numbersIdNone')}</option>
                        {numbersList.map((n: { id: number; name: string }) => (
                          <option key={n.id} value={n.id}>
                            {n.name}
                          </option>
                        ))}
                      </Select>
                    </VStack>
                  </VStack>
                )}
              </VStack>
            </VStack>
          </div>

          <DialogFooter className={styles.footer}>
            <HStack gap="8" justify="end" max>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className={styles.iconSpin} />}
                {t('common.save')}
              </Button>
            </HStack>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
