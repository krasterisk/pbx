import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { IDialplanAppProps } from '../../../model/types';

/**
 * ISDN/SIP hangup cause codes from Asterisk documentation.
 * @see https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/Hangup
 *
 * Hangup(causecode) — optional cause code (number or name).
 * If omitted, Asterisk uses cause 16 (Normal Clearing).
 */

/** Hangup cause code options with ISDN code, SIP equivalent, and i18n key */
const HANGUP_CAUSES = [
  { value: '',   labelKey: 'routes.apps.hangup.causeDefault' },
  { value: '16', labelKey: 'routes.apps.hangup.cause16' },
  { value: '17', labelKey: 'routes.apps.hangup.cause17' },
  { value: '18', labelKey: 'routes.apps.hangup.cause18' },
  { value: '19', labelKey: 'routes.apps.hangup.cause19' },
  { value: '21', labelKey: 'routes.apps.hangup.cause21' },
  { value: '1',  labelKey: 'routes.apps.hangup.cause1' },
  { value: '28', labelKey: 'routes.apps.hangup.cause28' },
  { value: '34', labelKey: 'routes.apps.hangup.cause34' },
  { value: '38', labelKey: 'routes.apps.hangup.cause38' },
  { value: '27', labelKey: 'routes.apps.hangup.cause27' },
  { value: '31', labelKey: 'routes.apps.hangup.cause31' },
  { value: '20', labelKey: 'routes.apps.hangup.cause20' },
  { value: '22', labelKey: 'routes.apps.hangup.cause22' },
] as const;

export const HangupApp = memo(({ action, onUpdate }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const causeCode = action.params?.causecode || '';

  const options = useMemo(() =>
    HANGUP_CAUSES.map(c => ({
      value: c.value,
      label: c.value
        ? `${c.value} — ${t(c.labelKey)}`
        : t(c.labelKey),
    })),
    [t],
  );

  return (
    <HStack gap="8" align="center" className="w-full">
      <Select
        className="flex-1"
        value={causeCode}
        onChange={(e) => onUpdate(action.id, 'params.causecode', e.target.value)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      <InfoTooltip text={t('routes.apps.hangup.tooltip',
        'Код причины завершения вызова (ISDN Cause Code).\nЕсли не указан — используется 16 (Normal Clearing).\nВлияет на SIP-ответ, отправляемый вызывающей стороне.'
      )} />
    </HStack>
  );
});

HangupApp.displayName = 'HangupApp';
