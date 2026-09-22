/**
 * Stub for TDD RED — Task 18-05-2. GREEN replaces with access-scoped journal API.
 */
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { TenantContext } from '../../integration-credentials/tenant-context';
import type { CdrAccessScope } from '../../reports/cdr/cdr-access-scope';
import { UserLevel } from '../../users/user.model';

export interface JournalRowAccessFields {
  id: string;
  operatorExten: string | null;
  operatorName: string | null;
  uploadedByUserId: number | null;
  sourceKind: string;
}

export function canMutateConversation(_level: number): boolean {
  return false;
}

export function canEditConversationScores(_level: number): boolean {
  return false;
}

export function isJournalRowVisible(
  _row: JournalRowAccessFields,
  _scope: CdrAccessScope | null,
  _viewer: { userId: number; level: number },
): boolean {
  return false;
}

@Injectable()
export class SaJournalService {
  constructor(
    private readonly recordings: unknown,
    private readonly runs: unknown,
    private readonly results: unknown,
    private readonly transcripts: unknown,
    private readonly segments: unknown,
    private readonly relations: unknown,
    private readonly reviews: unknown,
    private readonly users: unknown,
    private readonly numberLists: unknown,
    private readonly wallet: unknown,
  ) {}

  async list(_context: TenantContext): Promise<{ items: Array<{ id: string; latestAmount: string | null }>; total: number }> {
    return { items: [], total: 0 };
  }

  async get(_context: TenantContext, _id: string): Promise<{ runs: Array<{ id: string }> }> {
    return { runs: [] };
  }

  async regenerate(_context: TenantContext, _id: string): Promise<{ runId: string }> {
    throw new ForbiddenException({ code: 'journal_mutate_forbidden' });
  }

  async delete(_context: TenantContext, _id: string): Promise<{ deleted: true; refunded: false }> {
    throw new ForbiddenException({ code: 'journal_mutate_forbidden' });
  }
}

void UserLevel;
