"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AgentSkillRegistryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSkillRegistryService = exports.SKILLS_ROOT = exports.SKILL_BULK_READ_MAX = exports.SKILL_BODY_MAX_CHARS = void 0;
exports.resolveSkillsRootCandidates = resolveSkillsRootCandidates;
exports.parseSkill = parseSkill;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prompt_injection_util_1 = require("../../shared/utils/prompt-injection.util");
const ai_adapter_registry_service_1 = require("./ai-adapter-registry.service");
exports.SKILL_BODY_MAX_CHARS = 8000;
exports.SKILL_BULK_READ_MAX = 4;
exports.SKILLS_ROOT = 'SKILLS_ROOT';
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const TRUNCATION_NOTE = '\n\n[truncated]';
function resolveSkillsRootCandidates(moduleDir = __dirname, nodeEnv = process.env.NODE_ENV) {
    const compiled = path.resolve(moduleDir, '../../skills');
    const fromSrc = path.resolve(process.cwd(), 'src/skills');
    // Watch-mode must not depend on nest copying SKILL.md into dist (Windows EBUSY kills --watch).
    if (nodeEnv === 'development') {
        return [fromSrc, compiled];
    }
    return [compiled, fromSrc];
}
function pickScalar(head, key) {
    const match = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(head);
    return (match?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
}
function pickList(head, key) {
    const inline = new RegExp(`^${key}:\\s*\\[(.*)\\]\\s*$`, 'm').exec(head);
    if (inline) {
        return inline[1]
            .split(',')
            .map((part) => part.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
    }
    const block = new RegExp(`^${key}:\\s*\\r?\\n((?:\\s*-\\s*.+\\r?\\n?)+)`, 'm').exec(head);
    if (block) {
        return block[1]
            .split(/\r?\n/)
            .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
    }
    const scalar = pickScalar(head, key);
    return scalar ? [scalar] : [];
}
function parseSkill(raw, fallbackName) {
    const match = FRONTMATTER.exec(raw);
    if (!match) {
        return {
            name: fallbackName,
            description: '',
            domains: [fallbackName],
            intents: [],
            aliases: [],
            related: [],
            risk: 'medium',
            body: raw,
        };
    }
    const head = match[1];
    const name = pickScalar(head, 'name') || fallbackName;
    const domains = pickList(head, 'domains');
    const riskRaw = pickScalar(head, 'risk').toLowerCase();
    const risk = riskRaw === 'low' || riskRaw === 'high' || riskRaw === 'medium' ? riskRaw : 'medium';
    return {
        name,
        description: pickScalar(head, 'description'),
        domains: domains.length ? domains : [name],
        intents: pickList(head, 'intents'),
        aliases: pickList(head, 'aliases'),
        related: pickList(head, 'related'),
        risk,
        body: match[2].trim(),
    };
}
/**
 * Repository-hosted skills with progressive disclosure (D-10, D-11).
 *
 * The system prompt carries the catalog (name + one-line description).
 * Selected skill bodies are injected by the server for the turn; `read_skill`
 * remains a fallback. Only bundled repository skills are trusted procedural text.
 */
let AgentSkillRegistryService = AgentSkillRegistryService_1 = class AgentSkillRegistryService {
    registry;
    logger = new common_1.Logger(AgentSkillRegistryService_1.name);
    domain = 'skills';
    skills = new Map();
    constructor(registry, skillsRootOverride) {
        this.registry = registry;
        const skillsRoot = skillsRootOverride ?? this.resolveExistingRoot();
        this.loadSkills(skillsRoot);
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('AgentSkillRegistryService registered');
    }
    getCatalog() {
        return Array.from(this.skills.values())
            .map(({ body: _body, ...entry }) => entry)
            .sort((a, b) => a.name.localeCompare(b.name));
    }
    getSkill(name) {
        const skill = this.skills.get(name);
        if (!skill)
            return undefined;
        const { body: _body, ...entry } = skill;
        return entry;
    }
    readSkill(name) {
        const skill = this.skills.get(name);
        if (!skill) {
            return `Skill "${name}" not found.`;
        }
        return this.formatBody(name, skill.body);
    }
    /**
     * Budgeted bulk-read for server-side progressive disclosure (1–4 skills).
     * Bodies are returned as trusted procedural text for system-prompt injection
     * — still length-capped, but not wrapped as untrusted tool data.
     */
    readSkillsForPrompt(names, max = exports.SKILL_BULK_READ_MAX) {
        const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, max);
        return unique
            .map((name) => {
            const skill = this.skills.get(name);
            if (!skill)
                return '';
            const body = skill.body.length <= exports.SKILL_BODY_MAX_CHARS
                ? skill.body
                : `${skill.body.slice(0, exports.SKILL_BODY_MAX_CHARS)}${TRUNCATION_NOTE}`;
            return `### skill:${name}\n${body}`;
        })
            .filter(Boolean);
    }
    findByDomain(domain) {
        return this.getCatalog().filter((skill) => skill.domains.includes(domain) || skill.name === domain);
    }
    getTools() {
        return [this.toolListSkills(), this.toolReadSkill()];
    }
    formatBody(name, body) {
        const clipped = body.length <= exports.SKILL_BODY_MAX_CHARS
            ? body
            : `${body.slice(0, exports.SKILL_BODY_MAX_CHARS)}${TRUNCATION_NOTE}`;
        return (0, prompt_injection_util_1.wrapUntrustedData)(`skill:${name}`, clipped);
    }
    resolveExistingRoot() {
        const candidates = resolveSkillsRootCandidates(__dirname);
        const found = candidates.find((dir) => {
            try {
                return fs.statSync(dir).isDirectory();
            }
            catch {
                return false;
            }
        });
        if (!found) {
            this.logger.error(`Skills directory not found. Tried: ${candidates.join(', ')}. Skills are mandatory (D-11).`);
        }
        return found ?? null;
    }
    loadSkills(skillsRoot) {
        if (!skillsRoot) {
            return;
        }
        let entries;
        try {
            entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
        }
        catch (err) {
            this.logger.error(`Failed to read skills directory "${skillsRoot}": ${String(err)}`);
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const skillFile = path.join(skillsRoot, entry.name, 'SKILL.md');
            if (!fs.existsSync(skillFile)) {
                continue;
            }
            const parsed = parseSkill(fs.readFileSync(skillFile, 'utf8'), entry.name);
            this.skills.set(parsed.name, parsed);
        }
        const names = Array.from(this.skills.keys()).sort();
        this.logger.log(`Loaded ${this.skills.size} skill(s): ${names.join(', ') || '(none)'}`);
    }
    toolListSkills() {
        return {
            name: 'list_skills',
            description: 'Catalog of available skills: name and one-line description only. Use read_skill for the body.',
            inputSchema: {},
            entityType: 'skill',
            handler: async (_args, _vpbxUserUid) => this.getCatalog(),
        };
    }
    toolReadSkill() {
        return {
            name: 'read_skill',
            description: 'Read one skill body by name. Catalog entries never include the body.',
            inputSchema: {
                name: { type: 'string', description: 'Skill name from list_skills' },
            },
            entityType: 'skill',
            handler: async (args, _vpbxUserUid) => this.readSkill(String(args.name ?? '')),
        };
    }
};
exports.AgentSkillRegistryService = AgentSkillRegistryService;
exports.AgentSkillRegistryService = AgentSkillRegistryService = AgentSkillRegistryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)(exports.SKILLS_ROOT)),
    __metadata("design:paramtypes", [ai_adapter_registry_service_1.AiAdapterRegistryService, String])
], AgentSkillRegistryService);
//# sourceMappingURL=agent-skill-registry.service.js.map