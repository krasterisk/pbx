import { IRoute } from '@/shared/api/api';

export interface RoutesSchema {
  isModalOpen: boolean;
  modalMode: 'create' | 'edit' | 'copy';
  selectedRoute: IRoute | null;
  selectedContextUid: number | null;
  editorMode: 'table' | 'raw'; // which dialplan editor mode is active
}
