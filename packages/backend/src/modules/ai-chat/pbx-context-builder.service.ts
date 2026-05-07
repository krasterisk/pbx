import { Injectable, Logger } from '@nestjs/common';
import { EndpointsService } from '../endpoints/endpoints.service';
import { TrunksService } from '../trunks/trunks.service';
import { IvrsService } from '../ivrs/ivrs.service';
import { QueuesService } from '../queues/queues.service';
import { ContextsService } from '../contexts/contexts.service';

export interface PbxStateDto {
    endpointsCount: number;
    extensionRanges: string;
    trunksCount: number;
    trunks: Array<{ id: string; name: string; host: string; status: string | null }>;
    ivrsCount: number;
    ivrs: Array<{ uid: number; name: string }>;
    queuesCount: number;
    queues: Array<{ exten: string; displayName: string }>;
    contextsCount: number;
    contexts: Array<{ uid: number; name: string }>;
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
            contexts: contexts.map((c: any) => ({ uid: c.uid, name: c.name })),
        };
    }

    buildSystemPrompt(state: PbxStateDto): string {
        const trunksStr = state.trunks.length
            ? state.trunks.map(t => `"${t.name}" (${t.host})`).join(', ')
            : 'отсутствуют';

        const contextsStr = state.contexts.length
            ? state.contexts.map(c => `"${c.name}" (uid:${c.uid})`).join(', ')
            : 'отсутствуют';

        const ivrsStr = state.ivrs.length
            ? state.ivrs.map(i => `"${i.name}" (uid:${i.uid})`).join(', ')
            : 'отсутствуют';

        return `Ты — AI-ассистент для управления IP-АТС KrAsterisk (Asterisk).
Помогаешь администратору настраивать АТС через текстовые команды.

## Текущая конфигурация АТС
- Абоненты: ${state.endpointsCount} шт.${state.extensionRanges ? ' Диапазоны: ' + state.extensionRanges : ''}
- Транки: ${state.trunksCount} шт.${state.trunksCount ? ' (' + trunksStr + ')' : ''}
- Контексты: ${state.contextsCount} шт.${state.contextsCount ? ' (' + contextsStr + ')' : ''}
- IVR-меню: ${state.ivrsCount} шт.${state.ivrsCount ? ' (' + ivrsStr + ')' : ''}
- Очереди: ${state.queuesCount} шт.

## Правила работы
1. ВСЕГДА начинай с описания плана действий
2. При операциях на >5 сущностей — запроси подтверждение
3. Выполняй шаги ПОСЛЕДОВАТЕЛЬНО
4. Никогда не удаляй данные без явного подтверждения пользователя
5. Отвечай на русском языке
6. В конце подводи итог: что создано/изменено`;
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
