import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, VStack } from '@/shared/ui';
import { AuthFrame } from '@/widgets/AuthFrame/AuthFrame';

export const RegisterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ companyName: '', name: '', login: '', email: '', password: '' });
  const [confirm, setConfirm] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    if (form.password !== confirm) { setError(t('auth.passwordMismatch', 'Пароли не совпадают')); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email: form.email || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join('. ') : result.message || t('auth.registrationFailed', 'Не удалось зарегистрироваться'));
      navigate(result.requiresActivation ? '/activate' : '/login', { state: { login: form.login, email: form.email, registered: true } });
    } catch (failure) { setError(failure instanceof Error ? failure.message : t('common.error', 'Ошибка соединения')); }
    finally { setLoading(false); }
  };
  const fields = [
    ['companyName', t('auth.companyName', 'Организация'), 'organization', 'text'],
    ['name', t('auth.adminName', 'Имя администратора'), 'name', 'text'],
    ['login', t('auth.loginPlaceholder'), 'username', 'text'],
    ['email', t('auth.optionalActivationEmail', 'Email для подтверждения (необязательно)'), 'email', 'email'],
    ['password', t('auth.newPassword', 'Пароль (минимум 8 символов)'), 'new-password', 'password'],
  ] as const;
  return <AuthFrame title={t('auth.createCompany', 'Создать организацию')} description={t('auth.companySignupHint', 'Отдельные пользователи, абоненты и маршруты. Номера можно настроить через AI после входа.')}>
    <form onSubmit={submit} className="w-full"><VStack gap="16">
      {fields.map(([key, label, autoComplete, type]) => <VStack key={key} gap="8" className="w-full">
        <label htmlFor={`register-${key}`}>{label}</label>
        <Input id={`register-${key}`} type={type} autoComplete={autoComplete} value={form[key]} required={key !== 'email'} minLength={key === 'password' ? 8 : key === 'companyName' ? 2 : undefined} maxLength={key === 'password' ? 128 : 255} disabled={isLoading} onChange={e => setForm({ ...form, [key]: e.target.value })} />
      </VStack>)}
      <label htmlFor="register-confirm">{t('auth.confirmPassword', 'Повторите пароль')}</label>
      <Input id="register-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} disabled={isLoading} />
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <Button type="submit" disabled={isLoading}>{isLoading ? t('common.loading', 'Загрузка…') : t('auth.createCompany', 'Создать организацию')}</Button>
      <p className="text-xs text-muted-foreground">{t('auth.existingCompanyHint', 'Если ваша компания уже использует АТС, попросите администратора создать вам учётную запись — новая организация для этого не нужна.')}</p>
    </VStack></form>
  </AuthFrame>;
};
