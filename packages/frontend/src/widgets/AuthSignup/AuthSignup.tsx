import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Label, PasswordInput, Text, VStack } from '@/shared/ui';
import { useGetAuthConfigQuery } from '@/shared/api/endpoints/authApi';
import { AuthScreen } from '@/widgets/AuthScreen/AuthScreen';
import cls from './AuthSignup.module.scss';

/** Signup module: create an organization when registration is enabled. */
export function AuthSignup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading: isConfigLoading, isError } = useGetAuthConfigQuery();
  const registrationEnabled = data?.deploymentMode !== 'box' && data?.registrationEnabled === true;
  const [form, setForm] = useState({ companyName: '', name: '', login: '', email: '', password: '' });
  const [confirm, setConfirm] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isConfigLoading && (isError || data?.deploymentMode === 'box' || data?.registrationEnabled === false)) {
      navigate('/login', { replace: true });
    }
  }, [data?.deploymentMode, data?.registrationEnabled, isConfigLoading, isError, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading || !registrationEnabled) return;
    if (form.password !== confirm) {
      setError(t('auth.passwordMismatch', 'Пароли не совпадают'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email: form.email || undefined }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(Array.isArray(result.message) ? result.message.join('. ') : result.message || t('auth.registrationFailed', 'Не удалось зарегистрироваться'));
      }
      navigate(result.requiresActivation ? '/activate' : '/login', {
        state: { login: form.login, email: form.email, registered: true },
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('common.error', 'Ошибка соединения'));
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    ['companyName', t('auth.companyName', 'Организация'), 'organization', 'text'],
    ['name', t('auth.adminName', 'Имя администратора'), 'name', 'text'],
    ['login', t('auth.loginPlaceholder'), 'username', 'text'],
    ['email', t('auth.optionalActivationEmail', 'Email для подтверждения (необязательно)'), 'email', 'email'],
  ] as const;

  return (
    <AuthScreen
      title={t('auth.createCompany', 'Создать организацию')}
      description={t('auth.companySignupHint', 'Отдельные пользователи, абоненты и маршруты. Номера можно настроить через AI после входа.')}
    >
      {isConfigLoading || !registrationEnabled ? (
        <Text variant="muted">
          {isConfigLoading ? t('common.loading', 'Загрузка…') : t('auth.registrationClosed', 'Регистрация организаций отключена. Доступен только вход.')}
        </Text>
      ) : (
        <VStack as="form" className={cls.form} gap="16" onSubmit={submit}>
          {fields.map(([key, label, autoComplete, type]) => (
            <VStack key={key} gap="8">
              <Label htmlFor={`register-${key}`}>{label}</Label>
              <Input
                id={`register-${key}`}
                type={type}
                autoComplete={autoComplete}
                value={form[key]}
                required={key !== 'email'}
                minLength={key === 'companyName' ? 2 : undefined}
                maxLength={255}
                disabled={isLoading}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </VStack>
          ))}
          <VStack gap="8">
            <Label htmlFor="register-password">{t('auth.newPassword', 'Пароль (минимум 8 символов)')}</Label>
            <PasswordInput
              id="register-password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={form.password}
              disabled={isLoading}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </VStack>
          <VStack gap="8">
            <Label htmlFor="register-confirm">{t('auth.confirmPassword', 'Повторите пароль')}</Label>
            <PasswordInput
              id="register-confirm"
              autoComplete="new-password"
              required
              value={confirm}
              disabled={isLoading}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </VStack>
          {error && <Text variant="error" role="alert">{error}</Text>}
          <Button type="submit" className={cls.submit} disabled={isLoading}>
            {isLoading ? t('common.loading', 'Загрузка…') : t('auth.createCompany', 'Создать организацию')}
          </Button>
          <Text variant="muted" align="center">
            {t('auth.haveAccountLead', 'Already have an account?')}
            {' '}
            <Link className={cls.altLink} to="/login">
              {t('auth.haveAccountAction', 'Sign in')}
            </Link>
          </Text>
          <Text variant="xs" align="center">
            {t('auth.existingCompanyHint', 'Если ваша компания уже использует АТС, попросите администратора создать вам учётную запись.')}
          </Text>
        </VStack>
      )}
    </AuthScreen>
  );
}
