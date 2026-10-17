import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutodialIntegrationKeyService } from '../autodial-integration/autodial-integration-key.service';

@Injectable()
export class McpAutodialAuthGuard extends JwtAuthGuard {
  constructor(private readonly keys: AutodialIntegrationKeyService) { super(); }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer krac_v1_')) {
      req.user = await this.keys.authenticate(auth.slice(7));
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }
}
