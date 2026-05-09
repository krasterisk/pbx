import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * KnowledgeBaseService — загружает документацию KrAsterisk из .docs/
 * и подготавливает компактный дайджест для системного промпта.
 *
 * Docs читаются при старте приложения. Структура:
 *   .docs/ENDPOINTS_MODULE.md       → знания об абонентах
 *   .docs/CONTEXTS_MODULE.md        → знания о контекстах
 *   .docs/TRUNKS_MODULE.md          → знания о транках
 *   .docs/IVR_MODULE.md             → знания об IVR
 *   .docs/QUEUES_MODULE.md          → знания об очередях
 *   .docs/ROUTES_MODULE.md          → знания о маршрутизации
 *   .docs/DIALPLAN_APPS_MODULE.md   → знания о диалплан-приложениях
 */
@Injectable()
export class KnowledgeBaseService implements OnModuleInit {
    private readonly logger = new Logger(KnowledgeBaseService.name);

    /** Готовый дайджест для вставки в system prompt */
    private digest = '';

    onModuleInit() {
        this.loadDocs();
    }


    /** Возвращает дайджест документации для вставки в system prompt */
    getDigest(): string {
        return this.digest;
    }

    private loadDocs(): void {
        // Операторский справочник KrAsterisk — что делает каждый модуль с точки зрения пользователя.
        // Дополняется из .docs если они доступны (добавляет детали API и параметры).
        const operatorKnowledge = this.buildOperatorKnowledge();
        const docsAddendum = this.loadDocsAddendum();

        this.digest = docsAddendum
            ? `${operatorKnowledge}\n\n---\n\n${docsAddendum}`
            : operatorKnowledge;

        this.logger.log(`KnowledgeBase: knowledge base ready (${this.digest.length} chars)`);
    }

    /**
     * Операторский справочник — описание возможностей KrAsterisk от лица пользователя.
     * Модель должна знать ЧТО можно делать, а не КАК это устроено внутри.
     */
    private buildOperatorKnowledge(): string {
        return `## ВОЗМОЖНОСТИ KRASTERISK

KrAsterisk — это веб-интерфейс для управления IP-АТС на базе Asterisk PJSIP.
Пользователь (администратор АТС) управляет через веб-интерфейс или через AI-чат.

### Абоненты (Endpoints)
- Каждый абонент = SIP-аккаунт для телефона или софтфона
- Параметры: extension (внутренний номер), пароль, контекст, кодеки, NAT-профиль, display name
- SIP ID формат: e{extension}_{tenantId} — уникальный идентификатор в Asterisk
- Контекст абонента определяет его права: какие номера он может набирать
- Создание абонента вступает в силу МГНОВЕННО (Dynamic Realtime, без reload)
- Кодеки: ulaw, alaw (G.711 — стандарт), g722 (HD), opus (WebRTC), g729 (сжатый)
- NAT-профили: lan (офисная сеть), nat (абонент за NAT/роутером), webrtc (браузер)
- Для работы телефона нужны: SIP ID + пароль + адрес сервера АТС

### Транки (Trunks)
- Транк = соединение с оператором связи или другой АТС
- Через транк приходят входящие звонки и уходят исходящие
- Параметры: имя, host (адрес провайдера), username, пароль, тип транка
- Статус: Registered (работает), Unregistered (не зарегистрирован — проблема)
- После создания транка нужно настроить маршруты для входящих и исходящих звонков

### Контексты маршрутизации (Contexts)
- Контекст = именованная группа правил маршрутизации (dialplan)
- Каждый абонент привязан к контексту — это определяет что ему разрешено
- Маршруты помещаются в контекст и применяются через кнопку "Применить"
- Контексты могут включать друг друга (include)
- Один контекст может быть для внутренних звонков, другой — для входящих с транка

### Маршруты (Routes)
- Маршрут = правило: "если набрали номер X — сделать действие Y"
- Действия: переадресовать на абонента, на транк, на IVR, на очередь, проиграть аудио
- Паттерны номеров: "_3XX" (любой трёхзначный начинающийся с 3), "_7XXXXXXXXXX" (мобильные), "_." (любой)
- Маршруты можно ограничить по времени (TimeGroup) и добавить запись разговора
- После изменения маршрутов нужно нажать "Применить" (dialplan reload)

### IVR (Interactive Voice Response)
- IVR = голосовое меню: "Нажмите 1 — отдел продаж, 2 — техподдержка..."
- Каждый пункт меню можно направить на: абонента, группу, другое IVR, очередь
- Поддерживает запись приветствия через TTS или загрузку аудиофайла

### Очереди (Queues)
- Очередь = группа агентов, принимающих звонки по очереди
- Когда все агенты заняты — звонящий ждёт с музыкой
- Агенты = абоненты добавленные в очередь
- Стратегии: ringall (все сразу), roundrobin (по очереди), leastrecent (кто дольше не звонил)

### Расписания (TimeGroups)
- Ограничивают маршруты по времени: рабочие часы, выходные, праздники
- В рабочее время → идёт в очередь; вне рабочего → IVR "мы не работаем"

### Музыка на удержании (MOH)
- Фоновая музыка когда звонящий ждёт
- Можно загрузить свои mp3-файлы

### Автопровизионинг (Provision Templates)
- Автоматическая настройка IP-телефонов Yealink, Grandstream и других
- Шаблон конфигурации отправляется на телефон при его подключении

### Справочники (Phonebooks)
- База данных контактов: имя, номер, организация
- Поиск по имени при входящем звонке (CallerID lookup)

### Голосовые роботы (Voice Robots)
- Автоматические исходящие звонки с TTS-голосом и распознаванием речи (STT)
- Сценарии: опросы, уведомления, верификация

## РАБОЧИЕ СЦЕНАРИИ

### Новая АТС "с нуля"
1. Создать контекст для внутренних абонентов (например "from-internal")
2. Создать абонентов (100, 101, 102...)
3. Настроить транк (подключить к оператору)
4. Создать контекст для входящих (например "from-trunk")
5. Добавить маршрут в контекст входящих → куда направлять звонки
6. Применить диалплан

### Добавить нового абонента
Просто создать endpoint с нужным номером. Вступает в силу мгновенно.
Сообщить пользователю: SIP ID, пароль, адрес сервера.

### Настроить IVR
1. Создать IVR с нужными пунктами меню
2. В маршруте направить входящий номер на IVR

### Почему не работает звонок
- Проверить статус транка (Registered?)
- Проверить контекст абонента (правильный?)
- Проверить маршрут (применён?)
- Проверить NAT-профиль абонента`;
    }

