import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Text, Label, InfoTooltip, QueryErrorState } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useGetDirectoryQuery } from '@/shared/api/endpoints/directoryApi';
import { DialplanAppsEditor } from '../DialplanAppsEditor/DialplanAppsEditor';
import { allowedTypesForHost } from '../../model/hostTypes';
import { DirectoryLookupOutputsField } from '../DirectoryLookupOutputsField';
import type {
  DirectoryBehaviorType,
  DirectoryFieldType,
  IDirectoryBehaviorParams,
  IDirectoryLookupParams,
  IRouteDirectoryBinding,
} from '@krasterisk/shared';
import cls from './DirectoryPolicyEditor.module.scss';
const POLICY_PRESETS: DirectoryBehaviorType[] = [
  'set_name',
  'set_number',
  'redirect',
  'map_fields',
  'drop',
  'custom',
];
export function DirectoryPolicyEditor({
  params,
  onChange,
  readOnly,
}: {
  params: IDirectoryLookupParams;
  onChange: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const behavior = params.behavior;
  const binding: IRouteDirectoryBinding = {
    directory_uid: Number(params.directoryUid) || 0,
    position: 0,
    key_source: params.keySource,
    match_mode: params.matchMode ?? 'on_match',
    behavior_type: behavior ?? 'map_fields',
    behavior_params: params.behaviorParams,
    actions: params.actions,
  };
  return (
    <VStack gap="12" align="stretch" max className={cls.editor}>
      <VStack gap="8" align="stretch" max>
        <HStack gap="4">
          <Label>{t('routes.directories.behaviorLabel')}</Label>
          <InfoTooltip text={t('routes.chain.directoryLookup.behaviorHint')} />
        </HStack>
        <Select
          disabled={readOnly}
          aria-label={t('routes.directories.behaviorLabel')}
          value={behavior ?? ''}
          onChange={(e) =>
            onChange({
              behavior: e.target.value || undefined,
              matchMode: params.matchMode ?? 'on_match',
              behaviorParams:
                e.target.value === 'map_fields' ? { mappings: [] } : {},
              actions:
                e.target.value === 'custom' ? (params.actions ?? []) : [],
            })
          }
        >
          <option value="">
            {t('routes.chain.directoryLookup.copyFields')}
          </option>
          {POLICY_PRESETS.map((type) => (
            <option key={type} value={type}>
              {t('routes.directories.behavior.' + type)}
            </option>
          ))}
        </Select>
      </VStack>
      {behavior && (
        <>
          <VStack gap="8" align="stretch" max>
            <Label>{t('routes.directories.matchModeLabel')}</Label>
            <Select
              disabled={readOnly}
              aria-label={t('routes.directories.matchModeLabel')}
              value={params.matchMode ?? 'on_match'}
              onChange={(e) => onChange({ matchMode: e.target.value })}
            >
              <option value="on_match">
                {t('routes.directories.matchMode.on_match')}
              </option>
              <option value="on_no_match">
                {t('routes.directories.matchMode.on_no_match')}
              </option>
            </Select>
          </VStack>
          <BindingParamsFields
            readOnly={readOnly}
            binding={binding}
            onChange={(patch) =>
              onChange({
                behaviorParams: patch.behavior_params ?? params.behaviorParams,
                actions: patch.actions ?? params.actions,
              })
            }
          />
        </>
      )}
    </VStack>
  );
}
function DirectoryFieldSelect({
  directoryUid,
  value,
  onChange,
  expectedType,
  readOnly,
}: {
  directoryUid: number;
  value: number | undefined;
  onChange: (uid: number) => void;
  expectedType?: DirectoryFieldType;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const query = useGetDirectoryQuery(directoryUid, { skip: directoryUid <= 0 });
  const fields = (query.data?.fields ?? []).filter(
    (field) =>
      !expectedType || field.type === expectedType || field.uid === value,
  );

  return (
    <Select
      disabled={readOnly}
      className={cls.fieldSelect}
      value={value && value > 0 ? String(value) : ''}
      aria-label={t('routes.chain.directoryLookup.selectField', 'Поле записи')}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    >
      <option value="">
        {t('routes.chain.source.selectVarKeyPlaceholder', 'Выберите поле')}
      </option>
      {fields.map((field) => (
        <option key={field.uid} value={String(field.uid)}>
          {field.label}
        </option>
      ))}
    </Select>
  );
}

interface BindingParamsFieldsProps {
  binding: IRouteDirectoryBinding;
  onChange: (patch: Partial<IRouteDirectoryBinding>) => void;
  readOnly?: boolean;
}

const BindingParamsFields = memo(
  ({ binding, onChange, readOnly }: BindingParamsFieldsProps) => {
    const { t } = useTranslation();
    const params: IDirectoryBehaviorParams = binding.behavior_params || {};
    const setParams = (patch: IDirectoryBehaviorParams) =>
      onChange({
        behavior_params:
          binding.behavior_type === 'redirect'
            ? { targetContext: params.targetContext, ...patch }
            : patch,
      });

    switch (binding.behavior_type) {
      case 'set_name':
        return (
          <HStack gap="8" align="center" className={cls.paramsRow}>
            <Text variant="small" className={cls.paramsLabel}>
              {t('routes.directories.params.field', 'Поле')}
            </Text>
            <DirectoryFieldSelect
              readOnly={readOnly}
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
              disabled={readOnly}
              className={cls.paramsModeSelect}
              aria-label={t('routes.chain.source.aria')}
              value={mode}
              onChange={(e) =>
                setParams(
                  e.target.value === 'fixed'
                    ? { fixed: '' }
                    : { fieldUid: params.fieldUid },
                )
              }
            >
              <option value="field">
                {t('routes.directories.params.byField', 'Из поля')}
              </option>
              <option value="fixed">
                {t('routes.directories.params.byFixed', 'Фикс. значение')}
              </option>
            </Select>
            {mode === 'field' ? (
              <DirectoryFieldSelect
                readOnly={readOnly}
                directoryUid={binding.directory_uid}
                value={params.fieldUid}
                expectedType="phone"
                onChange={(fieldUid) => setParams({ fieldUid })}
              />
            ) : (
              <Input
                disabled={readOnly}
                className={cls.paramsInput}
                aria-label={t('routes.directories.params.byFixed')}
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
              disabled={readOnly}
              className={cls.paramsModeSelect}
              aria-label={t('routes.chain.source.aria')}
              value={mode}
              onChange={(e) =>
                setParams(
                  e.target.value === 'fixed'
                    ? { fixedExten: '' }
                    : { fieldUid: params.fieldUid },
                )
              }
            >
              <option value="field">
                {t('routes.directories.params.byField', 'Из поля')}
              </option>
              <option value="fixed">
                {t('routes.directories.params.byFixed', 'Фикс. значение')}
              </option>
            </Select>
            {mode === 'field' ? (
              <DirectoryFieldSelect
                readOnly={readOnly}
                directoryUid={binding.directory_uid}
                value={params.fieldUid}
                expectedType="phone"
                onChange={(fieldUid) => setParams({ fieldUid })}
              />
            ) : (
              <Input
                disabled={readOnly}
                className={cls.paramsInput}
                aria-label={t('routes.directories.params.byFixed')}
                value={params.fixedExten || ''}
                onChange={(e) => setParams({ fixedExten: e.target.value })}
                placeholder="200"
              />
            )}
            <RedirectContextField value={params.targetContext} readOnly={readOnly} onChange={targetContext=>setParams({...params,targetContext:targetContext||undefined})}/>
          </HStack>
        );
      }
      case 'map_fields':
        return (
          <VStack gap="8" className={cls.customBlock}>
            <DirectoryLookupOutputsField
              readOnly={readOnly}
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
              readOnly={readOnly}
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
  },
);

BindingParamsFields.displayName = 'BindingParamsFields';

function RedirectContextField({value,onChange,readOnly}:{value?:string;onChange:(value:string)=>void;readOnly?:boolean}){
 const {t}=useTranslation(); const query=useGetContextsQuery(); const contexts=query.data??[];
 return <VStack gap="4" align="stretch" max className={cls.contextField}>
  <HStack gap="4"><Label>{t('routes.context')}</Label><InfoTooltip text={t('routes.directories.params.redirectContextHint')}/></HStack>
  <Select aria-label={t('routes.context')} value={value??''} disabled={readOnly||query.isLoading} onChange={event=>onChange(event.target.value)}>
   <option value="">{t('routes.directories.params.currentContext')}</option>
   {value&&!contexts.some(context=>context.name===value)&&<option value={value}>{value}</option>}
   {contexts.map(context=><option key={context.uid} value={context.name}>{context.name}{context.comment?' ('+context.comment+')':''}</option>)}
  </Select>
  {query.isError&&<QueryErrorState message={t('routes.directories.params.contextLoadError')} retryLabel={t('common.retry')} onRetry={()=>void query.refetch()}/>}
 </VStack>;
}
