import { act, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';
import { ContextsTable } from './ContextsTable';

const { rows, dispatch, deleteContext, bulkDelete } = vi.hoisted(() => ({
  rows: [{ uid: 1, name: 'internal', comment: '', is_default_for_trunks: true, is_default_for_endpoints: true }],
  dispatch: vi.fn(), deleteContext: vi.fn(), bulkDelete: vi.fn(),
}));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => dispatch }));
vi.mock('@/shared/api/api', () => ({
  useGetContextsQuery: () => ({ data: rows, isLoading: false }),
  useDeleteContextMutation: () => [deleteContext],
  useBulkDeleteContextsMutation: () => [bulkDelete, { isLoading: false }],
}));

describe('contexts table language switching', () => {
  it('refreshes translated cell values on unchanged query data', async () => {
    const instance = createInstance();
    await instance.use(initReactI18next).init({
      lng: 'en', fallbackLng: 'ru',
      resources: { ru: { translation: ru }, en: { translation: en } },
    });
    render(<I18nextProvider i18n={instance}><ContextsTable /></I18nextProvider>);
    expect(screen.getByText('Default for trunks, Default for endpoints')).toBeInTheDocument();
    await act(async () => { await instance.changeLanguage('ru'); });
    expect(screen.getByText('Основной для транков, Основной для абонентов')).toBeInTheDocument();
    expect(screen.queryByText('Default for trunks, Default for endpoints')).not.toBeInTheDocument();
    await act(async () => { await instance.changeLanguage('en'); });
    expect(screen.getByText('Default for trunks, Default for endpoints')).toBeInTheDocument();
  });
});
