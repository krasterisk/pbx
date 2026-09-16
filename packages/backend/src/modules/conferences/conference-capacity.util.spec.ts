import {
  STREAM_KBPS,
  effectiveMax,
  maxParticipantsForBudget,
  streamsForParticipants,
} from './conference-capacity.util';

describe('conference-capacity.util (16.1-01 D-18/D-19)', () => {
  it('exposes STREAM_KBPS of 800', () => {
    expect(STREAM_KBPS).toBe(800);
  });

  it('maxParticipantsForBudget(0) → 0 and negatives → 0', () => {
    expect(maxParticipantsForBudget(0)).toBe(0);
    expect(maxParticipantsForBudget(-1)).toBe(0);
  });

  it('maxParticipantsForBudget(2) → 2', () => {
    expect(maxParticipantsForBudget(2)).toBe(2);
  });

  it('streamsForParticipants is 0 at n<=1 and n*(n-1) otherwise', () => {
    expect(streamsForParticipants(0)).toBe(0);
    expect(streamsForParticipants(1)).toBe(0);
    expect(streamsForParticipants(5)).toBe(20);
  });

  it('effectiveMax takes the min of tariff and budget, treating null tariff as budget', () => {
    expect(effectiveMax(null, 12)).toBe(12);
    expect(effectiveMax(8, 12)).toBe(8);
    expect(effectiveMax(20, 12)).toBe(12);
  });

  it('floors the quadratic root so N is always an integer', () => {
    expect(Number.isInteger(maxParticipantsForBudget(3))).toBe(true);
    expect(maxParticipantsForBudget(3)).toBe(Math.floor((1 + Math.sqrt(13)) / 2));
  });
});
