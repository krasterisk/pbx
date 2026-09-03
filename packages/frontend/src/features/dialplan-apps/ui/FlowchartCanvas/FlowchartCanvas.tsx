import { memo, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';
import { AppWindow, CornerDownRight, PhoneIncoming, Printer } from 'lucide-react';
import { type ActionType, type IRouteAction } from '@krasterisk/shared';
import { Badge, Button, Text } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { dialplanAppsRegistry } from '../../model/registry';
import cls from './FlowchartCanvas.module.scss';

export type FlowchartHost = 'route' | 'ivr';

export interface FlowchartMenuItem {
  digit: string;
  actions: IRouteAction[];
}

export interface FlowchartCanvasProps {
  host?: FlowchartHost;
  actions?: IRouteAction[];
  menuItems?: FlowchartMenuItem[];
  title?: string;
  patterns?: string[];
  ivrTimeout?: string | null;
  ivrTimeoutResponse?: string | null;
  ivrTimeoutDigit?: string | null;
  ivrMaxCount?: number;
}

const JUMP_TYPES = new Set<ActionType>(['toivr', 'toroute', 'goto']);

export function hasActionCondition(action: IRouteAction | undefined): boolean {
  const condition = action?.condition;
  if (!condition) return false;
  if (condition.source) return true;
  if (typeof condition.time_group_uid === 'number') return true;
  if (condition.name || condition.device || condition.value) return true;
  if (Array.isArray(condition.dialstatus) && condition.dialstatus.length > 0) return true;
  return typeof condition.dialstatus === 'string' && condition.dialstatus.length > 0;
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));
}

const SPECIAL_DIGIT_ORDER: Record<string, number> = { t: 1, i: 2, max: 3 };

export function ivrDigitLabel(digit: string, t: (key: string, fallback?: string) => string): string {
  if (digit === 't') return t('routes.flowchart.edge.timeout', 'Не нажали кнопку');
  if (digit === 'i') return t('routes.flowchart.edge.invalid', 'Нажали неверную кнопку');
  if (digit === 'max') return t('routes.flowchart.edge.max', 'Исчерпаны проходы по меню');
  if (digit.length === 1) {
    return interpolate(t('routes.flowchart.edge.key', 'Кнопка {{digit}}'), { digit });
  }
  return interpolate(t('routes.flowchart.edge.pattern', 'Набор по шаблону {{pattern}}'), {
    pattern: digit,
  });
}

export function sortIvrMenuItems(items: FlowchartMenuItem[]): FlowchartMenuItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aSpecial = SPECIAL_DIGIT_ORDER[a.item.digit] ?? 0;
      const bSpecial = SPECIAL_DIGIT_ORDER[b.item.digit] ?? 0;
      if (aSpecial !== bSpecial) return aSpecial - bSpecial;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function FlowchartNode({
  action,
  index,
  t,
}: {
  action: IRouteAction;
  index: number;
  t: (key: string, fallback?: string) => string;
}) {
  const config = action.type ? dialplanAppsRegistry[action.type] : undefined;
  const title = config
    ? t(config.labelKey, action.type)
    : t('routes.flowchart.badge.unknown', 'Неизвестное действие');
  const summary = config?.summarize
    ? config.summarize(action.params ?? {}, t)
    : t(
        'routes.flowchart.error.incomplete',
        'Заполните обязательные параметры на вкладке "Действия"',
      );
  const terminal = config?.terminal;
  const enabled = (action as { enabled?: boolean }).enabled ?? true;
  const isJump = action.type ? JUMP_TYPES.has(action.type) : false;

  return (
    <div
      className={[
        cls.node,
        terminal === 'conditional' ? cls.nodeConditional : '',
      ].filter(Boolean).join(' ')}
      role="listitem"
      data-testid="flowchart-node"
      data-action-type={action.type || 'unknown'}
    >
      <div className={cls.stepNumber}>{index + 1}</div>
      <h3 className={cls.nodeTitle}>{title}</h3>
      <p className={cls.nodeSummary}>{summary}</p>
      <div className={cls.badges}>
        {!enabled && (
          <Badge variant="secondary">
            {t('routes.flowchart.badge.disabled', 'Выключен')}
          </Badge>
        )}
        {terminal === 'always' && (
          <Badge variant="outline">
            {t('routes.flowchart.badge.endsChain', 'Завершает цепочку')}
          </Badge>
        )}
        {terminal === 'conditional' && (
          <Badge variant="outline">
            {t('routes.flowchart.badge.mayExit', 'Может выйти из цепочки')}
          </Badge>
        )}
        {!config && (
          <Badge variant="destructive">
            {t('routes.flowchart.badge.unknown', 'Неизвестное действие')}
          </Badge>
        )}
      </div>
      {isJump && (
        <div className={cls.chip} data-testid="flowchart-jump-chip">
          <CornerDownRight size={14} aria-hidden />
          <span>{summary || title}</span>
          <InfoTooltip
            text={t(
              'routes.flowchart.chip.hint',
              'Звонок продолжится там, эта схема дальше не показывает',
            )}
          />
        </div>
      )}
    </div>
  );
}

