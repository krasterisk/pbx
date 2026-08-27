import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Upload } from 'lucide-react';
import { Button } from '@/shared/ui';
import {
  useCreateVoiceRobotKeywordGroupMutation,
  useCreateVoiceRobotKeywordMutation,
  useUpdateVoiceRobotMutation,
} from '@/shared/api/endpoints/voiceRobotsApi';
import { useCreateVoiceRobotDataListMutation } from '@/shared/api/endpoints/voiceRobotDataListsApi';
import { applyScenarioImport } from '../../model/applyScenarioImport';
import { parseScenarioExport } from '../../model/scenarioExport';
import type { IVoiceRobot } from '@/entities/voiceRobot';

interface ScenarioImportButtonProps {
  robotId: number;
  className?: string;
  onImportedRobotFields?: (patch: Partial<IVoiceRobot>) => void;
}

export const ScenarioImportButton = memo(({
  robotId,
  className,
  onImportedRobotFields,
}: ScenarioImportButtonProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [createGroup] = useCreateVoiceRobotKeywordGroupMutation();
  const [createKeyword] = useCreateVoiceRobotKeywordMutation();
  const [createDataList] = useCreateVoiceRobotDataListMutation();
  const [updateRobot] = useUpdateVoiceRobotMutation();

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const parsed = parseScenarioExport(JSON.parse(await file.text()));
        const result = await applyScenarioImport(parsed, {
          createDataList: (data) => createDataList({ robotId, data }).unwrap(),
          createGroup: (data) => createGroup({ robotId, data }).unwrap(),
          createKeyword: (groupId, data) => createKeyword({ groupId, data }).unwrap(),
          updateRobot: (data) => updateRobot({ uid: robotId, data }).unwrap(),
        });
        onImportedRobotFields?.(result.robotPatch);
        toast.success(
          t(
            'voiceRobots.preview.importSuccess',
            'Импортировано: {{groups}} групп, {{keywords}} сценариев, {{lists}} справочников',
            {
              groups: result.groups,
              keywords: result.keywords,
              lists: result.dataLists,
            },
          ),
        );
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        const message =
          code === 'invalid-format' || code === 'unsupported-version' || code === 'invalid-scenario' || code === 'invalid-json'
            ? t('voiceRobots.preview.importInvalid', 'Файл не является экспортом сценария робота')
            : t('voiceRobots.preview.importFailed', 'Не удалось импортировать сценарий');
        toast.error(message);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [createDataList, createGroup, createKeyword, onImportedRobotFields, robotId, t, updateRobot],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-1.5" />
        {busy
          ? t('voiceRobots.preview.importing', 'Импорт…')
          : t('voiceRobots.preview.importJson', 'Импорт JSON')}
      </Button>
    </>
  );
});

ScenarioImportButton.displayName = 'ScenarioImportButton';
