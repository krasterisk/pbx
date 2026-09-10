import {
  DIALPLAN_ACTION_META,
  type ActionType,
  type DialplanHost,
} from '@krasterisk/shared';

export interface DialplanAppCopy {
  title: string;
  summary: string;
  when: string;
  need: string[];
}

export interface DialplanAppView extends DialplanAppCopy {
  type: ActionType;
  family: string;
  terminal: string;
  hosts: readonly DialplanHost[];
  usedIn?: { routes: number; ivrs: number };
}

const COPY: Record<ActionType, DialplanAppCopy> = {
  totrunk: {
    title: 'Набор через транк',
    summary: 'Внешний номер через выбранный транк. Это шаг цепочки, не overflow группы и не очередь.',
    when: 'Исходящий на городской, failover после togroup/toexten, набор DID.',
    need: ['trunk', 'dest'],
  },
  toexten: {
    title: 'Внутренний абонент',
    summary: 'Звонит абоненту тенанта по публичному номеру (101, не e101_0).',
    when: 'Цифра меню или маршрут на конкретного сотрудника.',
    need: ['target'],
  },
  toqueue: {
    title: 'Очередь',
    summary: 'Звонящий ждёт агента с музыкой. Overflow очереди — отдельное поле очереди, не этот шаг.',
    when: 'Контакт-центр, удержание в линии. Не замена группы на таймауте IVR.',
    need: ['target'],
  },
  togroup: {
    title: 'Группа вызова',
    summary: 'Звонят члены группы по её стратегии и ring_time. У группы нет overflow.',
    when: 'Короткий список «звонят все сразу». После неответа — следующий шаг этой же цепочки.',
    need: ['target'],
  },
  tolist: {
    title: 'Обзвон списка',
    summary: 'Набирает номера из справочника/списка по порядку или одновременно.',
    when: 'Обзвон из directory, не фиксированная группа.',
    need: ['list'],
  },
  toivr: {
    title: 'Голосовое меню',
    summary: 'Передаёт вызов в другое IVR. Терминальный шаг: дальше цепочка не идёт.',
    when: 'Вложенное меню, вход в IVR со входящего маршрута.',
    need: ['ivr_uid'],
  },
  toroute: {
    title: 'В другой контекст',
    summary: 'Продолжает набор в указанном контексте маршрутизации. Терминальный шаг.',
    when: 'Переход во внутренний/ночной контекст, не goto без label.',
    need: ['context'],
  },
  playback: {
    title: 'Проиграть файл',
    summary: 'Воспроизводит аудиофайл, затем идёт следующий шаг, если файл не оборвал канал.',
    when: 'Объявление, гудок перед набором.',
    need: ['filename'],
  },
  notify: {
    title: 'Уведомление',
    summary: 'Шлёт событие/уведомление и не обрывает маршрут.',
    when: 'Сигнал оператору или внешней системе без смены назначения.',
    need: ['channel'],
  },
  callerid: {
    title: 'Подменить CallerID',
    summary: 'Меняет имя или номер на линии и пропускает дальше.',
    when: 'Перед totrunk/toexten, чтобы на телефоне было нужное имя.',
    need: ['number'],
  },
  voicemail: {
    title: 'Голосовая почта',
    summary: 'Кладёт вызов в ящик абонента, если предыдущий набор не взяли.',
    when: 'После toexten/togroup, когда нужна почта, а не городской и не очередь.',
    need: ['mailbox'],
  },
  text2speech: {
    title: 'Произнести текст',
    summary: 'TTS-фраза на выбранном движке, маршрут продолжается.',
    when: 'Динамическое объявление без заранее записанного файла.',
    need: ['text'],
  },
  voicerobot: {
    title: 'Голосовой робот',
    summary: 'Передаёт канал голосовому роботу тенанта.',
    when: 'Сценарий бота вместо живого меню.',
    need: ['robot'],
  },
  webhook: {
    title: 'Webhook',
    summary: 'HTTP-вызов наружу, маршрут не обрывается.',
    when: 'Сигнал CRM в середине цепочки.',
    need: ['url'],
  },
  confbridge: {
    title: 'Конференция',
    summary: 'Сажает абонента в конференц-мост.',
    when: 'Совещание, не группа вызова.',
    need: ['bridge'],
  },
  cmd: {
    title: 'Команда Asterisk',
    summary: 'Сырое приложение только в маршруте, не в пункте IVR. Не используй, если есть typed-шаг.',
    when: 'Исключение, которого нет в редакторе. Host: route.',
    need: ['application'],
  },
  label: {
    title: 'Метка',
    summary: 'Именная точка, на которую ссылается goto. Сама ничего не набирает.',
    when: 'Развилка, повтор, обход по условию.',
    need: ['name'],
  },
  goto: {
    title: 'Переход к метке',
    summary: 'Прыжок на label в этой же цепочке. Без else при условии — падает дальше.',
    when: 'Повтор приветствия, обход по расписанию.',
    need: ['label_name'],
  },
  schedule: {
    title: 'Расписание',
    summary: 'Проверяет time group и не обрывает цепочку. Дальше обычно goto.',
    when: 'День/ночь, рабочие часы.',
    need: ['time_group'],
  },
  http_request: {
    title: 'HTTP-запрос',
    summary: 'Синхронный запрос с записью ответа в переменную, маршрут идёт дальше.',
    when: 'Нужен ответ внешней системы до следующего набора.',
    need: ['url'],
  },
  collect_input: {
    title: 'Сбор DTMF',
    summary: 'Пишет набранные цифры в переменную и продолжает цепочку.',
    when: 'Ввод добавочного, PIN, кода.',
    need: ['variable'],
  },
  hangup: {
    title: 'Завершить вызов',
    summary: 'Кладёт трубку. Терминальный шаг.',
    when: 'Явный конец после неответа или неверного ввода.',
    need: [],
  },
  directory_lookup: {
    title: 'Поиск в справочнике',
    summary: 'Ищет запись и кладёт поля в переменные, не набирает сам.',
    when: 'Перед totrunk/toexten по найденному номеру.',
    need: ['directory'],
  },
  callback: {
    title: 'Обратный звонок',
    summary: 'Ставит callback, только в маршруте, не в пункте IVR.',
    when: 'Заказ звонка из очереди. Host: route.',
    need: ['queue'],
  },
};

