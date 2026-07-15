import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Trash2, Plus, BookOpen } from 'lucide-react';
import { Button, Input, Select, Text, InfoTooltip } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { useGetPhonebooksQuery } from '@/shared/api/endpoints/phonebookApi';
import { DialplanAppsEditor } from '@/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor';
import type {
  IRoutePhonebook,
  IRoutePhonebookBinding,
  IPhonebookBehaviorParams,
  PhonebookMatchMode,
  PhonebookBehaviorType,
} from '@krasterisk/shared';
import { normalizePhonebookBehaviorType } from '@krasterisk/shared';
import cls from './RoutePhonebooksTab.module.scss';

/**
 * Collect all unique `vars` keys across a phonebook's entries, sorted —
 * mirrors backend's collectAllVarKeys (phonebook-dialplan.util.ts) so the UI
 * suggests only keys that actually exist in this phonebook's data, instead of
 * a hardcoded convention guess (was: free-text input defaulting to "name").
 */
function collectPhonebookVarKeys(phonebook: IRoutePhonebook | undefined): string[] {
  const keys = new Set<string>();
  for (const entry of phonebook?.entries || []) {
    if (entry.vars) Object.keys(entry.vars).forEach((k) => keys.add(k));
  }
  return Array.from(keys).sort();
}

export interface RoutePhonebooksTabProps {
  bindings: IRoutePhonebookBinding[];
  setBindings: (bindings: IRoutePhonebookBinding[]) => void;
}

/** Presets available when the caller IS found in the phonebook (on_match). */
const ON_MATCH_BEHAVIORS: PhonebookBehaviorType[] = [
  'set_name', 'set_number', 'drop', 'redirect', 'vars_only', 'custom',
];

/** Presets available when the caller is NOT found (on_no_match). No PB_* vars exist. */
const ON_NO_MATCH_BEHAVIORS: PhonebookBehaviorType[] = [
  'set_name', 'drop', 'redirect', 'custom',
];

const ON_MATCH_BEHAVIOR_SET = new Set(ON_MATCH_BEHAVIORS);
const ON_NO_MATCH_BEHAVIOR_SET = new Set(ON_NO_MATCH_BEHAVIORS);

function getAvailableBehaviorTypes(matchMode: PhonebookMatchMode): PhonebookBehaviorType[] {
  return matchMode === 'on_no_match' ? ON_NO_MATCH_BEHAVIORS : ON_MATCH_BEHAVIORS;
}

/** Pick a valid preset when match_mode changes and the current one is incompatible. */
function coerceBehaviorForMatchMode(
  behaviorType: PhonebookBehaviorType,
  matchMode: PhonebookMatchMode,
): PhonebookBehaviorType {
  const normalized = normalizePhonebookBehaviorType(behaviorType);
  const allowed = matchMode === 'on_no_match' ? ON_NO_MATCH_BEHAVIOR_SET : ON_MATCH_BEHAVIOR_SET;
  if (allowed.has(normalized)) return normalized;
  return matchMode === 'on_no_match' ? 'drop' : 'vars_only';
}

const withPositions = (list: IRoutePhonebookBinding[]): IRoutePhonebookBinding[] =>
  list.map((b, i) => ({ ...b, position: i }));

/**
 * Ordered list of route<->phonebook binding policies (D-08).
 * Row = phonebook (read-only, chosen once at add time) + match_mode + behavior
 * preset + up to 2 preset params; 'custom' reveals the reusable DialplanAppsEditor
 * (D-26). Reorder/remove buttons follow the MohFormModal playlist pattern.
 *
 * @layer features/routes
 */
