/** Only current-turn, authorized report tool results may supply call links. */
export interface CdrToolOutput { name: string; content: string }
const REPORT_TOOLS = new Set(['search_calls','get_call','summarize_calls','list_unreturned_missed','find_cdr_calls','get_cdr_summary','resolve_call_employees','summarize_employee_calls','search_call_content','get_call_analysis','summarize_call_conversations']);
export const isCdrAnswerTool = (name: string): boolean => REPORT_TOOLS.has(name);
const callPath = /^\/reports\/calls(?:\/[a-f0-9]{64})?\/?$/;
function parsed(value: string): URL | null {
  try { const url = new URL(value, 'https://cdr.invalid'); return callPath.test(url.pathname) ? url : null; }
  catch { return null; }
}
const query = (url: URL) => { const value = new URLSearchParams(url.search); value.sort(); return value.toString(); };

export function normalizeCdrAnswerLinks(text: string, outputs: CdrToolOutput[], locale = 'ru'): string {
  const known: Array<{value:string;url:URL}> = [];
  let active = false;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'url' && typeof item === 'string' && item.startsWith('/reports/calls')) {
        const url = parsed(item); if (url) known.push({value:item,url});
      } else if (typeof item === 'object') visit(item);
    }
  };
  for (const output of outputs) {
    if (!REPORT_TOOLS.has(output.name)) continue;
    try { const result = JSON.parse(output.content); if (!result || result.error) continue; active = true; visit(result); }
    catch { /* A failed or malformed tool result is not evidence for a link. */ }
  }
  if (!active) return text;
  const resolve = (href: string): string | null | undefined => {
    const url = parsed(href); if (!url) return undefined;
    const sameCall = known.filter(item => item.url.pathname === url.pathname);
    return sameCall.find(item=>query(item.url)===query(url))?.value
      ?? sameCall.find(item=>item.url.searchParams.has('transcriptSegment'))?.value
      ?? sameCall[0]?.value ?? null;
  };
  const preserved: string[] = [];
  let marker = 'CDR_LINK_PLACEHOLDER_';
  while (text.includes(marker)) marker += 'X';
  const keep = (value: string) => { preserved.push(value); return `${marker}${preserved.length-1}__`; };
  const unavailable = locale.startsWith('ru') ? 'ссылка на звонок недоступна' : 'call link unavailable';
  const clickable = (target: string) => {
    const card = /\/calls\/[a-f0-9]{64}/.test(target);
    const label = locale.startsWith('ru') ? (card ? 'Открыть звонок' : 'Открыть журнал') : (card ? 'Open call' : 'Open journal');
    return `[${label}](${target})`;
  };
  const markdown = text.replace(/\[([^\]]*)\]\((?:<([^>]+)>|([^\s)]+))\)/g, (match, label: string, angle: string, plain: string) => {
    const target = resolve(angle || plain);
    return keep(target === undefined ? match : target ? `[${label}](${target})` : label);
  });
  const absolute = markdown.replace(/https?:\/\/[^\s<>()\]]+/g, href => {
    const target = resolve(href);
    return keep(target === undefined ? href : target ? clickable(target) : unavailable);
  });
  const inline = absolute.replace(/`(\/reports\/calls(?:\/[a-f0-9]{64})?(?:\?[^`\s]*)?)`/g, (_match, href: string) => {
    const target=resolve(href); return keep(target ? clickable(target) : unavailable);
  });
  return inline.replace(/\/reports\/calls(?:\/[a-f0-9]{64})?(?:\?[^\s<>()\]`]*)?/g, href => {
    const target=resolve(href); return keep(target ? clickable(target) : unavailable);
  }).replace(new RegExp(`${marker}(\\d+)__`, 'g'), (match, index: string) => preserved[Number(index)] ?? match);
}
