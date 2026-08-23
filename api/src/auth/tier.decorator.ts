import { SetMetadata } from '@nestjs/common';
import { Tier } from '../../generated/prisma/enums';

export const TIER_KEY = 'requiredTier';
export const RequireTier = (tier: Tier) => SetMetadata(TIER_KEY, tier);