export const RoutePhonebooksTab = memo(({ bindings, setBindings }: RoutePhonebooksTabProps) => {
  const { t } = useTranslation();
  const { data: phonebooks = [] } = useGetPhonebooksQuery();
  const [selectedPhonebook, setSelectedPhonebook] = useState('');

  const getPhonebookName = useCallback((binding: IRoutePhonebookBinding): string => {
    return binding.phonebook?.name
      || phonebooks.find((pb) => pb.uid === binding.phonebook_uid)?.name
      || `#${binding.phonebook_uid}`;
  }, [phonebooks]);

  const handleAdd = useCallback(() => {
    if (!selectedPhonebook) return;
    const phonebookUid = Number(selectedPhonebook);
    const phonebook = phonebooks.find((pb) => pb.uid === phonebookUid);
    const newBinding: IRoutePhonebookBinding = {
      phonebook_uid: phonebookUid,
      position: bindings.length,
      match_mode: 'on_match',
      behavior_type: 'vars_only',
      behavior_params: null,
      actions: null,
      phonebook,
    };
    setBindings(withPositions([...bindings, newBinding]));
    setSelectedPhonebook('');
  }, [selectedPhonebook, phonebooks, bindings, setBindings]);

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

  const handleUpdate = useCallback((index: number, patch: Partial<IRoutePhonebookBinding>) => {
    setBindings(bindings.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }, [bindings, setBindings]);

  const handleMatchModeChange = useCallback((index: number, mode: PhonebookMatchMode) => {
    setBindings(bindings.map((b, i) => {
      if (i !== index) return b;
      const behaviorType = coerceBehaviorForMatchMode(b.behavior_type, mode);
      const paramsChanged = behaviorType !== b.behavior_type;
      return {
        ...b,
        match_mode: mode,
        behavior_type: behaviorType,
        behavior_params: paramsChanged ? null : b.behavior_params,
      };
    }));
  }, [bindings, setBindings]);

  const handleBehaviorTypeChange = useCallback((index: number, type: PhonebookBehaviorType) => {
    setBindings(bindings.map((b, i) => {
      if (i !== index) return b;
      return {
        ...b,
        behavior_type: type,
        behavior_params: null,
        actions: type === 'custom' ? (b.actions || []) : null,
      };
    }));
  }, [bindings, setBindings]);

  return (
    <VStack gap="12" max className={cls.wrapper}>
      <HStack gap="8" align="center">
        <Text variant="small">{t('routes.phonebooks.title', 'Справочники CallerID')}</Text>
        <InfoTooltip text={t(
          'routes.phonebooks.tooltip',
          'Упорядоченная цепочка политик: справочники проверяются по порядку до основных действий маршрута.',
        )}
        />
      </HStack>

      <VStack gap="8" max className={cls.bindingsBox}>
        {bindings.length === 0 ? (
          <VStack align="center" gap="8" className={cls.emptyState}>
            <BookOpen size={28} className={cls.emptyIcon} />
            <Text variant="small" className={cls.emptyText}>
              {t('routes.phonebooks.empty', 'Добавьте справочник, чтобы проверять CallerID перед основными действиями')}
            </Text>
          </VStack>
        ) : (
          <VStack gap="8" max>
            {bindings.map((binding, index) => {
              const availableTypes = getAvailableBehaviorTypes(binding.match_mode);

              return (
                <VStack key={`${binding.phonebook_uid}-${index}`} gap="0" max className={cls.bindingItem}>
                  <Flex align="center" wrap="wrap" gap="8" className={cls.bindingRow}>
                    <Text as="span" className={cls.bindingIndex}>{index + 1}</Text>
                    <Text as="span" className={cls.bindingName} title={getPhonebookName(binding)}>
                      {getPhonebookName(binding)}
                    </Text>

                    <Select
                      className={cls.matchModeSelect}
                      value={binding.match_mode}
                      onChange={(e) => handleMatchModeChange(index, e.target.value as PhonebookMatchMode)}
                    >
                      <option value="on_match">{t('routes.phonebooks.matchMode.on_match', 'Номер в справочнике')}</option>
                      <option value="on_no_match">{t('routes.phonebooks.matchMode.on_no_match', 'Номера нет в справочнике')}</option>
                    </Select>

                    <Select
                      className={cls.behaviorSelect}
                      value={normalizePhonebookBehaviorType(binding.behavior_type)}
                      onChange={(e) => handleBehaviorTypeChange(index, e.target.value as PhonebookBehaviorType)}
                    >
                      {availableTypes.map((type) => (
                        <option key={type} value={type}>
                          {t(`routes.phonebooks.behavior.${type}`, type)}
                        </option>
                      ))}
                    </Select>

                    <HStack gap="0" className={cls.bindingActions}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title={t('common.moveUp', 'Вверх')}
                      >
                        <ChevronUp size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveDown(index)}
                        disabled={index >= bindings.length - 1}
                        title={t('common.moveDown', 'Вниз')}
                      >
                        <ChevronDown size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cls.deleteBindingBtn}
                        onClick={() => handleRemove(index)}
                        title={t('common.delete', 'Удалить')}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </HStack>
                  </Flex>

                  <BindingParamsFields
                    binding={binding}
                    varKeys={collectPhonebookVarKeys(
                      binding.phonebook || phonebooks.find((pb) => pb.uid === binding.phonebook_uid),
                    )}
                    onChange={(patch) => handleUpdate(index, patch)}
                  />
                </VStack>
              );
            })}
          </VStack>
        )}

        <Flex align="center" gap="8" wrap="wrap" className={cls.addRow}>
          <Select
            className={cls.phonebookSelect}
            value={selectedPhonebook}
            onChange={(e) => setSelectedPhonebook(e.target.value)}
          >
            <option value="">{t('routes.phonebooks.selectPhonebook', 'Выберите справочник')}</option>
            {phonebooks.map((pb) => (
              <option key={pb.uid} value={pb.uid}>{pb.name}</option>
            ))}
          </Select>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!selectedPhonebook}
            className={cls.addBindingBtn}
          >
            <Plus size={16} />
            {t('routes.phonebooks.add', 'Добавить справочник')}
          </Button>
        </Flex>
      </VStack>
    </VStack>
  );
});

