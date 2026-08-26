import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2, Upload, UserRound } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  PasswordInput,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetUserByIdQuery,
  useUpdateUserMutation,
  useUploadUserAvatarMutation,
  useDeleteUserAvatarMutation,
} from '@/shared/api/api';
import { patchAuthUser } from '@/features/auth/model/authSlice';
import { buildUserAvatarUrl } from '@/shared/lib/userAvatarUrl';
import styles from './ProfilePage.module.scss';

export const ProfilePage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const fileRef = useRef<HTMLInputElement>(null);
  const authUser = useAppSelector((s) => s.auth.user);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const userId = authUser?.uniqueid ?? 0;

  const { data: user, isLoading } = useGetUserByIdQuery(userId, { skip: !userId });
  const [updateUser, { isLoading: isSaving }] = useUpdateUserMutation();
  const [uploadAvatar, { isLoading: isUploading }] = useUploadUserAvatarMutation();
  const [deleteAvatar, { isLoading: isDeleting }] = useDeleteUserAvatarMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passwd, setPasswd] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarFilename, setAvatarFilename] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    setAvatarFilename(user.avatar ?? null);
    setPasswd('');
    setShowPassword(false);
  }, [user]);

  const avatarSrc = buildUserAvatarUrl(userId, avatarFilename, accessToken);

  const handleSave = async () => {
    if (!userId) return;
    try {
      const payload: Record<string, unknown> = { name, email };
      if (passwd) payload.password = passwd;
      const updated = await updateUser({ id: userId, data: payload }).unwrap();
      dispatch(patchAuthUser({
        name: updated.name,
        avatar: updated.avatar ?? null,
      }));
      setPasswd('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userId) return;
    try {
      const updated = await uploadAvatar({ id: userId, file }).unwrap();
      setAvatarFilename(updated.avatar ?? null);
      dispatch(patchAuthUser({ avatar: updated.avatar ?? null }));
    } catch (err) {
      console.error('Failed to upload avatar:', err);
    }
  };

  const handleAvatarRemove = async () => {
    if (!userId) return;
    try {
      await deleteAvatar(userId).unwrap();
      setAvatarFilename(null);
      dispatch(patchAuthUser({ avatar: null }));
    } catch (err) {
      console.error('Failed to remove avatar:', err);
    }
  };

  if (!userId) {
    return <Text>{t('common.error')}</Text>;
  }

  return (
    <VStack gap="24" max className={styles.page} data-testid="profile-page">
      <HStack gap="12" align="center" className={styles.header}>
        <UserRound className={styles.titleIcon} />
        <Text as="h1" className={styles.title}>{t('auth.profile')}</Text>
      </HStack>

      <Card className={styles.card}>
        <CardHeader>
          <Text className={styles.sectionTitle}>{t('users.avatar')}</Text>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className={styles.spinner} />
          ) : (
            <HStack gap="16" max align="center" wrap="wrap" className={styles.avatarBlock}>
              <Avatar name={name || authUser?.name || 'U'} src={avatarSrc} size={80} />
              <VStack gap="8" max align="center" className={styles.avatarActions}>
                <HStack gap="8" wrap="wrap" className={styles.avatarButtons}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {isUploading ? <Loader2 className={styles.iconSpin} /> : <Upload className={styles.icon} />}
                    {t('users.avatarUpload')}
                  </Button>
                  {avatarFilename && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => void handleAvatarRemove()}
                      aria-label={t('users.avatarRemove')}
                    >
                      <Trash2 className={styles.icon} />
                    </Button>
                  )}
                </HStack>
                <Text className={styles.hint}>{t('users.avatarHint')}</Text>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className={styles.hiddenFile}
                  onChange={(e) => void handleAvatarPick(e)}
                />
              </VStack>
            </HStack>
          )}
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <Text className={styles.sectionTitle}>{t('profile.details')}</Text>
        </CardHeader>
        <CardContent>
          <VStack gap="16" max>
            <VStack gap="8" max>
              <Label htmlFor="profile-login">{t('users.login')}</Label>
              <Input id="profile-login" value={authUser?.login || user?.login || ''} disabled />
            </VStack>
            <VStack gap="8" max>
              <Label htmlFor="profile-name">{t('users.name')}</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </VStack>
            <VStack gap="8" max>
              <Label htmlFor="profile-email">{t('users.email')}</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </VStack>
            <VStack gap="8" max>
              <Label htmlFor="profile-password">
                {t('users.password')} {t('users.passwordUnchanged')}
              </Label>
              <PasswordInput
                id="profile-password"
                value={passwd}
                revealed={showPassword}
                onRevealedChange={setShowPassword}
                onChange={(e) => setPasswd(e.target.value)}
              />
            </VStack>
            <HStack gap="8" max className={styles.footer}>
              {saved && <Text className={styles.saved}>{t('common.success')}</Text>}
              <Button
                type="button"
                className={styles.saveBtn}
                onClick={() => void handleSave()}
                disabled={isSaving || !name.trim()}
              >
                {isSaving && <Loader2 className={styles.iconSpin} />}
                {t('common.save')}
              </Button>
            </HStack>
          </VStack>
        </CardContent>
      </Card>
    </VStack>
  );
};
