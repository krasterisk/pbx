import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, VStack } from '@/shared/ui';
import { AuthFrame } from '@/widgets/AuthFrame/AuthFrame';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { login, clearError } from '@/features/auth/model/authSlice';
import { resolveRoleStart } from '@/features/modules/lib/roleStartResolver';
import { ROLE_START_PENDING_KEY } from '@/features/modules/hooks/useRoleStartRedirect';
import { UserLevel } from '@krasterisk/shared';

export const LoginPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector(s => s.auth);
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
  return <AuthFrame title={t('auth.title')} description={t('auth.companyLoginHint', 'Войдите в свою организацию. Доступ сотруднику создаёт её администратор.')}>
    <form onSubmit={submit} className="w-full">
      <VStack gap="16">
        <label htmlFor="login-name">{t('auth.loginPlaceholder')}</label>
        <Input id="login-name" autoComplete="username" required value={form.login} onChange={e => { setForm({ ...form, login: e.target.value }); dispatch(clearError()); }} disabled={isLoading} />
        <label htmlFor="login-password">{t('auth.passwordPlaceholder')}</label>
        <Input id="login-password" type="password" autoComplete="current-password" required value={form.password} onChange={e => { setForm({ ...form, password: e.target.value }); dispatch(clearError()); }} disabled={isLoading} />
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button type="submit" disabled={isLoading || !form.login || !form.password}>{isLoading ? t('common.loading', 'Загрузка…') : t('auth.signIn', 'Войти')}</Button>
      </VStack>
    </form>
  </AuthFrame>;
};
