import { memo } from 'react';
import { DncPanel } from '../DncPanel/DncPanel';

interface Props {
  campaignUid: number | null;
  baseUid: number | null;
}

export const CampaignDncTab = memo(({ campaignUid, baseUid }: Props) => (
  <DncPanel
    scopedAs="campaign"
    scopeUid={campaignUid}
    inheritedScope={{ scope: 'base', uid: baseUid }}
  />
));

CampaignDncTab.displayName = 'CampaignDncTab';
