import { resolveProductImage } from './resolve-product-image';

describe('resolveProductImage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the image URL when Amazon responds with a real jpeg', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'image/jpeg']]),
    });

    const url = await resolveProductImage('B00006JSUB');

    expect(url).toBe(
      'https://m.media-amazon.com/images/P/B00006JSUB.01._SCLZZZZZZZ_.jpg',
    );
  });

  it('returns null when Amazon responds with its 1x1 gif placeholder (no image indexed)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'image/gif']]),
    });

    const url = await resolveProductImage('B0NOIMAGE1');

    expect(url).toBeNull();
  });

  it('returns null when the request itself fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    const url = await resolveProductImage('B00006JSUB');

    expect(url).toBeNull();
  });

  it('returns null on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      headers: new Map([['content-type', 'image/jpeg']]),
    });

    const url = await resolveProductImage('B00006JSUB');

    expect(url).toBeNull();
  });
});
