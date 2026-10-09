import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IEndpointListItem } from '@krasterisk/shared';
import { ru } from '@/shared/config/locales/ru';
import { EndpointsTable } from './EndpointsTable';
const mocks = vi.hoisted(() => ({ data: [] as IEndpointListItem[], mobile: false, error: false, retry: vi.fn(), dispatch: vi.fn(), bulkDelete: vi.fn(), remove: vi.fn() }));
function translate(key: string, options: Record<string, unknown> = {}): string {
  const value = key.split('.').reduce<unknown>((object, part) => object && typeof object === 'object' ? (object as Record<string, unknown>)[part] : undefined, ru);
  return typeof value === 'string' ? value.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options[name] ?? `{{${name}}}`)) : key;
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate, i18n: { language: 'ru' } }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: () => ({ data: mocks.data, isLoading: false, isError: mocks.error, refetch: mocks.retry }),
  useBulkDeleteEndpointsMutation: () => [mocks.bulkDelete, { isLoading: false }],
  useDeleteEndpointMutation: () => [mocks.remove, { isLoading: false }],
  useGetActiveBulkJobQuery: () => ({ data: { jobId: null } }),
  useGetBulkJobStatusQuery: () => ({ data: undefined }),
}));
const makeRows = (count: number): IEndpointListItem[] => Array.from({ length: count }, (_, i) => ({ id: `e${1000+i}`, extension: String(1000+i), sipUsername: String(1000+i), callerid: `"Name ${i}" <${1000+i}>`, context: 'internal', department: 'Sales', transport: 'udp', allow: 'alaw', status: 'online', userAgent: 'Phone', clientIp: null, contactUri: null, lastRegistered: null, tenantid: '1', authType: 'userpass' }));
describe('EndpointsTable real table and columns', () => {
  let blob: Blob | undefined;
  beforeEach(() => {
    vi.clearAllMocks(); mocks.data = makeRows(105); mocks.mobile = false; mocks.error = false; blob = undefined;
    mocks.bulkDelete.mockReturnValue({ unwrap: () => Promise.resolve({ deleted: 1 }) });
    mocks.remove.mockReturnValue({ unwrap: () => Promise.resolve() });
    vi.stubGlobal('URL', { createObjectURL: vi.fn((value: Blob) => { blob = value; return 'blob:csv'; }), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('reports failed loading with a working retry instead of a successful empty table', () => {
    mocks.error = true;
    mocks.data = [];
    render(<EndpointsTable />);
    expect(screen.getByRole('alert')).toHaveTextContent(ru.endpoints.loadError);
    fireEvent.click(screen.getByRole('button', { name: ru.common.retry }));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('keeps page selection, exports it across filters, and confirms a short bulk preview', async () => {
    const user = userEvent.setup();
    render(<EndpointsTable />);
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать текущую страницу абонентов' }));
    expect(screen.getByRole('button', { name: 'Удалить (50)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать абонента 1050' }));
    expect(screen.getByRole('button', { name: 'Удалить (51)' })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(ru.common.search), { target: { value: '1000' } });
    await user.click(screen.getByRole('button', { name: 'CSV (51)' }));
    const csv = await blob!.text();
    expect(csv).toContain('1050'); expect(csv).toContain('1000'); expect(csv).not.toContain('1051');
    await user.click(screen.getByRole('button', { name: 'Удалить (51)' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading')).toHaveTextContent('Удалить 51 абонентов?');
    expect(dialog.textContent).not.toContain('{{extensions}}');
    expect(dialog.textContent).toContain('ещё 43');
    await user.click(within(dialog).getByRole('button', { name: 'Удалить (51)' }));
    expect(mocks.bulkDelete).toHaveBeenCalledWith([...makeRows(50).map(row => row.id), 'e1050']);
  }, 20000);

  it('selects all matching pages and uses accessible row actions with a real delete dialog', async () => {
    const user = userEvent.setup();
    render(<EndpointsTable />);
    const edits = screen.getAllByRole('button', { name: ru.common.edit });
    expect(edits).toHaveLength(50);
    expect(edits.every(button => button.getAttribute('title') === ru.common.edit)).toBe(true);
    await user.click(edits[0]);
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'endpointsPage/openEditModal' }));
    await user.click(screen.getAllByRole('button', { name: ru.common.delete })[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить (1)' }));
    expect(mocks.remove).toHaveBeenCalledWith('e1000');
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать текущую страницу абонентов' }));
    const banner = screen.getByTestId('table-selection-banner');
    await user.click(within(banner).getByRole('button', { name: /105/ }));
    expect(screen.getByRole('button', { name: 'Удалить (105)' })).toBeInTheDocument();
  }, 20000);

  it('supports selection, CSV and bulk delete on mobile cards', async () => {
    const user = userEvent.setup(); mocks.mobile = true; mocks.data = makeRows(2);
    render(<EndpointsTable />);
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать абонента 1001' }));
    await user.click(screen.getByRole('button', { name: 'CSV (1)' }));
    const csv = await blob!.text(); expect(csv).toContain('1001'); expect(csv).not.toContain('1000');
    await user.click(screen.getByRole('button', { name: 'Удалить (1)' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить (1)' }));
    expect(mocks.bulkDelete).toHaveBeenCalledWith(['e1001']);
  });
});
