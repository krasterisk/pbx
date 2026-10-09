import styles from './CallerIdEditor.module.scss';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  callerIdV2Errors,
  normalizeCallerIdParams,
  type CallerIdField,
  type CallerIdSource,
  type DirectoryValueSource,
} from '@krasterisk/shared';
import {
  Input,
  Label,
  Select,
  Switch,
  TagInput,
  Text,
  InfoTooltip,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { SchemaDirectoryLookupField } from '../DirectoryLookupField/DirectoryLookupField';
import { DialModifyField } from '../DialModifyField/DialModifyField';

interface Props {
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
  tenantUid?: number;
}
export function CallerIdEditor({
  params,
  onChange,
  readOnly,
  tenantUid,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [tab, setTab] = useState('number');
  const model = normalizeCallerIdParams(params);
  const target = tab as 'number' | 'name';
  const field: CallerIdField = model[target] ?? {
    source: { source: 'current' },
  };
  const source = field.source;
  const label = (key: string) => t('routes.apps.calleridV2.' + key);
  const sourceLabel = (key: string) =>
    label(
      key === 'current'
        ? target === 'number'
          ? 'currentNumber'
          : 'currentName'
        : key === 'fixed'
          ? target === 'number'
            ? 'fixedNumber'
            : 'fixedName'
          : key,
    );
  const setField = (next: CallerIdField) =>
    onChange({ ...model, [target]: next });
  const patch = (next: Partial<CallerIdField>) =>
    setField({ ...field, ...next });
  const setSource = (next: CallerIdSource) => patch({ source: next });
  const choose = (kind: string) => {
    if (kind === 'fixed') setSource({ source: 'fixed', value: '' });
    else if (kind === 'directory')
      setSource({
        source: 'directory',
        directoryUid: 0,
        valueFieldUid: 0,
        keySource: { source: 'original_caller' },
        onMissing: 'keep',
      });
    else if (kind === 'variable') setSource({ source: 'variable', name: '' });
    else if (kind === 'pool')
      setSource({ source: 'pool', numbers: [], pick: 'random' });
    else setSource({ source: 'current' });
  };
  return (
    <VStack gap="12" max>
      {model.number?.source.source === 'number_list' && (
        <Text variant="error" role="alert">
          {label('accessListUnavailable')}
        </Text>
      )}
      {params.version !== 2 && (
        <Text variant="muted">{label('legacyHint')}</Text>
      )}
      <HStack gap="4">
        <Text variant="muted">{label('snapshot')}</Text>
        <InfoTooltip
          contentClassName={styles.helpContent}
          text={label('snapshotHint')}
        />
      </HStack>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="number">{label('numberTab')}</TabsTrigger>
          <TabsTrigger value="name">{label('nameTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <VStack gap="12" max>
            <HStack gap="8" justify="between">
              <Label htmlFor={id + '-clear'}>{label('clear')}</Label>
              <Switch
                id={id + '-clear'}
                checked={!!field.clear}
                disabled={readOnly}
                onCheckedChange={(clear) =>
                  clear
                    ? setField({ source: { source: 'current' }, clear: true })
                    : patch({ clear: false })
                }
              />
            </HStack>
            {!field.clear && (
              <>
                <HStack gap="4">
                  <Label htmlFor={id + '-source'}>
                    {label(target === 'number' ? 'numberSource' : 'nameSource')}
                  </Label>
                  <InfoTooltip
                    contentClassName={styles.helpContent}
                    text={label(
                      target === 'number'
                        ? 'numberSourceHint'
                        : 'nameSourceHint',
                    )}
                  />
                </HStack>
                <Select
                  id={id + '-source'}
                  value={source.source === 'number_list' ? '' : source.source}
                  disabled={readOnly}
                  onChange={(event) => choose(event.target.value)}
                  options={[
                    ...(source.source === 'number_list'
                      ? [{ value: '', label: label('chooseSource') }]
                      : []),
                    ...[
                      'current',
                      'fixed',
                      'directory',
                      'variable',
                      ...(target === 'number' ? ['pool'] : []),
                    ].map((value) => ({ value, label: sourceLabel(value) })),
                  ]}
                />
                {source.source === 'fixed' && (
                  <>
                    <Label htmlFor={id + '-fixed'}>
                      {label(target === 'number' ? 'numberValue' : 'nameValue')}
                    </Label>
                    <Input
                      id={id + '-fixed'}
                      value={source.value}
                      maxLength={target === 'number' ? 79 : 128}
                      disabled={readOnly}
                      onChange={(event) =>
                        setSource({ ...source, value: event.target.value })
                      }
                    />
                  </>
                )}
                {source.source === 'variable' && (
                  <>
                    <HStack gap="4">
                      <Label htmlFor={id + '-variable'}>
                        {label('variable')}
                      </Label>
                      <InfoTooltip text={label('variableHint')} />
                    </HStack>
                    <Input
                      id={id + '-variable'}
                      value={source.name}
                      maxLength={64}
                      disabled={readOnly}
                      onChange={(event) =>
                        setSource({ ...source, name: event.target.value })
                      }
                    />
                  </>
                )}
                {source.source === 'directory' && (
                  <SchemaDirectoryLookupField
                    value={source as DirectoryValueSource}
                    readOnly={readOnly}
                    expectedType={target === 'number' ? 'phone' : 'string'}
                    showOnMissing={false}
                    onChange={(next) =>
                      setSource({ ...next, onMissing: 'keep' })
                    }
                  />
                )}
                {source.source === 'pool' && (
                  <>
                    <Label>{label('pool')}</Label>
                    <TagInput
                      value={source.numbers}
                      disabled={readOnly}
                      onChange={(numbers) => setSource({ ...source, numbers })}
                      placeholder={label('addNumber')}
                    />
                    <Label htmlFor={id + '-pool-pick'}>{label('pick')}</Label>
                    <Select
                      id={id + '-pool-pick'}
                      value={source.pick}
                      disabled={readOnly}
                      onChange={(event) =>
                        setSource({
                          ...source,
                          pick: event.target.value as typeof source.pick,
                        })
                      }
                      options={['random', 'round_robin'].map((value) => ({
                        value,
                        label: sourceLabel(value),
                      }))}
                    />
                  </>
                )}
                <DialModifyField
                  key={target}
                  rewrite={field.rewrite}
                  onRewriteChange={(rewrite) => patch({ rewrite })}
                  readOnly={readOnly}
                  tenantUid={tenantUid}
                  source={
                    source.source === 'fixed'
                      ? { source: 'fixed', value: source.value }
                      : undefined
                  }
                  allowExpertMode={false}
                  textMode={target === 'name'}
                  allowShortNumbers
                />
                <Label htmlFor={id + '-missing'}>{label('onMissing')}</Label>
                <Select
                  id={id + '-missing'}
                  value={field.onMissing ?? 'keep'}
                  disabled={readOnly}
                  onChange={(event) =>
                    patch({
                      onMissing: event.target
                        .value as CallerIdField['onMissing'],
                    })
                  }
                  options={['keep', 'empty', 'hangup'].map((value) => ({
                    value,
                    label: sourceLabel(value),
                  }))}
                />
                <Label htmlFor={id + '-error'}>{label('onError')}</Label>
                <Select
                  id={id + '-error'}
                  value={field.onError ?? 'keep'}
                  disabled={readOnly}
                  onChange={(event) =>
                    patch({
                      onError: event.target.value as CallerIdField['onError'],
                    })
                  }
                  options={['keep', 'hangup'].map((value) => ({
                    value,
                    label: sourceLabel(value),
                  }))}
                />
              </>
            )}
            {callerIdV2Errors(model).length > 0 && (
              <Text variant="error" role="alert">
                {label('invalid')}
              </Text>
            )}
          </VStack>
        </TabsContent>
      </Tabs>
    </VStack>
  );
}
