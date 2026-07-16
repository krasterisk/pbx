import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Loader,
  MultiSelect,
  Select,
  Text,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useCreatePlatformHubModuleMutation,
  useGetPlatformHubModulesQuery,
  useReorderPlatformHubModulesMutation,
  useReplacePlatformHubModulePagesMutation,
  useUpdatePlatformHubModuleMutation,
  type IPlatformHubModule,
} from '@/shared/api/endpoints/cloudAdminApi';
import { HUB_PAGE_OPTIONS, pathForPageCode } from '../lib/hubPageOptions';
import cls from './PlatformCatalogEditor.module.scss';

/**
 * Platform Hub catalog: reorder, base/market badges, page→module membership (D-21).
 */
export function PlatformCatalogEditor() {
  const { t } = useTranslation();
  const { data: modules, isLoading } = useGetPlatformHubModulesQuery();
  const [reorder] = useReorderPlatformHubModulesMutation();
  const [updateModule] = useUpdatePlatformHubModuleMutation();
  const [replacePages] = useReplacePlatformHubModulePagesMutation();
  const [createModule, { isLoading: creating }] = useCreatePlatformHubModuleMutation();

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [draftPages, setDraftPages] = useState<string[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<'base' | 'market'>('market');

  const sorted = useMemo(
    () => [...(modules ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [modules],
  );

  const selectModule = (mod: IPlatformHubModule) => {
    setSelectedCode(mod.code);
    setDraftPages((mod.pages ?? []).map((p) => p.page_code));
  };

  const move = async (code: string, direction: -1 | 1) => {
    const codes = sorted.map((m) => m.code);
    const idx = codes.indexOf(code);
    const next = idx + direction;
    if (idx < 0 || next < 0 || next >= codes.length) return;
    const swapped = [...codes];
    [swapped[idx], swapped[next]] = [swapped[next], swapped[idx]];
    await reorder({ codes: swapped });
  };

  const changeKind = async (mod: IPlatformHubModule, kind: 'base' | 'market') => {
    if (mod.kind === kind) return;
    if (mod.kind === 'base' && kind === 'market') {
      const ok = window.confirm(
        t(
          'marketplace.removeFromBaseConfirm',
          'Remove module from base composition: this affects all tenants without an override. Continue?',
        ),
      );
      if (!ok) return;
    }
    await updateModule({ code: mod.code, data: { kind } });
  };

  const saveMembership = async () => {
    if (!selectedCode) return;
    const pages = draftPages.map((page_code, idx) => ({
      page_code,
      path: pathForPageCode(page_code),
      sort_order: (idx + 1) * 10,
    }));
    await replacePages({ code: selectedCode, pages });
  };

  const handleCreate = async () => {
    const code = newCode.trim();
    const name = newName.trim();
    if (!code || !name) return;
    await createModule({ code, name, kind: newKind });
    setNewCode('');
    setNewName('');
    setNewKind('market');
  };

  if (isLoading) {
    return (
      <HStack justify="center" className="py-16">
        <Loader size={40} />
      </HStack>
    );
  }

  return (
    <VStack gap="20" max data-testid="platform-catalog-editor">
      <HStack justify="between" align="center" max>
        <Text as="h1">{t('platform.modulesTitle', 'Modules catalog')}</Text>
      </HStack>

      <div className={cls.addForm} data-testid="platform-add-module">
        <div className={cls.field}>
          <span className={cls.label}>code</span>
          <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} id="platform-module-code" />
        </div>
        <div className={cls.field}>
          <span className={cls.label}>name</span>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} id="platform-module-name" />
        </div>
        <div className={cls.field}>
          <span className={cls.label}>kind</span>
          <Select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as 'base' | 'market')}
            id="platform-module-kind"
          >
            <option value="base">{t('platform.kindBase')}</option>
            <option value="market">{t('platform.kindMarket')}</option>
          </Select>
        </div>
        <Button
          type="button"
          onClick={handleCreate}
          disabled={creating || !newCode.trim() || !newName.trim()}
          id="platform-add-module-btn"
        >
          <Plus size={16} className="mr-1" />
          {t('marketplace.addModule', 'Add module')}
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Text variant="muted">{t('platform.noModules')}</Text>
      ) : (
        <div className={cls.list}>
          {sorted.map((mod, index) => {
            const isSelected = selectedCode === mod.code;
            return (
              <div key={mod.code} className={cls.row} data-testid={`platform-module-${mod.code}`}>
                <div className={cls.rowHeader}>
                  <button
                    type="button"
                    className={cls.moduleName}
                    onClick={() => selectModule(mod)}
                    data-testid={`platform-module-select-${mod.code}`}
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                  >
                    {mod.name}
                    <Text variant="muted" as="span" style={{ marginLeft: 8, fontSize: 12 }}>
                      {mod.code}
                    </Text>
                  </button>

                  <Badge
                    className={mod.kind === 'base' ? cls.badgeBase : cls.badgeMarket}
                    data-testid={`badge-${mod.kind}-${mod.code}`}
                  >
                    {mod.kind === 'base' ? t('platform.kindBase') : t('platform.kindMarket')}
                  </Badge>

                  <div className={cls.actions}>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t('platform.reorderUp')}
                      disabled={index === 0}
                      onClick={() => move(mod.code, -1)}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t('platform.reorderDown')}
                      disabled={index === sorted.length - 1}
                      onClick={() => move(mod.code, 1)}
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Select
                      value={mod.kind}
                      onChange={(e) => changeKind(mod, e.target.value as 'base' | 'market')}
                      aria-label={`kind-${mod.code}`}
                    >
                      <option value="base">{t('platform.kindBase')}</option>
                      <option value="market">{t('platform.kindMarket')}</option>
                    </Select>
                  </div>
                </div>

                {isSelected && (
                  <div className={cls.membership} data-testid="platform-membership-editor">
                    <Text variant="muted">{t('platform.membershipHint')}</Text>
                    <MultiSelect
                      value={draftPages}
                      onChange={setDraftPages}
                      options={HUB_PAGE_OPTIONS}
                      placeholder={t('platform.membershipLabel')}
                    />
                    <Button type="button" size="sm" onClick={saveMembership} id="platform-save-membership">
                      {t('platform.saveMembership')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </VStack>
  );
}
