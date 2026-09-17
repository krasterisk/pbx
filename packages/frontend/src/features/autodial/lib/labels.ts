import type {
  AutodialCampaignStatus,
  AutodialDialMode,
  AutodialDisposition,
} from '@krasterisk/shared';

type Translate = (key: string, fallback: string) => string;

const STATUS_FALLBACKS: Record<AutodialCampaignStatus, string> = {
  draft: 'Черновик',
  scheduled: 'По расписанию',
  running: 'Идёт набор',
  paused: 'Пауза',
  stopped: 'Остановлена',
  completed: 'Завершена',
};

const DIAL_MODE_FALLBACKS: Record<AutodialDialMode, string> = {
  progressive: 'Прогрессивный',
  power: 'Power (N:1)',
  agentless: 'Без операторов',
  predictive: 'Предиктивный',
};

const DISPOSITION_FALLBACKS: Record<AutodialDisposition, string> = {
  new: 'Новый',
  dialing: 'Набор',
  success: 'Успешно',
  answered_short: 'Короткий разговор',
  no_answer: 'Не ответили',
  busy: 'Занято',
  congestion: 'Перегрузка',
  failed: 'Ошибка',
  amd_machine: 'Автоответчик',
  voicemail: 'Голосовая почта',
  invalid_number: 'Неверный номер',
  dnc: 'Стоп-лист',
  max_attempts: 'Попытки исчерпаны',
  callback_scheduled: 'Перезвон назначен',
  cancelled: 'Отменено',
  excluded: 'Исключено',
};

/** Why the pacer is not opening more channels right now. */
const LIMITED_BY_FALLBACKS: Record<string, string> = {
  static: 'Фиксированный лимит',
  queue_agents: 'Свободные операторы',
  queue_agents_warmup: 'Ожидание данных по операторам',
  trunk_channels: 'Каналы транка',
  tenant_cap: 'Лимит арендатора',
  schedule: 'Вне расписания',
  no_providers: 'Пейсинг не настроен',
  none: '-',
};

export function autodialStatusLabel(status: AutodialCampaignStatus, t: Translate): string {
  return t(`autodial.status.${status}`, STATUS_FALLBACKS[status] ?? status);
}

export function autodialDialModeLabel(mode: AutodialDialMode, t: Translate): string {
  return t(`autodial.dialMode.${mode}`, DIAL_MODE_FALLBACKS[mode] ?? mode);
}

export function autodialDispositionLabel(
  disposition: AutodialDisposition,
  t: Translate,
): string {
  return t(
    `autodial.disposition.${disposition}`,
    DISPOSITION_FALLBACKS[disposition] ?? disposition,
  );
}

export function autodialLimitedByLabel(limitedBy: string, t: Translate): string {
  return t(`autodial.limitedBy.${limitedBy}`, LIMITED_BY_FALLBACKS[limitedBy] ?? limitedBy);
}

/** Status → Badge variant, so a paused campaign never looks like a healthy one. */
export function autodialStatusTone(
  status: AutodialCampaignStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'running':
      return 'default';
    case 'paused':
    case 'scheduled':
      return 'secondary';
    case 'stopped':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function formatAutodialDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
