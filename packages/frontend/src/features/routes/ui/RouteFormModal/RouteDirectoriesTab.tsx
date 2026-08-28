import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Trash2, Plus, BookOpen } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Text,
  InfoTooltip,
  TableRowActions,
  TableRowAction,
} from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { useGetDirectoryQuery } from '@/shared/api/endpoints/directoryApi';
import { useSchemaRefs } from '@/features/dialplan-apps/model/useSchemaRefs';
import { DialplanAppsEditor } from '@/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor';
import { allowedTypesForHost } from '@/features/dialplan-apps/model/hostTypes';
import { CallValueSourceField } from '@/features/dialplan-apps/ui/DirectoryLookupField';
import { DirectoryLookupOutputsField } from '@/features/dialplan-apps/ui/DirectoryLookupOutputsField';
import type {
  CallValueSource,
  DirectoryBehaviorType,
  DirectoryFieldType,
  DirectoryMatchMode,
  IDirectoryBehaviorParams,
  IRouteDirectoryBinding,
} from '@krasterisk/shared';
import cls from './RouteDirectoriesTab.module.scss';

const POLICY_PRESETS: DirectoryBehaviorType[] = [
  'set_name',
  'set_number',
  'redirect',
  'map_fields',
  'drop',
  'custom',
];

const POLICY_FALLBACKS: Record<DirectoryBehaviorType, string> = {
  set_name: 'Подставить имя',
  set_number: 'Подставить номер',
  redirect: 'Перенаправление',
  map_fields: 'Записать поля',
  drop: 'Сбросить звонок',
  custom: 'Произвольно',
};

export interface RouteDirectoriesTabProps {
  bindings: IRouteDirectoryBinding[];
  setBindings: (bindings: IRouteDirectoryBinding[]) => void;
}

const withPositions = (list: IRouteDirectoryBinding[]): IRouteDirectoryBinding[] =>
  list.map((binding, index) => ({ ...binding, position: index }));

