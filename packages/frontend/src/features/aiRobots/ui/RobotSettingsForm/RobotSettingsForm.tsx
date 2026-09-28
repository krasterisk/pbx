import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AiVoiceRobotConfig, AiVoiceConfigIssue } from '@krasterisk/shared';
import { Button, Input, Label, Textarea, Select, Switch, Text, InfoTooltip, MultiSelect, RadioCards, HStack, VStack } from '@/shared/ui';
import { useGetAiProvidersQuery } from '@/shared/api/endpoints/aiAgentsApi';
import { useGetAiToolsQuery, useGetKnowledgeBasesQuery } from '../../api/aiToolsApi';
import { changeRobotModel, voiceChoices } from '../../model/voiceChoices';
import cls from './RobotSettingsForm.module.scss';

type Section = 'prompt' | 'tools' | 'parameters' | 'vad' | 'pipeline';
const sections: Section[] = ['prompt', 'tools', 'parameters', 'vad', 'pipeline'];
const fieldSection = (field: keyof AiVoiceRobotConfig): Section => {
  if (['instruction', 'greeting'].includes(field)) return 'prompt';
  if (['toolIds', 'mcpServerIds', 'knowledgeBaseIds', 'allowHangup', 'allowTransfer', 'transferTargets', 'analytic'].includes(field)) return 'tools';
  if (['vadThreshold', 'prefixPaddingMs', 'silenceDurationMs', 'idleTimeoutMs', 'turnDetection', 'noiseReduction', 'semanticEagerness'].includes(field)) return 'vad';
  if (['mode', 'modelProfileId', 'sttProfileId', 'ttsProfileId', 'ttsVoice'].includes(field)) return 'pipeline';
  return 'parameters';
};

interface Props {
  value: AiVoiceRobotConfig;
  onChange: (value: AiVoiceRobotConfig) => void;
  issues?: AiVoiceConfigIssue[];
  disabled?: boolean;
}

