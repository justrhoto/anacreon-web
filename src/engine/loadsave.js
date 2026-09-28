// LOADSAVE.PAS: universe initialization, save and load (JSON format).
import {
  Universe, G, gal, MaxNoOfPlanets, Empire1, Empire8, Indep, ClearUniverse, ClearGlobalSets,
  InitializeSector, MaxNoOfFleets,
} from './types.js';
import { InitDefenseRecord } from './datacnst.js';
import { bIn, B } from '../runtime/pascal.js';
import { env } from './env.js';
import { NewsData, EraseNews, saveNews, loadNews } from './news.js';
import { msg, DeleteAllMessages } from './mess.js';
import { NPEData } from './npetypes.js';

export const SaveSignature = 'Anacreon web save v1';

export function InitializeUniverse(StartingYear, Size, Planets) {
  ClearUniverse();
  ClearGlobalSets();
  env.Year = StartingYear;
  env.TimePerTurn = 300;
  G.NoOfPlanets = Planets > MaxNoOfPlanets ? MaxNoOfPlanets : Planets;
  InitializeSector(Size);
  const ind = Universe.EmpireData[Indep];
  ind.EmpireName = 'Independent';
  ind.DefenseSettings = InitDefenseRecord();
  for (let e = Empire1; e <= Empire8; e++) EraseNews(e);
  DeleteAllMessages();
  for (let e = 0; e <= 8; e++) NPEData[e] = { Typ: 0, Data: null };
}

function replacer(_k, v) {
  return typeof v === 'bigint' ? { $big: v.toString() } : v;
}
function reviver(_k, v) {
  return v && typeof v === 'object' && '$big' in v ? BigInt(v.$big) : v;
}

export function serializeGame() {
  const activeFleets = [];
  for (let i = 1; i <= MaxNoOfFleets; i++) if (bIn(i, G.SetOfActiveFleets)) activeFleets.push(i);
  return JSON.stringify({
    signature: SaveSignature,
    env: {
      Year: env.Year, Player: env.Player, EmpiresToMove: env.EmpiresToMove,
      ScenaFilename: env.ScenaFilename, TimePerTurn: env.TimePerTurn, AutoSave: env.AutoSave,
      AsyncTurns: env.AsyncTurns, PauseActive: env.PauseActive, ReEnterGame: env.ReEnterGame,
    },
    size: gal.SizeOfGalaxy,
    sector: gal.Sector,
    G,
    universe: Universe,
    news: saveNews(),
    messages: msg.MessageList,
    npe: NPEData,
  }, replacer);
}

// Returns error string or null
export function deserializeGame(text) {
  let d;
  try {
    d = JSON.parse(text, reviver);
  } catch (e) {
    return 'not an Anacreon save file';
  }
  if (!d || d.signature !== SaveSignature) return 'not an Anacreon save file';
  Object.assign(env, d.env);
  gal.SizeOfGalaxy = d.size;
  gal.Sector = d.sector;
  Object.assign(G, d.G);
  for (const k of Object.keys(Universe)) Universe[k] = d.universe[k];
  loadNews(d.news);
  msg.MessageList = d.messages || [];
  for (let e = 0; e <= 8; e++) NPEData[e] = d.npe[e] || { Typ: 0, Data: null };
  // sanity check from LoadFleets: fleets with invalid coordinates are moved to 1,1
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    const f = Universe.Fleet[i];
    if (f && bIn(i, G.SetOfActiveFleets) && (f.Dest.x === 0 || f.Dest.y === 0 || f.XY.x === 0 || f.XY.y === 0)) {
      f.Dest = { x: 1, y: 1 };
      f.XY = { x: 1, y: 1 };
    }
  }
  return null;
}

export { B };
