import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { type IRouteAction } from '@krasterisk/shared';
import { FlowchartCanvas } from './FlowchartCanvas';

const handlePrint = vi.fn();
const printOptions: { contentRef?: { current: HTMLElement | null }; documentTitle?: string } = {};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('react-to-print', () => ({
  useReactToPrint: (options: { contentRef?: { current: HTMLElement | null }; documentTitle?: string }) => {
    printOptions.contentRef = options.contentRef;
    printOptions.documentTitle = options.documentTitle;
    return handlePrint;
  },
}));

function hangupAction(): IRouteAction {
  return { id: 'h1', type: 'hangup', params: {}, condition: {} };
}

describe('FlowchartCanvas print (D-04, D-52)', () => {
  beforeEach(() => {
    handlePrint.mockReset();
    printOptions.contentRef = undefined;
    printOptions.documentTitle = undefined;
  });

  it('wires useReactToPrint contentRef to the canvas figure', () => {
    render(<FlowchartCanvas title="Inbound" actions={[hangupAction()]} />);

    expect(printOptions.contentRef).toBeDefined();
    expect(printOptions.contentRef?.current).toBe(screen.getByTestId('flowchart-canvas'));
    expect(printOptions.contentRef?.current?.tagName).toBe('FIGURE');
    expect(printOptions.documentTitle).toContain('Inbound');

    fireEvent.click(screen.getByTestId('flowchart-print'));
    expect(handlePrint).toHaveBeenCalledTimes(1);
  });

  it('keeps print SCSS rules for the canvas subtree', () => {
    const scss = readFileSync(
      resolve(__dirname, 'FlowchartCanvas.module.scss'),
      'utf8',
    );

    expect(scss).toMatch(/@media print/);
    expect(scss).toMatch(/@page\s*\{[^}]*margin:\s*12mm/s);
    expect(scss).toMatch(/max-height:\s*none/);
    expect(scss).toMatch(/overflow:\s*visible/);
    expect(scss).toMatch(/print-color-adjust:\s*exact/);
    expect(scss).toMatch(/break-inside:\s*avoid/);
    expect(scss).toMatch(/\.printHidden/);
  });
});