function RouteCanvasBody({
  actions,
  title,
  patterns,
  t,
}: {
  actions: IRouteAction[];
  title?: string;
  patterns?: string[];
  t: (key: string, fallback?: string) => string;
}) {
  const mask = (patterns ?? []).filter(Boolean).join(', ');
  const incomingLabel = t('routes.flowchart.root.incoming', 'Входящий звонок');

  return (
    <div className={cls.grid}>
      <div className={cls.spineCell}>
        <div className={cls.node} role="listitem" data-testid="flowchart-root">
          <PhoneIncoming size={16} aria-hidden />
          <h3 className={cls.nodeTitle}>{incomingLabel}</h3>
          {mask && <p className={cls.nodeSummary}>{mask}</p>}
          {title && <p className={cls.nodeSummary}>{title}</p>}
        </div>
        <div className={cls.connector} aria-hidden>
          <span className={cls.edgeLabel}>
            {t('routes.flowchart.edge.next', 'Далее')}
          </span>
          <div className={cls.spineLine} />
        </div>
      </div>
      <div className={cls.gutter} />
      <div className={cls.branchCell} />

      {actions.map((action, index) => {
        const branched = hasActionCondition(action);
        const next = actions[index + 1];
        const nestedElse = next && hasActionCondition(next);
        return (
          <RouteActionRow
            key={action.id || `${action.type}-${index}`}
            action={action}
            index={index}
            branched={branched}
            next={next}
            nestedElse={Boolean(nestedElse)}
            isLast={index === actions.length - 1}
            t={t}
          />
        );
      })}
    </div>
  );
}

