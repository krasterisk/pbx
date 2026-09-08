import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { TimelineList } from '@/features/ai-chat/ui/Timeline';
import { useGetTenantsQuery } from '@/shared/api/endpoints/cloudAdminApi';
import {
  useGetPlatformAiChatThreadQuery,
  useGetPlatformAiChatThreadsQuery,
} from '@/shared/api/endpoints/aiChatApi';
import cls from './PlatformAiThreadsPage.module.scss';

/** Superadmin read-only view of tenant AI conversations. */
export const PlatformAiThreadsPage = () => {
  const { t } = useTranslation();
  const [tenantUid, setTenantUid] = useState<number | null>(null);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);

  const { data: tenantsData } = useGetTenantsQuery({ limit: 100, offset: 0 });
  const { data: threads = [] } = useGetPlatformAiChatThreadsQuery(tenantUid ?? 0, {
    skip: tenantUid == null,
  });
  const { data: detail } = useGetPlatformAiChatThreadQuery(
    { tenantUid: tenantUid ?? 0, uid: selectedUid ?? 0 },
    { skip: tenantUid == null || selectedUid == null },
  );

  const showTimeline = Boolean(detail?.timeline.length);

  return (
    <VStack gap="16" max data-testid="platform-ai-threads-page">
      <Text as="h1" className={cls.pageTitle}>
        {t('platform.aiThreadsTitle')}
      </Text>

      <VStack gap="8" className={cls.selector} align="stretch">
        <Label htmlFor="platform-ai-threads-tenant">{t('platform.aiThreadsTenant')}</Label>
        <Select
          id="platform-ai-threads-tenant"
          aria-label={t('platform.aiThreadsTenant')}
          value={tenantUid == null ? '' : String(tenantUid)}
          onChange={(event) => {
            const next = event.target.value;
            setTenantUid(next ? Number(next) : null);
            setSelectedUid(null);
          }}
        >
          <option value="">{t('platform.aiThreadsPickTenant')}</option>
          {(tenantsData?.rows ?? []).map((tenant) => (
            <option key={tenant.id} value={String(tenant.vpbx_user_uid)}>
              {tenant.name}
            </option>
          ))}
        </Select>
      </VStack>

      <HStack gap="16" align="start" max className={cls.layout}>
        <VStack gap="8" align="stretch" className={cls.rail}>
          {threads.length > 0 && (
            <VStack
              className={cls.list}
              gap="4"
              align="stretch"
              role="listbox"
              aria-label={t('platform.aiThreadsTitle')}
            >
              {threads.map((thread) => {
                const selected = thread.uid === selectedUid;
                const title = thread.title.trim() || t('aiChat.untitled');
                return (
                  <HStack
                    key={thread.uid}
                    role="option"
                    aria-selected={selected}
                    tabIndex={0}
                    className={`${cls.row} ${selected ? cls.selected : ''}`}
                    align="center"
                    gap="8"
                    onClick={() => setSelectedUid(thread.uid)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedUid(thread.uid);
                      }
                    }}
                  >
                    <VStack gap="0" align="start" max>
                      <Text as="span" className={cls.title}>{title}</Text>
                      {thread.ownerName ? (
                        <Text as="span" className={cls.owner}>
                          {t('aiChat.threadOwner')}: {thread.ownerName}
                        </Text>
                      ) : null}
                    </VStack>
                  </HStack>
                );
              })}
            </VStack>
          )}
        </VStack>

        <VStack gap="8" align="stretch" className={cls.workspace} max>
          {showTimeline ? (
            <TimelineList
              items={detail?.timeline ?? []}
              cards={detail?.cards ?? {}}
              readOnly
            />
          ) : (
            <VStack className={cls.empty} gap="8" align="stretch">
              <Text variant="muted">{t('platform.aiThreadsEmpty')}</Text>
            </VStack>
          )}
        </VStack>
      </HStack>
    </VStack>
  );
};
