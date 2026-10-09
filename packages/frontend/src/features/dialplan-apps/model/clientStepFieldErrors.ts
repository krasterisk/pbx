import { callerIdV2Errors } from '@krasterisk/shared';
import type { IRouteAction } from '@krasterisk/shared';
import type { TranslateFn } from '@/shared/lib/translateFn';
import { notifyFieldErrors } from './schemas/notify';
import { cmdFieldErrors } from './schemas/cmd';
import { httpRequestFieldErrors } from './schemas/httpRequest';
import { labelFieldErrors } from './schemas/label';
import { webhookFieldErrors } from './schemas/webhook';
import { directoryLookupFieldErrors } from './schemas/directoryLookup';

type TFn = TranslateFn;

const ERROR_MESSAGES: Record<string, { key: string; fallback: string }> = {
  'notify-body-required': {
    key: 'routes.chain.notify.bodyRequired',
    fallback: 'Укажите текст сообщения',
  },
  'notify-body-invalid': {
    key: 'routes.chain.notify.bodyInvalid',
    fallback: 'Текст сообщения не должен содержать переносы строк или ;',
  },
  'notify-integration-required': {
    key: 'routes.chain.notify.integrationRequired',
    fallback: 'Выберите интеграцию для отправки',
  },

  'callerid-access-list': {
    key: 'routes.apps.calleridV2.accessListUnavailable',
    fallback:
      'Списки доступа не используются для Caller ID. Выберите другой источник номера.',
  },
  'callerid-invalid': {
    key: 'routes.apps.calleridV2.invalid',
    fallback: 'Проверьте настройки Caller ID',
  },
  required: {
    key: 'routes.chain.fieldError.required',
    fallback: 'Обязательное поле',
  },
  'directory-invalid': {key:'routes.chain.directoryLookup.invalid',fallback:'Проверьте параметры справочника'},
  invalid: {
    key: 'routes.chain.label.nameErrorInvalid',
    fallback: 'Недопустимые символы в имени метки',
  },
  'only-https': {
    key: 'routes.chain.http.urlError',
    fallback:
      'Адрес должен быть https и не указывать на внутреннюю сеть или localhost',
  },
};

export function resolveClientFieldError(code: string, t: TFn): string {
  const entry = ERROR_MESSAGES[code];
  return entry ? t(entry.key, entry.fallback) : code;
}

/** Client-side field errors merged with server 400 mapping in StepSheet. */
export function clientStepFieldErrors(
  action: IRouteAction | null | undefined,
): Record<string, string> {
  if (!action?.type) return {};
  const params = (action.params ?? {}) as Record<string, unknown>;
  switch (action.type) {
    case 'notify':
      return notifyFieldErrors(params);
    case 'label':
      return labelFieldErrors(params);
    case 'http_request':
      return httpRequestFieldErrors(params);
    case 'webhook':
      return webhookFieldErrors(params);
    case 'cmd':
      return cmdFieldErrors(params);
    case 'callerid':
      if (
        params.version === 2 &&
        (params.number as { source?: { source?: string } } | undefined)?.source
          ?.source === 'number_list'
      )
        return { callerIdV2: 'callerid-access-list' };
      return params.version === 2 && callerIdV2Errors(params).length
        ? { callerIdV2: 'callerid-invalid' }
        : {};
    case 'directory_lookup':
      return directoryLookupFieldErrors(params);
    default:
      return {};
  }
}