function RouteActionRow({
  action,
  index,
  branched,
  next,
  nestedElse,
  isLast,
  t,
}: {
  action: IRouteAction;
  index: number;
  branched: boolean;
  next?: IRouteAction;
  nestedElse: boolean;
  isLast: boolean;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <>
      <div className={cls.spineCell}>
        <div role="list">
          <FlowchartNode action={action} index={index} t={t} />
        </div>
        {!isLast && (
          <div className={cls.connector}>
            {branched && (
              <span className={cls.edgeLabel} data-testid="flowchart-edge-condition-met">
                {t('routes.flowchart.edge.conditionMet', 'Условие выполнено')}
              </span>
            )}
            {!branched && (
              <span className={cls.edgeLabel}>
                {t('routes.flowchart.edge.next', 'Далее')}
              </span>
            )}
            <div className={cls.spineLine} />
          </div>
        )}
      </div>
      <div className={cls.gutter} />
      <div className={cls.branchCell}>
        {branched && (
          <div className={cls.branchLane} data-testid="flowchart-branch-lane">
            <span className={cls.edgeLabel} data-testid="flowchart-edge-otherwise">
              {t('routes.flowchart.edge.otherwise', 'Иначе')}
            </span>
            {next && nestedElse && (
              <div className={cls.chip} data-testid="flowchart-nested-chip">
                <CornerDownRight size={14} aria-hidden />
                <span>
                  {t('routes.flowchart.chip.nested', 'Вложенная ветка')}
                </span>
                <InfoTooltip
                  text={t(
                    'routes.flowchart.chip.hint',
                    'Звонок продолжится там, эта схема дальше не показывает',
                  )}
                />
              </div>
            )}
            {next && !nestedElse && (
              <div className={cls.branchNode} data-testid="flowchart-else-preview">
                <Text variant="muted">
                  {dialplanAppsRegistry[next.type]
                    ? dialplanAppsRegistry[next.type].summarize(next.params ?? {}, t)
                    : next.type}
                </Text>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function IvrCanvasBody({
  title,
  menuItems,
  ivrTimeout,
  ivrTimeoutResponse,
  ivrTimeoutDigit,
  ivrMaxCount,
  t,
}: {
  title?: string;
  menuItems: FlowchartMenuItem[];
  ivrTimeout?: string | null;
  ivrTimeoutResponse?: string | null;
  ivrTimeoutDigit?: string | null;
  ivrMaxCount?: number;
  t: (key: string, fallback?: string) => string;
}) {
  const sorted = sortIvrMenuItems(menuItems);
  const hasMaxItem = menuItems.some((item) => item.digit === 'max');
  const showMaxFallback = (ivrMaxCount ?? 0) > 0 && !hasMaxItem;
  const rootTitle = interpolate(
    t('routes.flowchart.root.ivr', 'Меню IVR "{{name}}"'),
    { name: title || '' },
  );

  return (
    <div className={cls.ivrTree} data-testid="flowchart-ivr-tree">
      <div className={cls.node} role="listitem" data-testid="flowchart-root">
        <AppWindow size={16} aria-hidden />
        <h3 className={cls.nodeTitle}>{rootTitle}</h3>
        <p className={cls.nodeSummary}>
          {[
            ivrTimeout && `Wait ${ivrTimeout}`,
            ivrTimeoutResponse && `Resp ${ivrTimeoutResponse}`,
            ivrTimeoutDigit && `Digit ${ivrTimeoutDigit}`,
            (ivrMaxCount ?? 0) > 0 && `max ${ivrMaxCount}`,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
      {sorted.map((item) => (
        <div
          key={item.digit}
          className={cls.ivrBranch}
          data-testid="flowchart-ivr-branch"
          data-digit={item.digit}
        >
          <span className={cls.edgeLabel} data-testid="flowchart-ivr-edge">
            {ivrDigitLabel(item.digit, t)}
          </span>
          {item.actions.map((action, index) => (
            <FlowchartNode
              key={action.id || `${item.digit}-${index}`}
              action={action}
              index={index}
              t={t}
            />
          ))}
        </div>
      ))}
      {showMaxFallback && (
        <div
          className={cls.ivrBranch}
          data-testid="flowchart-ivr-max-fallback"
          data-digit="max"
        >
          <span className={cls.edgeLabel}>{ivrDigitLabel('max', t)}</span>
          <div className={cls.node} role="listitem">
            <h3 className={cls.nodeTitle}>{ivrDigitLabel('max', t)}</h3>
            <p className={cls.nodeSummary}>
              {t('routes.flowchart.badge.endsChain', 'Завершает цепочку')}
            </p>
            <div className={cls.badges}>
              <Badge variant="outline">
                {t('routes.flowchart.badge.endsChain', 'Завершает цепочку')}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const FlowchartCanvas = memo(function FlowchartCanvas({
  host = 'route',
  actions = [],
  menuItems = [],
  title,
  patterns,
  ivrTimeout,
  ivrTimeoutResponse,
  ivrTimeoutDigit,
  ivrMaxCount,
}: FlowchartCanvasProps) {
  const { t } = useTranslation();
  const figureRef = useRef<HTMLFigureElement>(null);
  const isIvr = host === 'ivr';
  const count = isIvr
    ? menuItems.reduce((sum, item) => sum + (item.actions?.length ?? 0), 0)
    : actions.length;
  const empty = isIvr ? menuItems.length === 0 : actions.length === 0;

  const printTitle = useMemo(() => {
    const template = isIvr
      ? t('routes.flowchart.printTitleIvr', 'Схема меню IVR "{{name}}"')
      : t('routes.flowchart.printTitle', 'Схема маршрута "{{name}}"');
    return interpolate(template, { name: title || '' });
  }, [isIvr, t, title]);

  const handlePrint = useReactToPrint({
    contentRef: figureRef,
    documentTitle: printTitle,
  });

  return (
    <div className={cls.wrap}>
      <div className={`${cls.toolbar} ${cls.printHidden}`} data-testid="flowchart-toolbar">
        <span className={cls.counter} data-testid="flowchart-counter">
          {interpolate(t('routes.flowchart.counter', 'Действий: {{count}}'), { count })}
        </span>
        <div className={cls.printGroup}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cls.printButton}
            onClick={() => handlePrint()}
            data-testid="flowchart-print"
          >
            <Printer size={16} aria-hidden />
            {t('routes.flowchart.print', 'Печать')}
          </Button>
          <InfoTooltip
            text={t(
              'routes.flowchart.printHint',
              'В окне печати выберите "Сохранить как PDF", чтобы получить файл',
            )}
          />
        </div>
      </div>
      <figure
        ref={figureRef}
        className={cls.canvas}
        data-testid="flowchart-canvas"
        data-host={host}
      >
        <figcaption className={cls.caption}>{printTitle}</figcaption>
        {empty ? (
          <div className={cls.empty} data-testid="flowchart-empty">
            <p className={cls.emptyTitle}>
              {isIvr
                ? t('routes.flowchart.empty.ivrHeading', 'В меню нет пунктов')
                : t('routes.flowchart.empty.heading', 'В маршруте нет действий')}
            </p>
            <p className={cls.emptyBody}>
              {isIvr
                ? t(
                    'routes.flowchart.empty.ivrBody',
                    'Добавьте пункты меню на вкладке "Пункты", и схема появится здесь',
                  )
                : t(
                    'routes.flowchart.empty.body',
                    'Добавьте действия на вкладке "Действия", и схема появится здесь',
                  )}
            </p>
          </div>
        ) : (
          <div role="list">
            {!isIvr && (
              <RouteCanvasBody actions={actions} title={title} patterns={patterns} t={t} />
            )}
            {isIvr && (
              <IvrCanvasBody
                title={title}
                menuItems={menuItems}
                ivrTimeout={ivrTimeout}
                ivrTimeoutResponse={ivrTimeoutResponse}
                ivrTimeoutDigit={ivrTimeoutDigit}
                ivrMaxCount={ivrMaxCount}
                t={t}
              />
            )}
          </div>
        )}
      </figure>
    </div>
  );
});

FlowchartCanvas.displayName = 'FlowchartCanvas';
