import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './Sheet';

describe('Sheet (U1.3)', () => {
  it('renders overlay by default when open', () => {
    render(
      <Sheet open>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Modal sheet</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByTestId('sheet-overlay')).toBeInTheDocument();
    expect(screen.getByText('Modal sheet')).toBeInTheDocument();
  });

  it('omits overlay when overlay={false} and modal={false}', () => {
    render(
      <Sheet open modal={false}>
        <SheetContent overlay={false} aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Non-modal sheet</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.queryByTestId('sheet-overlay')).not.toBeInTheDocument();
    expect(screen.getByText('Non-modal sheet')).toBeInTheDocument();
  });
});
