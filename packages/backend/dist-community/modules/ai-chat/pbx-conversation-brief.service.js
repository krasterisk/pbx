"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PbxConversationBriefService = void 0;
const common_1 = require("@nestjs/common");
const conversation_brief_types_1 = require("./conversation-brief.types");
const SUBSTANTIVE_MIN = 8;
/**
 * Pins the first substantive user request and compiles later turns into
 * source-evidenced facts. A fact value may change only when the new message
 * contains an explicit quote supporting the replacement; compiler failure
 * leaves the previous brief (and its anchor) untouched.
 */
let PbxConversationBriefService = class PbxConversationBriefService {
    isSubstantive(text) {
        const trimmed = text.trim();
        if (trimmed.length < SUBSTANTIVE_MIN)
            return false;
        if (/^(да|нет|ok|ок|continue|продолж|дальше|yes|no)[\s!.?]*$/i.test(trimmed)) {
            return false;
        }
        return true;
    }
    ensureAnchor(brief, messageUid, text) {
        const current = brief && brief.version > 0 ? structuredClone(brief) : (0, conversation_brief_types_1.emptyBrief)();
        if (current.anchor)
            return current;
        if (!this.isSubstantive(text))
            return current;
        current.anchor = text.trim();
        current.anchorMessageUid = messageUid;
        current.goal = this.inferGoal(text);
        current.facts = this.extractFacts(text, messageUid);
        current.version = 1;
        current.updatedThroughMessageUid = messageUid;
        return current;
    }
    /**
     * Merge a new user message into the brief. Returns the previous brief unchanged
     * when the compiler cannot evidence a change (anchor always survives).
     */
    compile(previous, messageUid, text) {
        const base = previous && previous.version > 0 ? structuredClone(previous) : (0, conversation_brief_types_1.emptyBrief)();
        try {
            if (!base.anchor) {
                return this.ensureAnchor(base, messageUid, text);
            }
            if (messageUid <= base.updatedThroughMessageUid) {
                return base;
            }
            if (!this.isSubstantive(text) && !/замен|вместо|переимен|rename|instead/i.test(text)) {
                base.updatedThroughMessageUid = messageUid;
                return base;
            }
            const extracted = this.extractFacts(text, messageUid);
            for (const next of extracted) {
                const existing = base.facts.find((f) => f.key === next.key);
                if (!existing) {
                    base.facts.push(next);
                    continue;
                }
                if (existing.value === next.value)
                    continue;
                if (!this.quoteSupports(text, next.value) && !this.quoteSupports(text, next.sourceQuote)) {
                    continue;
                }
                base.replacements.push({
                    key: next.key,
                    from: existing.value,
                    to: next.value,
                    sourceMessageUid: messageUid,
                    sourceQuote: next.sourceQuote,
                });
                existing.value = next.value;
                existing.sourceMessageUid = next.sourceMessageUid;
                existing.sourceQuote = next.sourceQuote;
            }
            if (!base.goal) {
                base.goal = this.inferGoal(text) ?? base.goal;
            }
            base.version += 1;
            base.updatedThroughMessageUid = messageUid;
            return base;
        }
        catch {
            return previous && previous.version > 0 ? previous : base;
        }
    }
    withWorkflowProgress(brief, progress) {
        return {
            ...brief,
            workflowProgress: progress,
            version: brief.version + 1,
        };
    }
    inferGoal(text) {
        const trimmed = text.trim();
        if (/ivr|голосовое меню|меню/i.test(trimmed))
            return 'configure_ivr';
        if (/trunk|транк|провайдер/i.test(trimmed))
            return 'configure_trunk';
        if (/абонент|endpoint|внутренн/i.test(trimmed))
            return 'configure_endpoints';
        if (/групп/i.test(trimmed))
            return 'configure_call_group';
        if (/очеред/i.test(trimmed))
            return 'configure_queue';
        if (/атс|pbx|настро/i.test(trimmed))
            return 'pbx_setup';
        return trimmed.length > 0 ? 'general' : null;
    }
    extractFacts(text, messageUid) {
        const facts = [];
        const push = (key, value, quote) => {
            const clean = value.trim();
            if (!clean)
                return;
            facts.push({
                key,
                value: clean,
                sourceMessageUid: messageUid,
                sourceQuote: quote.slice(0, 120),
            });
        };
        const nameMatch = text.match(/(?:ivr|меню|группу|очередь|транк)\s+[«"']?([A-Za-zА-Яа-я0-9_\- ]{2,40})[»"']?/i) ||
            text.match(/назов(?:и|ём|ем)\s+[«"']?([A-Za-zА-Яа-я0-9_\- ]{2,40})[»"']?/i) ||
            text.match(/переимен(?:уй|овать)\s+(?:в|на)\s+[«"']?([A-Za-zА-Яа-я0-9_\- ]{2,40})[»"']?/i);
        if (nameMatch) {
            push('entity.name', nameMatch[1], nameMatch[0]);
        }
        const greeting = text.match(/приветств[^\n«"']{0,40}[«"']([^»"']{3,200})[»"']/i) ||
            text.match(/say\s*[«"']([^»"']{3,200})[»"']/i);
        if (greeting) {
            push('ivr.greeting', greeting[1], greeting[0]);
        }
        const digitRoutes = [...text.matchAll(/(?:цифр[аы]?|digit)\s*([0-9*#tT])\s*(?:→|->|на|to)\s*([0-9]{2,8}|[A-Za-zА-Яа-я0-9_\- ]+)/gi)];
        for (const match of digitRoutes) {
            push(`ivr.digit.${match[1].toLowerCase()}`, match[2].trim(), match[0]);
        }
        const members = text.match(/(?:абонент|член|member)[ыа]?\s+([0-9]{2,8}(?:\s*[,и\-–]\s*[0-9]{2,8})+)/i);
        if (members) {
            const nums = members[1].match(/[0-9]{2,8}/g) ?? [];
            if (nums.length)
                push('group.members', nums.join(','), members[0]);
        }
        const did = text.match(/(?:did|номер|pattern)\s*[:=]?\s*([+*#0-9XxNnZz._-]{3,32})/i);
        if (did) {
            push('route.did', did[1], did[0]);
        }
        const exten = text.match(/(?:exten|внутренн(?:ий|ие)|номер группы)\s*[:=]?\s*([0-9]{2,8})/i);
        if (exten) {
            push('group.exten', exten[1], exten[0]);
        }
        return facts;
    }
    quoteSupports(message, value) {
        const needle = value.trim();
        if (!needle)
            return false;
        return message.toLowerCase().includes(needle.toLowerCase());
    }
};
exports.PbxConversationBriefService = PbxConversationBriefService;
exports.PbxConversationBriefService = PbxConversationBriefService = __decorate([
    (0, common_1.Injectable)()
], PbxConversationBriefService);
//# sourceMappingURL=pbx-conversation-brief.service.js.map