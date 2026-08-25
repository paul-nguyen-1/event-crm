import { AffiliateLinkService } from './affiliate-link.service';
import { Network } from '../../generated/prisma/enums';

describe('AffiliateLinkService.resolveAffiliateLink', () => {
  let service: AffiliateLinkService;
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    service = new AffiliateLinkService();
    process.env = {
      ...ORIGINAL_ENV,
      AMAZON_ASSOCIATES_TRACKING_ID: 'mytag-20',
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('builds an Amazon URL carrying the server-side tracking ID, never a client-supplied one', () => {
    const url = service.resolveAffiliateLink(
      { externalId: 'B0EXAMPLE001' },
      Network.AMAZON,
    );

    expect(url).toBe('https://www.amazon.com/dp/B0EXAMPLE001?tag=mytag-20');
  });

  it('throws rather than producing an untagged link when the tracking ID is not configured', () => {
    delete process.env.AMAZON_ASSOCIATES_TRACKING_ID;

    expect(() =>
      service.resolveAffiliateLink(
        { externalId: 'B0EXAMPLE001' },
        Network.AMAZON,
      ),
    ).toThrow('AMAZON_ASSOCIATES_TRACKING_ID is not configured');
  });

  it('throws for a network that is not implemented yet, rather than silently returning an untagged link', () => {
    expect(() =>
      service.resolveAffiliateLink({ externalId: 'X1' }, 'RAKUTEN' as Network),
    ).toThrow(/not implemented/);
  });
});