RoutePhonebooksTab.displayName = 'RoutePhonebooksTab';

interface BindingParamsFieldsProps {
  binding: IRoutePhonebookBinding;
  /** Real `vars` keys found in this binding's phonebook entries (sorted, deduped). */
  varKeys: string[];
  onChange: (patch: Partial<IRoutePhonebookBinding>) => void;
}

/**
 * Conditional preset params (D-26): 1-2 fields per preset via a simple
 * var-key/fixed-value source toggle, or the DialplanAppsEditor for 'custom'.
 * On_no_match forces the fixed-value variant (var-key variants are excluded
 * from the preset select itself, see ON_NO_MATCH_ALLOWED).
 */
const BindingParamsFields = memo(({ binding, varKeys, onChange }: BindingParamsFieldsProps) => {
  const { t } = useTranslation();
  const params: IPhonebookBehaviorParams = binding.behavior_params || {};
  const isNoMatch = binding.match_mode === 'on_no_match';

  const setParams = (patch: IPhonebookBehaviorParams) => onChange({ behavior_params: patch });

  switch (normalizePhonebookBehaviorType(binding.behavior_type)) {
    case 'set_name': {
      if (isNoMatch) {
        return (
          <HStack gap="8" align="center" className={cls.paramsRow}>
            <Text variant="small" className={cls.paramsLabel}>
              {t('routes.phonebooks.params.fixedName', 'Фикс. имя')}
            </Text>
            <Input
              className={cls.paramsInput}
              value={params.fixed || ''}
              onChange={(e) => setParams({ fixed: e.target.value })}
              placeholder={t('routes.phonebooks.params.fixedNamePlaceholder', 'Иванов И.И.')}
            />
          </HStack>
        );
      }
      const mode = params.fixed !== undefined ? 'fixed' : 'var';
      return (
        <VStack gap="0" max className={cls.paramsRow}>
          <HStack gap="8" align="center" max>
            <Select
              className={cls.paramsModeSelect}
              value={mode}
              onChange={(e) => setParams(e.target.value === 'fixed' ? { fixed: '' } : { var_key: params.var_key })}
            >
              <option value="var">{t('routes.phonebooks.params.byVar', 'По переменной')}</option>
              <option value="fixed">{t('routes.phonebooks.params.byFixed', 'Фикс. значение')}</option>
            </Select>
            {mode === 'var' ? (
              <VarKeyField
                value={params.var_key}
                availableKeys={varKeys}
                onChange={(v) => setParams({ var_key: v })}
              />
            ) : (
              <Input
                className={cls.paramsInput}
                value={params.fixed || ''}
                onChange={(e) => setParams({ fixed: e.target.value })}
                placeholder={t('routes.phonebooks.params.fixedNamePlaceholder', 'Иванов И.И.')}
              />
            )}
          </HStack>
          {mode === 'var' && <VarKeyStatusHint varKey={params.var_key} availableKeys={varKeys} />}
        </VStack>
      );
    }
    case 'set_number': {
      const mode = params.fixed !== undefined ? 'fixed' : 'var';
      return (
        <VStack gap="0" max className={cls.paramsRow}>
          <HStack gap="8" align="center" max>
            <Select
              className={cls.paramsModeSelect}
              value={mode}
              onChange={(e) => setParams(e.target.value === 'fixed' ? { fixed: '' } : { var_key: params.var_key })}
            >
              <option value="var">{t('routes.phonebooks.params.byVar', 'По переменной')}</option>
              <option value="fixed">{t('routes.phonebooks.params.byFixed', 'Фикс. значение')}</option>
            </Select>
            {mode === 'var' ? (
              <VarKeyField
                value={params.var_key}
                availableKeys={varKeys}
                onChange={(v) => setParams({ var_key: v })}
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
          {mode === 'var' && <VarKeyStatusHint varKey={params.var_key} availableKeys={varKeys} />}
        </VStack>
      );
    }
    case 'redirect': {
      if (isNoMatch) {
        return (
          <HStack gap="8" align="center" className={cls.paramsRow}>
            <Text variant="small" className={cls.paramsLabel}>
              {t('routes.phonebooks.params.fixedExten', 'Фикс. номер')}
            </Text>
            <Input
              className={cls.paramsInput}
              value={params.fixed_exten || ''}
              onChange={(e) => setParams({ fixed_exten: e.target.value })}
              placeholder="200"
            />
          </HStack>
        );
      }
      const mode = params.fixed_exten !== undefined ? 'fixed' : 'var';
      return (
        <VStack gap="0" max className={cls.paramsRow}>
          <HStack gap="8" align="center" max>
            <Select
              className={cls.paramsModeSelect}
              value={mode}
              onChange={(e) => setParams(e.target.value === 'fixed' ? { fixed_exten: '' } : { var_key: params.var_key })}
            >
              <option value="var">{t('routes.phonebooks.params.byVar', 'По переменной')}</option>
              <option value="fixed">{t('routes.phonebooks.params.byFixed', 'Фикс. значение')}</option>
            </Select>
            {mode === 'var' ? (
              <VarKeyField
                value={params.var_key}
                availableKeys={varKeys}
                onChange={(v) => setParams({ var_key: v })}
              />
            ) : (
              <Input
                className={cls.paramsInput}
                value={params.fixed_exten || ''}
                onChange={(e) => setParams({ fixed_exten: e.target.value })}
                placeholder="200"
              />
            )}
          </HStack>
          {mode === 'var' && <VarKeyStatusHint varKey={params.var_key} availableKeys={varKeys} />}
        </VStack>
      );
    }
    case 'custom':
      return (
        <VStack gap="8" className={cls.customBlock}>
          <DialplanAppsEditor
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
              ? 'routes.phonebooks.params.dropHintOnNoMatch'
              : 'routes.phonebooks.params.dropHintOnMatch',
            binding.match_mode === 'on_no_match'
              ? 'Номера нет в справочнике — звонок сбрасывается. Пропускаются только номера из списка.'
              : 'Номер найден в справочнике — звонок сбрасывается. Остальные проходят дальше.',
          )}
        </Text>
      );
    default:
      // vars_only — no params (D-26)
      return null;
  }
});

