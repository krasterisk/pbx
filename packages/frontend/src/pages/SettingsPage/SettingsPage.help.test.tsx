import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './SettingsPage';
import { FfmpegStatusCard } from '@/features/system-settings/ui/FfmpegStatusCard';
import { RedisStatusCard } from '@/features/system-settings/ui/RedisStatusCard';
const fixture = vi.hoisted(() => ({
  save: vi.fn(), apply: vi.fn(), ffmpegCheck: vi.fn(), redisCheck: vi.fn(),
  ffmpeg: { data: undefined as {available:boolean;error?:string}|undefined, isFetching: false, isError: false },
  redis: { data: undefined, isFetching: false, isError: false, isUninitialized: true },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: () => true }));
vi.mock('@/shared/api/endpoints/authApi', () => ({ useGetAuthConfigQuery: () => ({ data: { deploymentMode: 'box' } }) }));
vi.mock('@/shared/api/endpoints/organizationSettingsApi', () => ({
  useGetOrganizationRegionalQuery: () => ({ data: { timezone: 'Asia/Krasnoyarsk', weekStart: 'monday', canEdit: true } }),
  useSetOrganizationRegionalMutation: () => [fixture.save, {}],
}));
vi.mock('@/entities/tenantSettings', () => ({
  TABLE_PAGE_SIZE_OPTIONS: [10,25,50,100], normalizeTablePageSize: (value:number) => value || 50,
  useGetTenantSettingsQuery: () => ({ data: { 'tables.page_size':50, 'endpoints.expert_mode':false, 'routes.show_raw_dialplan':true, 'routes.show_flowchart':true } }),
  useUpdateTenantSettingsMutation: () => [fixture.save, {}],
}));
vi.mock('@/features/system-settings/api/systemSettingsApi', () => ({
  useGetServerConfigQuery: () => ({ data: { records_base_path:'/test/records', records_base_url:'', webhook_secret:'' } }),
  useUpdateServerConfigMutation: () => [fixture.save, {}],
  useApplySubroutinesMutation: () => [fixture.apply, {}],
  useLazyGetFfmpegStatusQuery: () => [fixture.ffmpegCheck, fixture.ffmpeg],
  useLazyGetRedisStatusQuery: () => [fixture.redisCheck, fixture.redis],
}));
vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaSpeechModelsQuery: () => ({ data: { ownModels:true, sttProviderUid:null,llmProviderUid:null,projectOverride:false,providers:[] } }),
  useSaveSaSpeechModelsMutation: () => [fixture.save, {}],
}));
vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({ useGetAiProvidersQuery: () => ({ data: [{uid:7,name:'Test LLM',enabled:true,capabilities:['llm']}] }) }));
vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
  useGetAiChatDefaultProviderQuery: () => ({ data: { providerUid:7 } }),
  useUpdateAiChatDefaultProviderMutation: () => [fixture.save, {}],
}));
beforeEach(() => {
  vi.clearAllMocks();fixture.ffmpeg.data=undefined;fixture.ffmpeg.isError=false;fixture.redis.isError=false;
  fixture.ffmpegCheck.mockResolvedValue({});fixture.redisCheck.mockResolvedValue({});
});
const cases = [
  ['general','systemSettings.tablePageSize','systemSettings.tablePageSizeHint'],
  ['telephony','endpoints.expertModeGlobal','endpoints.expertModeGlobalHint'],
  ['server','systemSettings.subroutinesTitle','systemSettings.subroutinesDesc'],
  ['server','systemSettings.recordingsBasePath','systemSettings.recordingsBasePathDesc'],
  ['server','systemSettings.recordingsBaseUrl','systemSettings.recordingsBaseUrlDesc'],
  ['server','systemSettings.webhookSecretLabel','systemSettings.webhookSecretDesc'],
  ['server','systemSettings.sectionFfmpeg','systemSettings.sectionFfmpegDesc'],
  ['server','systemSettings.sectionRedis','systemSettings.sectionRedisDesc'],
  ['ai','speechAnalytics.tenantModelsTitle','speechAnalytics.tenantModelsHint'],
  ['ai','systemSettings.aiChatProvider','systemSettings.aiChatProviderDesc'],
];
it.each(cases)('keeps %s help for %s behind its label tooltip', async (tab,label,hint) => {
  const user=userEvent.setup();render(<MemoryRouter><SettingsPage/></MemoryRouter>);
  if(tab!=='general')await user.click(screen.getByRole('tab',{name:`systemSettings.tabs.${tab}`}));
  expect(screen.queryByText(hint)).not.toBeInTheDocument();
  const matches=screen.getAllByText(label,{exact:true});
  const labelElement=matches.find(element=>element.tagName==='LABEL') ?? matches[0];
  await user.click(within(labelElement.parentElement!).getByRole('button',{name:'common.fieldHelp'}));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(hint);
  expect(fixture.save).not.toHaveBeenCalled();expect(fixture.apply).not.toHaveBeenCalled();
});
it('keeps operational server states visible and does not run checks merely by opening the tab',async()=>{
  render(<MemoryRouter><SettingsPage/></MemoryRouter>);
  await userEvent.click(screen.getByRole('tab',{name:'systemSettings.tabs.server'}));
  expect(screen.getAllByText('systemSettings.statusNotChecked')).toHaveLength(2);
  expect(screen.getByText('systemSettings.webhookSecretNotSet')).toBeVisible();
  expect(screen.getByText('krasterisk/subroutines.conf')).toBeVisible();
  expect(fixture.ffmpegCheck).not.toHaveBeenCalled();expect(fixture.redisCheck).not.toHaveBeenCalled();
});
it('keeps failed status requests visible instead of replacing them with help text',()=>{
  fixture.ffmpeg.isError=true;fixture.redis.isError=true;
  render(<><FfmpegStatusCard/><RedisStatusCard/></>);
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(screen.getAllByText('systemSettings.statusCheckError')).toHaveLength(2);
});
it('shows installation advice only in a tooltip while keeping the ffmpeg failure visible',async()=>{
  fixture.ffmpeg.data={available:false,error:'Synthetic executable failure'};
  render(<FfmpegStatusCard/>);
  await userEvent.click(screen.getByRole('button',{name:'systemSettings.ffmpegCheck'}));
  expect(screen.getByText('systemSettings.ffmpegNotAvailable')).toBeVisible();
  expect(screen.getByText('Synthetic executable failure')).toBeVisible();
  expect(screen.queryByText('systemSettings.ffmpegInstallHint')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'common.fieldHelp'}));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('systemSettings.ffmpegInstallHint');
});
