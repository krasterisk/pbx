import { IProvisionTemplate } from '@/shared/api/api';

export interface ProvisionTemplatesSchema {
  isModalOpen: boolean;
  selectedTemplate: IProvisionTemplate | null;
}
