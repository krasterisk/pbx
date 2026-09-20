"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VoiceRobotsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceRobotsAiAdapter = void 0;
exports.isSpeechEngineConfigured = isSpeechEngineConfigured;
const common_1 = require("@nestjs/common");
const voice_robots_service_1 = require("./voice-robots.service");
const tts_engines_service_1 = require("../tts-engines/tts-engines.service");
const stt_engines_service_1 = require("../stt-engines/stt-engines.service");
const route_references_service_1 = require("../route-references/route-references.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
/**
 * VoiceRobotsAiAdapter — read-only voice robot tools (D-15).
 * Describe resolves each referenced speech engine so a silent robot is diagnosable
 * in one call. Dangling engine uids are reported as missing, not skipped (T-15-89).
 * Robots are outside the write boundary — no mutating tool is declared.
 */
let VoiceRobotsAiAdapter = VoiceRobotsAiAdapter_1 = class VoiceRobotsAiAdapter {
    voiceRobots;
    ttsEngines;
    sttEngines;
    registry;
    routeReferences;
    logger = new common_1.Logger(VoiceRobotsAiAdapter_1.name);
    domain = 'voice-robots';
    constructor(voiceRobots, ttsEngines, sttEngines, registry, routeReferences) {
        this.voiceRobots = voiceRobots;
        this.ttsEngines = ttsEngines;
        this.sttEngines = sttEngines;
        this.registry = registry;
        this.routeReferences = routeReferences;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('VoiceRobotsAiAdapter registered');
    }
    getTools() {
        return [this.toolListVoiceRobots(), this.toolDescribeVoiceRobot()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Голосовые роботы
- Робот ведёт диалог: приветствие, группы ключевых слов, TTS и STT.
- Тишина почти всегда значит, что движок не настроен или ссылка на него битая.
- describe_voice_robot уже показывает состояние движков. Не угадывай, какой движок стоит.`;
    }
    async buildSummary(vpbxUserUid) {
        const robots = await this.voiceRobots.findAll(vpbxUserUid);
        if (robots.length === 0)
            return '';
        const names = robots.map((robot) => robot.name).join(', ');
        return `Голосовые роботы: ${names}`;
    }
    toolListVoiceRobots() {
        return {
            name: 'list_voice_robots',
            description: 'Список голосовых роботов тенанта: статус и точки входа (маршруты, которые на них ссылаются). Состояние движков — describe_voice_robot.',
            inputSchema: {},
            entityType: 'voice_robot',
            handler: async (_args, uid) => {
                const robots = await this.voiceRobots.findAll(uid);
                return {
                    robots: await Promise.all(robots.map((robot) => this.toListRow(robot, uid))),
                };
            },
        };
    }
    toolDescribeVoiceRobot() {
        return {
            name: 'describe_voice_robot',
            description: 'Один робот: сценарий (приветствие, группы) и речевые движки с configured/missing. Битую ссылку не пропускает. Изменить робота нельзя.',
            inputSchema: {
                uid: { type: 'number', description: 'UID робота из list_voice_robots' },
            },
            entityType: 'voice_robot',
            handler: async (args, uid) => {
                const robot = (await this.voiceRobots.findOne(uid, Number(args.uid)));
                const groups = (await this.voiceRobots.getKeywordGroups(uid, robot.uid));
                const speechEngines = await this.resolveEngines(robot, uid);
                return {
                    uid: robot.uid,
                    name: robot.name,
                    description: robot.description ?? null,
                    status: robotStatus(robot.active),
                    language: robot.language ?? null,
                    scenario: {
                        greeting: robot.greeting_tts_text ?? null,
                        initial_group_id: robot.initial_group_id ?? null,
                        groups: groups.map((group) => ({
                            uid: group.uid,
                            name: group.name,
                            priority: group.priority ?? 0,
                            active: robotStatus(group.active) === 'active',
                        })),
                    },
                    speech_engines: speechEngines,
                };
            },
        };
    }
    async toListRow(robot, uid) {
        const refs = this.routeReferences
            ? await this.routeReferences.findReferences('voicerobot', robot.uid, uid)
            : [];
        return {
            uid: robot.uid,
            name: robot.name,
            status: robotStatus(robot.active),
            entry_points: refs.map((ref) => ({
                route_uid: ref.routeUid,
                route_name: ref.routeName ?? null,
                extensions: ref.extensions ?? [],
                location: ref.location,
            })),
        };
    }
    async resolveEngines(robot, uid) {
        const refs = [
            { kind: 'tts', engineUid: robot.tts_engine_id },
            { kind: 'stt', engineUid: robot.stt_engine_id },
        ];
        const resolved = [];
        for (const ref of refs) {
            if (ref.engineUid == null)
                continue;
            resolved.push(await this.resolveOne(ref.kind, ref.engineUid, uid));
        }
        return resolved;
    }
    async resolveOne(kind, engineUid, uid) {
        try {
            const engine = (await this.loadEngine(kind, engineUid, uid));
            return {
                kind,
                uid: engine.uid,
                name: engine.name ?? null,
                configured: isSpeechEngineConfigured(engine),
                missing: false,
            };
        }
        catch (err) {
            if (err instanceof common_1.NotFoundException) {
                return { kind, uid: engineUid, name: null, configured: false, missing: true };
            }
            throw err;
        }
    }
    loadEngine(kind, engineUid, uid) {
        return kind === 'tts'
            ? this.ttsEngines.findOne(engineUid, uid)
            : this.sttEngines.findOne(engineUid, uid);
    }
};
exports.VoiceRobotsAiAdapter = VoiceRobotsAiAdapter;
exports.VoiceRobotsAiAdapter = VoiceRobotsAiAdapter = VoiceRobotsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [voice_robots_service_1.VoiceRobotsService,
        tts_engines_service_1.TtsEnginesService,
        stt_engines_service_1.SttEnginesService,
        ai_adapter_registry_service_1.AiAdapterRegistryService,
        route_references_service_1.RouteReferencesService])
], VoiceRobotsAiAdapter);
function isSpeechEngineConfigured(engine) {
    if (engine.type === 'custom') {
        return Boolean(engine.custom_url && String(engine.custom_url).trim());
    }
    return Boolean(engine.token && String(engine.token).trim());
}
function robotStatus(active) {
    if (active === true || active === 1)
        return 'active';
    return 'inactive';
}
//# sourceMappingURL=voice-robots-ai.adapter.js.map