import { mergeRelatedQueueMembership, planQueueMembership } from './queue-membership.util';

describe('planQueueMembership', () => {
  it('shows AMI leftovers even when the session snapshot is empty', () => {
    expect(planQueueMembership(['q701_0'], [])).toEqual({
      display: ['q701_0'],
      missingFromAmi: [],
    });
  });

  it('keeps AMI extras when the snapshot lists a different queue', () => {
    expect(planQueueMembership(['q701_0'], ['q700_0'])).toEqual({
      display: ['q700_0', 'q701_0'],
      missingFromAmi: ['q700_0'],
    });
  });

  it('does not invent display queues from an empty AMI + empty snapshot', () => {
    expect(planQueueMembership([], [])).toEqual({ display: [], missingFromAmi: [] });
  });
});

describe('mergeRelatedQueueMembership', () => {
  it('folds primary and WebRTC twin members onto one list', () => {
    const map = new Map<string, string[]>([
      ['PJSIP/e201_0', ['q701_0']],
      ['PJSIP/ew201_0', ['q700_0']],
    ]);
    expect(mergeRelatedQueueMembership(map, ['PJSIP/e201_0', 'PJSIP/ew201_0'])).toEqual([
      'q700_0',
      'q701_0',
    ]);
  });
});
