import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RouteGeneralTab, type RouteGeneralTabProps } from './RouteGeneralTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/features/modules/hooks/useHubModules', () => ({
  useHubModules: () => ({
    active: [],
    marketplace: [],
    isLoading: false,
    favoriteCodes: [],
    toggleFavorite: vi.fn(),
    isFavorite: () => false,
  }),
}));

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaProjectsQuery: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

function baseProps(overrides: Partial<RouteGeneralTabProps> = {}): RouteGeneralTabProps {
  return {
    name: 'Inbound',
    setName: vi.fn(),
    extensions: ['100'],
    setExtensions: vi.fn(),
    active: true,
    setActive: vi.fn(),
    record: true,
    setRecord: vi.fn(),
    recordAll: false,
    setRecordAll: vi.fn(),
    recordStereo: false,
    setRecordStereo: vi.fn(),
    analyticsMode: 'inherit',
    setAnalyticsMode: vi.fn(),
    analyticsProjectId: '',
    setAnalyticsProjectId: vi.fn(),
    contextUid: 1,
    setContextUid: vi.fn(),
    isCreateMode: false,
    contexts: [{ uid: 1, name: 'default' } as any],
    speechAnalyticsModuleActive: true,
    analyticsProjects: [{ id: 'proj-1', name: 'Sales QA' }],
    ...overrides,
  };
}

describe('RouteGeneralTab analytics project Select (D-01, D-02)', () => {
  it('puts Active in the identity header and collapses unset recording settings',()=>{
    render(<RouteGeneralTab {...baseProps({record:false,analyticsProjectId:'',isCreateMode:true})}/>);
    expect(screen.getByLabelText('Активен').parentElement?.parentElement).toHaveTextContent('Параметры маршрута');
    const header=screen.getByRole('button',{name:'Запись и аналитика'});
    expect(header).toHaveAttribute('aria-expanded','false');
    expect(screen.queryByLabelText('Запись разговоров')).not.toBeInTheDocument();
    fireEvent.click(header);expect(screen.getByLabelText('Запись разговоров')).toBeInTheDocument();
    fireEvent.click(header);expect(header).toHaveAttribute('aria-expanded','false');
  });
  it('highlights and focuses the route field reported by save validation',()=>{
    render(<RouteGeneralTab {...baseProps({fieldErrors:{name:'Обязательное поле'}})}/>);
    expect(screen.getByLabelText('Наименование маршрута')).toHaveAttribute('aria-invalid','true');
    expect(screen.getByLabelText('Наименование маршрута')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Обязательное поле');
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Analytics project Select when module is active and recording is on', () => {
    render(<RouteGeneralTab {...baseProps({ record: true, speechAnalyticsModuleActive: true })} />);

    expect(screen.getByLabelText('Analytics project')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No project' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sales QA' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Speech analytics')).not.toBeInTheDocument();
  });

  it('hides the project Select when recording is off', () => {
    render(<RouteGeneralTab {...baseProps({ record: false, speechAnalyticsModuleActive: true })} />);

    expect(screen.queryByLabelText('Analytics project')).not.toBeInTheDocument();
  });

  it('hides the project Select when module is inactive and does not clear saved projectId', () => {
    const setAnalyticsProjectId = vi.fn();
    render(
      <RouteGeneralTab
        {...baseProps({
          record: true,
          speechAnalyticsModuleActive: false,
          analyticsProjectId: 'proj-saved',
          setAnalyticsProjectId,
        })}
      />,
    );

    expect(screen.queryByLabelText('Analytics project')).not.toBeInTheDocument();
    expect(setAnalyticsProjectId).not.toHaveBeenCalled();
  });
});