BindingParamsFields.displayName = 'BindingParamsFields';

interface VarKeyFieldProps {
  /** Current stored var_key, or undefined if not yet set. */
  value: string | undefined;
  /** Real `vars` keys found in the selected phonebook's entries (sorted). */
  availableKeys: string[];
  onChange: (key: string) => void;
}

/**
 * Picks a phonebook `vars` key to read at dialplan time (${PB_<key>}).
 *
 * No hardcoded naming conventions: the select only lists keys that actually
 * exist in this phonebook's entries, and the choice is mandatory — the
 * dialplan generator emits nothing for a var-based preset without var_key.
 * If exactly one key exists, it is auto-selected. Falls back to a disabled
 * state (with a hint) when the phonebook has no vars at all.
 */
const VarKeyField = memo(({ value, availableKeys, onChange }: VarKeyFieldProps) => {
  const { t } = useTranslation();

  // Single real key — nothing to choose, pick it automatically.
  useEffect(() => {
    if (availableKeys.length === 1 && value !== availableKeys[0]) {
      onChange(availableKeys[0]);
    }
  }, [availableKeys, value, onChange]);

  if (availableKeys.length === 0) {
    return (
      <div className={cls.varKeyWrapper}>
        <Select className={cls.varKeySelect} value="" disabled>
          <option value="">{t('routes.phonebooks.params.noVarsOption', 'Нет переменных в справочнике')}</option>
        </Select>
      </div>
    );
  }

  const selectValue = value && availableKeys.includes(value) ? value : '';

  return (
    <div className={cls.varKeyWrapper}>
      <Select
        className={cls.varKeySelect}
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
      >
        {!selectValue && (
          <option value="" disabled>
            {t('routes.phonebooks.params.selectVarKey', 'Выберите переменную')}
          </option>
        )}
        {availableKeys.map((key) => (
          <option key={key} value={key}>{key}</option>
        ))}
      </Select>
    </div>
  );
});

