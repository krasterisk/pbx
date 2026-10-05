import { useTranslation } from 'react-i18next';
import { Flex, Text } from '@/shared/ui';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';
import cls from './TrunksTable.module.scss';

type Props = Pick<ITrunkListItem, 'trunkType' | 'registrationStatus' | 'reachabilityStatus'>;

export function TrunkStatus({ trunkType, registrationStatus, reachabilityStatus = 'Unknown' }: Props) {
  const { t } = useTranslation();
  const available = reachabilityStatus === 'Reachable';
  const unavailable = reachabilityStatus === 'Unreachable';
  const statusText = t('trunks.reachability' + reachabilityStatus);
  return (
    <Flex gap="8" align="center" wrap="wrap">
      {trunkType === 'auth' && (
        <Flex gap="4" align="center">
          <span aria-hidden="true" className={registrationStatus === 'Registered' ? cls.statusDotRegistered : registrationStatus === 'Rejected' ? cls.statusDotRejected : cls.statusDotUnknown} />
          <Text className={registrationStatus === 'Registered' ? cls.statusRegistered : registrationStatus === 'Rejected' ? cls.statusRejected : cls.statusUnknown}>
            {registrationStatus === 'Registered' ? t('trunks.statusRegistered') : registrationStatus === 'Rejected' ? t('trunks.statusRejected') : t('trunks.registrationUnknown')}
          </Text>
        </Flex>
      )}
      <Flex gap="4" align="center" data-reachability={reachabilityStatus}>
        <span aria-hidden="true" className={available ? cls.statusDotRegistered : unavailable ? cls.statusDotRejected : cls.statusDotUnknown} />
        <Text className={available ? cls.statusRegistered : unavailable ? cls.statusRejected : cls.statusUnknown}>{statusText}</Text>
      </Flex>
    </Flex>
  );
}
