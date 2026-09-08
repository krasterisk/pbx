import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import type { AgentTimelineUserItem } from '@krasterisk/shared';
import cls from './TimelineList.module.scss';

interface UserBubbleProps {
    item: AgentTimelineUserItem;
}

export const UserBubble = ({ item }: UserBubbleProps) => (
    <VStack className={`${cls.item} ${cls.user}`} data-kind="user" align="end">
        <Text as="span" className={cls.userBubble}>{item.text}</Text>
    </VStack>
);
