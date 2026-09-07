import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { resolveProductImage } from '../src/links/resolve-product-image';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Curated, static catalog (per the "deterministic and cheap first" decision
// in the Phase 2 roadmap) — no external catalog API, no AI. Every externalId
// below is a real ASIN verified against a live Amazon product listing.
// Prices are representative estimates at time of writing, not live-synced —
// the same limitation this catalog always had; the fix for that is the
// Product Advertising API once the account qualifies for it (see
// .claude.monetization_roadmap.md). imageUrl is left null here and resolved
// per-ASIN at seed time via resolveProductImage — a real photo when Amazon
// has one indexed under its legacy per-ASIN image path, null otherwise.
const PRODUCTS: Array<{
  name: string;
  tags: string[];
  imageUrl: string | null;
  basePrice: string;
  externalId: string;
}> = [
  // cooking
  { name: 'Lodge Pre-Seasoned Cast Iron Skillet, 12 Inches', tags: ['cooking'], imageUrl: null, basePrice: '34.90', externalId: 'B00006JSUB' },
  { name: "Victorinox Forged Professional 8-Inch Chef's Knife", tags: ['cooking'], imageUrl: null, basePrice: '139.95', externalId: 'B0017JWM2C' },
  { name: 'Kikkerland Sourdough Starter Kit', tags: ['cooking', 'gardening'], imageUrl: null, basePrice: '29.99', externalId: 'B0BGS8Y3PF' },

  // wine
  { name: 'Secura Electric Wine Opener Set', tags: ['wine'], imageUrl: null, basePrice: '29.99', externalId: 'B01261VEOG' },
  { name: 'Galashield Crystal Wine Decanter', tags: ['wine', 'home'], imageUrl: null, basePrice: '34.99', externalId: 'B07JGF9D64' },
  { name: 'The Wine Journal, Tasting Notebook', tags: ['wine', 'reading'], imageUrl: null, basePrice: '16.95', externalId: 'B01LY25TBP' },

  // coffee
  { name: 'Coffee Gator Pour-Over Coffee Maker', tags: ['coffee'], imageUrl: null, basePrice: '34.95', externalId: 'B01COA90SQ' },
  { name: 'KRUPS Precision Burr Coffee Grinder', tags: ['coffee'], imageUrl: null, basePrice: '39.99', externalId: 'B07Q622YLB' },
  { name: 'Atlas Coffee Club World of Coffee Sampler', tags: ['coffee'], imageUrl: null, basePrice: '24.99', externalId: 'B09GW99L8W' },

  // reading
  { name: 'Handmade Leather Bookmark Gift Set', tags: ['reading'], imageUrl: null, basePrice: '16.99', externalId: 'B01N52W9ZQ' },
  { name: 'Uncaged Ergonomics Adjustable Book Stand', tags: ['reading'], imageUrl: null, basePrice: '29.99', externalId: 'B00D7OIL84' },
  { name: 'VYANLIGHT Warm-Light Clip-On Reading Lamp', tags: ['reading', 'home'], imageUrl: null, basePrice: '19.99', externalId: 'B081C2TLSG' },

  // gaming
  { name: 'Logitech G305 Lightspeed Wireless Gaming Mouse', tags: ['gaming', 'tech'], imageUrl: null, basePrice: '39.99', externalId: 'B07CMS5Q6N' },
  { name: 'Logitech G413 SE Mechanical Gaming Keyboard', tags: ['gaming', 'tech'], imageUrl: null, basePrice: '69.99', externalId: 'B08Z6X4NK3' },
  { name: 'Blokus Strategy Board Game', tags: ['gaming'], imageUrl: null, basePrice: '24.99', externalId: 'B08Z1HWPQX' },

  // fitness
  { name: 'Adjustable Dumbbell Set, 4-in-1', tags: ['fitness'], imageUrl: null, basePrice: '99.99', externalId: 'B0CLHTZD1P' },
  { name: 'Gaiam Premium Yoga Mat', tags: ['fitness', 'yoga'], imageUrl: null, basePrice: '29.98', externalId: 'B07W62HWQ7' },
  { name: 'Fitness Tracker Watch with Heart Rate Monitor', tags: ['fitness', 'tech'], imageUrl: null, basePrice: '29.99', externalId: 'B0DKJLH3K3' },

  // tech
  { name: 'Sony WH-1000XM4 Noise-Cancelling Headphones', tags: ['tech', 'music'], imageUrl: null, basePrice: '278.00', externalId: 'B08MVGF24M' },
  { name: 'JBL Go 3 Portable Bluetooth Speaker', tags: ['tech', 'music'], imageUrl: null, basePrice: '39.95', externalId: 'B08KW1KR5H' },
  { name: 'Anker 10,000mAh 30W Fast-Charge Power Bank', tags: ['tech', 'travel'], imageUrl: null, basePrice: '25.99', externalId: 'B0CZ9LV3H2' },

  // photography
  { name: 'KODAK Printomatic Instant Print Digital Camera', tags: ['photography'], imageUrl: null, basePrice: '59.99', externalId: 'B07BB5FDS2' },
  { name: 'DaVoice Compact Tripod with Phone Mount', tags: ['photography', 'travel'], imageUrl: null, basePrice: '12.99', externalId: 'B00OS9E6AO' },
  { name: 'XONDIES Linen-Cover Photo Album', tags: ['photography'], imageUrl: null, basePrice: '21.99', externalId: 'B09Z25RJ1N' },

  // gardening
  { name: 'Indoor Herb Garden Starter Kit', tags: ['gardening', 'cooking'], imageUrl: null, basePrice: '29.99', externalId: 'B06ZY8JGJ4' },
  { name: 'Radius Garden Ergonomic Garden Tool Set', tags: ['gardening'], imageUrl: null, basePrice: '39.99', externalId: 'B076TSGJCT' },
  { name: 'Urban Leaf Ceramic Self-Watering Planter', tags: ['gardening', 'home'], imageUrl: null, basePrice: '19.99', externalId: 'B098B679QT' },

  // travel
  { name: 'Mars Gear Stowaway Packable Travel Duffel Bag', tags: ['travel'], imageUrl: null, basePrice: '34.99', externalId: 'B0887VYGC8' },
  { name: 'Dot&Dot Twist Memory Foam Travel Pillow', tags: ['travel'], imageUrl: null, basePrice: '29.97', externalId: 'B01IEJHJWK' },
  { name: 'Insten Universal Travel Adapter', tags: ['travel', 'tech'], imageUrl: null, basePrice: '14.99', externalId: 'B000YN01X4' },

  // music
  { name: 'Amazon Basics Desktop Vinyl Record Player', tags: ['music', 'home'], imageUrl: null, basePrice: '59.99', externalId: 'B0BFHT7SLK' },
  { name: 'Donner Concert Ukulele Beginner Kit', tags: ['music'], imageUrl: null, basePrice: '59.99', externalId: 'B01M1L6OSX' },
  { name: 'Boundless Audio Vinyl Record Cleaning Kit', tags: ['music'], imageUrl: null, basePrice: '19.99', externalId: 'B0C4HGWNYK' },

  // art
  { name: 'Winsor & Newton Professional Watercolor Paint Set', tags: ['art'], imageUrl: null, basePrice: '44.99', externalId: 'B001M6VMTY' },
  { name: 'AITUSHA 41-Piece Sketch Pencil & Sketchbook Set', tags: ['art'], imageUrl: null, basePrice: '19.99', externalId: 'B07L2CWQ9V' },
  { name: 'The Mindfulness Coloring Book', tags: ['art', 'wellness'], imageUrl: null, basePrice: '9.99', externalId: '1615192824' },
];

async function main() {
  // Remove the old placeholder catalog (mock ASINs, never real products) so
  // it doesn't sit alongside the real one below as dead duplicate rows.
  const { count } = await prisma.product.deleteMany({
    where: { network: 'AMAZON', externalId: { startsWith: 'B0EXAMPLE' } },
  });
  if (count > 0) {
    // eslint-disable-next-line no-console
    console.log(`Removed ${count} placeholder-catalog products.`);
  }

  for (const product of PRODUCTS) {
    const imageUrl = product.imageUrl ?? (await resolveProductImage(product.externalId));
    await prisma.product.upsert({
      where: { network_externalId: { network: 'AMAZON', externalId: product.externalId } },
      update: {
        name: product.name,
        tags: product.tags,
        imageUrl,
        basePrice: product.basePrice,
      },
      create: {
        name: product.name,
        tags: product.tags,
        imageUrl,
        basePrice: product.basePrice,
        network: 'AMAZON',
        externalId: product.externalId,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${PRODUCTS.length} products.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
