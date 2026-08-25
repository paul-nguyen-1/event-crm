import { Injectable } from '@nestjs/common';
import { Network } from '../../generated/prisma/enums';

export interface AffiliateLinkProduct {
  externalId: string;
}

@Injectable()
export class AffiliateLinkService {
  /**
   * Amazon Associates is the only network implemented this phase, but the
   * signature takes `network` as a real parameter (not a hardcoded Amazon
   * call) so a second network (Rakuten, Impact, ShareASale) is additive.
   */
  resolveAffiliateLink(
    product: AffiliateLinkProduct,
    network: Network,
  ): string {
    switch (network) {
      case Network.AMAZON: {
        const trackingId = process.env.AMAZON_ASSOCIATES_TRACKING_ID;
        if (!trackingId) {
          throw new Error('AMAZON_ASSOCIATES_TRACKING_ID is not configured');
        }
        return `https://www.amazon.com/dp/${product.externalId}?tag=${trackingId}`;
      }
      default:
        throw new Error(
          `Affiliate link resolution not implemented for network: ${network as string}`,
        );
    }
  }
}
