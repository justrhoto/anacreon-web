import fs from 'node:fs';
import { decodeCP437 } from '../src/runtime/cp437.js';
import { vfs } from '../src/runtime/vfs.js';
import * as game from '../src/engine/game.js';
import * as cmd from '../src/engine/commands.js';
import * as views from '../src/engine/views.js';
import { BattleSession } from '../src/engine/battle.js';
import { env } from '../src/engine/env.js';
import { G, Universe, Pln, Flt, fgt, jmp, trn, men } from '../src/engine/types.js';
import { rng } from '../src/runtime/pascal.js';

for (const f of fs.readdirSync('public/assets/scenarios')) vfs.addBase(f, decodeCP437(fs.readFileSync('public/assets/scenarios/' + f)));
rng.seed = 12345;
const list = game.listScenarios();
console.log('scenarios:', list.map((s) => s.file + '(' + s.title + ')').join(', '));
const h = game.scenarioHeader('INTRO.SCN');
const r = game.startNewGame('INTRO.SCN', h, [{ name: 'Terra', password: 'pw', isEmpress: false }]);
console.log('start', r.ok, 'player', env.Player, 'needsPassword', game.needsPassword(), 'pw ok', game.checkPassword('pw'));
let b = game.beginTurn();
console.log('begin', b);
const rep = views.empireReport(env.Player);
console.log('report', rep.name, rep.year, rep.worlds, rep.population, rep.techLevel);
const worlds = views.worldList(env.Player);
console.log('worlds', worlds.length, worlds.slice(0, 3).map((w) => w.name + ' ' + w.type + ' ' + w.pop));
const cap = Universe.EmpireData[env.Player].Capital;
const map = views.mapView(env.Player);
let known = 0; for (let x = 1; x <= map.size; x++) for (let y = 1; y <= map.size; y++) if (map.cells[x][y].obj) known++;
console.log('map objects visible', known);
// launch a fleet from the capital to a known independent world
let target = null, best = 99;
const capXY = views.worldView(env.Player, cap).xy;
for (let x = 1; x <= map.size; x++) for (let y = 1; y <= map.size; y++) {
  const c = map.cells[x][y];
  if (c.obj && c.obj.kind === 'planet' && !c.obj.mine) { const d = Math.max(Math.abs(x - capXY.x), Math.abs(y - capXY.y)); if (d < best) { best = d; target = c.obj; } }
}
console.log('target', target && views.worldView(env.Player, target.id).name, 'dist', best);
const s = cmd.launchSession(cap);
console.log('fill fgt', s.fill(fgt), 'fill jmp', s.fill(jmp), 'trn', s.change(trn, 100), 'men', s.change(men, 400));
const tXY = views.worldView(env.Player, target.id).xy;
const lr = cmd.launchFleet('Alpha', cap, tXY, s);
console.log('launch', lr);
console.log('fleets', views.fleetList(env.Player).map((f) => f.shortName + ' ' + f.status + ' ' + f.range));
for (let y = 0; y < 8; y++) {
  const e = game.endTurn(10);
  const b2 = game.beginTurn();
  const f = views.fleetList(env.Player).find((f) => f.shortName === 'Alpha');
  if (f && f.statusCode === 0) {
    const targets = cmd.attackTargets(f.id);
    console.log('year', env.Year, 'arrived; targets', targets.map((t) => t.label));
    if (targets.length) {
      const bs = new BattleSession(f.id, targets[0].id);
      let rounds = 0;
      while (!bs.ended && rounds < 40) {
        const orders = {}; for (let i = 1; i <= bs.n; i++) orders[i] = 'A';
        if (!bs.maneuver(orders)) bs.engage();
        rounds++;
      }
      console.log('groups', bs.groups().map((g) => g.num + ' ' + g.typeName + '@' + g.posName).join('; '));
      const prep = bs.prepareFinish();
      const res = bs.resolve(true);
      console.log('battle result', prep.result, 'rounds', rounds, prep.lines.concat(res.lines).join(' | '));
    }
    break;
  }
  console.log('year', env.Year, e.kind, b2.kind, f && f.status);
}
console.log('news', views.newsList(env.Player).slice(0, 5).map((n) => n.text));
const fn = game.saveGame('TEST');
const before = JSON.stringify(views.worldList(env.Player));
console.log('saved', fn, vfs.read(fn).length, 'bytes');
console.log('load', game.loadGame(fn));
console.log('roundtrip equal', JSON.stringify(views.worldList(env.Player)) === before);
for (let y = 0; y < 20; y++) { game.endTurn(10); const b3 = game.beginTurn(); if (b3.kind !== 'turn') { console.log(b3); break; } }
console.log('final year', env.Year, 'worlds', views.worldList(env.Player).filter((w) => w.own).length);
