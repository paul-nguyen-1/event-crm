import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from './authenticated-request';
import { TIER_KEY } from './tier.decorator';

/**
 * Seam for Phase 4's paid-tier enforcement. Every route today only requires
 * FREE (or no requirement), so this always passes — the check itself becomes
 * real once EntitlementsService exists.
 */
@Injectable()
export class TierGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTier = this.reflector.getAllAndOverride<string>(TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredTier || requiredTier === 'FREE') {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return user?.tier === requiredTier;
  }
}