    /**
     * Дополнительные детали из .docs — только операционно значимые части.
     * Пропускает TypeScript/React/SQL код — оставляет только описания возможностей.
     */
    private loadDocsAddendum(): string {
        const candidates = [
            path.resolve(process.cwd(), '.docs'),
            path.resolve(process.cwd(), '../../.docs'),
            path.resolve(__dirname, '../../../../../.docs'),
        ];

        const docsDir = candidates.find(d => {
            try { return fs.statSync(d).isDirectory(); } catch { return false; }
        });

        if (!docsDir) return '';

        // Только самые компактные и полезные операционно файлы
        const ADDENDUM_DOCS = ['DIALPLAN_APPS_MODULE.md'];
        const sections: string[] = [];
        let totalChars = 0;
        const MAX_ADDENDUM = 4000;

        for (const filename of ADDENDUM_DOCS) {
            const filePath = path.join(docsDir, filename);
            if (!fs.existsSync(filePath)) continue;
            try {
                const raw = fs.readFileSync(filePath, 'utf8');
                const distilled = this.distill(raw, filename);
                if (totalChars + distilled.length > MAX_ADDENDUM) break;
                sections.push(distilled);
                totalChars += distilled.length;
            } catch { /* ignore */ }
        }

        return sections.join('\n\n');
    }



    /**
     * Дистиллирует markdown-документ в компактный текст для system prompt.
     * Убирает: mermaid-диаграммы, code-блоки с SQL/TypeScript, длинные таблицы,
     * оставляет: заголовки, описания, ключевые факты, API endpoints.
     */
    private distill(raw: string, filename: string): string {
        const moduleName = filename.replace('_MODULE.md', '').replace('.md', '');
        const lines = raw.split('\n');
        const result: string[] = [`## ${moduleName}`];

        let inCodeBlock = false;
        let codeBlockLang = '';
        let skipBlock = false;
        let consecutiveEmpty = 0;

        for (const line of lines) {
            // Обработка code blocks
            const codeMatch = line.match(/^```(\w*)/);
            if (codeMatch && !inCodeBlock) {
                inCodeBlock = true;
                codeBlockLang = codeMatch[1].toLowerCase();
                // Пропускаем code-блоки с кодом, оставляем только ini/conf (Asterisk config)
                skipBlock = !['ini', 'conf', 'asterisk', 'dialplan'].includes(codeBlockLang);
                if (!skipBlock) result.push(line);
                continue;
            }
            if (line.startsWith('```') && inCodeBlock) {
                inCodeBlock = false;
                if (!skipBlock) result.push(line);
                skipBlock = false;
                continue;
            }
            if (inCodeBlock) {
                if (!skipBlock) result.push(line);
                continue;
            }

            // Пропускаем mermaid sequenceDiagram содержимое (уже обработано как codeblock выше)
            // Пропускаем HTML-комментарии
            if (line.startsWith('<!--') || line.startsWith('> [!')) continue;

            // Пропускаем строки с чисто HTML-тегами
            if (/^<[^>]+>$/.test(line.trim())) continue;

            // Пропускаем строки таблицы с разделителями (---|---| ...)
            if (/^\|[-:\s|]+\|$/.test(line.trim())) continue;

            // Схлопываем несколько пустых строк в одну
            if (line.trim() === '') {
                consecutiveEmpty++;
                if (consecutiveEmpty <= 1) result.push('');
                continue;
            }
            consecutiveEmpty = 0;

            result.push(line);
        }

        // Убираем строки только с горизонтальными линиями
        const filtered = result.filter((l, i) => {
            if (/^---+$/.test(l.trim()) && (result[i - 1]?.trim() === '' || result[i + 1]?.trim() === '')) return false;
            return true;
        });

        return filtered.join('\n').trim();
    }
}