export function RobotSettingsForm({ value, onChange, issues = [], disabled = false }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Section | null>('prompt');
  const { data: providers = [] } = useGetAiProvidersQuery();
  const { data: tools = [] } = useGetAiToolsQuery();
  const { data: bases = [] } = useGetKnowledgeBasesQuery();
  const label = (key: string) => t(`aiVoiceDesigner.${key}`);
  const change = <K extends keyof AiVoiceRobotConfig>(key: K, next: AiVoiceRobotConfig[K]) =>
    onChange(key === 'model' && value.mode === 'realtime' ? changeRobotModel(value, String(next)) : { ...value, [key]: next });
  const firstIssue = issues[0]?.field;
  useEffect(() => {
    if (!firstIssue) return;
    document.getElementById(`robot-${firstIssue}`)?.focus();
  }, [firstIssue]);
  const error = (key: keyof AiVoiceRobotConfig) => issues.find(issue => issue.field === key);
  const field = (key: keyof AiVoiceRobotConfig, child: ReactNode, required = false, hint?: string) => (
    <VStack gap="8" max key={key} className={cls.field}>
      <HStack gap="4"><Label htmlFor={`robot-${key}`}>{label(key)}{required ? ' *' : ''}</Label>
        {hint ? <InfoTooltip text={label(hint)} /> : null}</HStack>
      {child}
      {error(key) ? <Text id={`robot-${key}-error`} variant="error" role="alert">{label(error(key)!.code)}</Text> : null}
    </VStack>
  );
  const input = (key: keyof AiVoiceRobotConfig, required = false, multiline = false) => field(key,
    multiline ? <Textarea id={`robot-${key}`} value={String(value[key])} rows={key === 'instruction' ? 10 : 3}
      disabled={disabled} aria-invalid={!!error(key)} aria-describedby={error(key) ? `robot-${key}-error` : undefined}
      onChange={event => change(key, event.target.value)} />
      : <Input id={`robot-${key}`} value={String(value[key] ?? '')} disabled={disabled}
        aria-invalid={!!error(key)} aria-describedby={error(key) ? `robot-${key}-error` : undefined}
        onChange={event => change(key, event.target.value)} />, required);
  const numeric = (key: keyof AiVoiceRobotConfig, min: number, max: number, step = 1) => field(key,
    <HStack gap="12" max className={cls.numeric}>
      <Input type="range" aria-label={label(key)} min={min} max={max} step={step} value={Number(value[key])}
        disabled={disabled} onChange={event => change(key, Number(event.target.value))} />
      <Input id={`robot-${key}`} type="number" min={min} max={max} step={step} value={Number(value[key])}
        disabled={disabled} aria-invalid={!!error(key)} onChange={event => change(key, Number(event.target.value))} />
    </HStack>);
  const toggle = (key: 'enabled' | 'analytic' | 'allowHangup' | 'allowTransfer' | 'interruptResponse') => (
    <HStack gap="12" key={key} className={cls.toggle}>
      <Switch id={`robot-${key}`} checked={value[key]} disabled={disabled} onCheckedChange={next => change(key, next)} />
      <Label htmlFor={`robot-${key}`}>{label(key)}</Label>
    </HStack>
  );
  const select = (key: keyof AiVoiceRobotConfig, values: string[], hint?: string) => field(key,
    <Select id={`robot-${key}`} value={String(value[key])} disabled={disabled} onChange={event => change(key, event.target.value)}>
      {values.map(item => <option key={item} value={item}>{item || label('choose')}</option>)}
    </Select>, false, hint);
  const provider = (key: 'modelProfileId' | 'sttProfileId' | 'ttsProfileId', capability: string) => field(key,
    <Select id={`robot-${key}`} value={value[key] ?? ''} disabled={disabled} aria-invalid={!!error(key)}
      onChange={event => {
        const uid = event.target.value ? Number(event.target.value) : null;
        if (key === 'modelProfileId' && value.mode === 'realtime' && uid !== value.modelProfileId) {
          const selected = providers.find(row => row.uid === uid);
          const model = typeof selected?.defaults?.model === 'string' ? selected.defaults.model : '';
          const format = selected?.vendor === 'qwen' ? 'pcm16' : selected?.vendor === 'openai' ? 'g711_alaw' : undefined;
          onChange({ ...changeRobotModel(value, model), modelProfileId: uid, voice: '',
            ...(format ? { inputAudioFormat: format, outputAudioFormat: format } : {}) });
        } else change(key, uid);
      }}>
      <option value="">{label('choose')}</option>
      {providers.filter(row => row.enabled && row.capabilities.some(item => item === capability)).map(row => (
        <option key={row.uid} value={row.uid}>{row.name} ({row.vendor})</option>
      ))}
    </Select>, true);
  const list = (key: 'toolIds' | 'mcpServerIds' | 'knowledgeBaseIds', rows: Array<{ id: string; name: string }>) => field(key,
    disabled ? <Text>{rows.filter(row => value[key].includes(row.id)).map(row => row.name).join(', ') || label('noOptions')}</Text>
      : <MultiSelect value={value[key]} onChange={next => change(key, next)} searchable placeholder={label('choose')}
        options={rows.map(row => ({ value: row.id, label: row.name }))} />);

  const content: Record<Section, ReactNode> = {
    prompt: <>{input('instruction', true, true)}{input('greeting', false, true)}</>,
    tools: <>{list('toolIds', tools.filter(row => row.kind !== 'mcp'))}{list('mcpServerIds', tools.filter(row => row.kind === 'mcp'))}
      {list('knowledgeBaseIds', bases)}{toggle('analytic')}{toggle('allowHangup')}{toggle('allowTransfer')}
      {value.allowTransfer ? field('transferTargets', <Input id="robot-transferTargets" disabled={disabled}
        value={value.transferTargets.join(', ')} onChange={event => change('transferTargets', event.target.value.split(',').map(item => item.trim()).filter(Boolean))} />) : null}</>,
    parameters: <>{input('name', true)}{input('uniqueId', true)}{toggle('enabled')}
      {value.mode === 'realtime' ? <>{input('model')}
        {select('voice', voiceChoices(providers.find(row => row.uid === value.modelProfileId)?.vendor ?? '', value.model, value.voice))}</> : null}
      {numeric('temperature', 0.6, 1.2, 0.1)}
      {field('maxResponseOutputTokens', <Input id="robot-maxResponseOutputTokens" disabled={disabled}
        value={value.maxResponseOutputTokens} placeholder="4096/inf" onChange={event => change('maxResponseOutputTokens', event.target.value === 'inf' ? 'inf' : Number(event.target.value))} />)}
      {input('inputTranscriptionModel')}{input('inputTranscriptionLanguage')}{input('outputTranscriptionModel')}
      {value.mode === 'realtime' ? <>{select('inputAudioFormat', ['g711_alaw', 'g711_ulaw', 'pcm16'])}{select('outputAudioFormat', ['g711_alaw', 'g711_ulaw', 'pcm16'])}</> : null}
      {input('comment', false, true)}{numeric('maxCallMs', 1000, 3600000, 1000)}</>,
    vad: <>{select('turnDetection', ['server_vad', 'none'], 'vadHint')}
      {value.mode === 'realtime' ? <>{select('noiseReduction', ['none', 'near_field', 'far_field'], 'noiseHint')}
        {input('semanticEagerness')}{toggle('interruptResponse')}</> : null}
      {numeric('vadThreshold', 0, 1, 0.01)}{numeric('prefixPaddingMs', 0, 1000, 50)}
      {numeric('silenceDurationMs', 100, 5000, 100)}{numeric('idleTimeoutMs', 6000, 60000, 1000)}</>,
    pipeline: <><InfoTooltip text={label('pipelineHint')} />
      <RadioCards value={value.mode} disabled={disabled} ariaLabel={label('pipeline')}
        options={[{ value: 'realtime', label: label('realtime') }, { value: 'cascade', label: label('cascade') }]}
        onChange={next => change('mode', next as AiVoiceRobotConfig['mode'])} />
      {provider('modelProfileId', value.mode === 'realtime' ? 'realtime' : 'llm')}
      {value.mode === 'cascade' ? <>{provider('sttProfileId', 'stt')}{input('model')}{provider('ttsProfileId', 'tts')}{input('ttsVoice')}</> : null}</>,
  };
  const expanded = issues.length ? fieldSection(issues[0].field) : open;
  return <VStack gap="12" max className={cls.form}>
    {sections.map(section => <VStack key={section} max className={cls.section}>
      <Button type="button" variant="ghost" className={cls.heading} aria-expanded={expanded === section}
        aria-controls={`robot-section-${section}`} onClick={() => setOpen(open === section ? null : section)}>
        {expanded === section ? <ChevronDown size={18} /> : <ChevronRight size={18} />}<Text>{label(section)}</Text>
      </Button>
      {expanded === section ? <VStack id={`robot-section-${section}`} gap="16" max className={cls.body}>{content[section]}</VStack> : null}
    </VStack>)}
  </VStack>;
}
