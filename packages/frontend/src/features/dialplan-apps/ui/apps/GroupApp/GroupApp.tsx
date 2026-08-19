import { memo, useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useGetCallGroupsQuery } from '@/shared/api/endpoints/callGroupApi';
import {
  CallGroupFormModal,
  callGroupsPageActions,
} from '@/features/call-groups';
import type { ICallGroup } from '@krasterisk/shared';
import { IDialplanAppProps } from '../../../model/types';
import cls from './GroupApp.module.scss';

export const GroupApp = memo(({ params, onChange, readOnly, actionType }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: callGroups = [] } = useGetCallGroupsQuery();

  const selectedGroup = String(params?.group ?? '');
  const selectedUid = selectedGroup ? Number(selectedGroup) : NaN;
  const hasValidSelection = Number.isFinite(selectedUid) && selectedUid > 0;

  const handleGroupChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      // Store numeric call_group uid as string (Gosub target consistency)
      onChange({ group: value });
    },
    [onChange],
  );

  const handleOpenModal = useCallback(() => {
    if (hasValidSelection) {
      dispatch(callGroupsPageActions.openEditModal(selectedUid));
    } else {
      dispatch(callGroupsPageActions.openCreateModal());
    }
  }, [dispatch, hasValidSelection, selectedUid]);

  const handleSaved = useCallback(
    (group: ICallGroup) => {
      const nextUid = String(group.uid);
      onChange({ group: nextUid });
    },
    [onChange],
  );

  return (
    <div className={cls.root}>
      <div className={cls.row}>
        <Select
          className={cls.select}
          value={selectedGroup}
          onChange={handleGroupChange}
          aria-label={t('routes.apps.group.selectGroup', 'Select call group')}
        >
          <option value="">
            {t('routes.apps.group.selectGroup', 'Select call group')}
          </option>
          {callGroups.map((g) => (
            <option key={g.uid} value={String(g.uid)}>
              {g.name}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="outline"
          className={cls.actionBtn}
          onClick={handleOpenModal}
        >
          {hasValidSelection
            ? t('routes.apps.group.editGroup', 'Edit group')
            : t('routes.apps.group.createGroup', 'Create group')}
        </Button>
      </div>
      <CallGroupFormModal onSaved={handleSaved} />
    </div>
  );
});

GroupApp.displayName = 'GroupApp';
