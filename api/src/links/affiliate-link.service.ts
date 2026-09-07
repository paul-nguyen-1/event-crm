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
        const baseUrl = `https://www.amazon.com/dp/${product.externalId}`;
        // No Associates account yet: link to the real product page untagged
        // rather than fail the whole buy flow. The moment the tracking ID
        // is configured, this same code path starts tagging every link —
        // no other change needed.
        return trackingId ? `${baseUrl}?tag=${trackingId}` : baseUrl;
      }
      default:
        throw new Error(
          `Affiliate link resolution not implemented for network: ${network as string}`,
        );
    }
  }
}
