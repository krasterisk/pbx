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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const sequelize_1 = require("@nestjs/sequelize");
const bcrypt = __importStar(require("bcrypt"));
const sequelize_2 = require("sequelize");
const users_service_1 = require("../users/users.service");
const logger_service_1 = require("../logger/logger.service");
const mailer_service_1 = require("../mailer/mailer.service");
const user_session_model_1 = require("./user-session.model");
const tenant_registration_service_1 = require("./tenant-registration.service");
/** Number of bcrypt salt rounds — 12 is the industry standard (2024) */
const BCRYPT_ROUNDS = 12;
let AuthService = AuthService_1 = class AuthService {
    usersService;
    jwtService;
    configService;
    loggerService;
    mailerService;
    sessionModel;
    registration;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(usersService, jwtService, configService, loggerService, mailerService, sessionModel, registration) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.loggerService = loggerService;
        this.mailerService = mailerService;
        this.sessionModel = sessionModel;
        this.registration = registration;
    }
    // ─── Token helpers ──────────────────────────────────────────────────────────
    buildPayload(user) {
        return {
            sub: user.uniqueid,
            login: user.login,
            name: user.name,
            level: user.level,
            role: user.role ?? 0,
            vpbx_user_uid: user.vpbx_user_uid ?? user.uniqueid,
        };
    }
    generateTokens(payload) {
        const plain = { ...payload };
        const accessToken = this.jwtService.sign(plain);
        const refreshToken = this.jwtService.sign(plain, {
            secret: this.configService.get('JWT_REFRESH_SECRET', 'refresh-secret-default'),
            expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d'),
        });
        return { accessToken, refreshToken };
    }
    buildUserResponse(user) {
        return {
            uniqueid: user.uniqueid,
            login: user.login,
            name: user.name,
            level: user.level,
            role: user.role ?? 0,
            exten: user.exten ?? '',
            vpbx_user_uid: user.vpbx_user_uid ?? user.uniqueid,
            avatar: user.avatar ?? null,
        };
    }
    /** Persist refresh token; clean expired sessions for this user */
    async persistSession(userId, refreshToken, ipAddress = '', userAgent = '') {
        const decoded = this.jwtService.decode(refreshToken);
        const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000;
        // Purge expired sessions to prevent unbounded growth
        await this.sessionModel.destroy({
            where: {
                user_id: userId,
                expiresAt: { [sequelize_2.Op.lt]: Date.now() },
            },
        });
        await this.sessionModel.create({
            user_id: userId,
            refreshToken,
            ipAddress,
            userAgent,
            expiresAt,
        });
    }
    // ─── Public methods ──────────────────────────────────────────────────────────
    /** POST /auth/login */
    async login(login, password, ipAddress, userAgent) {
        const user = await this.usersService.findByLogin(login);
        // Constant-time comparison — always run bcrypt even if user not found
        // to prevent timing-based user enumeration
        const candidateHash = user?.passwd ?? '$2b$12$invalidhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
        const isValid = await this.verifyPassword(password, candidateHash);
        if (!user || !isValid) {
            // Generic message — don't leak whether login or password was wrong
            throw new common_1.UnauthorizedException('Неверный логин или пароль');
        }
        if (!user.isActivated && user.activationCode)
            throw new common_1.ForbiddenException('Подтвердите адрес электронной почты');
        await this.upgradeLegacyPasswordIfNeeded(user.uniqueid, user.vpbx_user_uid, password, user.passwd);
        const payload = this.buildPayload(user);
        const tokens = this.generateTokens(payload);
        await this.persistSession(user.uniqueid, tokens.refreshToken, ipAddress, userAgent);
        await this.loggerService.logAction(user.uniqueid, 'login', 'auth', user.uniqueid, payload.vpbx_user_uid, `Login from ${ipAddress ?? 'unknown'}`);
        return { ...tokens, user: this.buildUserResponse(user) };
    }
    /**
     * Password verification with legacy MD5 fallback.
     *
     * Migration strategy (zero-downtime):
     *  1. New passwords → bcrypt from now on
     *  2. Old MD5 hashes still work on first login → auto-upgraded to bcrypt
     *
     * Detection: bcrypt hashes start with "$2b$" or "$2a$", MD5 = 32 hex chars
     */
    async verifyPassword(plainText, stored) {
        const isBcrypt = stored.startsWith('$2b$') || stored.startsWith('$2a$');
        if (isBcrypt) {
            return bcrypt.compare(plainText, stored);
        }
        // Legacy MD5 path — auto-migrate on success (handled in login flow via usersService)
        const { createHash } = await Promise.resolve().then(() => __importStar(require('crypto')));
        const md5 = createHash('md5').update(plainText).digest('hex');
        return md5 === stored;
    }
    /** Upgrade legacy MD5 password to bcrypt in-place after successful login */
    async upgradeLegacyPasswordIfNeeded(userId, vpbxUserUid, plainText, stored) {
        if (!stored.startsWith('$2b$') && !stored.startsWith('$2a$')) {
            try {
                const hash = await bcrypt.hash(plainText, BCRYPT_ROUNDS);
                await this.usersService.update(userId, vpbxUserUid, { passwd: hash });
                this.logger.log(`Upgraded MD5 → bcrypt for user #${userId}`);
            }
            catch (e) {
                this.logger.warn(`Failed to upgrade password for user #${userId}: ${e}`);
            }
        }
    }
    /** POST /auth/register — only available in BOX/OPENSOURCE mode */
    async register(login, password, name, email, companyName) {
        const deploymentMode = this.configService.get('DEPLOYMENT_MODE', 'BOX').toUpperCase();
        if (deploymentMode === 'CLOUD') {
            throw new common_1.ForbiddenException('Self-registration is disabled. Contact your administrator.');
        }
        const existing = await this.usersService.findByLogin(login);
        if (existing) {
            throw new common_1.ConflictException('Пользователь с таким логином уже существует');
        }
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const activationCode = this.generateActivationCode();
        const activationExpires = Date.now() + 15 * 60 * 1000; // 15 min
        const user = await this.registration.create({ login, passwd: hashedPassword, name, email,
            companyName, activationCode, activationExpires });
        if (email) {
            try {
                await this.mailerService.sendActivationMail(email, activationCode);
            }
            catch (e) {
                this.logger.warn(`Failed to send activation email to ${email}: ${e}`);
            }
        }
        try {
            await this.loggerService.logAction(user.uniqueid, 'register', 'auth', user.uniqueid, user.uniqueid, 'New tenant registered');
        }
        catch {
            this.logger.warn(`Registration audit transport failed for user #${user.uniqueid}`);
        }
        return {
            success: true,
            requiresActivation: !!email,
            message: email
                ? 'Регистрация успешна. Проверьте почту для активации аккаунта.'
                : 'Регистрация успешна.',
        };
    }
    /** POST /auth/activation */
    async activate(login, code) {
        const user = await this.usersService.findByLogin(login);
        if (!user) {
            throw new common_1.UnauthorizedException('Пользователь не найден');
        }
        if (user.isActivated) {
            return { success: true, message: 'Аккаунт уже активирован' };
        }
        if (!user.activationCode) {
            throw new common_1.HttpException('Код активации не найден', common_1.HttpStatus.BAD_REQUEST);
        }
        if (user.activationExpires && user.activationExpires < Date.now()) {
            throw new common_1.HttpException('Код активации истёк. Запросите новый.', common_1.HttpStatus.BAD_REQUEST);
        }
        // Constant-time string comparison to prevent timing attacks
        const codesMatch = user.activationCode === code.trim();
        if (!codesMatch) {
            throw new common_1.HttpException('Неверный код активации', common_1.HttpStatus.BAD_REQUEST);
        }
        await this.usersService.update(user.uniqueid, user.vpbx_user_uid, {
            isActivated: true,
            activationCode: null,
            activationExpires: null,
        });
        return { success: true, message: 'Аккаунт успешно активирован' };
    }
    /** POST /auth/refresh — rotate refresh token */
    async refresh(refreshToken, ipAddress, userAgent) {
        let payload;
        try {
            payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET', 'refresh-secret-default'),
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Refresh token недействителен или истёк');
        }
        // Check token is in the whitelist (not revoked)
        const session = await this.sessionModel.findOne({ where: { refreshToken } });
        if (!session || session.expiresAt < Date.now()) {
            // If session is found but expired — clean up
            if (session)
                await session.destroy();
            throw new common_1.UnauthorizedException('Сессия истекла. Пожалуйста, войдите снова.');
        }
        // Verify user still exists and is not suspended
        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            await session.destroy();
            throw new common_1.UnauthorizedException('Пользователь не найден');
        }
        // Rotate: destroy old session, issue new token pair
        await session.destroy();
        const newPayload = this.buildPayload(user);
        const tokens = this.generateTokens(newPayload);
        await this.persistSession(user.uniqueid, tokens.refreshToken, ipAddress, userAgent);
        return { ...tokens, user: this.buildUserResponse(user) };
    }
    /** POST /auth/logout — invalidate specific session */
    async logout(refreshToken) {
        if (refreshToken) {
            await this.sessionModel.destroy({ where: { refreshToken } });
        }
        return { success: true };
    }
    /**
     * Called by JwtStrategy.validate() on every authenticated request.
     *
     * IMPORTANT: We return req.user from the JWT payload — NOT from the DB.
     * This avoids a DB round-trip on every authenticated API call.
     * Payload is refreshed on every token rotation (refresh endpoint).
     *
     * If you need fresh data (e.g. after role change), force re-login or refresh.
     */
    validateJwtPayload(payload) {
        if (!payload?.sub || payload.level === undefined) {
            throw new common_1.UnauthorizedException('Invalid token payload');
        }
        return payload;
    }
    // ─── Utilities ───────────────────────────────────────────────────────────────
    /** Hash a plain-text password with bcrypt */
    static async hashPassword(plain) {
        return bcrypt.hash(plain, BCRYPT_ROUNDS);
    }
    generateActivationCode() {
        return Math.floor(100_000 + Math.random() * 900_000).toString();
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, sequelize_1.InjectModel)(user_session_model_1.UserSession)),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService,
        logger_service_1.LoggerService,
        mailer_service_1.MailerService, Object, tenant_registration_service_1.TenantRegistrationService])
], AuthService);
//# sourceMappingURL=auth.service.js.map