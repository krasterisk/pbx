import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
const state=vi.hoisted(()=>({mode:'box' as string|undefined,error:false,ownModels:true}));
vi.mock('@/shared/api/endpoints/authApi',()=>({useGetAuthConfigQuery:()=>({data:state.mode ? {deploymentMode:state.mode} : undefined,isError:state.error,refetch:vi.fn()})}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@/features/system-settings/ui/DialplanSubroutinesCard', () => ({
  DialplanSubroutinesCard: () => <div data-testid="dialplan-card-stub">dialplan</div>,
}));

vi.mock('@/features/system-settings/ui/RecordingsCard', () => ({
  RecordingsCard: () => <div data-testid="recordings-card-stub">recordings</div>,
}));

vi.mock('@/features/system-settings/ui/WebhookSecurityCard', () => ({
  WebhookSecurityCard: () => <div data-testid="webhook-card-stub">webhook</div>,
}));

vi.mock('@/features/system-settings/ui/FfmpegStatusCard', () => ({
  FfmpegStatusCard: () => <div data-testid="ffmpeg-card-stub">ffmpeg</div>,
}));

vi.mock('@/features/system-settings/ui/RedisStatusCard', () => ({
  RedisStatusCard: () => <div data-testid="redis-card-stub">redis</div>,
}));

vi.mock('@/features/speechAnalytics/ui/TenantSpeechModelsCard/TenantSpeechModelsCard', () => ({
  TenantSpeechModelsCard: () => null,
}));

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaSpeechModelsQuery: () => ({ data: { ownModels: state.ownModels } }),
}));

vi.mock('@/features/tenant-settings/ui/TablePageSizeSetting/TablePageSizeSetting', () => ({
  TablePageSizeSetting: () => <div data-testid="table-page-size-stub">tables</div>,
}));

vi.mock('@/features/tenant-settings/ui/EndpointExpertModeSetting/EndpointExpertModeSetting', () => ({
  EndpointExpertModeSetting: () => <div data-testid="endpoint-expert-mode-stub">endpoint expert mode</div>,
}));

vi.mock('@/features/tenant-settings/ui/TenantSettingsSection', () => ({
  TenantSettingsSection: ({allowRawDialplan}:{allowRawDialplan:boolean}) => <div data-testid="tenant-settings-section-stub" data-raw={String(allowRawDialplan)}>tenant</div>,
}));

vi.mock('@/features/system-settings/ui/AiChatProviderCard', () => ({
  AiChatProviderCard: () => <div data-testid="ai-chat-card-stub">ai-chat</div>,
}));

vi.mock('@/features/system-settings/ui/OrganizationTimezoneSetting/OrganizationTimezoneSetting',()=>({OrganizationTimezoneSetting:()=> <p>timezone-setting</p>}));

import { SettingsPage } from './SettingsPage';


beforeEach(()=>{state.mode='box';state.error=false;state.ownModels=true;});
describe('SettingsPage deployment-aware tabs',()=>{
 it('defaults to compact general settings and mounts other sections only on demand',async()=>{
  const user=userEvent.setup();render(<SettingsPage/>);
  expect(screen.getByTestId('settings-page-responsive')).toHaveAttribute('data-stack','phone');
  expect(screen.getByText('timezone-setting')).toBeVisible();
  expect(screen.getByTestId('table-page-size-stub')).toBeVisible();
  expect(screen.queryByTestId('dialplan-card-stub')).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab',{name:'systemSettings.tabs.server'}));
  for(const id of ['dialplan','recordings','webhook','ffmpeg','redis']) expect(screen.getByTestId(id+'-card-stub')).toBeVisible();
  expect(screen.queryByText('timezone-setting')).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab',{name:'systemSettings.tabs.telephony'}));
  expect(screen.getByTestId('tenant-settings-section-stub')).toHaveAttribute('data-raw','true');
  expect(screen.getByTestId('endpoint-expert-mode-stub')).toBeVisible();
  await user.click(screen.getByRole('tab',{name:'systemSettings.tabs.ai'}));
  expect(screen.getByTestId('ai-chat-card-stub')).toBeVisible();
 });
 it('never mounts server cards in cloud and hides raw dialplan while keeping organization preferences',async()=>{
  state.mode='cloud';render(<SettingsPage/>);
  expect(screen.queryByRole('tab',{name:'systemSettings.tabs.server'})).not.toBeInTheDocument();
  expect(screen.queryByTestId('recordings-card-stub')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab',{name:'systemSettings.tabs.telephony'}));
  expect(screen.getByTestId('tenant-settings-section-stub')).toHaveAttribute('data-raw','false');
 });
 it('allows installation settings in the open source edition',()=>{
  state.mode='opensource';render(<SettingsPage/>);
  expect(screen.getByRole('tab',{name:'systemSettings.tabs.server'})).toBeVisible();
 });
 it('respects the own-model capability even on a box',()=>{
  state.ownModels=false;render(<SettingsPage/>);
  expect(screen.queryByRole('tab',{name:'systemSettings.tabs.ai'})).not.toBeInTheDocument();
  expect(screen.queryByTestId('ai-chat-card-stub')).not.toBeInTheDocument();
 });
 it('fails closed while deployment mode is loading or unavailable',()=>{
  state.mode=undefined;const {rerender}=render(<SettingsPage/>);
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(screen.queryByText('timezone-setting')).not.toBeInTheDocument();
  state.error=true;rerender(<SettingsPage/>);
  expect(screen.getByRole('alert')).toHaveTextContent('systemSettings.modeError');
  expect(screen.getByRole('button',{name:'common.retry'})).toBeVisible();
 });
});
