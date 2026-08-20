import { useTranslation } from 'react-i18next';
import { Select, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useChainLabels } from '../../model/chainLabels';

export function LabelSelect({
  value,
  onChange,
  readOnly,
  label,
  fieldKey,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  label: string;
  fieldKey: string;
}) {
  const { t } = useTranslation();
  const labels = useChainLabels();
  const empty = labels.length === 0;
  const id = `schema-field-${fieldKey}`;

  return (
    <VStack gap="4" max>
      <Select
        id={id}
        aria-label={label}
        disabled={readOnly || empty}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {labels.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </Select>
      {empty ? (
        <Text variant="muted">
          {t(
            'routes.chain.goto.noLabels',
            'Сначала добавьте метку в эту цепочку, затем выберите её здесь',
          )}
        </Text>
      ) : null}
    </VStack>
  );
}
