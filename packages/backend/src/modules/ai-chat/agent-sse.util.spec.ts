import { formatSseEvent, formatSseHeartbeat, SseStreamSession } from './agent-sse.util';

describe('agent-sse.util', () => {
  it('frames each event with its name and a single serialized payload line', () => {
    const framed = formatSseEvent('tool_call', { name: 'get_pbx_state', arguments: { domain: 'queues' } });

    expect(framed).toBe(
      'event: tool_call\ndata: {"name":"get_pbx_state","arguments":{"domain":"queues"}}\n\n',
    );
  });

  it('emits a heartbeat when idle beyond the configured interval', () => {
    jest.useFakeTimers();
    const writes: string[] = [];
    const session = new SseStreamSession((chunk) => writes.push(chunk), 15_000);

    session.startHeartbeat();
    jest.advanceTimersByTime(14_999);
    expect(writes).toEqual([]);

    jest.advanceTimersByTime(1);
    expect(writes).toEqual([formatSseHeartbeat()]);
    expect(writes[0].startsWith(': ')).toBe(true);

    session.emit('text', 'still here');
    writes.length = 0;
    jest.advanceTimersByTime(14_999);
    expect(writes).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(writes).toEqual([formatSseHeartbeat()]);

    session.stop();
    jest.useRealTimers();
  });
});
