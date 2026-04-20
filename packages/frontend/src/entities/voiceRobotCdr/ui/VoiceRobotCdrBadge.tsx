import { memo } from 'react';
import { Badge } from '@/shared/ui';
import { CdrDisposition, CDR_DISPOSITION_OPTIONS } from '@/shared/api/endpoints/voiceRobotCdrApi';
import { useTranslation } from 'react-i18next';

interface VoiceRobotCdrBadgeProps {
  disposition: CdrDisposition;
  className?: string;
}

export const VoiceRobotCdrBadge = memo(({ disposition, className }: VoiceRobotCdrBadgeProps) => {
  const { t } = useTranslation();
  const option = CDR_DISPOSITION_OPTIONS.find((o) => o.value === disposition);

  if (!option) {
    return <Badge variant="outline" className={className}>{disposition}</Badge>;
  }

  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline';
  let colorClass = '';

  switch (option.color) {
    case 'green':
      colorClass = 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20';
      break;
    case 'red':
      variant = 'destructive';
      break;
    case 'amber':
    case 'orange':
      colorClass = 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/20';
      break;
    case 'gray':
    default:
      variant = 'secondary';
  }

  return (
    <Badge variant={variant} className={`${colorClass} ${className || ''}`}>
      {t(option.labelKey, option.fallback)}
    </Badge>
  );
});

VoiceRobotCdrBadge.displayName = 'VoiceRobotCdrBadge';
