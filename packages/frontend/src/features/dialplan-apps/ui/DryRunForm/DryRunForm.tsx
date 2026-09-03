import { memo, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, ChevronRight as CrumbSep, ExternalLink } from 'lucide-react';
import {
  DIALSTATUS_VALUES,
  QUEUESTATUS_VALUES,
  RECORD_STATUS_VALUES,
  type IRouteAction,
  type WalkOutcome,
} from '@krasterisk/shared';
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Loader,
  SegmentedControl,
  Select,
} from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import {
  usePostDryRunMutation,
  type IDryRunReask,
  type IDryRunResult,
} from '@/shared/api/endpoints/dryRunApi';
import type { FlowchartMenuItem } from '../FlowchartCanvas/FlowchartCanvas';
import { collectConditionSources, type DryRunSourceControl } from './collectConditionSources';
import cls from './DryRunForm.module.scss';

const DIAL_LABELS: Record<string, string> = {
  CHANUNAVAIL: 'Недоступен',
  CONGESTION: 'Перегрузка',
  BUSY: 'Занято',
  NOANSWER: 'Не отвечает',
  ANSWER: 'Ответили',
  CANCEL: 'Отмена',
  DONTCALL: 'Не звонить',
  TORTURE: 'Torture',
  INVALIDARGS: 'Неверные аргументы',
};

const QUEUE_LABELS: Record<string, string> = {
  TIMEOUT: 'Таймаут очереди',
  FULL: 'Очередь переполнена',
  JOINEMPTY: 'Нет операторов при входе',
  LEAVEEMPTY: 'Не осталось операторов',
  CONTINUE: 'Продолжить',
};

const RECORD_LABELS: Record<string, string> = {
  DTMF: 'Нажата #',
  SILENCE: 'Тишина',
  SKIP: 'Пропуск',
  TIMEOUT: 'Таймаут записи',
  HANGUP: 'Абонент повесил трубку',
  ERROR: 'Ошибка записи',
  OPERATOR: 'Оператор (0)',
};

const DEVICE_PRESETS = [
  { value: 'UNAVAILABLE', labelKey: 'routes.dryRun.preset.deviceOffline', fallback: 'Абонент не в сети' },
  { value: 'NOT_INUSE', labelKey: 'routes.dryRun.preset.deviceFree', fallback: 'Абонент свободен' },
  { value: 'BUSY', labelKey: 'routes.dryRun.preset.deviceBusy', fallback: 'Абонент занят' },
] as const;

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));
}

export function outcomeTone(kind: WalkOutcome['kind'] | undefined): 'success' | 'warning' | 'destructive' | 'neutral' {
  if (kind === 'callback_requested' || kind === 'terminal') return 'success';
  if (kind === 'congestion' || kind === 'incomplete' || kind === 'addressed' || kind === 'stub') {
    return 'warning';
  }
  return 'neutral';
}

export function outcomeCopy(
  result: IDryRunResult,
  t: (key: string, fallback?: string) => string,
): { title: string; body?: string } {
  const kind = result.outcome.kind;
  if (kind === 'callback_requested') {
    return {
      title: t('routes.dryRun.outcome.callback', 'Итог: абонент заказал обратный звонок'),
    };
  }
  if (kind === 'congestion') {
    return {
      title: interpolate(
        t('routes.dryRun.walk.hopLimit', 'Итог: исчерпан предел переходов, {{limit}}'),
        { limit: result.hopLimit },
      ),
      body: t('routes.dryRun.walk.congestionHear', 'Абонент услышит короткие гудки'),
    };
  }
  if (kind === 'terminal') {
    const type = result.outcome.actionType;
    if (type === 'toqueue') {
      return { title: t('routes.dryRun.outcome.queue', 'Итог: звонок ушёл в очередь "{{name}}"') };
    }
    if (type === 'togroup') {
      return { title: t('routes.dryRun.outcome.group', 'Итог: звонок ушёл на группу "{{name}}"') };
    }
    if (type === 'toexten') {
      return { title: t('routes.dryRun.outcome.exten', 'Итог: звонок ушёл на внутренний номер {{number}}') };
    }
    if (type === 'totrunk') {
      return { title: t('routes.dryRun.outcome.trunk', 'Итог: звонок ушёл на транк "{{name}}", дальше он вне АТС') };
    }
    if (type === 'voicemail') {
      return { title: t('routes.dryRun.outcome.voicemail', 'Итог: звонок ушёл в голосовую почту') };
    }
    return { title: t('routes.dryRun.outcome.ended', 'Итог: звонок завершён') };
  }
  if (kind === 'addressed') {
    if (result.outcome.reason === 'inactive') {
      return {
        title: t('routes.dryRun.walk.targetDisabled', 'Итог: цель перехода выключена'),
        body: result.outcome.message,
      };
    }
    if (result.outcome.message === 'Цель перехода не найдена') {
      return {
        title: t('routes.dryRun.walk.targetMissing', 'Итог: цель перехода не найдена'),
        body: result.outcome.message,
      };
    }
    return {
      title: t('routes.dryRun.outcome.addressed', 'Итог: звонок ушёл на адрес {{context}},{{extension}}'),
      body: result.outcome.message,
    };
  }
  if (kind === 'incomplete' || kind === 'stub') {
    return { title: t('routes.dryRun.walk.cannotCheck', 'Итог: дальше не проверить') };
  }
  return { title: t('routes.dryRun.outcome.ended', 'Итог: звонок завершён') };
}

