import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { DashboardOverview } from '@krasterisk/shared';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';
import { DashboardRows } from './DashboardDetailSheet';
vi.mock('@/shared/api/endpoints/dashboardApi', () => ({
  useLazyGetDashboardRowsQuery: () => [() => ({ abort:vi.fn() }), {
    isFetching:false,
    currentData:{ rows:['noAnswer','insufficientEvidence','awaitingCompletion','aiPlaybackUnconfirmed','voicemail','ivr','error','busy'].map((reason,index) => ({
      id:String(index),linkedid:'',startedAt:'2026-10-11T10:00:00Z',endedAt:'2026-10-11T10:01:00Z',src:'100',dst:'200',
      direction:'in',origin:'telephony',outcome:reason==='insufficientEvidence'||reason==='awaitingCompletion'||reason==='aiPlaybackUnconfirmed'?'unknown':'missed',reason,duration:60,
    })), total:8,nextCursor:null,version:'1',source:{ state:'ok',updatedAt:null } },
  }],
}));
vi.mock('@/features/modules/hooks/useHubModules', () => ({ useHubModules:() => ({ navigation:[],isLoading:false,isError:false }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: (select:(state:unknown)=>unknown) => select({ auth:{ user:{ level:1 } } }) }));
describe('dashboard real classifier reason copy', () => {
  it.each([['ru',ru],['en',en]] as const)('renders human explanations in%s, never raw classifier codes', async (language, locale) => {
    const i18n = createInstance();
    await i18n.init({ lng:language,resources:{ [language]:{ translation:locale } },interpolation:{ escapeValue:false } });
    const overview = { period:{ from:'2026-10-11T00:00:00Z',to:'2026-10-12T00:00:00Z',timezone:'UTC' } } as DashboardOverview;
    render(<I18nextProvider i18n={i18n}><MemoryRouter><DashboardRows entry={{ kind:'calls',title:'Calls',filters:{ outcome:'missed' } }} overview={overview} /></MemoryRouter></I18nextProvider>);
    for(const reason of ['noAnswer','insufficientEvidence','awaitingCompletion','aiPlaybackUnconfirmed','voicemail','ivr','error','busy'] as const) {
      expect(screen.getByText(locale.dashboard.reason[reason])).toBeInTheDocument();
      expect(screen.queryByText(reason,{ exact:true })).not.toBeInTheDocument();
    }
    cleanup();
  });
});
