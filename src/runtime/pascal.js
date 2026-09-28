// Turbo Pascal semantics helpers used throughout the port.
//
// Conventions:
//  - Strings are JS strings of CP437 glyphs (see cp437.js); Pascal index 1 = JS index 0.
//  - Small sets (<= 32 members) are integer bitmasks; large sets (fleets 1..240, planets
//    1..200, ...) are BigInt bitmasks.

// ---- numbers ---------------------------------------------------------------

export const MaxInt = 32767;

// Round: half away from zero (TP semantics).
export function Round(x) {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}
export const Trunc = Math.trunc;
export function Sqr(x) { return x * x; }
export function Frac(x) { return x - Math.trunc(x); }

export function int16(x) { x &= 0xFFFF; return x >= 0x8000 ? x - 0x10000 : x; }
export function word(x) { return x & 0xFFFF; }
export function byte(x) { return x & 0xFF; }
export function Lo(x) { return x & 0xFF; }
export function Hi(x) { return (x >> 8) & 0xFF; }
// Integer DIV / MOD (truncate toward zero like Pascal)
export function div(a, b) { return Math.trunc(a / b); }
export function mod(a, b) { return a % b; }

// ---- random (Turbo Pascal / Delphi LCG) --------------------------------------

export const rng = { seed: 0 };

export function Randomize() {
  const d = new Date();
  rng.seed = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 100 +
    Math.floor(d.getMilliseconds() / 10) + Math.floor(Math.random() * 0x7fffffff)) | 0;
}

function nextSeed() {
  rng.seed = (Math.imul(rng.seed, 134775813) + 1) | 0;
  return rng.seed >>> 0;
}

// Random(n): 0..n-1 ; Random(): real in [0,1)
export function Random(n) {
  const s = nextSeed();
  if (n === undefined) return s / 4294967296;
  n &= 0xFFFF;
  return Math.floor((s * n) / 4294967296);
}

// ---- strings -----------------------------------------------------------------

export function Length(s) { return s.length; }

export function Copy(s, index, count) {
  if (index < 1) index = 1;
  if (count <= 0 || index > s.length) return '';
  return s.substr(index - 1, count);
}

export function Pos(sub, s) {
  if (sub === '') return 0;
  return s.indexOf(sub) + 1;
}

export function Delete(s, index, count) {
  if (index < 1 || index > s.length || count <= 0) return s;
  return s.slice(0, index - 1) + s.slice(index - 1 + count);
}

export function Insert(src, s, index) {
  if (index < 1) index = 1;
  if (index > s.length + 1) index = s.length + 1;
  return s.slice(0, index - 1) + src + s.slice(index - 1);
}

export function UpCase(ch) {
  if (ch >= 'a' && ch <= 'z') return ch.toUpperCase();
  return ch;
}

// Only ASCII a..z are converted (AllUpCase inline asm semantics).
export function UpCaseStr(s) {
  return s.replace(/[a-z]+/g, (m) => m.toUpperCase());
}

// Truncate a string to a Pascal STRING[n] capacity.
export function sN(s, n) { return s.length > n ? s.slice(0, n) : s; }

// Set char at 1-based index (Pascal Line[i]:=c). Out of range is ignored.
export function setCh(s, i, c) {
  if (i < 1 || i > s.length) return s;
  return s.slice(0, i - 1) + c + s.slice(i);
}
// Pascal Line[i] (returns '' beyond length, like reading garbage -> treat as #0)
export function ch(s, i) { return i >= 1 && i <= s.length ? s[i - 1] : '\0'; }

export function Chr(n) { return String.fromCharCode(n); }
export function Ord(c) { return c.charCodeAt(0); }

// ---- Str / Val -----------------------------------------------------------------

function pad(s, w) { return s.length >= w ? s : ' '.repeat(w - s.length) + s; }

// Str(n:w) for integers
export function IntStr(n, w = 0) { return pad(String(Math.trunc(n)), w); }

