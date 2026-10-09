import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import type { IContext } from '@/shared/api/api';
import { ContextIncludesEditor } from './ContextIncludesEditor';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const contexts = [
  { uid: 1, name: 'Entry', include_uids: [2] },
  { uid: 2, name: 'A', include_uids: [3] },
  { uid: 3, name: 'B', include_uids: [] },
] as IContext[];
describe('context include draft', () => {
  it('reorders selected contexts through accessible buttons without a server write', () => {
    const change = vi.fn();
    render(<ContextIncludesEditor value={[2, 3]} onChange={change} contexts={contexts} contextUid={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'contexts.moveUp: B' }));
    expect(change).toHaveBeenCalledWith([3, 2]);
  });
  it('displays transitive cycles in the draft', () => {
    render(<ContextIncludesEditor value={[2]} onChange={vi.fn()} contexts={[...contexts.slice(0, 2), { ...contexts[2], include_uids: [1] }]} contextUid={1} />);
    expect(screen.getByRole('alert')).toHaveTextContent('contexts.includeCycle');
  });
});
