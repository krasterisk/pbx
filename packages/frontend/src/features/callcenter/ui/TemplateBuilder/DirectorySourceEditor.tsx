import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isCardDirectorySource, type CardFieldOptions, type CardDirectorySource } from '@krasterisk/shared';
import { useGetDirectoriesQuery } from '@/shared/api/endpoints/directoryApi';
import { Button, Select, Label, Text, TagInput, VStack } from '@/shared/ui';
import styles from './DirectorySourceEditor.module.scss';

export function DirectorySourceEditor({ value, onChange }: { value?: CardFieldOptions | null; onChange: (value: CardFieldOptions) => void }) {
  const { t } = useTranslation();
  const source = isCardDirectorySource(value) ? value : null;
  return <VStack gap="8">
    <Label>{t('callcenter.cards.builder.choicesSource')}</Label>
    <Select aria-label={t('callcenter.cards.builder.choicesSource')} value={source ? 'directory' : 'manual'} onChange={e => onChange(e.target.value === 'directory' ? { source: 'directory', directoryUid: 0, valueFieldUid: 0, labelFieldUid: 0 } : [])}>
      <option value="manual">{t('callcenter.cards.builder.manualOptions')}</option>
      <option value="directory">{t('callcenter.cards.builder.fromDirectory')}</option>
    </Select>
    {source ? <DirectoryColumns source={source} onChange={onChange} /> : <TagInput aria-label={t('callcenter.cards.builder.options')} value={Array.isArray(value) ? value : []} onChange={onChange} placeholder={t('callcenter.cards.builder.optionsPlaceholder')} />}
  </VStack>;
}

function DirectoryColumns({ source, onChange }: { source: CardDirectorySource; onChange: (value: CardDirectorySource) => void }) {
  const { t } = useTranslation();
  const { data = [], isLoading, isError, refetch } = useGetDirectoriesQuery();
  const directory = data.find(item => item.uid === source.directoryUid);
  const [columnsOpen, setColumnsOpen] = useState(false);
  return <VStack gap="8">
    <Select aria-label={t('callcenter.cards.builder.directory')} value={source.directoryUid || ''} disabled={isLoading} onChange={e => {
      const selected = data.find(item => item.uid === Number(e.target.value));
      const code = selected?.lookup_field_uid ?? selected?.fields?.[0]?.uid ?? 0;
      const label = selected?.fields?.find(field => field.uid !== code && field.type === 'string')?.uid ?? selected?.fields?.find(field => field.uid !== code)?.uid ?? code;
      onChange({ ...source, directoryUid: Number(e.target.value), valueFieldUid: code, labelFieldUid: label });
    }}>
      <option value="">{t('callcenter.cards.builder.chooseDirectory')}</option>
      {data.map(item => <option key={item.uid} value={item.uid}>{item.name}</option>)}
    </Select>
    <Button type="button" variant="ghost" size="sm" aria-expanded={columnsOpen} onClick={() => setColumnsOpen((open) => !open)}>
      {t('callcenter.cards.builder.directoryColumns')}
    </Button>
    {columnsOpen ? (
      <VStack gap="8">
        {(['valueFieldUid', 'labelFieldUid'] as const).map(key => <VStack gap="4" key={key}>
          <Label>{t(`callcenter.cards.builder.${key}`)}</Label>
          <Select aria-label={t(`callcenter.cards.builder.${key}`)} value={source[key] || ''} disabled={!directory} onChange={e => onChange({ ...source, [key]: Number(e.target.value) })}>
            <option value="">{t('callcenter.cards.builder.chooseColumn')}</option>
            {(directory?.fields ?? []).map(field => <option key={field.uid} value={field.uid}>{field.label}</option>)}
          </Select>
        </VStack>)}
      </VStack>
    ) : null}
    <Text variant="muted">{t('callcenter.cards.builder.directoryHelp')}</Text>
    <Link to="/directories" target="_blank" rel="noreferrer" className={styles.link}>{t('callcenter.cards.builder.manageDirectories')}</Link>
    {isError ? <Button type="button" onClick={() => void refetch()}>{t('callcenter.cards.builder.directoryLoadError')} · {t('common.retry')}</Button> : null}
  </VStack>;
}