VarKeyField.displayName = 'VarKeyField';

interface VarKeyStatusHintProps {
  varKey: string | undefined;
  availableKeys: string[];
}

/**
 * Context line under a var-based preset: explains where the value comes from,
 * or warns that the preset is inert (no vars / nothing selected) — mirrors the
 * generator, which emits no dialplan action without a valid var_key.
 */
const VarKeyStatusHint = memo(({ varKey, availableKeys }: VarKeyStatusHintProps) => {
  const { t } = useTranslation();

  if (availableKeys.length === 0) {
    return (
      <Text variant="small" className={`${cls.varKeyHintRow} ${cls.varKeyWarn}`}>
        {t(
          'routes.phonebooks.params.noVarsHint',
          'В справочнике нет переменных - добавьте их в записи справочника (колонка «Переменные»), затем выберите здесь',
        )}
      </Text>
    );
  }

  if (!varKey || !availableKeys.includes(varKey)) {
    return (
      <Text variant="small" className={`${cls.varKeyHintRow} ${cls.varKeyWarn}`}>
        {t(
          'routes.phonebooks.params.varKeyRequiredHint',
          'Выберите переменную, иначе действие не сработает',
        )}
      </Text>
    );
  }

  return (
    <Text variant="small" className={`${cls.varKeyHintRow} ${cls.varKeyHint}`}>
      {t(
        'routes.phonebooks.params.varKeyDynamicHint',
        'Значение «{{key}}» берётся из записи справочника, найденной по номеру звонящего',
        { key: varKey },
      )}
    </Text>
  );
});

VarKeyStatusHint.displayName = 'VarKeyStatusHint';
