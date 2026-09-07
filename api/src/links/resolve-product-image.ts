/**
 * Amazon's legacy per-ASIN image endpoint — undocumented, not officially
 * supported, but a real source for a product's actual photo without
 * needing Product Advertising API access (which a pre-revenue Associates
 * account can't reliably get anyway; see .claude.monetization_roadmap.md).
 *
 * When Amazon has nothing indexed under this path for a given ASIN, it
 * responds with a 1x1 image/gif placeholder instead of a real image/jpeg —
 * that content-type is what distinguishes "no image" from a real one, so
 * this never returns a URL that resolves to a blank placeholder.
 */
export async function resolveProductImage(
  asin: string,
): Promise<string | null> {
  const url = `https://m.media-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type') === 'image/jpeg') {
      return url;
    }
  } catch {
    // Network hiccup — treated the same as "no image found".
  }
  return null;
}
