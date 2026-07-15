import { memo, useCallback, useState } from 'react';
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

/** All behavior presets, in select order (D-06). */
const ALL_BEHAVIOR_TYPES: PhonebookBehaviorType[] = [
  'set_name', 'set_number', 'blacklist', 'whitelist', 'redirect', 'vars_only', 'custom',
];

/**
 * Presets that stay meaningful with match_mode=on_no_match (D-24): no matched entry
 * means no PB_* vars are available, so var-key-based presets (set_number,
 * set_name-by-var, vars_only) are dropped from the choice — only fixed-value
 * variants and value-independent presets remain.
 */
const ON_NO_MATCH_ALLOWED = new Set<PhonebookBehaviorType>([
  'blacklist', 'whitelist', 'redirect', 'set_name', 'custom',
]);

function getAvailableBehaviorTypes(matchMode: PhonebookMatchMode): PhonebookBehaviorType[] {
  return matchMode === 'on_no_match'
    ? ALL_BEHAVIOR_TYPES.filter((t) => ON_NO_MATCH_ALLOWED.has(t))
    : ALL_BEHAVIOR_TYPES;
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
      let behaviorType = b.behavior_type;
      let params = b.behavior_params;
      if (mode === 'on_no_match' && !ON_NO_MATCH_ALLOWED.has(behaviorType)) {
        behaviorType = 'blacklist';
        params = null;
      }
      return { ...b, match_mode: mode, behavior_type: behaviorType, behavior_params: params };
    }));
  }, [bindings, setBindings]);

  const handleBehaviorTypeChange = useCallback((index: number, type: PhonebookBehaviorType) => {
    setBindings(bindings.map((b, i) => {
      if (i !== index) return b;
      const patch: Partial<IRoutePhonebookBinding> = {
        behavior_type: type,
        behavior_params: null,
        actions: type === 'custom' ? (b.actions || []) : null,
      };
      // whitelist only makes sense on no-match (D-24) — force it so dialplan generation stays consistent
      if (type === 'whitelist') patch.match_mode = 'on_no_match';
      return { ...b, ...patch };
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
                      <option value="on_match">{t('routes.phonebooks.matchMode.on_match', 'При совпадении')}</option>
                      <option value="on_no_match">{t('routes.phonebooks.matchMode.on_no_match', 'При отсутствии')}</option>
                    </Select>

                    <Select
                      className={cls.behaviorSelect}
                      value={binding.behavior_type}
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

  switch (binding.behavior_type) {
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
        <HStack gap="8" align="center" className={cls.paramsRow}>
          <Select
            className={cls.paramsModeSelect}
            value={mode}
            onChange={(e) => setParams(e.target.value === 'fixed' ? { fixed: '' } : { var_key: params.var_key || 'name' })}
          >
            <option value="var">{t('routes.phonebooks.params.byVar', 'По переменной')}</option>
            <option value="fixed">{t('routes.phonebooks.params.byFixed', 'Фикс. значение')}</option>
          </Select>
          {mode === 'var' ? (
            <VarKeyField
              value={params.var_key}
              defaultKey="name"
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
      );
    }
    case 'set_number': {
      const mode = params.fixed !== undefined ? 'fixed' : 'var';
      return (
        <HStack gap="8" align="center" className={cls.paramsRow}>
          <Select
            className={cls.paramsModeSelect}
            value={mode}
            onChange={(e) => setParams(e.target.value === 'fixed' ? { fixed: '' } : { var_key: params.var_key || 'clid' })}
          >
            <option value="var">{t('routes.phonebooks.params.byVar', 'По переменной')}</option>
            <option value="fixed">{t('routes.phonebooks.params.byFixed', 'Фикс. значение')}</option>
          </Select>
          {mode === 'var' ? (
            <VarKeyField
              value={params.var_key}
              defaultKey="clid"
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
        <HStack gap="8" align="center" className={cls.paramsRow}>
          <Select
            className={cls.paramsModeSelect}
            value={mode}
            onChange={(e) => setParams(e.target.value === 'fixed' ? { fixed_exten: '' } : { var_key: params.var_key || 'redirect' })}
          >
            <option value="var">{t('routes.phonebooks.params.byVar', 'По переменной')}</option>
            <option value="fixed">{t('routes.phonebooks.params.byFixed', 'Фикс. значение')}</option>
          </Select>
          {mode === 'var' ? (
            <VarKeyField
              value={params.var_key}
              defaultKey="redirect"
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
    default:
      // blacklist / whitelist / vars_only — no params (D-26)
      return null;
  }
});

BindingParamsFields.displayName = 'BindingParamsFields';

interface VarKeyFieldProps {
  /** Current stored var_key, or undefined if not yet set (falls back to defaultKey). */
  value: string | undefined;
  /** Suggested key when nothing is chosen yet — a naming convention, not real data. */
  defaultKey: string;
  /** Real `vars` keys found in the selected phonebook's entries (sorted). */
  availableKeys: string[];
  onChange: (key: string) => void;
}

/**
 * Picks a phonebook `vars` key to read at dialplan time (${PB_<key>}).
 *
 * UX: shows a dropdown of real keys found in the phonebook's entries as soon
 * as any exist — no extra click needed. Manual free-text entry only appears
 * when the user explicitly picks "Другое" (or when a previously-saved value
 * is a manual key that no longer matches the phonebook's real vars).
 * Falls back to plain free text (with a hint) only if the phonebook has no
 * vars at all yet.
 */
const VarKeyField = memo(({ value, defaultKey, availableKeys, onChange }: VarKeyFieldProps) => {
  const { t } = useTranslation();
  const [manualOverride, setManualOverride] = useState(false);

  if (availableKeys.length === 0) {
    return (
      <VStack gap="2" className={cls.varKeyWrapper}>
        <Input
          className={cls.paramsInput}
          value={value ?? defaultKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultKey}
        />
        <Text variant="small" className={cls.varKeyHint}>
          {t(
            'routes.phonebooks.params.noVarsHint',
            'В справочнике нет заполненных переменных — добавьте их в записи или введите ключ вручную',
          )}
        </Text>
      </VStack>
    );
  }

  // Manual only when explicitly requested, or when a previously-saved value
  // was a manual key that doesn't match this phonebook's real vars.
  const isManual = manualOverride || (!!value && !availableKeys.includes(value));

  if (isManual) {
    return (
      <HStack gap="4" align="center">
        <Input
          className={cls.paramsInput}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultKey}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setManualOverride(false);
            onChange(availableKeys[0]);
          }}
        >
          {t('routes.phonebooks.params.pickFromList', 'Из списка')}
        </Button>
      </HStack>
    );
  }

  const selectValue = value && availableKeys.includes(value) ? value : '';

  return (
    <Select
      className={cls.paramsInput}
      value={selectValue}
      onChange={(e) => {
        if (e.target.value === '__custom__') {
          setManualOverride(true);
          onChange('');
          return;
        }
        onChange(e.target.value);
      }}
    >
      {!selectValue && (
        <option value="">{t('routes.phonebooks.params.selectVarKey', 'Выберите переменную')}</option>
      )}
      {availableKeys.map((key) => (
        <option key={key} value={key}>{key}</option>
      ))}
      <option value="__custom__">{t('routes.phonebooks.params.customKey', 'Другое (ввести вручную)')}</option>
    </Select>
  );
});

VarKeyField.displayName = 'VarKeyField';
