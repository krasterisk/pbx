import { useAutodialDialogFocus } from '../AutodialConfirmation/useAutodialDialogFocus';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AutodialSchemaMigrationRequest, IAutodialSchemaPreview } from '@krasterisk/shared';
import { Button, Dialog, DialogFooter, DialogHeader, DialogTitle, FormDialogContent, ModalBody, ModalSection, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useApplyAutodialSchemaMutation } from '@/shared/api/endpoints/autodialApi';
import { autodialErrorKey } from '../../lib/mutationError';

export function SchemaMigrationDialog({ uid, request, preview, onClose, onApplied, returnFocusTo }: {
  uid: number; request: AutodialSchemaMigrationRequest; preview: IAutodialSchemaPreview | null; onClose: () => void; onApplied: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const { t } = useTranslation();
  const dialogFocus = useAutodialDialogFocus(returnFocusTo);
  const [apply, { isLoading }] = useApplyAutodialSchemaMutation();
  const [error, setError] = useState<string | null>(null);
  return <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && !isLoading && onClose()}><FormDialogContent {...dialogFocus} size="large" aria-describedby={undefined}>
    <DialogHeader><DialogTitle>{t('autodial.workspace.schemaPreview')}</DialogTitle></DialogHeader>
    <ModalBody><ModalSection><VStack gap="12" max>
      <Text>{t('autodial.workspace.schemaCounts', { checked: preview?.scanned_contacts ?? 0, errors: preview?.error_count ?? 0, archive: preview?.archived_values ?? 0 })}</Text>
      <Text>{t('autodial.workspace.schemaArchiveBody')}</Text>
      {preview?.renames.map((rename) => <Text key={rename.oldVar}>{rename.oldVar} → {rename.variable} · {rename.oldKey} → {rename.key}</Text>)}
      {Boolean(preview?.removed_fields.length) && <Text>{t('autodial.workspace.removedFields')}: {preview!.removed_fields.join(', ')}</Text>}
      {preview?.blockers.map((blocker, index) => <Text role="alert" key={index}>{blocker.field}: {t(autodialErrorKey({ data: { code: blocker.code } }, 'autodial.workspace.schemaBlocked'))} {blocker.used_by.map((usage) => usage.name).join(', ')}</Text>)}
      {preview?.errors.map((issue, index) => <Text role="alert" key={index}>#{issue.contact_uid} · {issue.field}: {t(autodialErrorKey({ data: { code: issue.code } }, 'autodial.workspace.schemaInvalidValue'))}</Text>)}
      {Boolean(preview?.sample.length) && <><Text>{t('autodial.workspace.schemaSample')}</Text>
        <Table showSearch={false} showExport={false}><TableHeader><TableRow><TableHead>{t('autodial.workspace.previewContact')}</TableHead>
          <TableHead>{t('autodial.bases.fieldKey')}</TableHead><TableHead>{t('autodial.workspace.before')}</TableHead><TableHead>{t('autodial.workspace.after')}</TableHead>
        </TableRow></TableHeader><TableBody>{preview!.sample.flatMap((sample) => [...new Set([...Object.keys(sample.before), ...Object.keys(sample.after)])]
          .filter((key) => !Object.is(sample.before[key], sample.after[key])).map((key) => <TableRow key={`${sample.contact_uid}:${key}`}>
            <TableCell>{sample.contact_uid}</TableCell><TableCell>{key}</TableCell><TableCell>{String(sample.before[key] ?? '—')}</TableCell><TableCell>{String(sample.after[key] ?? '—')}</TableCell>
          </TableRow>))}</TableBody></Table></>}
      {error && <Text role="alert">{error}</Text>}
    </VStack></ModalSection></ModalBody>
    <DialogFooter><Button variant="outline" disabled={isLoading} onClick={onClose}>{t('common.cancel')}</Button>
      <Button disabled={isLoading || !preview?.ready} onClick={async () => {
        if (!preview?.ready) return; setError(null);
        try { await apply({ uid, data: { ...request, preview_hash: preview.preview_hash } }).unwrap(); onApplied(); }
        catch (cause) { setError(t(autodialErrorKey(cause, 'autodial.bases.saveFailed'))); }
      }}>{t('autodial.workspace.applySchema')}</Button>
    </DialogFooter>
  </FormDialogContent></Dialog>;
}
