import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Loader,
  Select,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { hubPageLabelKey } from '@/features/modules/lib/hubPageLabel';
import { isCatalogManagedPage } from '@/features/modules/lib/catalogNavOrder';
import { getBaselineModule } from '@/features/modules/lib/moduleRegistry';
import {
  useGetPlatformHubModulesQuery,
  useReorderPlatformHubModulesMutation,
  useReplacePlatformHubModulePagesMutation,
  useUpdatePlatformHubModuleMutation,
  type IPlatformHubModule,
} from '@/shared/api/endpoints/cloudAdminApi';
import { HUB_PAGE_OPTIONS, pathForPageCode } from '../lib/hubPageOptions';
import cls from './PlatformCatalogEditor.module.scss';

type HubKind = 'base' | 'market' | 'off';

function kindLabel(kind: HubKind, t: (key: string) => string): string {
  if (kind === 'base') return t('platform.kindBase');
  if (kind === 'off') return t('platform.kindOff');
  return t('platform.kindMarket');
}

function kindBadgeClass(kind: HubKind): string {
  if (kind === 'base') return cls.badgeBase;
  if (kind === 'off') return cls.badgeOff;
  return cls.badgeMarket;
}

interface DraftPage {
  page_code: string;
  path: string | null;
}

function useVerticalSortSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function restrictToVerticalAxis({
  transform,
}: {
  transform: { x: number; y: number; scaleX: number; scaleY: number };
}) {
  return { ...transform, x: 0 };
}

function DragHandle({
  label,
  attributes,
  listeners,
}: {
  label: string;
  attributes: DraggableAttributes;
  listeners?: DraggableSyntheticListeners;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cls.dragHandle}
      {...attributes}
      {...(listeners ?? {})}
      aria-label={label}
    >
      <GripVertical size={16} />
    </Button>
  );
}

function SortablePageRow({
  page,
  label,
  onRemove,
}: {
  page: DraftPage;
  label: string;
  onRemove: (code: string) => void;
}) {
  const { t } = useTranslation();
  const sortable = useSortable({ id: page.page_code });
  return (
    <Flex
      ref={sortable.setNodeRef}
      align="center"
      justify="between"
      gap="8"
      max
      className={[cls.pageRow, sortable.isDragging ? cls.pageRowDragging : ''].filter(Boolean).join(' ')}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      data-testid={`platform-page-${page.page_code}`}
    >
      <HStack gap="8" align="center" className={cls.pageLabel}>
        <DragHandle
          label={`${t('platform.dragHandle')} ${page.page_code}`}
          attributes={sortable.attributes}
          listeners={sortable.listeners}
        />
        <Text as="span">{label}</Text>
      </HStack>
      <TableRowActions>
        <TableRowAction
          danger
          title={t('platform.removePage')}
          aria-label={`${t('platform.removePage')} ${page.page_code}`}
          onClick={() => onRemove(page.page_code)}
        >
          <Trash2 />
        </TableRowAction>
      </TableRowActions>
    </Flex>
  );
}

