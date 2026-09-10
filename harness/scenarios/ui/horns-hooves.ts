/** Shared brief for stub and live «Рога и копыта» Playwright specs. */
export const HORNS_PROMPT = hornsPrompt('Рога и копыта');

export function hornsPrompt(name: string, groupExten?: string): string {
  const groupLine = groupExten ? ` номер группы ${groupExten}` : '';
  return [
    `Создай IVR - ${name}`,
    'текст: "Здравствуйте, вы позвонили в Рога и копыта. Нажмите 1 для консультации, 2 для ремонта, 3 для гарантии, или оставайтесь на линии"',
    `Пункты: 1 - Абонент 101 2 - 102 3 - 103 ничего не нажали - звонят все одновременно (группа вызова)${groupLine}`,
  ].join('\n');
}

export function hornsLiveCase(): { name: string; groupExten: string; prompt: string } {
  const stamp = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  const name = `Рога и копыта ${stamp}`;
  const groupExten = `6${stamp.slice(-3)}`;
  return { name, groupExten, prompt: hornsPrompt(name, groupExten) };
}

export const HORNS_TITLE = /Рога и копыта/;
export const HORNS_GREETING = /Здравствуйте, вы позвонили в Рога и копыта/;
export const HORNS_DIGITS = /101|102|103/;
export const STEP_LIMIT = /Достигнут лимит шагов|Step ceiling|max_steps/i;
export const PLAN_STEP = /Собираю план изменений|Assembling a change plan/;
export const RAW_TOOLS = /list_tts_engines|list_endpoints|propose_plan|create_endpoints_bulk|create_call_group|create_ivr/;
export const PLACEHOLDER = /Подготовил изменение|Если нужен план|Prepared a change|If a plan is needed/i;

export function isLiveLlm(): boolean {
  return process.env.HARNESS_LIVE_LLM === '1';
}
