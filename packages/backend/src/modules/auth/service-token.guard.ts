import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import type { JwtPayloadUser } from '../auth/auth.service';

/**
 * ServiceTokenGuard — authenticates requests from aiPBX webhook tool calls.
 *
 * Validates `Authorization: Bearer <KRASTERISK_SERVICE_TOKEN>` header.
 * Tenant identity is provided via `X-Vpbx-User-Uid` header.
 *
 * Sets req.user compatible with JwtPayloadUser so all existing service
 * methods that use req.user.vpbx_user_uid work transparently.
 *
 * Usage:
 *   @UseGuards(JwtOrServiceTokenGuard)  ← preferred (allows both)
 *   @UseGuards(ServiceTokenGuard)       ← service-only endpoints
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
    private readonly logger = new Logger(ServiceTokenGuard.name);

    constructor(private readonly config: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request & { user: JwtPayloadUser }>();

        const serviceToken = this.config.get<string>('KRASTERISK_SERVICE_TOKEN');
        if (!serviceToken) {
            this.logger.warn('KRASTERISK_SERVICE_TOKEN is not configured — service token auth disabled');
            throw new UnauthorizedException('Service token authentication is not configured');
        }

        const authHeader = request.headers['authorization'];
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or malformed Authorization header');
        }

        const providedToken = authHeader.slice(7).trim();
        if (providedToken !== serviceToken) {
            this.logger.warn(`Invalid service token from ${request.ip}`);
            throw new UnauthorizedException('Invalid service token');
        }

        // Read tenant UID from header — aiPBX sets this per-chat
        const tenantUidHeader = request.headers['x-vpbx-user-uid'];
        const vpbxUserUid = tenantUidHeader ? parseInt(String(tenantUidHeader), 10) : 0;

        if (!vpbxUserUid || isNaN(vpbxUserUid)) {
            throw new UnauthorizedException('X-Vpbx-User-Uid header is required for service token auth');
        }

        // Inject synthetic user compatible with JwtPayloadUser
        request.user = {
            sub: 0,
            login: 'service-account',
            name: 'aiPBX Service',
            level: 'admin' as any,
            role: 0,
            vpbx_user_uid: vpbxUserUid,
        };

        return true;
    }
}
