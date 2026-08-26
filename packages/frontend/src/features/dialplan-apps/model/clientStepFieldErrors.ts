import type { IRouteAction } from '@krasterisk/shared';
import type { TranslateFn } from '@/shared/lib/translateFn';
import { cmdFieldErrors } from './schemas/cmd';
import { httpRequestFieldErrors } from './schemas/httpRequest';
import { labelFieldErrors } from './schemas/label';
import { webhookFieldErrors } from './schemas/webhook';

type TFn = TranslateFn;

const ERROR_MESSAGES: Record<string, { key: string; fallback: string }> = {
  required: { key: 'routes.chain.fieldError.required', fallback: 'Обязательное поле' },
  invalid: { key: 'routes.chain.label.nameErrorInvalid', fallback: 'Недопустимые символы в имени метки' },
  'only-https': { key: 'routes.chain.http.urlError', fallback: 'Адрес должен быть https и не указывать на внутреннюю сеть или localhost' },
};

export function resolveClientFieldError(code: string, t: TFn): string {
  const entry = ERROR_MESSAGES[code];
  return entry ? t(entry.key, entry.fallback) : code;
}

/** Client-side field errors merged with server 400 mapping in StepSheet. */
export function clientStepFieldErrors(action: IRouteAction | null | undefined): Record<string, string> {
  if (!action?.type) return {};
  const params = (action.params ?? {}) as Record<string, unknown>;
  switch (action.type) {
    case 'label':
      return labelFieldErrors(params);
    case 'http_request':
      return httpRequestFieldErrors(params);
    case 'webhook':
      return webhookFieldErrors(params);
    case 'cmd':
      return cmdFieldErrors(params);
    default:
      return {};
  }
}
