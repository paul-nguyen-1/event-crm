import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Curated, static catalog (per the "deterministic and cheap first" decision
// in the Phase 2 roadmap) — no external catalog API, no AI. externalId
// values are placeholder ASIN-shaped strings; swap for real, verified ASINs
// before any real Amazon Associates link is served.
const PRODUCTS: Array<{
  name: string;
  tags: string[];
  imageUrl: string;
  basePrice: string;
  externalId: string;
}> = [
  // cooking
  { name: 'Cast Iron Skillet, 12-inch', tags: ['cooking'], imageUrl: 'https://example.com/products/cast-iron-skillet.jpg', basePrice: '39.99', externalId: 'B0EXAMPLE001' },
  { name: 'Chef\'s Knife, 8-inch Forged', tags: ['cooking'], imageUrl: 'https://example.com/products/chefs-knife.jpg', basePrice: '89.99', externalId: 'B0EXAMPLE002' },
  { name: 'Sourdough Baking Starter Kit', tags: ['cooking', 'gardening'], imageUrl: 'https://example.com/products/sourdough-kit.jpg', basePrice: '34.50', externalId: 'B0EXAMPLE003' },

  // wine
  { name: 'Electric Wine Opener Set', tags: ['wine'], imageUrl: 'https://example.com/products/wine-opener.jpg', basePrice: '29.99', externalId: 'B0EXAMPLE004' },
  { name: 'Crystal Wine Decanter', tags: ['wine', 'home'], imageUrl: 'https://example.com/products/wine-decanter.jpg', basePrice: '54.00', externalId: 'B0EXAMPLE005' },
  { name: 'World Wine Regions Tasting Journal', tags: ['wine', 'reading'], imageUrl: 'https://example.com/products/wine-journal.jpg', basePrice: '18.99', externalId: 'B0EXAMPLE006' },

  // coffee
  { name: 'Pour-Over Coffee Dripper Set', tags: ['coffee'], imageUrl: 'https://example.com/products/pour-over-set.jpg', basePrice: '42.00', externalId: 'B0EXAMPLE007' },
  { name: 'Burr Coffee Grinder', tags: ['coffee'], imageUrl: 'https://example.com/products/burr-grinder.jpg', basePrice: '69.99', externalId: 'B0EXAMPLE008' },
  { name: 'Single-Origin Coffee Sampler, 5-Pack', tags: ['coffee'], imageUrl: 'https://example.com/products/coffee-sampler.jpg', basePrice: '32.00', externalId: 'B0EXAMPLE009' },

  // reading
  { name: 'Leather Bookmark Set', tags: ['reading'], imageUrl: 'https://example.com/products/bookmark-set.jpg', basePrice: '14.99', externalId: 'B0EXAMPLE010' },
  { name: 'Adjustable Book Stand', tags: ['reading'], imageUrl: 'https://example.com/products/book-stand.jpg', basePrice: '24.99', externalId: 'B0EXAMPLE011' },
  { name: 'Warm-Light Reading Lamp', tags: ['reading', 'home'], imageUrl: 'https://example.com/products/reading-lamp.jpg', basePrice: '37.50', externalId: 'B0EXAMPLE012' },

  // gaming
  { name: 'Wireless Gaming Mouse', tags: ['gaming', 'tech'], imageUrl: 'https://example.com/products/gaming-mouse.jpg', basePrice: '59.99', externalId: 'B0EXAMPLE013' },
  { name: 'Mechanical Gaming Keyboard', tags: ['gaming', 'tech'], imageUrl: 'https://example.com/products/gaming-keyboard.jpg', basePrice: '99.99', externalId: 'B0EXAMPLE014' },
  { name: 'Strategy Board Game Bundle', tags: ['gaming'], imageUrl: 'https://example.com/products/board-game-bundle.jpg', basePrice: '44.99', externalId: 'B0EXAMPLE015' },

  // fitness
  { name: 'Adjustable Dumbbell Set', tags: ['fitness'], imageUrl: 'https://example.com/products/dumbbell-set.jpg', basePrice: '129.99', externalId: 'B0EXAMPLE016' },
  { name: 'Premium Yoga Mat', tags: ['fitness', 'yoga'], imageUrl: 'https://example.com/products/yoga-mat.jpg', basePrice: '38.00', externalId: 'B0EXAMPLE017' },
  { name: 'Fitness Tracker Watch', tags: ['fitness', 'tech'], imageUrl: 'https://example.com/products/fitness-tracker.jpg', basePrice: '79.99', externalId: 'B0EXAMPLE018' },

  // tech
  { name: 'Noise-Cancelling Headphones', tags: ['tech', 'music'], imageUrl: 'https://example.com/products/anc-headphones.jpg', basePrice: '149.99', externalId: 'B0EXAMPLE019' },
  { name: 'Portable Bluetooth Speaker', tags: ['tech', 'music'], imageUrl: 'https://example.com/products/bt-speaker.jpg', basePrice: '54.99', externalId: 'B0EXAMPLE020' },
  { name: 'Fast-Charge Power Bank', tags: ['tech', 'travel'], imageUrl: 'https://example.com/products/power-bank.jpg', basePrice: '29.99', externalId: 'B0EXAMPLE021' },

  // photography
  { name: 'Instant Print Camera', tags: ['photography'], imageUrl: 'https://example.com/products/instant-camera.jpg', basePrice: '69.99', externalId: 'B0EXAMPLE022' },
  { name: 'Compact Tripod with Phone Mount', tags: ['photography', 'travel'], imageUrl: 'https://example.com/products/tripod.jpg', basePrice: '27.99', externalId: 'B0EXAMPLE023' },
  { name: 'Photo Album, Linen Cover', tags: ['photography'], imageUrl: 'https://example.com/products/photo-album.jpg', basePrice: '22.50', externalId: 'B0EXAMPLE024' },

  // gardening
  { name: 'Indoor Herb Garden Kit', tags: ['gardening', 'cooking'], imageUrl: 'https://example.com/products/herb-garden-kit.jpg', basePrice: '44.99', externalId: 'B0EXAMPLE025' },
  { name: 'Ergonomic Garden Tool Set', tags: ['gardening'], imageUrl: 'https://example.com/products/garden-tools.jpg', basePrice: '36.00', externalId: 'B0EXAMPLE026' },
  { name: 'Ceramic Self-Watering Planter', tags: ['gardening', 'home'], imageUrl: 'https://example.com/products/self-watering-planter.jpg', basePrice: '31.99', externalId: 'B0EXAMPLE027' },

  // travel
  { name: 'Packable Travel Duffel Bag', tags: ['travel'], imageUrl: 'https://example.com/products/travel-duffel.jpg', basePrice: '48.00', externalId: 'B0EXAMPLE028' },
  { name: 'Memory Foam Travel Pillow', tags: ['travel'], imageUrl: 'https://example.com/products/travel-pillow.jpg', basePrice: '19.99', externalId: 'B0EXAMPLE029' },
  { name: 'Universal Travel Adapter', tags: ['travel', 'tech'], imageUrl: 'https://example.com/products/travel-adapter.jpg', basePrice: '16.99', externalId: 'B0EXAMPLE030' },

  // music
  { name: 'Vinyl Record Player', tags: ['music', 'home'], imageUrl: 'https://example.com/products/vinyl-player.jpg', basePrice: '119.99', externalId: 'B0EXAMPLE031' },
  { name: 'Beginner Ukulele Kit', tags: ['music'], imageUrl: 'https://example.com/products/ukulele-kit.jpg', basePrice: '49.99', externalId: 'B0EXAMPLE032' },
  { name: 'Curated Vinyl Record 3-Pack', tags: ['music'], imageUrl: 'https://example.com/products/vinyl-3pack.jpg', basePrice: '54.00', externalId: 'B0EXAMPLE033' },

  // art
  { name: 'Watercolor Painting Set', tags: ['art'], imageUrl: 'https://example.com/products/watercolor-set.jpg', basePrice: '32.99', externalId: 'B0EXAMPLE034' },
  { name: 'Sketchbook & Pencil Set', tags: ['art'], imageUrl: 'https://example.com/products/sketchbook-set.jpg', basePrice: '21.99', externalId: 'B0EXAMPLE035' },
  { name: 'Adult Coloring & Mindfulness Book', tags: ['art', 'wellness'], imageUrl: 'https://example.com/products/coloring-book.jpg', basePrice: '12.99', externalId: 'B0EXAMPLE036' },
];

async function main() {
  for (const product of PRODUCTS) {
    await prisma.product.upsert({
      where: { network_externalId: { network: 'AMAZON', externalId: product.externalId } },
      update: {
        name: product.name,
        tags: product.tags,
        imageUrl: product.imageUrl,
        basePrice: product.basePrice,
      },
      create: {
        name: product.name,
        tags: product.tags,
        imageUrl: product.imageUrl,
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
