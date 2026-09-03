import {
  collectActionReferences,
  type ActionReference,
  type ActionReferenceScanBinding,
  type ActionReferenceScanRoute,
} from '../route-references/action-reference.util';

export type DirectoryReference = ActionReference;

export interface ReferenceScanBinding extends ActionReferenceScanBinding {
  directory_uid: number;
}

export type ReferenceScanRoute = ActionReferenceScanRoute;

export function collectDirectoryReferences(
  directoryUid: number,
  fieldUid: number | undefined,
  bindings: ReferenceScanBinding[],
  routes: ReferenceScanRoute[],
): DirectoryReference[] {
  return collectActionReferences('directory', directoryUid, routes, bindings, fieldUid);
}
