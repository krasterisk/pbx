import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CallParty, CallRecord } from '@krasterisk/shared';
import {
  ArrowRightLeft,
  Check,
  Circle,
  GitBranch,
  PhoneCall,
  PhoneOff,
} from 'lucide-react';
import { Badge, Button, Flex, Text, VStack, InfoTooltip } from '@/shared/ui';
import { callDuration } from '../model/callsUrl';
import cls from './Calls.module.scss';
import { PhoneNumber } from '@/entities/phone';

export function CallRouteView({
  call,
  timezone,
  label,
}: {
  call: CallRecord;
  timezone: string;
  label: (party: CallParty | null) => string;
}) {
  const { t, i18n } = useTranslation();
  const [scheme, setScheme] = useState(false);
  const nodes =
    call.route?.nodes ||
    call.journey.map((step) => ({
      id: step.id,
      kind: step.kind,
      steps: [step],
      possibleParallel: false,
    }));
  const clock = (at: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(at));
  return (
    <VStack
      gap="16"
      align="stretch"
      className={cls.journey}
      data-testid="call-route"
    >
      <Flex justify="between" align="center" wrap="wrap" gap="8">
        <Flex gap="4" align="center"><Text variant="h3">{t('calls.routeTitle')}</Text><InfoTooltip text={t('calls.routeLegend')}/></Flex>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={scheme}
          onClick={() => setScheme(!scheme)}
        >
          <GitBranch size={16} />
          {t(scheme ? 'calls.routeTimeline' : 'calls.routeScheme')}
        </Button>
      </Flex>
      {nodes
        .filter((node) => node.kind === 'transfer')
        .map((node) => (
          <Text key={`summary:${node.id}`} className={cls.routeTransferSummary}>
            {t('calls.step.transfer')}: {label(node.steps[0].actor)} →{' '}
            {label(node.steps[0].target)} ·{' '}
            {t(
              node.steps[0].result === 'answered'
                ? 'calls.transferConnected'
                : 'calls.transferUnconfirmed',
            )}
          </Text>
        ))}
      {!call.historyComplete && (
        <Flex gap="4" align="center">
          <Text role="status" variant="muted">{t('calls.partialHistoryLabel')}</Text>
          <InfoTooltip text={t('calls.partialJourney')}/>
        </Flex>
      )}
      {!nodes.length && <Text>{t('calls.routeEmpty')}</Text>}
      <VStack
        gap="0"
        align="stretch"
        className={`${cls.route} ${scheme ? cls.routeScheme : ''}`}
        data-view={scheme ? 'scheme' : 'timeline'}
      >
        {nodes.map((node) => {
          const step = node.steps[0];
          const Icon =
            node.kind === 'transfer'
              ? ArrowRightLeft
              : node.kind === 'conversation'
                ? PhoneCall
                : node.kind === 'ended'
                  ? PhoneOff
                  : node.kind === 'attempts'
                    ? GitBranch
                    : Circle;
          return (
            <Flex
              key={node.id}
              gap="12"
              align="start"
              className={cls.routeNode}
              data-testid={`route-${node.kind}`}
            >
              <Flex className={cls.routeMarker}>
                <Icon size={16} />
              </Flex>
              <VStack gap="8" align="stretch" className={cls.routeCard}>
                <Flex justify="between" align="center" wrap="wrap" gap="8">
                  <Text className={cls.routeHeading}>
                    {t(
                      node.kind === 'attempts'
                        ? 'calls.routeAttempts'
                        : `calls.step.${node.kind}`,
                    )}
                  </Text>
                  <Text as="span" variant="muted" className={cls.routeClock}>
                    {step.evidence === 'cdr' &&
                    !['received', 'ended'].includes(step.kind)
                      ? '≈ '
                      : ''}
                    {clock(step.at)} · +
                    {callDuration(
                      Math.max(
                        0,
                        Math.round(
                          (Date.parse(step.at) - Date.parse(call.startedAt)) /
                            1000,
                        ),
                      ),
                    )}
                  </Text>
                </Flex>
                {node.possibleParallel && (
                  <Text variant="muted">{t('calls.possibleParallel')}</Text>
                )}
                <Flex gap="8" className={cls.routeBranches}>
                  {node.steps.map((item) => (
                    <VStack
                      key={item.id}
                      gap="4"
                      align="stretch"
                      className={cls.routeBranch}
                    >
                      {(item.actor || item.target) && (
                        <Text>
                          {item.actor ? <PhoneNumber number={item.actor.number} name={item.actor.name} fallback={label(item.actor)}/> : ''}
                          {item.actor && item.target ? ' → ' : ''}
                          {item.target ? <PhoneNumber number={item.target.number} name={item.target.name} fallback={label(item.target)}/> : ''}
                        </Text>
                      )}
                      {item.result && (
                        <Flex gap="4" align="center">
                          <Badge
                            variant={
                              item.result === 'answered'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {item.result === 'answered' && <Check size={12} />}
                            {t(
                              item.kind === 'transfer' &&
                                item.result === 'answered'
                                ? 'calls.transferConnected'
                                : `calls.attempt.${item.result}`,
                            )}
                          </Badge>
                        </Flex>
                      )}
                      {item.kind === 'transfer' && !item.result && (
                        <Text variant="muted">
                          {t('calls.transferUnconfirmed')}
                        </Text>
                      )}
                      {item.kind === 'conversation' && item.until && (
                        <Text variant="muted">
                          {t('calls.connected')}:{' '}
                          {callDuration(
                            Math.max(
                              0,
                              Math.round(
                                (Date.parse(item.until) - Date.parse(item.at)) /
                                  1000,
                              ),
                            ),
                          )}
                        </Text>
                      )}
                      {item.evidence === 'cdr' &&
                        !['received', 'ended'].includes(item.kind) && (
                          <Text variant="muted">
                            {t('calls.approximateTime')}
                          </Text>
                        )}
                    </VStack>
                  ))}
                </Flex>
              </VStack>
            </Flex>
          );
        })}
      </VStack>
    </VStack>
  );
}
