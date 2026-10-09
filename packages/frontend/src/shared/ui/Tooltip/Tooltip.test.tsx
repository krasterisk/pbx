import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom';
import { Button } from '@/shared/ui/Button';
import { InfoTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from './Tooltip';

describe('single custom tooltip presentation', () => {
  it('suppresses child and inherited native titles while preserving refs, label, events and rich content', async () => {
    const ref = createRef<HTMLButtonElement>();
    let clicks = 0;
    render(<div title="Ancestor hint"><Tooltip content="**Custom help**" defaultOpen>
      <Button ref={ref} title="Native hint" aria-label="Field help" onClick={() => clicks++}>
        <span title="Nested native hint">Help</span>
      </Button>
    </Tooltip></div>);
    const trigger = screen.getByRole('button', { name: 'Field help' });
    expect(trigger).toHaveAttribute('title', '');
    expect(screen.getByText('Help')).toHaveAttribute('title', '');
    expect(ref.current).toBe(trigger);
    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Custom help'));
    fireEvent.click(trigger);
    expect(clicks).toBe(1);
  });

  it('preserves native titles when custom tooltip content is absent', () => {
    render(<Tooltip><Button title="Native help">Help</Button></Tooltip>);
    expect(screen.getByRole('button', { name: 'Help' })).toHaveAttribute('title', 'Native help');
  });

  it('uses the title as an accessible name when the trigger had no explicit aria-label', () => {
    render(<Tooltip content="Explanation"><Button title="Edit item">Edit</Button></Tooltip>);
    expect(screen.getByRole('button', { name: 'Edit item' })).toHaveAttribute('title', '');
  });

  it('suppresses native titles for the low-level shared trigger API too', () => {
    render(<TooltipProvider><TooltipRoot defaultOpen>
      <TooltipTrigger title="Raw hint">Help</TooltipTrigger>
      <TooltipContent>Custom help</TooltipContent>
    </TooltipRoot></TooltipProvider>);
    expect(screen.getByRole('button', { name: 'Raw hint' })).toHaveAttribute('title', '');
  });

  it('suppresses titles on children supplied to InfoTooltip', async () => {
    render(<InfoTooltip text="Custom help"><span title="Icon hint">Icon</span></InfoTooltip>);
    expect(screen.getByText('Icon')).toHaveAttribute('title', '');
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Custom help'));
  });
});