function toWalkActions(actions: IRouteAction[]) {
  return actions.map((action) => ({
    id: action.id,
    type: action.type,
    params: (action.params ?? {}) as Record<string, unknown>,
    condition: action.condition,
  }));
}

const EMPTY_ACTIONS: IRouteAction[] = [];
const EMPTY_MENU: FlowchartMenuItem[] = [];

export interface DryRunFormProps {
  host: 'route' | 'ivr';
  actions?: IRouteAction[];
  menuItems?: FlowchartMenuItem[];
  maxCount?: number;
  entityName?: string;
  onResultChange?: (result: IDryRunResult | null) => void;
}

export const DryRunForm = memo(function DryRunForm({
  host,
  actions = EMPTY_ACTIONS,
  menuItems = EMPTY_MENU,
  maxCount = 0,
  entityName,
  onResultChange,
}: DryRunFormProps) {
  const { t } = useTranslation();
  const bodyId = useId();
  const reaskRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [callerNumber, setCallerNumber] = useState('');
  const [scenario, setScenario] = useState<Record<string, string>>({});
  const [ivrChoice, setIvrChoice] = useState('');
  const [ivrPass, setIvrPass] = useState('1');
  const [result, setResult] = useState<IDryRunResult | null>(null);
  const [reask, setReask] = useState<IDryRunReask | null>(null);
  const [reaskValue, setReaskValue] = useState('');
  const [postDryRun, { isLoading, isError }] = usePostDryRunMutation();

  const sources = useMemo(() => {
    if (host === 'ivr') {
      return collectConditionSources(menuItems.flatMap((item) => item.actions ?? []));
    }
    return collectConditionSources(actions);
  }, [actions, host, menuItems]);

  const ivrOptions = useMemo(() => {
    if (host !== 'ivr') return [];
    const digits = menuItems.map((item) => item.digit).filter((digit) => digit !== 't' && digit !== 'i' && digit !== 'max');
    const options = digits.map((digit) => ({
      value: digit,
      label:
        digit.length === 1
          ? interpolate(t('routes.dryRun.ivr.pressedKey', 'Нажал кнопку {{digit}}'), { digit })
          : interpolate(t('routes.dryRun.ivr.pressedPattern', 'Набрал номер по шаблону {{pattern}}'), {
              pattern: digit,
            }),
    }));
    options.push({
      value: 't',
      label: t('routes.dryRun.ivr.pressedNothing', 'Ничего не нажал'),
    });
    options.push({
      value: 'i',
      label: t('routes.dryRun.ivr.pressedUnknown', 'Нажал кнопку, которой нет в меню'),
    });
    return options;
  }, [host, menuItems, t]);

  const ivrEmpty = host === 'ivr' && menuItems.length === 0;
  const reaskBlocking = Boolean(reask && !reaskValue);

  const onResultChangeRef = useRef(onResultChange);
  onResultChangeRef.current = onResultChange;

  useEffect(() => {
    setResult(null);
    setReask(null);
    setReaskValue('');
    onResultChangeRef.current?.(null);
  }, [actions, menuItems]);

  useEffect(() => {
    if (reask && reaskRef.current) {
      reaskRef.current.focus();
    }
  }, [reask]);

  const applyResult = (next: IDryRunResult | null) => {
    setResult(next);
    onResultChange?.(next);
  };

  const handleRun = async () => {
    const mergedScenario = { ...scenario };
    if (reask && reaskValue) {
      mergedScenario[reask.source] = reaskValue;
    }

    try {
      const resolvedIvrChoice =
        host === 'ivr' && maxCount > 0 && Number(ivrPass) >= maxCount ? 'max' : ivrChoice;

      const payload = await postDryRun({
        host,
        callerNumber: callerNumber || undefined,
        scenario: mergedScenario,
        ...(host === 'route'
          ? { actions: toWalkActions(actions) }
          : {
              menu_items: menuItems.map((item) => ({
                digit: item.digit,
                actions: toWalkActions(item.actions ?? []),
              })),
              ivrChoice: resolvedIvrChoice || undefined,
            }),
      }).unwrap();

      setScenario(mergedScenario);
      if (payload.reask) {
        setReask(payload.reask);
        setReaskValue('');
      } else {
        setReask(null);
        setReaskValue('');
      }
      applyResult(payload);
    } catch {
      applyResult(null);
    }
  };

  const handleClear = () => {
    applyResult(null);
    setReask(null);
    setReaskValue('');
  };

  const copy = result ? outcomeCopy(result, t) : null;
  const tone = result ? outcomeTone(result.outcome.kind) : 'neutral';
  const showPass = host === 'ivr' && maxCount > 0;

  return (
    <div className={cls.form} data-testid="dry-run-form">
      <div className={cls.toggleRow}>
        <button
          type="button"
          className={cls.toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          data-testid="dry-run-toggle"
        >
          {open ? (
            <ChevronDown className={cls.toggleIcon} size={16} aria-hidden />
          ) : (
            <ChevronRight className={cls.toggleIcon} size={16} aria-hidden />
          )}
          <span className={cls.toggleLabel}>
            {host === 'ivr'
              ? t('routes.dryRun.ivr.title', 'Проверить меню')
              : t('routes.dryRun.title', 'Проверить маршрут')}
          </span>
        </button>
        <InfoTooltip
          text={
            host === 'ivr'
              ? t('routes.dryRun.ivr.hint', 'Прогон считается по вашему меню, звонка не будет')
              : t('routes.dryRun.hint', 'Прогон считается по вашей цепочке, звонка не будет')
          }
        />
      </div>

      {open && (
        <div id={bodyId} className={cls.body} data-testid="dry-run-body">
          <div className={cls.field}>
            <Label className={cls.fieldLabel} htmlFor="dry-run-caller">
              {t('routes.dryRun.callerNumber', 'Номер звонящего')}
            </Label>
            <Input
              id="dry-run-caller"
              className={cls.mono}
              inputMode="tel"
              value={callerNumber}
              onChange={(event) => setCallerNumber(event.target.value)}
              placeholder={t('routes.dryRun.callerPlaceholder', 'Например, 79001234567')}
              data-testid="dry-run-caller"
            />
          </div>

          {host === 'ivr' ? (
            ivrEmpty ? (
              <div data-testid="dry-run-ivr-empty">
                <p className={cls.hint}>{t('routes.dryRun.ivr.empty', 'В меню нет пунктов')}</p>
                <p className={cls.hint}>
                  {t(
                    'routes.dryRun.ivr.emptyBody',
                    'Добавьте пункт меню на вкладке "Пункты", и меню можно будет прогнать',
                  )}
                </p>
              </div>
            ) : (
              <div className={cls.field}>
                <Label className={cls.fieldLabel} htmlFor="dry-run-ivr-choice">
                  {t('routes.dryRun.ivr.whatCallerDid', 'Что сделал абонент')}
                </Label>
                <p className={cls.hint}>
                  {t('routes.dryRun.ivr.whatCallerDidHint', 'Выберите один из пунктов, которые есть в меню')}
                </p>
                <Select
                  id="dry-run-ivr-choice"
                  value={ivrChoice}
                  onChange={(event) => setIvrChoice(event.target.value)}
                  data-testid="dry-run-ivr-choice"
                >
                  <option value="">{t('routes.dryRun.ivr.chooseItem', 'Выберите пункт')}</option>
                  {ivrOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {showPass && (
                  <div className={cls.field}>
                    <Label className={cls.fieldLabel} htmlFor="dry-run-ivr-pass">
                      {t('routes.dryRun.ivr.pass', 'Какой это проход по меню')}
                    </Label>
                    <Input
                      id="dry-run-ivr-pass"
                      type="number"
                      min={1}
                      max={maxCount}
                      value={ivrPass}
                      onChange={(event) => setIvrPass(event.target.value)}
                      data-testid="dry-run-ivr-pass"
                    />
                    <p className={cls.hint}>
                      {interpolate(
                        t(
                          'routes.dryRun.ivr.passHint',
                          'Меню повторяется до {{max}} раз, после этого звонок уходит по ветке "Исчерпаны проходы"',
                        ),
                        { max: maxCount },
                      )}
                    </p>
                  </div>
                )}
              </div>
            )
          ) : sources.length === 0 ? (
            <div data-testid="dry-run-no-checks">
              <p className={cls.hint}>{t('routes.dryRun.emptyChecks', 'В цепочке нет проверок')}</p>
              <p className={cls.hint}>
                {t(
                  'routes.dryRun.emptyChecksBody',
                  'Все действия выполнятся подряд, достаточно указать номер',
                )}
              </p>
            </div>
          ) : (
            <div className={cls.field} data-testid="dry-run-scenario">
              <p className={cls.fieldLabel}>{t('routes.dryRun.scenarioTitle', 'Что произошло в звонке')}</p>
              <p className={cls.hint}>
                {t(
                  'routes.dryRun.scenarioHint',
                  'Выберите исход для каждой проверки, которая есть в цепочке',
                )}
              </p>
              {sources.map((source) => (
                <SourceControl
                  key={`${source.kind}:${source.name ?? source.device ?? ''}`}
                  source={source}
                  value={scenario[source.kind] ?? ''}
                  onChange={(value) =>
                    setScenario((prev) => ({ ...prev, [source.kind]: value }))
                  }
                  t={t}
                />
              ))}
            </div>
          )}

          {reask && (
            <div className={cls.field} data-testid="dry-run-reask">
              <Label className={cls.fieldLabel} htmlFor="dry-run-reask-input">
                {reask.label || reask.source}
                <Badge variant="outline" className={cls.reaskBadge}>
                  {t('routes.dryRun.walk.askedAfterRun', 'спросили после прогона')}
                </Badge>
              </Label>
              <ReaskControl
                reask={reask}
                value={reaskValue}
                onChange={setReaskValue}
                inputRef={reaskRef}
                t={t}
              />
            </div>
          )}

          <div className={cls.actions}>
            <Button
              type="button"
              onClick={() => void handleRun()}
              disabled={isLoading || ivrEmpty || reaskBlocking}
              data-testid="dry-run-run"
            >
              {isLoading && <Loader size={16} />}
              {isLoading
                ? t('routes.dryRun.loading', 'Считаем прогон')
                : t('routes.dryRun.run', 'Прогнать сценарий')}
            </Button>
            {result && (
              <Button type="button" variant="ghost" onClick={handleClear} data-testid="dry-run-clear">
                {t('routes.dryRun.clear', 'Сбросить прогон')}
              </Button>
            )}
          </div>

          {isError && (
            <p className={cls.hint} data-testid="dry-run-error">
              {t('routes.dryRun.error', 'Не удалось прогнать сценарий, попробуйте ещё раз')}
            </p>
          )}

          {copy && result && (
            <div
              className={[
                cls.outcome,
                tone === 'success' ? cls.outcomeSuccess : '',
                tone === 'warning' ? cls.outcomeWarning : '',
                tone === 'destructive' ? cls.outcomeDestructive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-live="polite"
              data-testid="dry-run-outcome"
            >
              <p className={cls.outcomeTitle}>{copy.title}</p>
              {copy.body && <p className={cls.outcomeBody}>{copy.body}</p>}
            </div>
          )}

          {result && (
            <ResultTrail
              result={result}
              host={host}
              entityName={entityName}
              callerNumber={callerNumber}
              scenario={scenario}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
});

DryRunForm.displayName = 'DryRunForm';

function SourceControl({
  source,
  value,
  onChange,
  t,
}: {
  source: DryRunSourceControl;
  value: string;
  onChange: (value: string) => void;
  t: (key: string, fallback?: string) => string;
}) {
  if (source.kind === 'schedule') {
    return (
      <div className={cls.field} data-testid="dry-run-source-schedule">
        <SegmentedControl
          ariaLabel={t('routes.dryRun.preset.schedule', 'Расписание')}
          value={(value || 'inside') as 'inside' | 'outside'}
          onChange={onChange}
          options={[
            {
              value: 'inside',
              label: t('routes.dryRun.preset.scheduleIn', 'Время попадает в расписание'),
            },
            {
              value: 'outside',
              label: t('routes.dryRun.preset.scheduleOut', 'Время не попадает в расписание'),
            },
          ]}
        />
      </div>
    );
  }

  if (source.kind === 'variable' || source.kind === 'http_result') {
    const label =
      source.kind === 'http_result'
        ? t('routes.dryRun.preset.http', 'Результат HTTP-запроса')
        : interpolate(t('routes.dryRun.preset.variable', 'Значение переменной "{{name}}"'), {
            name: source.name || '',
          });
    return (
      <div className={cls.field}>
        <Label className={cls.fieldLabel}>{label}</Label>
        <Input
          className={cls.mono}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          data-testid={`dry-run-source-${source.kind}`}
        />
      </div>
    );
  }

  const options = presetOptions(source, t);
  return (
    <div className={cls.field}>
      <Label className={cls.fieldLabel} htmlFor={`dry-run-source-${source.kind}`}>
        {sourceLabel(source, t)}
      </Label>
      <Select
        id={`dry-run-source-${source.kind}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-testid={`dry-run-source-${source.kind}`}
      >
        <option value="">{t('routes.dryRun.choosePreset', 'Выберите исход')}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ReaskControl({
  reask,
  value,
  onChange,
  inputRef,
  t,
}: {
  reask: IDryRunReask;
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLSelectElement | HTMLInputElement | null>;
  t: (key: string, fallback?: string) => string;
}) {
  const source: DryRunSourceControl = { kind: reask.source as DryRunSourceControl['kind'] };
  if (source.kind === 'variable' || source.kind === 'http_result') {
    return (
      <Input
        id="dry-run-reask-input"
        ref={inputRef as RefObject<HTMLInputElement>}
        className={cls.mono}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-testid="dry-run-reask-input"
      />
    );
  }
  if (source.kind === 'schedule') {
    return (
      <SegmentedControl
        ariaLabel={t('routes.dryRun.preset.schedule', 'Расписание')}
        value={(value || 'inside') as 'inside' | 'outside'}
        onChange={onChange}
        options={[
          { value: 'inside', label: t('routes.dryRun.preset.scheduleIn', 'Время попадает в расписание') },
          { value: 'outside', label: t('routes.dryRun.preset.scheduleOut', 'Время не попадает в расписание') },
        ]}
      />
    );
  }
  const options = presetOptions(source, t);
  return (
    <Select
      id="dry-run-reask-input"
      ref={inputRef as RefObject<HTMLSelectElement>}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      data-testid="dry-run-reask-input"
    >
      <option value="">{t('routes.dryRun.choosePreset', 'Выберите исход')}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

function sourceLabel(source: DryRunSourceControl, t: (key: string, fallback?: string) => string): string {
  if (source.kind === 'dialstatus') return t('routes.chain.conditions.statusLabel', 'Результат предыдущего шага');
  if (source.kind === 'queuestatus') return t('routes.chain.conditions.queue.group', 'Очередь');
  if (source.kind === 'record_status') return t('routes.chain.conditions.record.group', 'Запись сообщения');
  if (source.kind === 'device_state') {
    return source.device
      ? interpolate(t('routes.dryRun.preset.deviceNamed', 'Состояние {{device}}'), { device: source.device })
      : t('routes.dryRun.preset.device', 'Состояние устройства');
  }
  return source.kind;
}

function presetOptions(
  source: DryRunSourceControl,
  t: (key: string, fallback?: string) => string,
): { value: string; label: string }[] {
  if (source.kind === 'dialstatus') {
    return DIALSTATUS_VALUES.filter((value) =>
      ['ANSWER', 'NOANSWER', 'BUSY', 'CHANUNAVAIL'].includes(value),
    ).map((value) => ({
      value,
      label: t(`routes.chain.conditions.dial.${value.toLowerCase()}`, DIAL_LABELS[value] ?? value),
    }));
  }
  if (source.kind === 'queuestatus') {
    return QUEUESTATUS_VALUES.map((value) => ({
      value,
      label: t(`routes.chain.conditions.queue.${value.toLowerCase()}`, QUEUE_LABELS[value] ?? value),
    }));
  }
  if (source.kind === 'record_status') {
    return RECORD_STATUS_VALUES.map((value) => ({
      value,
      label: t(`routes.chain.conditions.record.${value.toLowerCase()}`, RECORD_LABELS[value] ?? value),
    }));
  }
  if (source.kind === 'device_state') {
    return DEVICE_PRESETS.map((preset) => ({
      value: preset.value,
      label: t(preset.labelKey, preset.fallback),
    }));
  }
  return [];
}

function ResultTrail({
  result,
  host,
  entityName,
  callerNumber,
  scenario,
  t,
}: {
  result: IDryRunResult;
  host: 'route' | 'ivr';
  entityName?: string;
  callerNumber: string;
  scenario: Record<string, string>;
  t: (key: string, fallback?: string) => string;
}) {
  const multi = result.segments.length > 1 || result.breadcrumbs.length > 1;
  const hopExceeded = result.outcome.kind === 'congestion';

  const scrollTo = (index: number) => {
    document.getElementById(`dry-run-segment-${index}`)?.scrollIntoView({ block: 'start' });
  };

  return (
    <div className={cls.pathHeader} data-testid="dry-run-path">
      <h3 className={cls.pathTitle}>{t('routes.dryRun.pathTitle', 'Путь звонка')}</h3>
      <div className={cls.presets}>
        {callerNumber && <Badge variant="outline">{callerNumber}</Badge>}
        {Object.entries(scenario).map(([key, value]) => (
          <Badge key={key} variant="outline">
            {value}
          </Badge>
        ))}
      </div>

      {multi && (
        <nav className={cls.breadcrumbs} aria-label={t('routes.dryRun.walk.crumbs', 'Путь по сущностям')} data-testid="dry-run-breadcrumbs">
          <span className={cls.hint}>
            {interpolate(t('routes.dryRun.walk.hops', 'Переходов: {{n}} из {{limit}}'), {
              n: result.hopsUsed,
              limit: result.hopLimit,
            })}
          </span>
          {result.breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.entityKind}-${index}`} className={cls.crumbBtn}>
              {index > 0 && <CrumbSep size={14} aria-hidden />}
              <button type="button" className={cls.crumbBtn} onClick={() => scrollTo(index)}>
                <Badge variant={index === 0 ? 'secondary' : 'outline'}>
                  {crumb.entityName || crumb.entityKind}
                </Badge>
              </button>
              {crumb.loop && <Badge variant="outline">{t('routes.dryRun.walk.loop', 'Петля')}</Badge>}
              {crumb.repeatCount && crumb.repeatCount > 1 && (
                <Badge variant="outline">
                  {interpolate(t('routes.dryRun.walk.visited', 'Пройдено раз: {{count}}'), {
                    count: crumb.repeatCount,
                  })}
                </Badge>
              )}
            </span>
          ))}
        </nav>
      )}

      {hopExceeded && (
        <Card className={cls.outcomeWarning} data-testid="dry-run-hop-limit">
          <p className={cls.outcomeTitle}>
            {interpolate(
              t('routes.dryRun.walk.hopLimit', 'Итог: исчерпан предел переходов, {{limit}}'),
              { limit: result.hopLimit },
            )}
          </p>
          <p className={cls.outcomeBody}>
            {t('routes.dryRun.walk.congestionHear', 'Абонент услышит короткие гудки')}
          </p>
        </Card>
      )}

      {multi && (
        <div className={cls.segments} data-testid="dry-run-segments">
          {result.segments.map((segment, index) => (
            <Card
              key={`${segment.entityKind}-${segment.index}`}
              id={`dry-run-segment-${index}`}
              className={`${cls.segment} ${index > 0 ? cls.segmentForeign : ''}`}
              data-testid="dry-run-segment"
            >
              <div className={cls.segmentHeader}>
                <h4 className={cls.segmentTitle}>
                  {segment.entityName || (segment.entityKind === 'ivr' ? 'IVR' : entityName) || host}
                </h4>
                <Badge variant={index === 0 ? 'secondary' : 'outline'}>
                  {index === 0
                    ? t('routes.dryRun.walk.hostBadge', 'Открыто сейчас')
                    : t('routes.dryRun.walk.foreignBadge', 'Другая сущность, только просмотр')}
                </Badge>
                {index > 0 && (
                  <a
                    href={segment.entityKind === 'ivr' ? '/ivrs' : '/routes'}
                    target="_blank"
                    rel="noreferrer"
                    className={cls.hint}
                  >
                    <ExternalLink size={14} aria-hidden />
                    {t('routes.dryRun.walk.openTab', 'Открыть в новой вкладке')}
                  </a>
                )}
              </div>
              <div className={cls.presets} style={{ padding: '12px 16px' }}>
                {segment.nodes.map((node) => (
                  <Badge key={`${node.actionId}-${node.order}`} variant="default">
                    {node.order}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
