import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { en } from '@/shared/config/locales/en';
import { ru } from '@/shared/config/locales/ru';
import { DirectoryPolicyEditor } from './DirectoryPolicyEditor';
import { CallValueSourceField } from '../DirectoryLookupField';
import { buildDirectoryLookupSchema } from '../../model/schemas/directoryLookup';
import { SchemaFields } from '../SchemaFields/SchemaFields';
vi.mock('@/shared/api/endpoints/directoryApi', () => ({
  useGetDirectoryQuery: () => ({ data: { fields: [] }, isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/contextApi',()=>({useGetContextsQuery:()=>({data:[{uid:1,name:'internal',comment:''}],isLoading:false,isError:false})}));
vi.mock('../DialplanAppsEditor/DialplanAppsEditor', () => ({
  DialplanAppsEditor: () => <div>Custom chain</div>,
}));
const params = {
  directoryUid: 7,
  keySource: { source: 'current_caller' as const },
  outputs: [],
  onMissing: 'keep' as const,
  behavior: 'set_number' as const,
  matchMode: 'on_match' as const,
  behaviorParams: { fixed: '200' },
};
async function setup(language: string) {
  const i18n = createInstance();
  await i18n.init({
    lng: language,
    fallbackLng: false,
    resources: { en: { translation: en }, ru: { translation: ru } },
    interpolation: { escapeValue: false },
  });
  return i18n;
}
describe('Directory app localization and policy settings', () => {
 it('can choose and clear the redirect context while preserving the destination',async()=>{
  const i18n=await setup('en'),change=vi.fn();render(<I18nextProvider i18n={i18n}><DirectoryPolicyEditor params={{...params,behavior:'redirect',behaviorParams:{fixedExten:'200',targetContext:'internal'}}} onChange={change}/></I18nextProvider>);
  expect(screen.getByRole('option',{name:'Current context'})).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox',{name:'Context'}),{target:{value:''}});
  expect(change).toHaveBeenCalledWith(expect.objectContaining({behaviorParams:{fixedExten:'200',targetContext:undefined}}));
 });
  it.each(['en', 'ru'])(
    'localizes every source, policy and condition for %s',
    async (language) => {
      const i18n = await setup(language);
      render(
        <I18nextProvider i18n={i18n}>
          <CallValueSourceField value={params.keySource} onChange={vi.fn()} />
          <DirectoryPolicyEditor params={params} onChange={vi.fn()} />
        </I18nextProvider>,
      );
      for (const option of screen.getAllByRole('option')) {
        expect(option.textContent).not.toMatch(/^routes\./);
        if (language === 'en')
          expect(option.textContent).not.toMatch(/[А-Яа-яЁё]/);
      }
      expect(screen.getAllByRole('option')).toHaveLength(16);
    },
  );
  it('uses locale keys for schema select options instead of frozen Russian fallbacks', async () => {
    const i18n = await setup('en');
    const schema = buildDirectoryLookupSchema(
      (_key: string, fallback?: string) => fallback ?? _key,
    ).filter((field) => field.key === 'onMissing');
    render(
      <I18nextProvider i18n={i18n}>
        <SchemaFields
          schema={schema}
          params={{ onMissing: 'keep' }}
          onChange={vi.fn()}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole('option', { name: 'Keep as is' })).toBeDefined();
    expect(
      screen.getByRole('option', { name: 'Clear variables' }),
    ).toBeDefined();
  });
  it('changes behavior and keeps editing disabled in read-only mode', async () => {
    const i18n = await setup('en');
    const change = vi.fn();
    const view = render(
      <I18nextProvider i18n={i18n}>
        <DirectoryPolicyEditor params={params} onChange={change} />
      </I18nextProvider>,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Behavior' }), {
      target: { value: 'custom' },
    });
    expect(change).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'custom', actions: [] }),
    );
    view.rerender(
      <I18nextProvider i18n={i18n}>
        <DirectoryPolicyEditor params={params} onChange={change} readOnly />
      </I18nextProvider>,
    );
    for (const input of [
      ...screen.getAllByRole('combobox'),
      ...screen.getAllByRole('textbox'),
    ])
      expect(input).toBeDisabled();
  });
});
