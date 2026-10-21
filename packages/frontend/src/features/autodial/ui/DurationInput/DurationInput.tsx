import { useTranslation } from 'react-i18next';
import { Button, Input, Label, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import cls from './DurationInput.module.scss';

const parts = (value: number) => [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60];
const UNITS = ['hours', 'minutes', 'seconds'] as const;

export function DurationInput({ id, label, value, fallback, onChange }: {
  id: string; label: string; value: number | undefined; fallback?: number; onChange: (seconds: number | undefined) => void;
}) {
  const { t } = useTranslation();
  const values = value === undefined ? ['', '', ''] : parts(value).map(String);
  const placeholders = fallback === undefined ? undefined : parts(fallback);
  return <VStack gap="4" max align="stretch">
    <HStack gap="8" max align="end" className={cls.parts}>
      {UNITS.map((unit, index) => <VStack key={unit} gap="4" className={cls.part} align="stretch">
        <Label htmlFor={index ? `${id}-${unit}` : id} className={cls.unit}>{t(`autodial.workspace.${unit}`)}</Label>
        <Input id={index ? `${id}-${unit}` : id} aria-label={`${label}: ${t(`autodial.workspace.${unit}`)}`}
          type="number" min={0} step={1} inputMode="numeric" value={values[index]} placeholder={placeholders ? String(placeholders[index]) : undefined}
          onChange={(event) => {
            const next = [...values]; next[index] = event.target.value;
            if (next.every((part) => part === '')) { onChange(undefined); return; }
            onChange(next.reduce((sum, part, i) => sum + Math.max(0, Math.trunc(Number(part) || 0)) * [3600, 60, 1][i], 0));
          }} />
      </VStack>)}
    </HStack>
    {fallback !== undefined && <Button variant="link" size="sm" className={cls.reset} disabled={value === undefined}
      aria-label={`${label}: ${t('autodial.workspace.retryInherit')}`} onClick={() => onChange(undefined)}>{t('autodial.workspace.retryInherit')}</Button>}
    {value === 0 && <Text variant="muted">{t('autodial.workspace.retryImmediately')}</Text>}
  </VStack>;
}
