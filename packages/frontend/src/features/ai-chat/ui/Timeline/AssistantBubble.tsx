import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { scrubToolIdsFromPublicText, type AgentTimelineAssistantItem } from '@krasterisk/shared';
import cls from './TimelineList.module.scss';

interface AssistantBubbleProps {
    item: AgentTimelineAssistantItem;
}

export const AssistantBubble = ({ item }: AssistantBubbleProps) => {
    const text = scrubToolIdsFromPublicText(item.text);

    return (
        <VStack
            className={`${cls.item} ${cls.assistant}`}
            data-kind="assistant"
            data-streaming={item.streaming ? 'true' : undefined}
            align="start"
        >
            {(text || item.streaming) && (
                <VStack className={cls.assistantBubble} align="stretch">
                    {text && (
                        <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ children, className }) {
                                    const isBlock = /language-/.test(className ?? '');
                                    return isBlock
                                        ? <pre className={cls.codeBlock}><code>{children}</code></pre>
                                        : <code className={cls.inlineCode}>{children}</code>;
                                },
                                p({ children }) { return <p className={cls.mdParagraph}>{children}</p>; },
                                ul({ children }) { return <ul className={cls.mdList}>{children}</ul>; },
                                ol({ children }) { return <ol className={cls.mdList}>{children}</ol>; },
                                li({ children }) { return <li className={cls.mdListItem}>{children}</li>; },
                                strong({ children }) { return <strong className={cls.mdStrong}>{children}</strong>; },
                                h1({ children }) { return <h3 className={cls.mdHeading}>{children}</h3>; },
                                h2({ children }) { return <h3 className={cls.mdHeading}>{children}</h3>; },
                                h3({ children }) { return <h3 className={cls.mdHeading}>{children}</h3>; },
                            }}
                        >
                            {text}
                        </Markdown>
                    )}
                    {item.streaming && (
                        <Text as="span" className={cls.cursor} aria-hidden data-streaming-cursor="" />
                    )}
                </VStack>
            )}
        </VStack>
    );
};
