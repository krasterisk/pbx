import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import type { JwtPayloadUser } from '../auth/auth.service';

/**
 * JwtOrServiceTokenGuard — accepts either a valid user JWT or a service token.
 *
 * Priority:
 *   1. Try JWT (Passport 'jwt' strategy) — regular user requests
 *   2. On JWT failure, try ServiceToken — aiPBX webhook calls
 *
 * This allows all existing endpoints to continue working for users
 * while also accepting aiPBX service calls without any code changes.
 */
@Injectable()
export class JwtOrServiceTokenGuard implements CanActivate {
    private readonly logger = new Logger(JwtOrServiceTokenGuard.name);
    private readonly jwtGuard = new (class extends AuthGuard('jwt') {})();

    constructor(private readonly config: ConfigService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // 1. Try JWT first
        try {
            const jwtResult = await this.jwtGuard.canActivate(context);
            if (jwtResult) return true;
        } catch {
            // JWT failed — fall through to service token
        }

        // 2. Try service token
        const request = context.switchToHttp().getRequest<Request & { user: JwtPayloadUser }>();
        const serviceToken = this.config.get<string>('KRASTERISK_SERVICE_TOKEN');

        if (!serviceToken) {
            throw new UnauthorizedException('Not authenticated');
        }

        const authHeader = request.headers['authorization'];
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Not authenticated');
        }

        const providedToken = authHeader.slice(7).trim();
        if (providedToken !== serviceToken) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const tenantUidHeader = request.headers['x-vpbx-user-uid'];
        const vpbxUserUid = tenantUidHeader ? parseInt(String(tenantUidHeader), 10) : 0;

        if (!vpbxUserUid || isNaN(vpbxUserUid)) {
            throw new UnauthorizedException('X-Vpbx-User-Uid header is required');
        }

        request.user = {
            sub: 0,
            login: 'service-account',
            name: 'aiPBX Service',
            level: 'admin' as any,
            role: 0,
            vpbx_user_uid: vpbxUserUid,
        };

        this.logger.debug(`Service token auth OK for tenant ${vpbxUserUid}`);
        return true;
    }
}
