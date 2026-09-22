import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SpeechAnalyticsReportsPage } from '@/pages/SpeechAnalyticsReportsPage/SpeechAnalyticsReportsPage';
import { router } from './router';

function walkRoutes(routes: RouteObject[] | undefined, visit: (route: RouteObject) => void): void {
  if (!routes) return;
  for (const route of routes) {
    visit(route);
    walkRoutes(route.children, visit);
  }
}

function findRouteByPath(path: string): RouteObject | undefined {
  let found: RouteObject | undefined;
  walkRoutes(router.routes as RouteObject[], (route) => {
    if (route.path === path) found = route;
  });
  return found;
}

function elementTypeName(node: ReactNode): string | undefined {
  if (!isValidElement(node)) return undefined;
  const type = (node as ReactElement).type as { displayName?: string; name?: string };
  return type.displayName ?? type.name;
}

describe('speech-analytics reports route (D-37)', () => {
  it('does not mount SpeechAnalyticsReportsPage as a live product route at /speech-analytics/reports', () => {
    const reports = findRouteByPath('speech-analytics/reports');
    expect(reports, 'expected a /speech-analytics/reports route (redirect or removal target)').toBeDefined();

    const element = reports!.element;
    const mountsReportsPage =
      isValidElement(element) &&
      (element.type === SpeechAnalyticsReportsPage ||
        elementTypeName(element) === 'SpeechAnalyticsReportsPage');

    expect(mountsReportsPage).toBe(false);

    expect(isValidElement(element) && element.type === Navigate).toBe(true);
    expect(isValidElement(element) && (element.props as { to?: string }).to).toBe(
      '/speech-analytics/conversations',
    );
  });

  it('keeps dashboard and journal product routes', () => {
    expect(findRouteByPath('speech-analytics/dashboard')).toBeDefined();
    expect(findRouteByPath('speech-analytics/conversations')).toBeDefined();
  });
});
