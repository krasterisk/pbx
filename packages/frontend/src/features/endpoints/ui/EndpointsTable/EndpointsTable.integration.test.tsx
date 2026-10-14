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
    expect(screen.queryByRole('button', { name: ru.common.edit })).not.toBeInTheDocument();
    const row = screen.getByRole('row', { name: 'Редактировать абонента 1000' });
    await user.click(row);
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'endpointsPage/openEditModal' }));
    mocks.dispatch.mockClear();
    await user.click(within(row).getByRole('button', { name: ru.endpoints.btnSip }));
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'endpointsPage/openCredentialsModal' }));
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    mocks.dispatch.mockClear();
    await user.click(within(row).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Удалить (1)' }));
    expect(mocks.dispatch).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить (1)' }));
    expect(mocks.bulkDelete).toHaveBeenCalledWith(['e1000']);
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать текущую страницу абонентов' }));
    expect(screen.queryByTestId('table-selection-banner')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('50');
    await user.click(screen.getByRole('button', { name: ru.endpoints.selectionAll }));
    expect(screen.getByRole('status')).toHaveTextContent('105');
    expect(screen.getByRole('button', { name: 'Удалить (105)' })).toBeInTheDocument();
  }, 20000);

  it('edits focused rows with Enter/Space while nested controls remain independent', async () => {
    const user = userEvent.setup(); mocks.data = makeRows(2);
    render(<EndpointsTable />);
    const row = screen.getByRole('row', { name: 'Редактировать абонента 1000' });
    row.focus(); await user.keyboard('{Enter}'); await user.keyboard(' ');
    expect(mocks.dispatch).toHaveBeenCalledTimes(2);
    mocks.dispatch.mockClear();
    const checkbox = within(row).getByRole('checkbox');
    checkbox.focus(); await user.keyboard(' ');
    expect(checkbox).toBeChecked();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('selects from the padding around desktop and mobile checkboxes without editing', async () => {
    const user = userEvent.setup(); mocks.data = makeRows(2);
    const desktop = render(<EndpointsTable />);
    const checkbox = screen.getByRole('checkbox', { name: 'Выбрать абонента 1000' });
    await user.click(checkbox.closest('td')!);
    expect(checkbox).toBeChecked();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    desktop.unmount(); mocks.mobile = true;
    render(<EndpointsTable />);
    const mobileCheckbox = screen.getByRole('checkbox', { name: 'Выбрать абонента 1000' });
    await user.click(mobileCheckbox.closest('label')!);
    expect(mobileCheckbox).toBeChecked();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('keeps mobile card editing, SIP/delete and conditional clear selection independent', async () => {
    const user = userEvent.setup(); mocks.mobile = true; mocks.data = makeRows(2);
    render(<EndpointsTable />);
    expect(screen.queryByRole('button', { name: ru.endpoints.selectionClear })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Редактировать абонента 1000' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'endpointsPage/openEditModal', payload: mocks.data[0] }));
    mocks.dispatch.mockClear();
    await user.click(screen.getByRole('checkbox', { name: 'Выбрать абонента 1001' }));
    expect(mocks.dispatch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: ru.endpoints.selectionClear }));
    expect(screen.queryByRole('button', { name: ru.endpoints.selectionClear })).not.toBeInTheDocument();
    const card = screen.getAllByTestId('endpoints-mobile-card')[0];
    await user.click(within(card).getByRole('button', { name: ru.endpoints.btnSip }));
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'endpointsPage/openCredentialsModal' }));
    mocks.dispatch.mockClear();
    await user.click(within(card).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Удалить (1)' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

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
