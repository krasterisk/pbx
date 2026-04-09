import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Phone, Lock, User, ArrowRight, Loader2, Languages } from 'lucide-react';
import { Button, Input } from '@/shared/ui';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { login, clearError } from '@/features/auth/model/authSlice';

export const LoginPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((s) => s.auth);

  const [form, setForm] = useState({ login: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(login(form));
    if (login.fulfilled.match(result)) {
      navigate('/');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (form.login && form.password) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  };

  return (
    <div className="flex flex-col min-h-screen p-6 relative overflow-hidden bg-[#0c1214]">
      {/* Background decoration — radial glow (aiPBX pattern) */}
      <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-[radial-gradient(circle,rgba(99,102,241,0.12)_0%,transparent_70%)] blur-[80px] z-[1] pointer-events-none" />
      <div className="absolute -bottom-[20%] -left-[15%] w-[40%] h-[40%] bg-[radial-gradient(circle,rgba(168,85,247,0.08)_0%,transparent_70%)] blur-[80px] z-[1] pointer-events-none" />

      {/* Header — lang switcher */}
      <header className="relative z-10">
        <div className="flex justify-between items-center">
          <button
            id="login-lang-toggle"
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <Languages className="w-4 h-4" />
            {i18n.language.toUpperCase()}
          </button>
        </div>
      </header>

      {/* Form wrapper — center */}
      <div className="flex-1 flex items-center justify-center relative z-[5]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-[440px]"
        >
          {/* Glass card (aiPBX pattern) */}
          <div className="relative rounded-2xl p-8 bg-[rgba(21,28,31,0.6)] backdrop-blur-[24px] border border-white/[0.15] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-all duration-300 hover:border-white/[0.25] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.1)]">
            <div className="flex flex-col items-center gap-6">
              {/* Logo wrapper — floating animation (aiPBX pattern) */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
                className="relative w-[84px] h-[84px] flex items-center justify-center bg-white/[0.02] rounded-[20px] border border-white/[0.05] backdrop-blur-[12px] shadow-[0_10px_40px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.05)] overflow-visible"
              >
                {/* Gradient border overlay */}
                <div className="absolute inset-[-1px] rounded-[20px] bg-[linear-gradient(135deg,rgba(255,255,255,0.1),transparent_50%,rgba(255,255,255,0.05))] pointer-events-none" />
                <Phone className="w-9 h-9 text-primary relative z-[1]" />
              </motion.div>

              {/* Title */}
              <div className="text-center">
                <h1 className="text-xl font-semibold text-white">
                  {t('auth.title')}
                </h1>
                <p className="text-sm text-[#a1a1aa] mt-1">
                  {t('auth.subtitle')} Krasterisk
                </p>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="w-full text-center"
                >
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}

              {/* Loader overlay */}
              {isLoading && (
                <div className="flex justify-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="w-full space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                  <Input
                    id="login-input"
                    type="text"
                    placeholder={t('auth.loginPlaceholder')}
                    value={form.login}
                    onChange={(e) => {
                      setForm({ ...form, login: e.target.value });
                      if (error) dispatch(clearError());
                    }}
                    className="pl-10 bg-[#151c1f] border-white/[0.1] hover:bg-[#1a2226] focus:border-primary/40 text-white placeholder:text-white/40"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                  <Input
                    id="password-input"
                    type="password"
                    placeholder={t('auth.passwordPlaceholder')}
                    value={form.password}
                    onChange={(e) => {
                      setForm({ ...form, password: e.target.value });
                      if (error) dispatch(clearError());
                    }}
                    className="pl-10 bg-[#151c1f] border-white/[0.1] hover:bg-[#1a2226] focus:border-primary/40 text-white placeholder:text-white/40"
                    disabled={isLoading}
                  />
                </div>

                {/* Submit button — glass-action style (aiPBX pattern) */}
                <Button
                  id="login-button"
                  type="submit"
                  className="w-full h-11 bg-primary/90 hover:bg-primary text-white font-medium shadow-[0_4px_16px_rgba(99,102,241,0.25)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.35)] transition-all duration-300"
                  disabled={isLoading || !form.login || !form.password}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {t('auth.login')}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer (aiPBX pattern) */}
      <footer className="relative z-10 text-center opacity-60 mt-6">
        <p className="text-sm text-[#a1a1aa]">
          © {new Date().getFullYear()} Krasterisk. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
