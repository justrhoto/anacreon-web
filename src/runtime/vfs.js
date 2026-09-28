// Virtual file system: a flat, synchronous, in-memory file store.
//  - Bundled game data (scenarios, help file) is a read-only base layer.
//  - User files (saves, config, imported scenarios) overlay it and are persisted
//    to IndexedDB (browser) with write-through.
// File names are normalized to their upper-case base name (DOS paths ignored).

const base = new Map();   // name -> { data, time }
const user = new Map();   // name -> { data, time }
let persist = null;       // async (op, name, rec) => void

export function normName(name) {
  const parts = String(name).replace(/\//g, '\\').split(/[\\:]/);
  return parts[parts.length - 1].toUpperCase();
}

export const vfs = {
  addBase(name, data) { base.set(normName(name), { data, time: 0 }); },
  loadUser(name, rec) { user.set(normName(name), rec); },
  setPersist(fn) { persist = fn; },

  exists(name) {
    const n = normName(name);
    return user.has(n) || base.has(n);
  },
  read(name) {
    const n = normName(name);
    const r = user.get(n) || base.get(n);
    return r ? r.data : null;
  },
  write(name, data) {
    const n = normName(name);
    const rec = { data, time: Date.now() };
    user.set(n, rec);
    if (persist) persist('put', n, rec);
  },
  erase(name) {
    const n = normName(name);
    if (!user.has(n)) return base.has(n) ? 5 : 2; // access denied / not found
    user.delete(n);
    if (persist) persist('delete', n);
    return 0;
  },
  rename(from, to) {
    const f = normName(from), t = normName(to);
    const r = user.get(f);
    if (!r) return 2;
    if (user.has(t) || base.has(t)) return 5;
    user.delete(f);
    user.set(t, r);
    if (persist) { persist('delete', f); persist('put', t, r); }
    return 0;
  },
  // List files matching a DOS wildcard mask (e.g. '*.SCN', '*.*')
  list(mask) {
    const re = maskToRegExp(normName(mask || '*.*'));
    const names = new Set([...base.keys(), ...user.keys()]);
    const out = [];
    for (const n of names) {
      if (!re.test(n)) continue;
      const r = user.get(n) || base.get(n);
      out.push({ name: n, size: r.data.length, time: r.time });
    }
    out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return out;
  },
  isUser(name) { return user.has(normName(name)); },
  userFiles() { return [...user.keys()]; },
};

function maskToRegExp(mask) {
  let m = mask;
  if (m.indexOf('.') < 0) m += '.*';
  let [nm, ext] = m.split('.');
  const conv = (p) => p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  if (ext === '*') return new RegExp('^' + conv(nm) + '(\\..*)?$');
  return new RegExp('^' + conv(nm) + '\\.' + conv(ext) + '$');
}

// Turbo Pascal TEXT file reader over a string.
export class TextFile {
  constructor(data) {
    this.s = data || '';
    this.p = 0;
  }
  eof() {
    return this.p >= this.s.length || this.s[this.p] === '\x1a';
  }
  // Read(F, Ch)
  readChar() {
    if (this.eof()) return '\x1a';
    return this.s[this.p++];
  }
  // ReadLn(F, S) ; maxLen truncates like a STRING[n] target
  readLn(maxLen = 255) {
    let line = '';
    while (!this.eof()) {
      const c = this.s[this.p];
      if (c === '\r' || c === '\n') break;
      line += c;
      this.p++;
    }
    // consume line terminator
    if (this.s[this.p] === '\r') this.p++;
    if (this.s[this.p] === '\n') this.p++;
    return line.length > maxLen ? line.slice(0, maxLen) : line;
  }
  reset() { this.p = 0; }
}

// ---- IndexedDB persistence (browser only) ---------------------------------------

export async function initPersistence() {
  if (typeof indexedDB === 'undefined') return;
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('anacreon', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(() => null);
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        user.set(cur.key, cur.value);
        cur.continue();
      } else resolve();
    };
    req.onerror = () => resolve();
  });
  persist = (op, name, rec) => {
    try {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      if (op === 'put') store.put(rec, name);
      else store.delete(name);
    } catch (e) {
      console.error('persist failed', e);
    }
  };
}
