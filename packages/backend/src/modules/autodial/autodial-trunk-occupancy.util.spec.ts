import { countChannelsByTrunk, resolveTrunkChannelLimit } from './autodial-trunk-occupancy.util';

describe('resolveTrunkChannelLimit', () => {
  it('prefers the campaign override when it is a positive number', () => {
    expect(resolveTrunkChannelLimit(4, 30)).toBe(4);
  });

  it('falls back to the trunk setting when the campaign leaves 0/absent', () => {
    expect(resolveTrunkChannelLimit(0, 12)).toBe(12);
    expect(resolveTrunkChannelLimit(undefined, 8)).toBe(8);
  });

  it('treats both layers as unlimited when neither declares a limit', () => {
    expect(resolveTrunkChannelLimit(0, 0)).toBe(0);
    expect(resolveTrunkChannelLimit(undefined, undefined)).toBe(0);
  });
});

describe('countChannelsByTrunk', () => {
  it('counts CoreShowChannel rows whose name belongs to a trunk endpoint', () => {
    const counts = countChannelsByTrunk(
      [
        { event: 'CoreShowChannel', channel: 'PJSIP/t_megafon_1-0000000a' },
        { event: 'CoreShowChannel', Channel: 'PJSIP/t_megafon_1-0000000b' },
        { event: 'CoreShowChannel', channel: 'PJSIP/t_other_1-00000001' },
        { event: 'CoreShowChannelsComplete' },
      ],
      ['t_megafon_1', 't_other_1'],
    );
    expect(counts.get('t_megafon_1')).toBe(2);
    expect(counts.get('t_other_1')).toBe(1);
  });

  it('starts every requested trunk at zero so a quiet trunk is not missing', () => {
    const counts = countChannelsByTrunk([], ['t_quiet_1']);
    expect(counts.get('t_quiet_1')).toBe(0);
  });
});