function DirectoryFieldSelect({
  directoryUid,
  value,
  onChange,
  expectedType,
}: {
  directoryUid: number;
  value: number | undefined;
  onChange: (uid: number) => void;
  expectedType?: DirectoryFieldType;
}) {
  const { t } = useTranslation();
  const query = useGetDirectoryQuery(directoryUid, { skip: directoryUid <= 0 });
  const fields = (query.data?.fields ?? []).filter(
    (field) => !expectedType || field.type === expectedType || field.uid === value,
  );

  return (
    <Select
      className={cls.fieldSelect}
      value={value && value > 0 ? String(value) : ''}
      aria-label={t('routes.chain.directoryLookup.selectField', 'Поле записи')}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    >
      <option value="">{t('routes.chain.source.selectVarKeyPlaceholder', 'Выберите поле')}</option>
      {fields.map((field) => (
        <option key={field.uid} value={String(field.uid)}>
          {field.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Ordered route directory policies. Row = directory + key source + match mode
 * + preset. custom opens DialplanAppsEditor with host directory_policy.
 *
 * @layer features/routes
 */
export const RouteDirectoriesTab = memo(({ bindings, setBindings }: RouteDirectoriesTabProps) => {
  const { t } = useTranslation();
  const refs = useSchemaRefs(['dialplanDirectories']);
  const directories = refs.dialplanDirectories?.items ?? [];
  const [selectedDirectory, setSelectedDirectory] = useState('');

  const getDirectoryName = useCallback((binding: IRouteDirectoryBinding): string => {
    return binding.directory?.name
      || directories.find((item) => Number(item.value) === binding.directory_uid)?.label
      || `#${binding.directory_uid}`;
  }, [directories]);

  const handleAdd = useCallback(() => {
    if (!selectedDirectory) return;
    const directoryUid = Number(selectedDirectory);
    const catalog = directories.find((item) => item.value === selectedDirectory);
    const newBinding: IRouteDirectoryBinding = {
      directory_uid: directoryUid,
      position: bindings.length,
      key_source: { source: 'original_caller' },
      match_mode: 'on_match',
      behavior_type: 'set_name',
      behavior_params: {},
      actions: null,
      directory: catalog
        ? {
            uid: directoryUid,
            user_uid: 0,
            name: catalog.label,
            lookup_field_uid: 0,
            key_normalization: 'digits',
            revision: 0,
          }
        : undefined,
    };
    setBindings(withPositions([...bindings, newBinding]));
    setSelectedDirectory('');
  }, [selectedDirectory, directories, bindings, setBindings]);

  const handleRemove = useCallback((index: number) => {
    setBindings(withPositions(bindings.filter((_, i) => i !== index)));
  }, [bindings, setBindings]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const copy = [...bindings];
    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
    setBindings(withPositions(copy));
  }, [bindings, setBindings]);

  const handleMoveDown = useCallback((index: number) => {
    if (index >= bindings.length - 1) return;
    const copy = [...bindings];
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
    setBindings(withPositions(copy));
  }, [bindings, setBindings]);

  const handleUpdate = useCallback((index: number, patch: Partial<IRouteDirectoryBinding>) => {
    setBindings(bindings.map((binding, i) => (i === index ? { ...binding, ...patch } : binding)));
  }, [bindings, setBindings]);

  const handleBehaviorTypeChange = useCallback((index: number, type: DirectoryBehaviorType) => {
    setBindings(bindings.map((binding, i) => {
      if (i !== index) return binding;
      return {
        ...binding,
        behavior_type: type,
        behavior_params: type === 'map_fields' ? { mappings: [] } : {},
        actions: type === 'custom' ? (binding.actions || []) : null,
      };
    }));
  }, [bindings, setBindings]);

  return (
    <VStack gap="12" max className={cls.wrapper}>
      <HStack gap="8" align="center">
        <Text variant="small">{t('routes.directories.title', 'Справочники CallerID')}</Text>
        <InfoTooltip text={t(
          'routes.directories.tooltip',
          'Упорядоченная цепочка политик: справочники проверяются по порядку до основных действий маршрута.',
        )}
        />
      </HStack>

      <VStack gap="8" max className={cls.bindingsBox}>
        {bindings.length === 0 ? (
          <VStack align="center" gap="8" className={cls.emptyState}>
            <BookOpen size={28} className={cls.emptyIcon} />
            <Text variant="small" className={cls.emptyText}>
              {t('routes.directories.empty', 'Добавьте справочник, чтобы проверять CallerID перед основными действиями')}
            </Text>
          </VStack>
        ) : (
          <VStack gap="8" max>
            {bindings.map((binding, index) => (
              <VStack key={`${binding.directory_uid}-${index}`} gap="0" max className={cls.bindingItem}>
                <Flex align="center" wrap="wrap" gap="8" className={cls.bindingRow}>
                  <Text as="span" className={cls.bindingIndex}>{index + 1}</Text>
                  <Text as="span" className={cls.bindingName} title={getDirectoryName(binding)}>
                    {getDirectoryName(binding)}
                  </Text>

                  <Select
                    className={cls.matchModeSelect}
                    value={binding.match_mode}
                    aria-label={t('routes.directories.matchModeLabel', 'Когда срабатывает')}
                    onChange={(e) => handleUpdate(index, { match_mode: e.target.value as DirectoryMatchMode })}
                  >
                    <option value="on_match">{t('routes.directories.matchMode.on_match', 'Номер в справочнике')}</option>
                    <option value="on_no_match">{t('routes.directories.matchMode.on_no_match', 'Номера нет в справочнике')}</option>
                  </Select>

                  <Select
                    className={cls.behaviorSelect}
                    value={binding.behavior_type}
                    aria-label={t('routes.directories.behaviorLabel', 'Поведение')}
                    onChange={(e) => handleBehaviorTypeChange(index, e.target.value as DirectoryBehaviorType)}
                  >
                    {POLICY_PRESETS.map((type) => (
                      <option key={type} value={type}>
                        {t(`routes.directories.behavior.${type}`, POLICY_FALLBACKS[type])}
                      </option>
                    ))}
                  </Select>

                  <TableRowActions className={cls.bindingActions}>
                    <TableRowAction
                      title={t('common.moveUp', 'Вверх')}
                      aria-label={t('common.moveUp', 'Вверх')}
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                    >
                      <ChevronUp size={14} />
                    </TableRowAction>
                    <TableRowAction
                      title={t('common.moveDown', 'Вниз')}
                      aria-label={t('common.moveDown', 'Вниз')}
                      onClick={() => handleMoveDown(index)}
                      disabled={index >= bindings.length - 1}
                    >
                      <ChevronDown size={14} />
                    </TableRowAction>
                    <TableRowAction
                      danger
                      title={t('common.delete', 'Удалить')}
                      aria-label={t('common.delete', 'Удалить')}
                      onClick={() => handleRemove(index)}
                    >
                      <Trash2 size={14} />
                    </TableRowAction>
                  </TableRowActions>
                </Flex>

                <VStack gap="8" max className={cls.keySourceRow}>
                  <CallValueSourceField
                    value={binding.key_source}
                    onChange={(keySource: CallValueSource) => handleUpdate(index, { key_source: keySource })}
                  />
                </VStack>

                <BindingParamsFields
                  binding={binding}
                  onChange={(patch) => handleUpdate(index, patch)}
                />
              </VStack>
            ))}
          </VStack>
        )}

        <Flex align="center" gap="8" wrap="wrap" className={cls.addRow}>
          <Select
            className={cls.directorySelect}
            value={selectedDirectory}
            onChange={(e) => setSelectedDirectory(e.target.value)}
          >
            <option value="">{t('routes.directories.selectDirectory', 'Выберите справочник')}</option>
            {directories.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </Select>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!selectedDirectory}
            className={cls.addBindingBtn}
          >
            <Plus size={16} />
            {t('routes.directories.add', 'Добавить справочник')}
          </Button>
        </Flex>
      </VStack>
    </VStack>
  );
});

RouteDirectoriesTab.displayName = 'RouteDirectoriesTab';

interface BindingParamsFieldsProps {
  binding: IRouteDirectoryBinding;
  onChange: (patch: Partial<IRouteDirectoryBinding>) => void;
}

const BindingParamsFields = memo(({ binding, onChange }: BindingParamsFieldsProps) => {
  const { t } = useTranslation();
  const params: IDirectoryBehaviorParams = binding.behavior_params || {};
  const setParams = (patch: IDirectoryBehaviorParams) => onChange({ behavior_params: patch });

  switch (binding.behavior_type) {
    case 'set_name':
      return (
        <HStack gap="8" align="center" className={cls.paramsRow}>
          <Text variant="small" className={cls.paramsLabel}>
            {t('routes.directories.params.field', 'Поле')}
          </Text>
          <DirectoryFieldSelect
            directoryUid={binding.directory_uid}
            value={params.fieldUid}
            onChange={(fieldUid) => setParams({ fieldUid })}
          />
        </HStack>
      );
    case 'set_number': {
      const mode = params.fixed !== undefined ? 'fixed' : 'field';
      return (
        <HStack gap="8" align="center" className={cls.paramsRow} max>
          <Select
            className={cls.paramsModeSelect}
            value={mode}
            onChange={(e) => setParams(e.target.value === 'fixed' ? { fixed: '' } : { fieldUid: params.fieldUid })}
          >
            <option value="field">{t('routes.directories.params.byField', 'Из поля')}</option>
            <option value="fixed">{t('routes.directories.params.byFixed', 'Фикс. значение')}</option>
          </Select>
          {mode === 'field' ? (
            <DirectoryFieldSelect
              directoryUid={binding.directory_uid}
              value={params.fieldUid}
              expectedType="phone"
              onChange={(fieldUid) => setParams({ fieldUid })}
            />
          ) : (
            <Input
              className={cls.paramsInput}
              value={params.fixed || ''}
              onChange={(e) => setParams({ fixed: e.target.value })}
              placeholder="+79001234567"
            />
          )}
        </HStack>
      );
    }
    case 'redirect': {
      const mode = params.fixedExten !== undefined ? 'fixed' : 'field';
      return (
        <HStack gap="8" align="center" className={cls.paramsRow} max>
          <Select
            className={cls.paramsModeSelect}
            value={mode}
            onChange={(e) =>
              setParams(e.target.value === 'fixed' ? { fixedExten: '' } : { fieldUid: params.fieldUid })
            }
          >
            <option value="field">{t('routes.directories.params.byField', 'Из поля')}</option>
            <option value="fixed">{t('routes.directories.params.byFixed', 'Фикс. значение')}</option>
          </Select>
          {mode === 'field' ? (
            <DirectoryFieldSelect
              directoryUid={binding.directory_uid}
              value={params.fieldUid}
              expectedType="phone"
              onChange={(fieldUid) => setParams({ fieldUid })}
            />
          ) : (
            <Input
              className={cls.paramsInput}
              value={params.fixedExten || ''}
              onChange={(e) => setParams({ fixedExten: e.target.value })}
              placeholder="200"
            />
          )}
        </HStack>
      );
    }
    case 'map_fields':
      return (
        <VStack gap="8" className={cls.customBlock}>
          <DirectoryLookupOutputsField
            directoryUid={binding.directory_uid}
            value={params.mappings ?? []}
            onChange={(mappings) => setParams({ mappings })}
          />
        </VStack>
      );
    case 'custom':
      return (
        <VStack gap="8" className={cls.customBlock}>
          <DialplanAppsEditor
            host="directory_policy"
            labels={{ namespace: 'routes.chain' }}
            allowedTypes={allowedTypesForHost('directory_policy')}
            actions={binding.actions || []}
            onChange={(actions) => onChange({ actions })}
          />
        </VStack>
      );
    case 'drop':
      return (
        <Text variant="small" className={cls.behaviorHint}>
          {t(
            binding.match_mode === 'on_no_match'
              ? 'routes.directories.params.dropHintOnNoMatch'
              : 'routes.directories.params.dropHintOnMatch',
            binding.match_mode === 'on_no_match'
              ? 'Номера нет в справочнике - звонок сбрасывается. Пропускаются только номера из списка.'
              : 'Номер найден в справочнике - звонок сбрасывается. Остальные проходят дальше.',
          )}
        </Text>
      );
    default:
      return null;
  }
});

BindingParamsFields.displayName = 'BindingParamsFields';