export function listDialplanAppCatalog(host?: DialplanHost): DialplanAppView[] {
  return (Object.keys(DIALPLAN_ACTION_META) as ActionType[])
    .filter((type) => !host || DIALPLAN_ACTION_META[type].allowedIn.includes(host))
    .map((type) => {
      const meta = DIALPLAN_ACTION_META[type];
      const copy = COPY[type];
      return {
        type,
        family: meta.family,
        terminal: meta.terminal,
        hosts: meta.allowedIn,
        title: copy.title,
        summary: copy.summary,
        when: copy.when,
        need: copy.need,
      };
    });
}

export function countDialplanAppUsage(
  routes: Array<{ actions?: unknown }>,
  ivrs: Array<{ menu_items?: unknown }>,
): Record<string, { routes: number; ivrs: number }> {
  const usage: Record<string, { routes: number; ivrs: number }> = {};
  const bump = (type: string, bucket: 'routes' | 'ivrs') => {
    if (!type) return;
    usage[type] ??= { routes: 0, ivrs: 0 };
    usage[type][bucket] += 1;
  };
  for (const route of routes) {
    for (const type of actionTypesOf(route.actions)) bump(type, 'routes');
  }
  for (const ivr of ivrs) {
    const items = Array.isArray(ivr.menu_items) ? ivr.menu_items : [];
    for (const item of items) {
      const rec = item && typeof item === 'object' ? item as { actions?: unknown } : {};
      for (const type of actionTypesOf(rec.actions)) bump(type, 'ivrs');
    }
  }
  return usage;
}

function actionTypesOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => (row && typeof row === 'object' ? String((row as { type?: unknown }).type ?? '') : ''))
    .filter(Boolean);
}
