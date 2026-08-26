import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActionTypeSelect } from './ActionTypeSelect';
import { dialplanAppsRegistry } from '../../model/registry';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/ui/Tooltip/Tooltip', () => ({
  InfoTooltip: ({ text }: { text: string }) => <span role="note">{text}</span>,
}));

function optionValues() {
  const select = screen.getByRole('combobox') as HTMLSelectElement;
  return Array.from(select.options).map((option) => option.value);
}

describe('ActionTypeSelect', () => {
  it('names the step action and describes it without Asterisk wording', () => {
    render(<ActionTypeSelect value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Действие шага')).toBeInTheDocument();
    // \b keeps the product name Krasterisk from matching.
    expect(screen.getByRole('note').textContent).not.toMatch(/\basterisk\b/i);
  });

  it.each(['sendmail', 'sendmailpeer', 'telegram', 'playprompt', 'background'])(
    'does not offer the hard-removed type %s',
    (type) => {
      render(<ActionTypeSelect value="" onChange={vi.fn()} />);
      expect(optionValues()).not.toContain(type);
    },
  );

  it.each(['sendmail', 'telegram', 'playprompt'])(
    'has no registry entry for the hard-removed type %s',
    (type) => {
      expect(dialplanAppsRegistry).not.toHaveProperty(type);
    },
  );
});
