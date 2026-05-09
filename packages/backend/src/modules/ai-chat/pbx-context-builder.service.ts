import { Injectable, Logger } from '@nestjs/common';
import { EndpointsService } from '../endpoints/endpoints.service';
import { TrunksService } from '../trunks/trunks.service';
import { IvrsService } from '../ivrs/ivrs.service';
import { QueuesService } from '../queues/queues.service';
import { ContextsService } from '../contexts/contexts.service';
import { KnowledgeBaseService } from './knowledge-base.service';

export interface PbxStateDto {
    endpointsCount: number;
    extensionRanges: string;
    endpoints: Array<{ extension: string; sipId: string; displayName?: string; context: string }>;
    trunksCount: number;
    trunks: Array<{ id: string; name: string; host: string; status: string | null }>;
    ivrsCount: number;
    ivrs: Array<{ uid: number; name: string }>;
    queuesCount: number;
    queues: Array<{ exten: string; displayName: string }>;
    contextsCount: number;
    contexts: Array<{ uid: number; name: string; comment: string }>;
}

@Injectable()
export class PbxContextBuilderService {
    private readonly logger = new Logger(PbxContextBuilderService.name);

    constructor(
        private readonly endpointsService: EndpointsService,
        private readonly trunksService: TrunksService,
        private readonly ivrsService: IvrsService,
        private readonly queuesService: QueuesService,
        private readonly contextsService: ContextsService,
        private readonly knowledgeBase: KnowledgeBaseService,
    ) {}

    async buildState(userUid: number): Promise<PbxStateDto> {
        const [endpoints, trunks, ivrs, queues, contexts] = await Promise.all([
            this.endpointsService.findAll(userUid).catch(() => []),
            this.trunksService.findAll(userUid).catch(() => []),
            this.ivrsService.findAll(userUid).catch(() => []),
            this.queuesService.findAll(userUid).catch(() => []),
            this.contextsService.findAll(userUid).catch(() => []),
        ]);

        return {
            endpointsCount: endpoints.length,
            extensionRanges: this.buildExtensionRanges(endpoints),
            endpoints: endpoints.slice(0, 30).map((e: any) => ({
                extension: e.id ?? e.name ?? '',
                sipId: e.sipUsername ?? '',
                displayName: e.displayName ?? '',
                context: e.context ?? '',
            })),
            trunksCount: trunks.length,
            trunks: trunks.map((t: any) => ({
                id: t.id,
                name: t.name,
                host: t.host,
                status: t.registrationStatus ?? null,
            })),
            ivrsCount: ivrs.length,
            ivrs: ivrs.map((ivr: any) => ({ uid: ivr.uid, name: ivr.name })),
            queuesCount: queues.length,
            queues: queues.map((q: any) => ({
                exten: q.exten,
                displayName: q.display_name ?? q.exten,
            })),
            contextsCount: contexts.length,
            contexts: contexts.map((c: any) => ({
                uid: c.uid,
                name: c.name,
                comment: c.comment ?? '',
            })),
        };
    }

    buildSystemPrompt(state: PbxStateDto): string {
        const trunksStr = state.trunks.length
            ? state.trunks.map(t => `  • "${t.name}" → ${t.host} [${t.status ?? 'неизвестно'}]`).join('\n')
            : '  (нет транков)';

        const contextsStr = state.contexts.length
            ? state.contexts.map(c => `  • "${c.name}" uid=${c.uid}${c.comment ? ` — ${c.comment}` : ''}`).join('\n')
            : '  (нет контекстов)';

        const ivrsStr = state.ivrs.length
            ? state.ivrs.map(i => `  • "${i.name}" uid=${i.uid}`).join('\n')
            : '  (нет IVR)';

        const queuesStr = state.queues.length
            ? state.queues.map(q => `  • ${q.exten} "${q.displayName}"`).join('\n')
            : '  (нет очередей)';

        const endpointsPreview = state.endpoints.length
            ? state.endpoints.slice(0, 10)
                .map(e => `${e.extension}${e.displayName ? ' (' + e.displayName + ')' : ''}`)
                .join(', ')
                + (state.endpoints.length > 10 ? ` и ещё ${state.endpoints.length - 10}...` : '')
            : 'нет';

        return `Ты — AI-ассистент IP-АТС KrAsterisk. Отвечай по-русски.

## ГЛАВНОЕ ПРАВИЛО — ДЕЙСТВУЙ НЕМЕДЛЕННО
Если пользователь просит создать/удалить/изменить — СРАЗУ вызывай инструмент. НЕ задавай уточняющих вопросов для простых операций.

Примеры ПРАВИЛЬНОГО поведения:
- "создай абонентов 101-105" → сразу вызываешь create_endpoint 5 раз, без вопросов
- "удали абонента 102" → спрашиваешь подтверждение (удаление опасно), потом delete_endpoint
- "покажи состояние АТС" → сразу get_pbx_state
- "создай 10 абонентов" → уточни только диапазон если он не указан, потом создавай

НЕ уточняй: тип подключения, роль абонента, назначение, технические детали — это не нужно для создания.

## ТЕКУЩЕЕ СОСТОЯНИЕ АТС
- Абоненты: ${state.endpointsCount}${state.extensionRanges ? ' (номера: ' + state.extensionRanges + ')' : ''}
- Транки: ${state.trunksCount}${state.trunks.length ? ' (' + state.trunks.map(t => `"${t.name}" [${t.status ?? '?'}]`).join(', ') + ')' : ''}
- Контексты: ${state.contextsCount}${state.contexts.length ? '\n' + state.contexts.map(c => `  • "${c.name}"${c.comment ? ' — ' + c.comment : ''}`).join('\n') : ''}
- IVR: ${state.ivrsCount}${state.ivrs.length ? ' (' + state.ivrs.map(i => `"${i.name}"`).join(', ') + ')' : ''}
- Очереди: ${state.queuesCount}${state.queues.length ? ' (' + state.queues.map(q => q.exten).join(', ') + ')' : ''}

## ПРАВИЛА ИНСТРУМЕНТОВ
⛔ ЗАПРЕЩЕНО писать "создан/удалён/готово" до получения реального ответа от инструмента
⛔ ЗАПРЕЩЕНО обновлять счётчики на основе предположений — только из get_pbx_state
✅ После tool_result — цитируй ФАКТИЧЕСКИЙ ответ (SIP ID, пароль, ошибку)
✅ Пароль показывай всегда — он нужен для настройки телефона
✅ При ошибке — показывай точный текст ошибки, не выдумывай причины

## ЗНАНИЯ О СИСТЕМЕ
${this.knowledgeBase.getDigest()}`;
    }



    private buildExtensionRanges(endpoints: any[]): string {
        if (!endpoints.length) return '';
        const nums = endpoints
            .map((e: any) => parseInt(e.id || e.name || '0', 10))
            .filter(n => !isNaN(n) && n > 0)
            .sort((a, b) => a - b);
        if (!nums.length) return '';

        const ranges: string[] = [];
        let start = nums[0];
        let end = nums[0];
        for (let i = 1; i < nums.length; i++) {
            if (nums[i] === end + 1) {
                end = nums[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                start = nums[i];
                end = nums[i];
            }
        }
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        return ranges.join(', ');
    }
}

