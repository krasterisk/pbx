import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog';
import { Text } from '@/shared/ui/Text/Text';
import {
  buildBulkDeletePreview,
  type BulkDeletePreview,
} from '@/shared/lib/tableSelection';
import cls from './BulkDeleteDialog.module.scss';

export interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display labels for selected rows (order preserved). */
  labels: string[];
  allMatching: boolean;
  hasFilter: boolean;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  /**
   * Optional i18n namespace for module-specific copy
   * (`[ns].confirmBulkDelete`, …). Falls back to `common.*`.
   */
  i18nNs?: string;
}

function tKey(
  t: (k: string, o?: Record<string, unknown>) => string,
  ns: string | undefined,
  key: string,
  opts?: Record<string, unknown>,
) {
  if (ns) {
    const specificKey = `${ns}.${key}`;
    const specific = t(specificKey, opts);
    if (specific !== specificKey) return specific;
  }
  return t(`common.${key}`, opts);
}

function titleForPreview(
  t: (k: string, o?: Record<string, unknown>) => string,
  ns: string | undefined,
  preview: BulkDeletePreview,
  hasFilter: boolean,
): string {
  if (preview.mode === 'allMatching') {
    return hasFilter
      ? tKey(t, ns, 'confirmBulkDeleteAllFiltered', { count: preview.count })
      : tKey(t, ns, 'confirmBulkDeleteAll', { count: preview.count });
  }
  if (preview.mode === 'single') {
    return tKey(t, ns, 'confirmBulkDeleteOne', {
      label: preview.previewLabels[0] || '',
      name: preview.previewLabels[0] || '',
      ext: preview.previewLabels[0] || '',
    });
  }
  return tKey(t, ns, 'confirmBulkDelete', { count: preview.count });
}

function bodyForPreview(
  t: (k: string, o?: Record<string, unknown>) => string,
  ns: string | undefined,
  preview: BulkDeletePreview,
): string {
  if (preview.mode === 'allMatching' || preview.mode === 'single') {
    return tKey(t, ns, 'confirmBulkDeleteIrreversible');
  }
  const labels = preview.previewLabels.join(', ');
  if (preview.mode === 'truncated') {
    return tKey(t, ns, 'confirmBulkDeleteBodyMore', {
      labels,
      extensions: labels,
      remaining: preview.remaining,
    });
  }
  return tKey(t, ns, 'confirmBulkDeleteBody', { labels, extensions: labels });
}

export const BulkDeleteDialog = memo(function BulkDeleteDialog({
  open,
  onOpenChange,
  labels,
  allMatching,
  hasFilter,
  isDeleting = false,
  onConfirm,
  i18nNs,
}: BulkDeleteDialogProps) {
  const { t } = useTranslation();

  const preview = useMemo(
    () =>
      buildBulkDeletePreview({
        labels,
        allMatching,
        hasFilter,
        filteredTotal: labels.length,
      }),
    [labels, allMatching, hasFilter],
  );

  const title = titleForPreview(t, i18nNs, preview, hasFilter);
  const body = bodyForPreview(t, i18nNs, preview);
  const showExtraIrreversible =
    preview.mode !== 'allMatching' && preview.mode !== 'single';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isDeleting) onOpenChange(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {showExtraIrreversible ? (
          <Text variant="muted">{tKey(t, i18nNs, 'confirmBulkDeleteIrreversible')}</Text>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={isDeleting || preview.count === 0}
            onClick={() => void onConfirm()}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : null}
            {tKey(t, i18nNs, 'deleteSelected', { count: preview.count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

BulkDeleteDialog.displayName = 'BulkDeleteDialog';
