/**
 * @author jdiaz5513
 */

// LINT: a lot of the util functions need the any type.
/* tslint:disable:no-any no-unsafe-any */

import initTrace from 'debug';

import {MAX_INT32, MAX_SEGMENT_LENGTH, MAX_UINT32} from './constants';
import {RANGE_INT32_OVERFLOW, RANGE_INVALID_UTF8, RANGE_SIZE_OVERFLOW, RANGE_UINT32_OVERFLOW} from './errors';

const trace = initTrace('capnp:util');
trace('load');

// Set up custom debug formatters.

/* tslint:disable:no-string-literal */
initTrace.formatters['h'] = (v: any) => v.toString('hex');
initTrace.formatters['x'] = (v: any) => `0x${v.toString(16)}`;
initTrace.formatters['a'] = (v: any) => `0x${pad(v.toString(16), 8)}`;
initTrace.formatters['X'] = (v: any) => `0x${v.toString(16).toUpperCase()}`;
/* tslint:enable:no-string-literal */

/**
 * Enables the mixin pattern on a class by allowing the class to implement multiple parent classes; call
 * `applyMixins()` on the subclass to add all of the prototype methods to it. Prototype methods with conflicting names
 * are overridden from left to right.
 *
 * @export
 * @param {*} derivedCtor The subclass to extend.
 * @param {any[]} baseCtors An array of parent classes to inherit from.
 * @returns {void}
 */

export function applyMixins(derivedCtor: any, baseCtors: any[]) {

  baseCtors.forEach((baseCtor) => {

    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {

      derivedCtor.prototype[name] = baseCtor.prototype[name];

    });

  });

}

/**
 * Dump a hex string from the given buffer.
 *
 * @export
 * @param {ArrayBuffer} buffer The buffer to convert.
 * @returns {string} A hexadecimal string representing the buffer.
 */

export function bufferToHex(buffer: ArrayBuffer): string {

  const a = new Uint8Array(buffer);
  const h = [];

  for (let i = 0; i < a.byteLength; i++) h.push(pad(a[i].toString(16), 2));

  return `[${h.join(' ')}]`;

}

/**
 * Throw an error if the provided value cannot be represented as a 32-bit integer.
 *
 * @export
 * @param {number} value The number to check.
 * @returns {number} The same number if it is valid.
 */

export function checkInt32(value: number): number {

  if (value > MAX_INT32 || value < -MAX_INT32) throw new RangeError(RANGE_INT32_OVERFLOW);

  return value;

}

export function checkUint32(value: number): number {

  if (value < 0 || value > MAX_UINT32) throw new RangeError(RANGE_UINT32_OVERFLOW);

  return value;

}

/**
 * Throw an error if the provided size (in bytes) is greater than the allowed limit, or return the same number
 * otherwise.
 *
 * @export
 * @param {number} size The size to check.
 * @returns {number} The same size, if it is valid.
 */

export function checkSizeOverflow(size: number): number {

  if (size > MAX_SEGMENT_LENGTH) throw new RangeError(format(RANGE_SIZE_OVERFLOW, size));

  return size;

}

/**
 * Decode a UTF-8 encoded byte array into a JavaScript string (UCS-2).
 *
 * @export
 * @param {Uint8Array} src A utf-8 encoded byte array.
 * @returns {string} A string representation of the byte array.
 */

