// Loads the bundled game data into the virtual file system and restores saved files.
import { vfs, initPersistence } from '../runtime/vfs.js';
import { decodeCP437 } from '../runtime/cp437.js';
import { env } from '../engine/env.js';

export const SCENARIOS = ['AFTERMAT.SCN', 'ARRONAX.SCN', 'AWAKEN.SCN', 'EASTWEST.SCN', 'FENCES.SCN',
  'GAUNTLET.SCN', 'IMPERIUM.SCN', 'INTRO.SCN', 'JAKARTA.SCN', 'Nebula.SCN', 'PERIPHER.SCN',
  'PRINCES.SCN', 'TRINITY.SCN'];

export let helpPages = [];

async function fetchBytes(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error('Could not load ' + path);
  return new Uint8Array(await r.arrayBuffer());
}

// ANACREON.HLP is a FILE OF ARRAY [1..19] OF STRING[80] (81 bytes per line).
function parseHelp(bytes) {
  const pages = [];
  const recSize = 19 * 81;
  for (let p = 0; p + recSize <= bytes.length; p += recSize) {
    const lines = [];
    for (let l = 0; l < 19; l++) {
      const o = p + l * 81;
      const len = Math.min(bytes[o], 80);
      lines.push(decodeCP437(bytes.subarray(o + 1, o + 1 + len)));
    }
    pages.push(lines);
  }
  return pages;
}

export async function boot() {
  const base = import.meta.env.BASE_URL + 'data/';
  await Promise.all(SCENARIOS.map(async (f) => {
    vfs.addBase(f, decodeCP437(await fetchBytes(base + 'scenarios/' + f)));
  }));
  try {
    helpPages = parseHelp(await fetchBytes(base + 'ANACREON.HLP'));
  } catch (e) {
    helpPages = [];
  }
  await initPersistence();
  // configuration (ANACREON.CNF equivalent)
  const cfg = vfs.read('ANACREON.CFG');
  if (cfg) {
    try { Object.assign(env, JSON.parse(cfg)); } catch (e) { /* ignore */ }
  }
}

export function saveConfig() {
  vfs.write('ANACREON.CFG', JSON.stringify({ UseColor: env.UseColor }));
}
