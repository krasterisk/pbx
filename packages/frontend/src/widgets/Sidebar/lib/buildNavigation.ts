import type { TFunction } from 'i18next';
import {
  LayoutDashboard,
  Users,
  Phone,
  Route,
  ListOrdered,
  BarChart3,
  Headphones,
  Monitor,
  Settings,
  Waypoints,
  Shield,
  List,
  FileCode,
  Network,
  AppWindow,
  Mic,
  Music,
  Volume2,
  AudioLines,
  Bot,
  Activity,
  ClipboardList,
  ClipboardCheck,
  Calendar,
  BookOpen,
  PhoneCall,
  MonitorPlay,
} from 'lucide-react';
import { UserLevel } from '@/entities/User';
import type { SidebarItemType } from '../ui/SidebarItem/SidebarItem';

export type SidebarNavEntry = SidebarItemType | { type: 'divider'; label: string };

function buildCallCenterBlock(t: TFunction, level: UserLevel | undefined): SidebarNavEntry[] {
  const entries: SidebarNavEntry[] = [];

  const hasCcAccess =
    level === UserLevel.OPERATOR ||
    level === UserLevel.SUPERVISOR ||
    level === UserLevel.ADMIN;

  if (hasCcAccess) {
    entries.push({ type: 'divider', label: t('nav.callcenter') });
  }

  entries.push({
    name: t('nav.serviceRequests', 'Заявки клиентов'),
    path: '/service-requests',
    icon: ClipboardList,
  });

  if (level === UserLevel.OPERATOR || level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN) {
    entries.push({
      name: t('nav.operator'),
      path: '/callcenter/agent',
      icon: Headphones,
    });
  }

  if (level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN) {
    entries.push(
      {
        name: t('nav.supervisor'),
        path: '/callcenter/supervisor',
        icon: Monitor,
      },
      {
        name: t('nav.wallboard'),
        path: '/callcenter/wallboard',
        icon: MonitorPlay,
      },
      {
        name: t('nav.ccReports'),
        path: '/callcenter/reports',
        icon: BarChart3,
      },
    );
  }

  if (level === UserLevel.ADMIN) {
    entries.push({
      name: t('nav.ccSettings'),
      path: '/callcenter/settings',
      icon: Settings,
    });
  }

  return entries;
}

export function buildNavigation(t: TFunction, level: UserLevel | undefined): SidebarNavEntry[] {
  return [
    { name: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
    { type: 'divider', label: t('nav.pbx') },
    { name: t('endpoints.title'), path: '/endpoints', icon: Phone },
    { name: t('contexts.title', 'Контексты'), path: '/contexts', icon: Network },
    { name: t('nav.trunks'), path: '/trunks', icon: Waypoints },
    { name: t('nav.routes'), path: '/routes', icon: Route },
    { name: t('nav.timeGroups', 'Временные группы'), path: '/time-groups', icon: Calendar },
    { name: t('nav.phonebooks', 'Справочники'), path: '/phonebooks', icon: BookOpen },
    { type: 'divider', label: t('nav.apps', 'Приложения') },
    { name: t('nav.voiceRobots', 'Голосовые роботы'), path: '/voice-robots', icon: Bot },
    { name: t('nav.ivrs', 'IVR'), path: '/ivrs', icon: AppWindow },
    { name: t('nav.queues'), path: '/queues', icon: ListOrdered },
    { name: t('promptsPage.title', 'Записи'), path: '/prompts', icon: Mic },
    { name: t('moh.title', 'Музыка на удержании'), path: '/moh', icon: Music },
    ...buildCallCenterBlock(t, level),
    { type: 'divider', label: t('nav.analytics') },
    { name: t('nav.reports'), path: '/reports', icon: BarChart3 },
    { name: t('nav.cdr', 'Журнал звонков (CDR)'), path: '/reports/cdr', icon: PhoneCall },
    { name: t('nav.voiceRobotCdr', 'Журнал роботов (CDR)'), path: '/reports/voice-robot-cdr', icon: Activity },
    { name: t('nav.auditLog', 'Журнал событий'), path: '/audit-log', icon: ClipboardCheck },
    { type: 'divider', label: t('nav.system') },
    { name: t('nav.users'), path: '/users', icon: Users },
    { name: t('nav.roles' as any) || 'Интерфейсы', path: '/roles', icon: Shield },
    { name: t('nav.numbers' as any) || 'Списки доступа', path: '/numbers', icon: List },
    { name: t('nav.provisionTemplates', 'Шаблоны автонастройки'), path: '/provision-templates', icon: FileCode },
    { name: t('nav.ttsEngines', 'Синтез речи (TTS)'), path: '/settings/tts-engines', icon: Volume2 },
    { name: t('nav.sttEngines', 'Распознавание речи (STT)'), path: '/settings/stt-engines', icon: AudioLines },
    { name: t('nav.settings'), path: '/settings', icon: Settings },
  ];
}