export function decodeUtf8(src: Uint8Array): string {

  // This ain't for the faint of heart, kids. If you suffer from seizures, heart palpitations, or have had a history of
  // stroke you may want to look away now.

  const l = src.byteLength;
  let dst = '';
  let i = 0;
  let cp = 0;
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;

  // Unlike other implementations out there on the net, this one has no `Math`, `%`, `*`, or `/` operations. :)

  while (i < l) {

    a = src[i++];

    if ((a & 0b10000000) === 0) {

      cp = a;

    } else if ((a & 0b11100000) === 0b11000000) {

      if (i + 1 >= l) throw new RangeError(RANGE_INVALID_UTF8);

      b = src[i++];

      if ((b & 0b11000000) !== 0b10000000) throw new RangeError(RANGE_INVALID_UTF8);

      cp = ((b & 0b00111111) << 5) | (a & 0x00011111);

    } else if ((a & 0b11110000) === 0b11100000) {

      if (i + 2 >= l) throw new RangeError(RANGE_INVALID_UTF8);

      b = src[i++];
      c = src[i++];

      if ((b & 0b11000000) !== 0b10000000) throw new RangeError(RANGE_INVALID_UTF8);
      if ((c & 0b11000000) !== 0b10000000) throw new RangeError(RANGE_INVALID_UTF8);

      cp = ((c & 0b00111111) << 10) | ((b & 0b00111111) << 4) | (a & 0x00001111);

    } else if ((a & 0b11111000) === 0b11110000) {

      if (i + 3 >= l) throw new RangeError(RANGE_INVALID_UTF8);

      b = src[i++];
      c = src[i++];
      d = src[i++];

      if ((b & 0b11000000) !== 0b10000000) throw new RangeError(RANGE_INVALID_UTF8);
      if ((c & 0b11000000) !== 0b10000000) throw new RangeError(RANGE_INVALID_UTF8);

      cp = ((d & 0b00111111) << 15) | ((c & 0b00111111) << 9) | ((b & 0b00111111) << 3) | (a & 0x00001111);

    } else {

      throw new RangeError(RANGE_INVALID_UTF8);

    }

    if (cp < 0) throw new RangeError(RANGE_INVALID_UTF8);

    if (cp <= 0xD7ff || (cp >= 0xe000 && cp <= 0xffff)) {

      dst += String.fromCharCode(cp);

    } else {

      cp -= 0x010000;

      const lo = (cp & 0x03ff) + 0xdc00;
      const hi = (cp >>> 10) + 0xd800;

      if (lo < 0xdc00 || lo > 0xdfff) throw new RangeError(RANGE_INVALID_UTF8);
      if (hi < 0xd800 || hi > 0xdbff) throw new RangeError(RANGE_INVALID_UTF8);

      dst += String.fromCharCode(lo, hi);

    }

  }

  return dst;

}

/**
 * Encode a JavaScript string (UCS-2) to a UTF-8 encoded string inside a Uint8Array.
 *
 * Note that the underlying buffer for the array will likely be larger than the actual contents; ignore the extra bytes.
 *
 * @export
 * @param {string} src The input string.
 * @returns {Uint8Array} A UTF-8 encoded buffer with the string's contents.
 */

export function encodeUtf8(src: string): Uint8Array {

  const l = src.length;
  const dst = new Uint8Array(new ArrayBuffer(l * 4));
  let j = 0;

  for (let i = 0; i < l; i++) {

    const c = src.charCodeAt(i);

    if (c <= 0x7f) {

      dst[j++] = c;

    } else if (c <= 0x07ff) {

      dst[j++] = 0xc0 | (c >>> 6);
      dst[j++] = 0x80 | (c & 0x3f);

    } else if (c <= 0xffff) {

      dst[j++] = 0xe0 | (c >>> 12);
      dst[j++] = 0x80 | ((c >>> 6) & 0x3f);
      dst[j++] = 0x80 | (c & 0x3f);

    } else {

      let k = 4;

      while (c >> (6 * k)) k++;

      dst[j++] = ((0xff00 >>> k) & 0xff) | (c >>> (6 * --k));

      while (k--) dst[j++] = 0x80 | ((c >>> (6 * k)) & 0x3f);

    }

  }

  return dst.subarray(0, j);

}

/**
 * Produce a `printf`-style string. Nice for providing arguments to `assert` without paying the cost for string
 * concatenation up front. Precision is supported for floating point numbers.
 *
 * @param {string} s The format string. Supported format specifiers: b, c, d, f, j, o, s, x, and X.
 * @param {...any} args Values to be formatted in the string. Arguments beyond what are consumed by the format string
 * are ignored.
 * @returns {string} The formatted string.
 */