function SortableModuleCard({
  mod,
  isSelected,
  draftPages,
  pageToAdd,
  availablePages,
  onSelect,
  onKind,
  onPageDragEnd,
  onRemovePage,
  onPageToAdd,
  onAddPage,
  onSave,
}: {
  mod: IPlatformHubModule;
  isSelected: boolean;
  draftPages: DraftPage[];
  pageToAdd: string;
  availablePages: Array<{ value: string; label: string }>;
  onSelect: (mod: IPlatformHubModule) => void;
  onKind: (mod: IPlatformHubModule, kind: HubKind) => void;
  onPageDragEnd: (event: DragEndEvent) => void;
  onRemovePage: (code: string) => void;
  onPageToAdd: (code: string) => void;
  onAddPage: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const sensors = useVerticalSortSensors();
  const sortable = useSortable({ id: mod.code });
  return (
    <Flex
      ref={sortable.setNodeRef}
      direction="column"
      align="stretch"
      gap="12"
      max
      className={[cls.card, sortable.isDragging ? cls.cardDragging : ''].filter(Boolean).join(' ')}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      data-testid={`platform-module-${mod.code}`}
    >
      <HStack align="center" justify="between" gap="12" wrap="wrap" max className={cls.cardHead}>
        <HStack gap="4" align="center" className={cls.toggleWrap}>
          <DragHandle
            label={`${t('platform.dragHandle')} ${mod.code}`}
            attributes={sortable.attributes}
            listeners={sortable.listeners}
          />
          <Button
            type="button"
            variant="ghost"
            className={cls.toggle}
            onClick={() => onSelect(mod)}
            aria-expanded={isSelected}
            data-testid={`platform-module-select-${mod.code}`}
          >
            {isSelected ? (
              <ChevronDown size={16} className={cls.chevron} aria-hidden />
            ) : (
              <ChevronRight size={16} className={cls.chevron} aria-hidden />
            )}
            <VStack gap="2" className={cls.titleBlock}>
              <Text as="span" className={cls.moduleName}>{mod.name}</Text>
              <Text as="span" variant="xs">{mod.code}</Text>
            </VStack>
          </Button>
        </HStack>

        <HStack gap="8" align="center" wrap="wrap" className={cls.actions}>
          <Badge
            className={kindBadgeClass(mod.kind)}
            data-testid={`badge-${mod.kind}-${mod.code}`}
          >
            {kindLabel(mod.kind, t)}
          </Badge>
          <VStack className={cls.kindField}>
            <Select
              value={mod.kind}
              onChange={(e) => onKind(mod, e.target.value as HubKind)}
              id={`kind-${mod.code}`}
              aria-label={`kind-${mod.code}`}
            >
              <option value="base">{t('platform.kindBase')}</option>
              <option value="market">{t('platform.kindMarket')}</option>
              <option value="off">{t('platform.kindOff')}</option>
            </Select>
          </VStack>
        </HStack>
      </HStack>

      {isSelected && (
        <VStack gap="8" max className={cls.membership} data-testid="platform-membership-editor">
          <Text variant="muted">{t('platform.membershipHint')}</Text>
          {draftPages.length === 0 ? (
            <Text variant="muted">{t('platform.pageOrderEmpty')}</Text>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={onPageDragEnd}
            >
              <SortableContext
                items={draftPages.map((page) => page.page_code)}
                strategy={verticalListSortingStrategy}
              >
                <VStack gap="8" max data-testid="platform-page-order">
                  {draftPages.map((page) => (
                    <SortablePageRow
                      key={page.page_code}
                      page={page}
                      label={t(hubPageLabelKey(page))}
                      onRemove={onRemovePage}
                    />
                  ))}
                </VStack>
              </SortableContext>
            </DndContext>
          )}
          <HStack gap="8" align="end" wrap="wrap" max>
            <VStack gap="4" className={cls.fieldGrow}>
              <Label htmlFor="platform-add-page">{t('platform.addPage')}</Label>
              <Select
                id="platform-add-page"
                value={pageToAdd}
                onChange={(e) => onPageToAdd(e.target.value)}
              >
                <option value="">{t('platform.addPage')}</option>
                {availablePages.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </VStack>
            <Button type="button" variant="outline" onClick={onAddPage} disabled={!pageToAdd}>
              <Plus size={16} className={cls.addBtnIcon} />
              <Text as="span">{t('platform.addPage')}</Text>
            </Button>
          </HStack>
          <Button type="button" className={cls.saveBtn} onClick={onSave} id="platform-save-membership">
            {t('platform.saveMembership')}
          </Button>
        </VStack>
      )}
    </Flex>
  );
}

function toDraftPages(mod: IPlatformHubModule): DraftPage[] {
  const fromCatalog = [...(mod.pages ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((page) => ({ page_code: page.page_code, path: page.path }));
  const knownPaths = new Set(fromCatalog.map((page) => page.path).filter((path): path is string => !!path));
  const extras = (getBaselineModule(mod.code)?.pages ?? [])
    .filter((page) => !isCatalogManagedPage(page) && !knownPaths.has(page.path))
    .map((page) => ({ page_code: page.id, path: page.path }));
  return [...fromCatalog, ...extras];
}

/**
 * Platform Hub catalog: module order, base/market, and navbar page order.
 */
export function PlatformCatalogEditor() {
  const { t } = useTranslation();
  const { data: modules, isLoading } = useGetPlatformHubModulesQuery();
  const [reorder] = useReorderPlatformHubModulesMutation();
  const [updateModule] = useUpdatePlatformHubModuleMutation();
  const [replacePages] = useReplacePlatformHubModulePagesMutation();

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [draftPages, setDraftPages] = useState<DraftPage[]>([]);
  const [pageToAdd, setPageToAdd] = useState('');
  const [pendingKind, setPendingKind] = useState<{ code: string; kind: 'market' | 'off' } | null>(null);
  const [moduleOrder, setModuleOrder] = useState<string[] | null>(null);

  const sensors = useVerticalSortSensors();

  const serverSorted = useMemo(
    () => [...(modules ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [modules],
  );

  const sorted = useMemo(() => {
    if (!moduleOrder) return serverSorted;
    const byCode = new Map(serverSorted.map((mod) => [mod.code, mod]));
    const ordered = moduleOrder
      .map((code) => byCode.get(code))
      .filter((mod): mod is IPlatformHubModule => mod != null);
    for (const mod of serverSorted) {
      if (!moduleOrder.includes(mod.code)) ordered.push(mod);
    }
    return ordered;
  }, [moduleOrder, serverSorted]);

  useEffect(() => {
    setModuleOrder(null);
  }, [modules]);

  const availablePages = useMemo(
    () => HUB_PAGE_OPTIONS.filter((option) => !draftPages.some((page) => page.page_code === option.value)),
    [draftPages],
  );

  const selectModule = (mod: IPlatformHubModule) => {
    if (selectedCode === mod.code) {
      setSelectedCode(null);
      setDraftPages([]);
      setPageToAdd('');
      return;
    }
    setSelectedCode(mod.code);
    setDraftPages(toDraftPages(mod));
    setPageToAdd('');
  };

  const onModuleDragEnd = async (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (overId == null || event.active.id === overId) return;
    const codes = sorted.map((mod) => mod.code);
    const from = codes.indexOf(String(event.active.id));
    const to = codes.indexOf(String(overId));
    if (from < 0 || to < 0) return;
    const next = arrayMove(codes, from, to);
    setModuleOrder(next);
    try {
      await reorder({ codes: next }).unwrap();
    } catch {
      setModuleOrder(null);
    }
  };

  const onPageDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (overId == null || event.active.id === overId) return;
    setDraftPages((prev) => {
      const from = prev.findIndex((page) => page.page_code === event.active.id);
      const to = prev.findIndex((page) => page.page_code === overId);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  const addPage = () => {
    if (!pageToAdd || draftPages.some((page) => page.page_code === pageToAdd)) return;
    setDraftPages((prev) => [...prev, { page_code: pageToAdd, path: pathForPageCode(pageToAdd) }]);
    setPageToAdd('');
  };

  const removePage = (code: string) => {
    setDraftPages((prev) => prev.filter((page) => page.page_code !== code));
  };

  const changeKind = async (mod: IPlatformHubModule, kind: HubKind) => {
    if (mod.kind === kind) return;
    if (kind === 'off' || (mod.kind === 'base' && kind === 'market')) {
      setPendingKind({ code: mod.code, kind });
      return;
    }
    await updateModule({ code: mod.code, data: { kind } });
  };

  const confirmKind = async () => {
    if (!pendingKind) return;
    const next = pendingKind;
    setPendingKind(null);
    await updateModule({ code: next.code, data: { kind: next.kind } });
  };

  const saveMembership = async () => {
    if (!selectedCode) return;
    const pages = draftPages.map((page, idx) => ({
      page_code: page.page_code,
      path: pathForPageCode(page.page_code) ?? page.path,
      sort_order: (idx + 1) * 10,
    }));
    await replacePages({ code: selectedCode, pages });
  };

  if (isLoading) {
    return (
      <HStack justify="center" className={cls.loader}>
        <Loader size={40} />
      </HStack>
    );
  }

  return (
    <VStack gap="24" max className={cls.page} data-testid="platform-catalog-editor">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <LayoutGrid size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('platform.modulesTitle')}
            </Text>
            <Text variant="muted">{t('platform.modulesSubtitle')}</Text>
          </VStack>
        </HStack>
      </Flex>

      {sorted.length === 0 ? (
        <Text variant="muted">{t('platform.noModules')}</Text>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onModuleDragEnd}
        >
          <SortableContext items={sorted.map((mod) => mod.code)} strategy={verticalListSortingStrategy}>
            <VStack gap="12" max className={cls.list}>
              {sorted.map((mod) => (
                <SortableModuleCard
                  key={mod.code}
                  mod={mod}
                  isSelected={selectedCode === mod.code}
                  draftPages={selectedCode === mod.code ? draftPages : []}
                  pageToAdd={pageToAdd}
                  availablePages={availablePages}
                  onSelect={selectModule}
                  onKind={changeKind}
                  onPageDragEnd={onPageDragEnd}
                  onRemovePage={removePage}
                  onPageToAdd={setPageToAdd}
                  onAddPage={addPage}
                  onSave={saveMembership}
                />
              ))}
            </VStack>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={pendingKind != null} onOpenChange={(open) => { if (!open) setPendingKind(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingKind?.kind === 'off' ? t('platform.kindOffTitle') : t('platform.changeKindTitle')}
            </DialogTitle>
            <DialogDescription>
              {pendingKind?.kind === 'off'
                ? t(
                  'platform.kindOffConfirm',
                  'The module disappears from the hub and the sidebar for every cabinet. Continue?',
                )
                : t(
                  'platform.changeKindBaseConfirm',
                  'Remove module from base composition: this affects all tenants without an override. Continue?',
                )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingKind(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmKind}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}
