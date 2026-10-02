import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Label, PasswordInput, Text, VStack } from '@/shared/ui';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { login, clearError } from '@/features/auth/model/authSlice';
import { resolveRoleStart } from '@/features/modules/lib/roleStartResolver';
import { ROLE_START_PENDING_KEY } from '@/features/modules/hooks/useRoleStartRedirect';
import { UserLevel } from '@krasterisk/shared';
import { useGetAuthConfigQuery } from '@/shared/api/endpoints/authApi';
import { AuthScreen } from '@/widgets/AuthScreen/AuthScreen';
import cls from './AuthLogin.module.scss';

/** Sign-in module: organization login only. */
export function AuthLogin() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((s) => s.auth);
  const { data } = useGetAuthConfigQuery();
  const registrationEnabled = data?.deploymentMode !== 'box' && data?.registrationEnabled === true;
  const [form, setForm] = useState({ login: '', password: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    const result = await dispatch(login(form));
    if (login.fulfilled.match(result)) {
      const level = result.payload.user.level as UserLevel;
      if (level === UserLevel.SUPERADMIN) {
        sessionStorage.removeItem(ROLE_START_PENDING_KEY);
        navigate('/platform');
        return;
      }
      sessionStorage.setItem(ROLE_START_PENDING_KEY, '1');
      navigate(resolveRoleStart(level));
    }
  };

  return (
    <AuthScreen title={t('auth.title')}>
      <VStack as="form" className={cls.form} gap="16" onSubmit={submit}>
        <VStack gap="8" className={cls.fieldGroup}>
          <Label htmlFor="login-name">{t('auth.loginPlaceholder')}</Label>
          <Input
            id="login-name"
            className={cls.field}
            autoComplete="username"
            required
            value={form.login}
            onChange={(e) => {
              setForm({ ...form, login: e.target.value });
              dispatch(clearError());
            }}
            disabled={isLoading}
          />
        </VStack>
        <VStack gap="8" className={cls.fieldGroup}>
          <Label htmlFor="login-password">{t('auth.passwordPlaceholder')}</Label>
          <PasswordInput
            id="login-password"
            className={cls.field}
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => {
              setForm({ ...form, password: e.target.value });
              dispatch(clearError());
            }}
            disabled={isLoading}
          />
        </VStack>
        {error && (
          <Text variant="error" role="alert">{error}</Text>
        )}
        <Button
          type="submit"
          className={cls.submit}
          disabled={isLoading || !form.login || !form.password}
        >
          {isLoading ? t('common.loading') : t('auth.signIn')}
        </Button>
        {registrationEnabled && (
          <Text variant="muted" align="center">
            {t('auth.noAccountLead', "Don't have an account?")}
            {' '}
            <Link className={cls.altLink} to="/register">
              {t('auth.noAccountAction', 'Sign up')}
            </Link>
          </Text>
        )}
      </VStack>
    </AuthScreen>
  );
}
