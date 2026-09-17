import { memo } from 'react';
import { DncPanel } from '../DncPanel/DncPanel';

interface Props {
  campaignUid: number | null;
}

export const CampaignDncTab = memo(({ campaignUid }: Props) => (
  <DncPanel scopedAs="campaign" scopeUid={campaignUid} />
));

CampaignDncTab.displayName = 'CampaignDncTab';
