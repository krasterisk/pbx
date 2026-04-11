import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Phone, Lock, User, ArrowRight, Loader2, Languages, Mail } from 'lucide-react';
import { Button, Input, VStack, HStack, Flex } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [form, setForm] = useState({ name: '', email: '', login: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.login || !form.password) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Registration failed');
      }

      // Success, move to activation phase carrying the login
      navigate('/activate', { state: { login: form.login, email: form.email } });
    } catch (e: any) {
      setError(e.message || 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  };

  return (
    <VStack className="min-h-screen p-6 relative overflow-hidden bg-[#0c1214]" justify="between">
      <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-[radial-gradient(circle,rgba(99,102,241,0.12)_0%,transparent_70%)] blur-[80px] z-[1] pointer-events-none" />
      <div className="absolute -bottom-[20%] -left-[15%] w-[40%] h-[40%] bg-[radial-gradient(circle,rgba(168,85,247,0.08)_0%,transparent_70%)] blur-[80px] z-[1] pointer-events-none" />

      <header className="relative z-10 w-full">
        <HStack max justify="end">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <Languages className="w-4 h-4" />
            {i18n.language.toUpperCase()}
          </button>
        </HStack>
      </header>

      <Flex className="flex-1 w-full relative z-[5]" align="center" justify="center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-[440px]"
        >
          <div className="relative rounded-2xl p-8 bg-[rgba(21,28,31,0.6)] backdrop-blur-[24px] border border-white/[0.15] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-all duration-300 hover:border-white/[0.25] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.1)]">
            <VStack gap="24" align="center">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
                className="relative w-[84px] h-[84px] flex items-center justify-center bg-white/[0.02] rounded-[20px] border border-white/[0.05] backdrop-blur-[12px] shadow-[0_10px_40px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.05)] overflow-visible"
              >
                <div className="absolute inset-[-1px] rounded-[20px] bg-[linear-gradient(135deg,rgba(255,255,255,0.1),transparent_50%,rgba(255,255,255,0.05))] pointer-events-none" />
                <Phone className="w-9 h-9 text-primary relative z-[1]" />
              </motion.div>

              <div className="text-center">
                <h1 className="text-xl font-semibold text-white">
                  {t('auth.registerTitle')}
                </h1>
                <p className="text-sm text-[#a1a1aa] mt-1">
                  {t('auth.registerSubtitle')}
                </p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="w-full text-center"
                >
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="w-full space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                  <Input
                    type="text"
                    placeholder={t('auth.namePlaceholder')}
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      setError(null);
                    }}
                    className="pl-10 bg-[#151c1f] border-white/[0.1] hover:bg-[#1a2226] focus:border-primary/40 text-white placeholder:text-white/40"
                    disabled={isLoading}
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                  <Input
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      setError(null);
                    }}
                    className="pl-10 bg-[#151c1f] border-white/[0.1] hover:bg-[#1a2226] focus:border-primary/40 text-white placeholder:text-white/40"
                    disabled={isLoading}
                  />
                </div>

                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                  <Input
                    type="text"
                    placeholder={t('auth.loginPlaceholder')}
                    value={form.login}
                    onChange={(e) => {
                      setForm({ ...form, login: e.target.value });
                      setError(null);
                    }}
                    className="pl-10 bg-[#151c1f] border-white/[0.1] hover:bg-[#1a2226] focus:border-primary/40 text-white placeholder:text-white/40"
                    disabled={isLoading}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                  <Input
                    type="password"
                    placeholder={t('auth.passwordPlaceholder')}
                    value={form.password}
                    onChange={(e) => {
                      setForm({ ...form, password: e.target.value });
                      setError(null);
                    }}
                    className="pl-10 bg-[#151c1f] border-white/[0.1] hover:bg-[#1a2226] focus:border-primary/40 text-white placeholder:text-white/40"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-primary/90 hover:bg-primary text-white font-medium shadow-[0_4px_16px_rgba(99,102,241,0.25)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.35)] transition-all duration-300"
                  disabled={isLoading || !form.name || !form.login || !form.password}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {t('auth.registerAction')}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <VStack max align="center" className="mt-4">
                  <button 
                    type="button" 
                    onClick={() => navigate('/login')} 
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    {t('auth.haveAccount')}
                  </button>
                </VStack>
              </form>
            </VStack>
          </div>
        </motion.div>
      </Flex>

      <footer className="relative z-10 w-full text-center opacity-60">
        <p className="text-sm text-[#a1a1aa] pb-4">
          © {new Date().getFullYear()} Krasterisk. All rights reserved.
        </p>
      </footer>
    </VStack>
  );
};
