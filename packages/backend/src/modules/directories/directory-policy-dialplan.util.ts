import {
  AsteriskDialplanUtils,
  renderActionChain,
} from '../../shared/utils/dialplan.util';
import { compileDirectoryPolicy } from '../../shared/utils/directory-policy-compiler.util';
import type { RouteDirectoryBinding } from './route-directory-binding.model';
export type { GeneratedDialplanCategory } from '../../shared/utils/directory-policy-compiler.util';
export function generatePolicyDialplan(
  binding: RouteDirectoryBinding,
  directory: { uid: number; name?: string },
  vpbxUserUid: number,
  routeTenantedContext: string,
  isAdmin: boolean,
) {
  return compileDirectoryPolicy({
    binding,
    directory,
    vpbxUserUid,
    routeTenantedContext,
    backendBaseUrl: AsteriskDialplanUtils.backendBaseUrl,
    apiKey: AsteriskDialplanUtils.dialplanApiKey,
    sanitize: (value) => AsteriskDialplanUtils.sanitizeDialplanInput(value),
    render: (actions) =>
      renderActionChain(actions, {
        vpbxUserUid,
        host: 'directory_policy',
        ownerId: binding.uid,
        isAdmin,
      }),
  });
}
