export type TenantContext = Readonly<{
  tenantUid: number;
  principalId: string;
  principalKind: 'user' | 'integration';
  credentialId?: string;
  permissionRevision: string;
  requestId: string;
}>;

export type ProductResourceKind = 'project' | 'deployment';

export interface ProductResourceReference {
  product: 'speech_analytics' | 'ai_voice_robots';
  action: string;
  resourceKind: ProductResourceKind;
  resourceId: string;
}