// Str(x:w:d) for reals
export function RealStr(x, w, d) {
  if (d === undefined) {
    // Default real format: scientific " 1.2345678900E+0001" style (TP uses 17 chars)
    let e = x.toExponential(10).toUpperCase();
    let [m, ex] = e.split('E');
    const sign = ex[0] === '-' ? '-' : '+';
    ex = ex.replace(/^[+-]/, '').padStart(4, '0');
    const s = (x < 0 ? '' : ' ') + m + 'E' + sign + ex;
    return pad(s, w || 0);
  }
  const f = Math.abs(x) * Math.pow(10, d);
  let r = Math.round(f + 1e-9 * Math.max(1, f)) / Math.pow(10, d);
  let s = r.toFixed(d);
  if (x < 0 && r !== 0) s = '-' + s;
  return pad(s, w);
}

// Val(s): returns { value, code }. code=0 on success, else 1-based error position.
export function Val(s, isReal = false) {
  let i = 0;
  while (i < s.length && s[i] === ' ') i++;
  if (i >= s.length) return { value: 0, code: Math.max(1, s.length) };
  if (isReal) {
    const m = /^[+-]?(\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(s.slice(i));
    if (!m) return { value: 0, code: i + 1 };
    const end = i + m[0].length;
    if (end !== s.length) return { value: 0, code: end + 1 };
    return { value: parseFloat(m[0]), code: 0 };
  }
  let j = i;
  let neg = false;
  if (s[j] === '+' || s[j] === '-') { neg = s[j] === '-'; j++; }
  let v = 0;
  let digits = 0;
  if (s[j] === '$') {
    j++;
    while (j < s.length && /[0-9a-fA-F]/.test(s[j])) { v = v * 16 + parseInt(s[j], 16); j++; digits++; }
  } else {
    while (j < s.length && s[j] >= '0' && s[j] <= '9') { v = v * 10 + (s.charCodeAt(j) - 48); j++; digits++; }
  }
  if (digits === 0) return { value: 0, code: j + 1 };
  if (j !== s.length) return { value: 0, code: j + 1 };
  return { value: neg ? -v : v, code: 0 };
}

// Val into a 16-bit Integer (out of range -> error)
export function ValInt(s) {
  const r = Val(s);
  if (r.code === 0 && (r.value > 32767 || r.value < -32768)) return { value: 0, code: s.length };
  return r;
}
// Val into a Word
export function ValWord(s) {
  const r = Val(s);
  if (r.code === 0 && (r.value > 65535 || r.value < 0)) {
    if (r.value < 0 && r.value >= -32768) return { value: r.value & 0xFFFF, code: 0 };
    return { value: 0, code: s.length };
  }
  return r;
}

// ---- sets --------------------------------------------------------------------

// Small sets: ints
export function bit(i) { return 1 << i; }
export function inSet(i, s) { return (s & (1 << i)) !== 0; }

// Large sets: BigInt
const BIG = [];
for (let i = 0; i < 256; i++) BIG.push(1n << BigInt(i));
export function B(i) { return BIG[i & 255]; }
export function bIn(i, s) { return i >= 0 && i < 256 && (s & BIG[i]) !== 0n; }
export function bAdd(s, i) { return s | BIG[i]; }
export function bDel(s, i) { return s & ~BIG[i]; }
export const EMPTY = 0n;

// Integer-set helpers for Char sets written as strings of allowed chars.
export function charIn(c, chars) { return chars.indexOf(c) >= 0; }

// ---- misc --------------------------------------------------------------------

export function Sgn(x) { return x === 0 ? 0 : x < 0 ? -1 : 1; }

export function clone(o) {
  if (Array.isArray(o)) return o.map(clone);
  if (o && typeof o === 'object') {
    const r = {};
    for (const k in o) r[k] = clone(o[k]);
    return r;
  }
  return o;
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
