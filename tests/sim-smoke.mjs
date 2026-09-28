import fs from 'node:fs';
import { decodeCP437 } from '../src/runtime/cp437.js';
import { ParseScenarioHeader, CreateUniverseFromScenario } from '../src/engine/newgame.js';
import { G, Universe, Empire1, Empire8 } from '../src/engine/types.js';
import { env } from '../src/engine/env.js';
import { EmpireActive, EmpirePlayer, EmpireName } from '../src/engine/primintr.js';
import { ImplementNPE } from '../src/engine/npe.js';
import { UpdateUniverse } from '../src/engine/update.js';
import { UpdateAllFleets } from '../src/engine/fleet.js';
import { MovePlayerStarbases } from '../src/engine/sbase.js';
import { ClearScoutSet, ScoutFleets, ScoutObjects, UpdateProbes } from '../src/engine/intrface.js';
import { EraseNews, GetNewsList } from '../src/engine/news.js';
import { NextEmpire } from '../src/engine/primintr.js';

const file = process.argv[2] || 'INTRO.SCN';
const years = +(process.argv[3] || 10);
const text = decodeCP437(fs.readFileSync('public/data/scenarios/' + file));
const h = ParseScenarioHeader(text);
console.log(h.title, 'v' + h.version, 'players', h.minPlay, '-', h.maxPlay, 'size', h.size, 'planets', h.planets);
const players = []; for (let i = 0; i < h.minPlay; i++) players.push({ name: 'Testia' + i, password: '', isEmpress: false });
const r = CreateUniverseFromScenario(text, h, players, h.minPlay);
console.log('create ok', r.ok, r.log);
for (let e = Empire1; e <= Empire8; e++) if (EmpireActive(e)) console.log(' empire', e, EmpireName(e), EmpirePlayer(e) ? 'player' : 'NPE');
const t0 = Date.now();
for (let y = 0; y < years; y++) {
  for (let e = Empire1; e <= Empire8; e++) {
    if (!EmpireActive(e)) continue;
    ClearScoutSet(e); ScoutFleets(e); ScoutObjects(e); UpdateProbes(e);
    if (!EmpirePlayer(e)) ImplementNPE(e);
    EraseNews(e);
    UpdateAllFleets(e, NextEmpire(e));
    MovePlayerStarbases(NextEmpire(e));
  }
  UpdateUniverse();
  let fleets = 0; for (let i = 1; i <= 240; i++) if (Universe.Fleet[i]) fleets++;
  const owned = [];
  for (let e = Empire1; e <= Empire8; e++) if (EmpireActive(e)) { let n = 0; for (let i = 1; i <= G.NoOfPlanets; i++) if (Universe.Planet[i].Emp === e) n++; owned.push(EmpireName(e) + ':' + n); }
  console.log('year', env.Year, 'fleets', fleets, owned.join(' '));
}
console.log('ms', Date.now() - t0);
