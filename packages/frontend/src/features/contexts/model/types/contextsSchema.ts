import { IContext } from '@/shared/api/api';

export interface ContextsSchema {
  isModalOpen: boolean;
  selectedContext: IContext | null;
}
