import {
  normalizeCallNumber,
  type CallDimension,
  type CallRecord,
} from '@krasterisk/shared';

export function callDimensions(
  call: CallRecord,
): Array<{ kind: CallDimension | 'recording'; value: string; label: string }> {
  const dimensions = new Map<
    string,
    { kind: CallDimension | 'recording'; value: string; label: string }
  >();
  const add = (
    kind: CallDimension | 'recording',
    value: string | null,
    label?: string | null,
  ) => {
    if (!value || value.length > 128) return;
    const key = `${kind}:${value}`;
    const previous = dimensions.get(key);
    if (!previous || (label && previous.label === value))
      dimensions.set(key, {
        kind,
        value,
        label: (label || value).slice(0, 255),
      });
  };
  for (const party of [call.caller, call.recipient, ...call.participants]) {
    if (party.kind === 'employee')
      add('employee', party.number || party.id, party.name);
    if (party.kind === 'queue')
      add('queue', party.id || party.number, party.name);
    if (['aiRobot', 'voiceRobot'].includes(party.kind) && party.id)
      add('robot', `${party.kind}:${party.id}`, party.name);
    if (party.department)
      add(
        'department',
        party.department.trim().toLowerCase(),
        party.department,
      );
  }
  if (call.companyNumber)
    add(
      'companyNumber',
      normalizeCallNumber(call.companyNumber),
      call.companyNumber,
    );
  if (call.recordings.length) add('recording', 'yes');
  return [...dimensions.values()];
}
