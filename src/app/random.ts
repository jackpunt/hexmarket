// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript

export class Random {
  // seed generator, hash:
  static cyrb128(str: string) {
    let h1 = 1779033703, h2 = 3144134277,
      h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  // Side note: Only designed & tested for seed generation,
  // may be suboptimal as a general 128-bit hash.

  /** random generator, seeded by string.
   *
   * @example
   * const getRand = Random.sfc32('foo');
   * for(let i = 0; i < 10; i++) console.log(getRand());
   *
   * @returns a repeatable random generator
   */
  static sfc32(str: string) {
    let [a, b, c, d] = Random.cyrb128(str);
    return function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      let t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
  }

  /** random generator, seeded by string.
   *
   * @example
   * const getRand = Random.splitmix32('foo');
   * for(let i = 0; i < 10; i++) console.log(getRand());
   *
   * @returns a repeatable random generator
   */
  static splitmix32(str: string) {
    let [a] = Random.cyrb128(str);
    return function () {
      a |= 0;
      a = a + 0x9e3779b9 | 0;
      let t = a ^ a >>> 16;
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ t >>> 15;
      t = Math.imul(t, 0x735a2d97);
      return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
    }
  }

  /** random generator, seeded by string.
   *
   * @example
   * const getRand = Random.mulberry32('foo');
   * for(let i = 0; i < 10; i++) console.log(getRand());
   *
   * @returns a repeatable random generator
   */
  static mulberry32(str: string) {
    let [a] = Random.cyrb128(str)
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }

  /** random generator, seeded by string.
   *
   * @example
   * const getRand = Random.xoshiro128ss('foo');
   * for(let i = 0; i < 10; i++) console.log(getRand());
   *
   * @returns a repeatable random generator
   */
  static xoshiro128ss(str: string) {
    let [a, b, c, d] = Random.cyrb128(str)
    return function () {
      let t = b << 9, r = b * 5;
      r = (r << 7 | r >>> 25) * 9;
      c ^= a;
      d ^= b;
      b ^= c;
      a ^= d;
      c ^= t;
      d = d << 11 | d >>> 21;
      return (r >>> 0) / 4294967296;
    }
  }

  static math_random = Math.random
  static seed_random = Random.mulberry32(`${Math.random( )}`);
  static random = Random.math_random;

}
