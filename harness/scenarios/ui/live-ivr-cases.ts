import { hornsPrompt } from './horns-hooves';

export interface LiveIvrCase {
  id: string;
  title: string;
  name: string;
  prompt: string;
  card: RegExp[];
  expectQueue?: string;
  expectGroup?: boolean;
}

function stamp(): string {
  return `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

export function liveIvrCases(): LiveIvrCase[] {
  const s = stamp();
  const simple = `Простой офис ${s}`;
  const horns = `Рога и копыта ${s}`;
  const support = `Поддержка ${s}`;
  const service = `Сервис ${s}`;
  const mixed = `Смешанный ${s}`;
  const groupExten = `6${s.slice(-3)}`;
  const queueA = `8${s.slice(-3)}`;
  const queueB = `8${String((Number(s.slice(-3)) + 1) % 1000).padStart(3, '0')}`;

  return [
    {
      id: 'simple-hangup',
      title: 'simple IVR: two extensions, timeout hangup',
      name: simple,
      prompt: [
        `Создай IVR - ${simple}`,
        'текст: "Добро пожаловать в офис. Нажмите 1 или 2"',
        '1 - Абонент 101',
        '2 - 102',
        'таймаут - сброс вызова',
      ].join('\n'),
      card: [new RegExp(simple.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), /Добро пожаловать в офис/, /101|102/],
    },
    {
      id: 'group-timeout',
      title: 'classic: endpoints + ringall group + IVR',
      name: horns,
      prompt: hornsPrompt(horns, groupExten),
      card: [/Рога и копыта/, /Здравствуйте, вы позвонили в Рога и копыта/, /101|102|103/],
      expectGroup: true,
    },
    {
      id: 'queue-digit',
      title: 'IVR digit to a new queue',
      name: support,
      prompt: [
        `Создай IVR - ${support}`,
        'текст: "Нажмите 1 для сотрудника или 2 чтобы ждать в очереди"',
        '1 - Абонент 101',
        `2 - очередь ${support} ${queueA}`,
        'таймаут - hangup',
      ].join('\n'),
      card: [new RegExp(support.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), /очеред/i, /101/],
      expectQueue: support,
    },
    {
      id: 'dialplan-apps',
      title: 'voicemail + playback + invalid hangup',
      name: service,
      prompt: [
        `Создай IVR - ${service}`,
        'текст: "Сервисный отдел. 1 сотрудник, 2 почта, 3 объявление"',
        '1 - Абонент 101',
        '2 - голосовая почта 101',
        '3 - проиграть beep',
        'таймаут - hangup',
        'неверный ввод - сброс вызова',
      ].join('\n'),
      card: [new RegExp(service.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), /Сервисный отдел/, /101/],
    },
    {
      id: 'mixed-chain',
      title: 'extension + queue + group-then-hangup + invalid hangup',
      name: mixed,
      prompt: [
        `Создай IVR - ${mixed}`,
        'текст: "Смешанное меню. 1 сотрудник, 2 очередь, или оставайтесь на линии"',
        '1 - Абонент 101',
        `2 - очередь Продажи ${queueB}`,
        `таймаут - группа вызова номер группы ${groupExten} затем hangup`,
        'неверный ввод - сброс',
      ].join('\n'),
      card: [new RegExp(mixed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), /очеред|групп/i, /101/],
      expectQueue: 'Продажи',
      expectGroup: true,
    },
  ];
}
