import type { IRoute } from '@krasterisk/shared';
import type { RouteReference } from '@/shared/api/endpoints/routeReferencesApi';

type TFn = (key: string, fallback: string, options?: Record<string, unknown>) => string;

export interface UsageReferenceView {
  title: string;
  subtitle?: string;
  location: string;
  href: string;
  disabled: boolean;
  host: 'route' | 'ivr' | 'binding';
}

export function actionTypeLabel(type: string | undefined, t: TFn): string {
  const raw = String(type ?? '').trim();
  if (!raw) return '';
  const label = t(`routes.action.${raw}`, raw);
  return label && label !== `routes.action.${raw}` ? label : raw;
}

export function formatIvrMenuDigit(digit: string | undefined, t: TFn): string {
  const value = String(digit ?? '').trim();
  if (!value) return '';
  if (value === 't') return t('routes.flowchart.edge.timeout', 'Не нажали кнопку');
  if (value === 'i') return t('routes.flowchart.edge.invalid', 'Нажали неверную кнопку');
  if (value === 'max') return t('routes.flowchart.edge.max', 'Исчерпаны проходы по меню');
  if (value.length === 1) {
    return t('routes.flowchart.edge.key', 'Кнопка {{digit}}', { digit: value });
  }
  return t('routes.flowchart.edge.pattern', 'Набор по шаблону {{pattern}}', { pattern: value });
}

function interpolate(template: string, options?: Record<string, unknown>): string {
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''));
}

function resolveHost(ref: RouteReference): UsageReferenceView['host'] {
  if (ref.host === 'ivr' || ref.host === 'binding' || ref.host === 'route') return ref.host;
  if (/binding/i.test(ref.location)) return 'binding';
  if (/^IVR\s/i.test(ref.location)) return 'ivr';
  return 'route';
}

function formatActionStep(
  ref: RouteReference,
  route: IRoute | undefined,
  t: TFn,
): string {
  const actions = route?.actions ?? [];
  const matchedIndex = actions.findIndex((action) => action.id === ref.actionOrBindingId);
  const matched = matchedIndex >= 0 ? actions[matchedIndex] : undefined;
  const index = ref.actionIndex
    ?? (matchedIndex >= 0 ? matchedIndex + 1 : undefined);
  const type = actionTypeLabel(ref.actionType ?? matched?.type, t);

  if (index != null && type) {
    return interpolate(t('references.locationAction', 'Действие {{index}} — {{type}}', { index, type }), {
      index,
      type,
    });
  }
  if (type) {
    return interpolate(t('references.locationActionType', '{{type}}', { type }), { type });
  }
  if (index != null) {
    return interpolate(t('references.locationActionIndex', 'Действие {{index}}', { index }), { index });
  }
  return '';
}

export function formatReferenceLocation(
  ref: RouteReference,
  route: IRoute | undefined,
  t: TFn,
): string {
  const host = resolveHost(ref);
  if (host === 'binding' && !ref.actionType) {
    return t('references.locationBinding', 'Справочники маршрута');
  }

  const step = formatActionStep(ref, route, t);
  if (host === 'ivr') {
    const digit = formatIvrMenuDigit(ref.menuDigit, t);
    if (digit && step) {
      return interpolate(
        t('references.locationIvrAction', '{{digit}} · {{step}}', { digit, step }),
        { digit, step },
      );
    }
    return digit || step || t('references.locationIvr', 'Пункт меню IVR');
  }

  return step || t('references.locationActionUnknown', 'Действие в маршруте');
}

export function describeUsageReference(
  ref: RouteReference,
  route: IRoute | undefined,
  t: TFn,
): UsageReferenceView {
  const host = resolveHost(ref);
  const location = formatReferenceLocation(ref, route, t);

  if (host === 'ivr') {
    const name = ref.ivrName?.trim() || (ref.ivrUid != null ? `#${ref.ivrUid}` : t('references.ivrFallback', 'IVR'));
    return {
      title: interpolate(t('references.ivrTitle', 'IVR «{{name}}»', { name }), { name }),
      location,
      href: '/ivrs',
      disabled: false,
      host,
    };
  }

  const name = ref.routeName?.trim() || route?.name?.trim() || `#${ref.routeUid}`;
  const extensions = (ref.extensions?.length ? ref.extensions : route?.extensions ?? [])
    .map((item) => String(item).trim())
    .filter(Boolean);
  const disabled = (ref.routeActive ?? route?.active) === 0;

  return {
    title: interpolate(t('references.routeTitle', 'Маршрут «{{name}}»', { name }), { name }),
    subtitle: extensions.length
      ? interpolate(
          t('references.routeExtensions', 'Номера: {{extensions}}', { extensions: extensions.join(', ') }),
          { extensions: extensions.join(', ') },
        )
      : undefined,
    location,
    href: '/routes',
    disabled,
    host,
  };
}
