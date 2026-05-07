/**
 * deployment-mode.ts
 *
 * Determines whether the application is running in CLOUD (SaaS/multi-tenant)
 * or BOX (self-hosted/single-tenant) mode.
 *
 * Set DEPLOYMENT_MODE=cloud in .env to enable cloud features
 * (billing, multi-tenancy, module marketplace, etc.).
 * Defaults to 'box' for backwards compatibility with self-hosted installs.
 */
export type DeploymentMode = 'cloud' | 'box';

export const DEPLOYMENT_MODE: DeploymentMode =
  (process.env.DEPLOYMENT_MODE as DeploymentMode) === 'cloud' ? 'cloud' : 'box';

/** Returns true when running as a cloud/SaaS platform */
export const isCloud = DEPLOYMENT_MODE === 'cloud';

/** Returns true when running as a self-hosted box installation */
export const isBox = DEPLOYMENT_MODE === 'box';
