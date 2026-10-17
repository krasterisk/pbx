import { render, screen } from '@testing-library/react';
import { APP_VERSION } from '@krasterisk/shared';
import { AppVersionLabel } from './AppVersion';

describe('AppVersionLabel', () => {
  it('shows the application version', () => {
    render(<AppVersionLabel />);
    expect(screen.getByTestId('app-version')).toHaveTextContent(`v${APP_VERSION}`);
    expect(APP_VERSION).toMatch(/^4\.\d+\.\d+\.\d+$/);
  });
});
