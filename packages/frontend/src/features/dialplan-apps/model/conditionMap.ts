import type {
  ConditionSource,
  DialstatusValue,
  IRouteActionCondition,
  QueuestatusValue,
} from '@krasterisk/shared';

export function toConditionSource(condition?: IRouteActionCondition): ConditionSource | undefined {
  if (!condition) return undefined;
  if (condition.source === 'queuestatus' && condition.values?.length) {
    return { source: 'queuestatus', values: condition.values as QueuestatusValue[] };
  }
  if (condition.source === 'dialstatus' && condition.values?.length) {
    return { source: 'dialstatus', values: condition.values as DialstatusValue[] };
  }
  if (condition.source === 'device_state' && condition.device && condition.values?.length) {
    return {
      source: 'device_state',
      device: condition.device,
      values: condition.values as ConditionSource extends { source: 'device_state' } ? never : never,
    } as ConditionSource;
  }
  if (condition.source === 'variable' && condition.name && condition.op != null) {
    return { source: 'variable', name: condition.name, op: condition.op, value: condition.value ?? '' };
  }
  if (condition.source === 'http_result' && condition.op != null) {
    return { source: 'http_result', op: condition.op, value: condition.value ?? '' };
  }
  if (condition.dialstatus) {
    const values = (Array.isArray(condition.dialstatus) ? condition.dialstatus : [condition.dialstatus]).filter(
      Boolean,
    ) as DialstatusValue[];
    if (values.length) return { source: 'dialstatus', values };
  }
  return undefined;
}

export function toRouteCondition(source: ConditionSource | undefined): IRouteActionCondition {
  if (!source) return {};
  if (source.source === 'dialstatus') {
    return { source: 'dialstatus', values: source.values, dialstatus: source.values[0] };
  }
  if (source.source === 'queuestatus') {
    return { source: 'queuestatus', values: source.values };
  }
  if (source.source === 'device_state') {
    return { source: 'device_state', device: source.device, values: source.values };
  }
  if (source.source === 'variable') {
    return { source: 'variable', name: source.name, op: source.op, value: source.value };
  }
  return { source: 'http_result', op: source.op, value: source.value };
}
