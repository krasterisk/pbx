import { memo } from 'react';
import { Text } from '@/shared/ui';

/** Stub until GREEN — UploadForm (D-14, D-15). */
export interface UploadFormProject {
  id: string;
  name: string;
}

export interface UploadFormOperator {
  id: number;
  name: string;
}

export interface UploadFormSubmitPayload {
  projectId: string;
  operator?: { userId?: number; name?: string };
  clientPhone?: string;
  language?: string;
  files: File[];
}

export interface UploadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: UploadFormProject[];
  operators?: UploadFormOperator[];
  onSubmit: (payload: UploadFormSubmitPayload) => Promise<void>;
  isSubmitting?: boolean;
  formError?: string | null;
}

export const UploadForm = memo((_props: UploadFormProps) => (
  <div data-testid="upload-form-stub">
    <Text>stub</Text>
  </div>
));

UploadForm.displayName = 'UploadForm';
