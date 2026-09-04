/**
 * In-flight agent turn (15-18). Implementation lands in the GREEN commit.
 */
export function useAgentStream() {
  return {
    send: (_message: string) => undefined,
    stop: () => undefined,
    abort: () => undefined,
    progressLines: [] as string[],
    answerText: '',
    isStreaming: false,
    outcome: 'idle' as const,
  };
}
