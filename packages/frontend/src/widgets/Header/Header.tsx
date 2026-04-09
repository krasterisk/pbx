import { useTranslation } from 'react-i18next';
import { Bell, Moon, Sun, LogOut, Search, Languages } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { logout } from '@/features/auth/model/authSlice';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface HeaderProps {
  sidebarWidth: number;
}

export const Header = ({ sidebarWidth }: HeaderProps) => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const [isDark, setIsDark] = useState(true);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
      html.classList.add('light');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
    }
    setIsDark(!isDark);
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(nextLang);
  };

  return (
    <header
      className="fixed top-0 right-0 h-16 z-30 flex items-center justify-between px-6 border-b border-border bg-background/80 backdrop-blur-md"
      style={{ left: sidebarWidth }}
    >
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="global-search"
            type="text"
            placeholder={t('common.search')}
            className="w-full h-9 pl-10 pr-4 rounded-lg bg-muted/50 border border-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Language toggle */}
        <Button id="lang-toggle" variant="ghost" size="icon" onClick={toggleLanguage} title={i18n.language.toUpperCase()}>
          <Languages className="w-4 h-4" />
        </Button>

        {/* Theme toggle */}
        <Button id="theme-toggle" variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notifications */}
        <Button id="notifications-btn" variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full pulse-online" />
        </Button>

        {/* User */}
        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-border">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">ext. {user?.exten || '—'}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <Button id="logout-btn" variant="ghost" size="icon" onClick={handleLogout} title={t('auth.logout')}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
