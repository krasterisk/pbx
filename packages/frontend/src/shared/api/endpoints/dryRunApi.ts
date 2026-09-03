import { rtkApi } from '../rtkApi';
import type {
  WalkAction,
  WalkBreadcrumb,
  WalkHostKind,
  WalkIvrInputs,
  WalkMenuItem,
  WalkOutcome,
  WalkSegment,
} from '@krasterisk/shared';

export interface IDryRunRequest {
  host: WalkHostKind;
  actions?: WalkAction[];
  menu_items?: WalkMenuItem[];
  callerNumber?: string;
  scenario?: Record<string, string>;
  ivrChoice?: string;
}

export interface IDryRunReask {
  source: string;
  keys: string[];
  askedAfterRun: true;
  label?: string;
}

export interface IDryRunResult {
  segments: WalkSegment[];
  breadcrumbs: WalkBreadcrumb[];
  hopsUsed: number;
  hopLimit: number;
  outcome: WalkOutcome;
  reask?: IDryRunReask;
  ivrInputs?: WalkIvrInputs;
}

export const dryRunApi = rtkApi.injectEndpoints({
  endpoints: (builder) => ({
    postDryRun: builder.mutation<IDryRunResult, IDryRunRequest>({
      query: (body) => ({ url: '/dialplan/dry-run', method: 'POST', body }),
    }),
  }),
});

export const { usePostDryRunMutation } = dryRunApi;
