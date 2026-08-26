import { useTranslation } from 'react-i18next';
import { Bell, Moon, Sun, Search, Languages, Menu } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useState } from 'react';
import { UserBlock } from '@/widgets/UserBlock';

interface HeaderProps {
  sidebarWidth: number;
  onMenuToggle?: () => void;
  isMobile?: boolean;
}

export const Header = ({ sidebarWidth, onMenuToggle, isMobile }: HeaderProps) => {
  const { t, i18n } = useTranslation();
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  const toggleTheme = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
      html.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDark(!isDark);
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(nextLang);
  };

  return (
    <header
      className="fixed top-0 right-0 h-16 flex items-center justify-between px-6 border-b border-border bg-background/80 backdrop-blur-md layer-header"
      style={{ left: sidebarWidth }}
    >
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onMenuToggle} className="flex-shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        )}
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

      <div className="flex items-center gap-1">
        <Button id="lang-toggle" variant="ghost" size="icon" onClick={toggleLanguage} title={i18n.language.toUpperCase()}>
          <Languages className="w-4 h-4" />
        </Button>

        <Button id="theme-toggle" variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <Button id="notifications-btn" variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full pulse-online" />
        </Button>

        <div className="ml-2 pl-4 border-l border-border">
          <UserBlock />
        </div>
      </div>
    </header>
  );
};
