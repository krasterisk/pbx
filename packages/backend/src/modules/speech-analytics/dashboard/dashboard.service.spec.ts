import {
  aggregateDashboard,
  filterDashboardByAccess,
  type DashboardConversation,
} from './dashboard.service';
import { UserLevel } from '../../users/user.model';

function row(partial: Partial<DashboardConversation> & { id: string }): DashboardConversation {
  return {
    operatorExten: null,
    operatorName: null,
    uploadedByUserId: null,
    sourceKind: 'upload',
    latestAmount: '1.00',
    currency: 'RUB',
    lowStt: false,
    success: true,
    sentiment: 'positive',
    scaleScores: { greeting: 80 },
    customScores: { needs: 60 },
    dayLabel: 'Mon',
    overallScore: 80,
    ...partial,
  };
}

describe('aggregateDashboard (D-34)', () => {
  it('excludes low-STT conversations from averages and exposes their count', () => {
    const result = aggregateDashboard({
      conversations: [
        row({ id: 'a', overallScore: 100, lowStt: false, latestAmount: '2.00' }),
        row({ id: 'b', overallScore: 40, lowStt: true, latestAmount: '3.00' }),
        row({ id: 'c', overallScore: 80, lowStt: false, latestAmount: '1.00' }),
      ],
      scope: null,
      viewer: { userId: 1, level: UserLevel.ADMIN },
    });

    expect(result.lowSttCount).toBe(1);
    expect(result.averageScore).toBe(90);
    expect(result.conversationCount).toBe(3);
    expect(result.costTotal).toBe('6.00');
  });

  it('sums latest-run amounts only for cost cards and ignores insights amounts', () => {
    const result = aggregateDashboard({
      conversations: [
        row({ id: 'a', latestAmount: '1.50', currency: 'RUB' }),
        row({ id: 'b', latestAmount: '2.50', currency: 'RUB' }),
      ],
      scope: null,
      viewer: { userId: 1, level: UserLevel.ADMIN },
    });
    expect(result.costTotal).toBe('4.00');
    expect(result.currency).toBe('RUB');
  });

  it('respects CDR access list the same way as the journal', () => {
    const visible = filterDashboardByAccess(
      [
        row({ id: 'mine', operatorExten: '101', uploadedByUserId: 9 }),
        row({ id: 'other', operatorExten: '202', uploadedByUserId: 8 }),
      ],
      {
        operators: ['101'],
        ownExten: '101',
        queues: [],
      },
      { userId: 9, level: UserLevel.OPERATOR },
    );
    expect(visible.map((r) => r.id)).toEqual(['mine']);
  });
});
