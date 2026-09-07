import { extractAsin } from './extract-asin';

describe('extractAsin', () => {
  it('extracts the ASIN from a /dp/ URL', () => {
    expect(extractAsin('https://www.amazon.com/dp/B0EXAMPLE1')).toBe(
      'B0EXAMPLE1',
    );
  });

  it('extracts the ASIN from a /dp/ URL with a product title prefix', () => {
    expect(
      extractAsin(
        'https://www.amazon.com/Baratza-Encore-Grinder/dp/B0EXAMPLE1/ref=sr_1_1',
      ),
    ).toBe('B0EXAMPLE1');
  });

  it('extracts the ASIN from a /gp/product/ URL', () => {
    expect(extractAsin('https://www.amazon.com/gp/product/B0EXAMPLE2')).toBe(
      'B0EXAMPLE2',
    );
  });

  it('extracts the ASIN from an asin= query parameter', () => {
    expect(
      extractAsin('https://www.amazon.com/s?k=grinder&asin=B0EXAMPLE3'),
    ).toBe('B0EXAMPLE3');
  });

  it('uppercases a lowercase ASIN', () => {
    expect(extractAsin('https://www.amazon.com/dp/b0example1')).toBe(
      'B0EXAMPLE1',
    );
  });

  it('returns null for a URL with no recognizable ASIN', () => {
    expect(extractAsin('https://www.amazon.com/s?k=coffee+grinder')).toBeNull();
  });

  it('returns null for a non-Amazon URL', () => {
    expect(
      extractAsin('https://www.target.com/p/some-item/-/A-12345'),
    ).toBeNull();
  });
});
