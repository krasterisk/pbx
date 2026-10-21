import type { AutodialOutcomeDefinition, AutodialScenarioAction } from '@krasterisk/shared';
import { autodialOperationId } from './operationId';

export type ConversationGoal = 'debt' | 'appointment' | 'notification' | 'operator' | 'survey';
export interface ConversationInput {
  goal: ConversationGoal;
  provider?: number;
  name?: string;
  amount?: string;
  date?: string;
  time?: string;
  queue?: string;
  text: (key: string, values?: Record<string, string>) => string;
  outcomeLabel?: (code: string) => string;
}

/** Templates use the same validated scenario contract as the ordinary editor. */
export function conversationTemplate(input: ConversationInput): Array<AutodialScenarioAction & { id: string; condition: Record<string, never> }> {
  const actions: Array<AutodialScenarioAction & { id: string; condition: Record<string, never> }> = [];
  const add = (action: AutodialScenarioAction) => actions.push({ ...action, id: autodialOperationId(), condition: {} });
  const say = (key: string, values?: Record<string, string>, completionOutcome?: AutodialOutcomeDefinition & { code: string }) => {
    if (!input.provider) throw new Error('speech_provider_required');
    add({ type: 'text2speech', params: { engine: input.provider, text: input.text(key, values), onFailure: 'hangup', ...(completionOutcome ? { completionOutcome } : {}) } });
  };
  const hangup = () => add({ type: 'hangup', params: {} });
  const token = (variable: string | undefined, suffix = '') => {
    if (!variable || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) throw new Error('field_required');
    return `{${variable}${suffix}}`;
  };
  const meanings: Record<string, Omit<AutodialOutcomeDefinition, 'label'>> = {
    identity_acknowledged: { category: 'neutral', goal_relation: 'unknown' }, wrong_party: { category: 'negative', goal_relation: 'not_achieved' },
    payment_promised: { category: 'positive', goal_relation: 'achieved' }, payment_callback: { category: 'callback', goal_relation: 'not_achieved' },
    visit_confirmed: { category: 'positive', goal_relation: 'achieved' }, visit_reschedule: { category: 'callback', goal_relation: 'not_achieved' },
    survey_positive: { category: 'positive', goal_relation: 'achieved' }, survey_negative: { category: 'negative', goal_relation: 'achieved' },
  };
  const read = (variableName: string, outcomeMap: Record<string, string>) => add({ type: 'collect_input', params: {
    variableName, digitsCount: 1, timeout: 10, attempts: 2, outcomeMap,
    outcomeDefinitions: Object.fromEntries(Object.values(outcomeMap).map((code) => [code, { label: input.outcomeLabel?.(code) ?? code, ...meanings[code] }])),
  } });
  const jump = (name: string, variable: string, value: string) => add({ type: 'goto', params: { label_name: name, condition: { source: 'variable', name: variable, op: 'eq', value } } });
  const label = (name: string) => add({ type: 'label', params: { label_name: name } });
  if (input.goal === 'operator') {
    if (!input.queue) throw new Error('queue_required');
    add({ type: 'toqueue', params: { queue: input.queue, connectionOutcome: { code: 'operator_connected',
      label: input.outcomeLabel?.('operator_connected') ?? 'operator_connected', category: 'positive', goal_relation: 'achieved' } } });
    hangup(); return actions;
  }
  if (input.goal === 'debt') {
    // An explicit keypress gates disclosure. It is an acknowledgement, not
    // reliable identity verification or evidence of a legal commitment.
    say('debtIdentity', { name: token(input.name) });
    read('AC_IDENTITY', { '1': 'identity_acknowledged', '2': 'wrong_party' });
    jump('debt_details', 'AC_IDENTITY', '1');
    say('neutralEnd'); hangup();
    label('debt_details'); say('debtMessage', { amount: token(input.amount, '_SAY_MONEY') });
    read('AC_PAYMENT', { '1': 'payment_promised', '2': 'payment_callback' });
    jump('debt_received', 'AC_PAYMENT', '1'); jump('debt_received', 'AC_PAYMENT', '2');
    say('unknownEnd'); hangup(); label('debt_received'); say('received'); hangup();
  } else if (input.goal === 'appointment') {
    say('appointmentMessage', { name: token(input.name), date: token(input.date, '_SAY_DATE'), time: token(input.time) });
    read('AC_VISIT', { '1': 'visit_confirmed', '2': 'visit_reschedule' });
    jump('visit_received', 'AC_VISIT', '1'); jump('visit_received', 'AC_VISIT', '2');
    say('unknownEnd'); hangup(); label('visit_received'); say('received'); hangup();
  } else if (input.goal === 'survey') {
    say('surveyMessage', { name: token(input.name) });
    read('AC_SURVEY', { '1': 'survey_positive', '2': 'survey_negative' });
    jump('survey_received', 'AC_SURVEY', '1'); jump('survey_received', 'AC_SURVEY', '2');
    say('unknownEnd'); hangup(); label('survey_received'); say('received'); hangup();
  } else {
    say('notificationMessage', { name: token(input.name) }, { code: 'message_played', label: input.outcomeLabel?.('message_played') ?? 'message_played', category: 'positive', goal_relation: 'achieved' }); hangup();
  }
  return actions;
}
