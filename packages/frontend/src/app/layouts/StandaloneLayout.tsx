import { Outlet } from 'react-router-dom';

/**
 * Standalone layout for v3 integration.
 *
 * Simplified: no token parsing, no auth logic.
 * In standalone mode, API calls go to public endpoints (no JWT required).
 * The layout just renders the child route with minimal padding and transparent background
 * so it integrates seamlessly inside the v3 iframe.
 */
export const StandaloneLayout = () => {
  return (
    <div className="p-4 bg-transparent min-h-screen">
      <Outlet />
    </div>
  );
};