export function format(s: string, ...args: any[]) {

  const n = s.length;
  let arg: any;
  let argIndex = 0;
  let c: string;
  let escaped = false;
  let i = 0;
  let leadingZero = false;
  let precision: number | null;
  let result = '';

  function nextArg() {

    return args[argIndex++];

  }

  function slurpNumber() {

    let digits = '';

    while (/\d/.test(s[i])) {

      digits += s[i++];
      c = s[i];

    }

    return digits.length > 0 ? parseInt(digits, 10) : null;

  }

  for (; i < n; ++i) {

    c = s[i];

    if (escaped) {

      escaped = false;

      if (c === '.') {

        leadingZero = false;

        c = s[++i];

      } else if (c === '0' && s[i + 1] === '.') {

        leadingZero = true;

        i += 2;
        c = s[i];

      } else {

        leadingZero = true;

      }

      precision = slurpNumber();

      switch (c) {

        case 'a':   // number in hex with padding

          result += '0x' + pad(parseInt(nextArg(), 10).toString(16), 8);

          break;

        case 'b':   // number in binary

          result += parseInt(nextArg(), 10).toString(2);

          break;

        case 'c':   // character

          arg = nextArg();

          if (typeof arg === 'string' || arg instanceof String) {

            result += arg;
          } else {

            result += String.fromCharCode(parseInt(arg, 10));

          }

          break;

        case 'd':   // number in decimal

          result += parseInt(nextArg(), 10);

          break;

        case 'f':   // floating point number

          const tmp = String(parseFloat(nextArg()).toFixed(precision || 6));

          result += leadingZero ? tmp : tmp.replace(/^0/, '');

          break;

        case 'j':   // JSON

          result += JSON.stringify(nextArg());

          break;

        case 'o':   // number in octal

          result += '0' + parseInt(nextArg(), 10).toString(8);

          break;

        case 's':   // string

          result += nextArg();

          break;

        case 'x':   // lowercase hexadecimal

          result += '0x' + parseInt(nextArg(), 10).toString(16);

          break;

        case 'X':   // uppercase hexadecimal

          result += '0x' + parseInt(nextArg(), 10).toString(16).toUpperCase();

          break;

        default:

          result += c;

          break;

      }

    } else if (c === '%') {

      escaped = true;

    } else {

      result += c;

    }

  }

  return result;

}

/**
 * Return a new DataView backed by the same ArrayBuffer but with a new byteOffset and byteLength. Will throw if the new
 * DataView extends outside the ArrayBuffer bounds.
 *
 * @param {DataView} dataView The DataView to extend.
 * @param {number | undefined} relByteOffset The new byteOffset relative to the current one.
 * @param {number | undefined} byteLength THe new byteLength, or `undefined` to use the same length.
 * @returns {DataView} The new DataView.
 */

export function extendDataView(dataView: DataView, relByteOffset = 0, byteLength?: number) {

  // The DataView constructor does bounds checking for us. :)

  return new DataView(dataView.buffer, dataView.byteOffset + relByteOffset, byteLength || dataView.byteLength);

}

/**
 * Return the thing that was passed in. Yaaaaawn.
 *
 * @export
 * @template T
 * @param {T} x A thing.
 * @returns {T} The same thing.
 */

export function identity<T>(x: T) {

  return x;

}

/**
 * Copy `n` bytes from the `src` DataView to `dst`.
 *
 * @param {DataView} dst The destination DataView.
 * @param {DataView} src The source DataView.
 * @param {number | undefined} n Number of bytes to copy. If undefined, will copy all of `src`.
 * @returns {void}
 */

export function memcpy(dst: DataView, src: DataView, n?: number): void {

  trace('Copying %d bytes from %s to %s.', n, src, dst);

  // Use Int32Arrays to copy from one ArrayBuffer to the other (so far appears to be the fastest way).

  const d = new Int32Array(dst.buffer, dst.byteOffset, dst.byteLength);
  const s = new Int32Array(src.buffer, src.byteOffset, n || src.byteLength);

  d.set(s);

}

export function noop(): void {

  // do nothing!

}

export function pad(v: string, width: number, pad = '0'): string {

  return v.length >= width ? v : new Array(width - v.length + 1).join(pad) + v;

}

/**
 * Add padding to a number to make it divisible by 8. Typically used to pad byte sizes so they align to a word boundary.
 *
 * @export
 * @param {number} size The number to pad.
 * @returns {number} The padded number.
 */

export function padToWord(size: number): number {

  return (size + 7) & ~7;

}

/**
 * Repeat a string n times. Shamelessly copied from lodash.repeat.
 *
 * @param {number} times Number of times to repeat.
 * @param {string} str The string to repeat.
 * @returns {string} The repeated string.
 */

export function repeat(times: number, str: string) {

  let out = '';
  let n = times;
  let s = str;

  if (n < 1 || n > Number.MAX_VALUE) return out;

  // https://en.wikipedia.org/wiki/Exponentiation_by_squaring

  do {

    if (n % 2) out += s;

    n = Math.floor(n / 2);

    if (n) s += s;

  } while (n);

  return out;

}
