// Game/session flow: the main loop of ANACREON.PAS and the non-UI parts of PROLOG.PAS.
//
// The UI drives the loop:
//   1. game.currentPlayer() is the empire whose turn it is.
//   2. If it is a human empire: ask for the password (checkPassword), then call beginTurn().
//   3. The player issues commands; the UI tracks elapsed seconds.
//   4. endTurn(elapsed) runs NPE turns and the year update as needed, then step 1 again.
import { bIn, MaxInt } from '../runtime/pascal.js';
import { vfs } from '../runtime/vfs.js';
import {
  Universe, G, Empire1, Empire8, Indep, Void, Pln, BioTchLvl, CapTyp, EmptyQuadrant, Limbo, cpID,
} from './types.js';
import { TechDev } from './datacnst.js';
import {
  EmpireActive, EmpirePlayer, EmpireName, GetCapital, GetTimeLeft, SetTimeLeft, NextEmpire,
  GetStatus, GetTech, GetPopulation, Known, GetEmpireTechnology, CreateEmpire, SetStatus, SetType,
  SetTech, GetCoord, DeleteAllFleetDestNames, MyLord,
} from './primintr.js';
import {
  ClearScoutSet, ScoutFleets, ScoutObjects, UpdateProbes, DestroyEmpire, ClearKnownSet, Scout,
} from './intrface.js';
import { UpdateAllFleets } from './fleet.js';
import { MovePlayerStarbases } from './sbase.js';
import { ImplementNPE } from './npe.js';
import { UpdateUniverse } from './update.js';
import { EraseNews, AddNews, N } from './news.js';
import { serializeGame, deserializeGame } from './loadsave.js';
import { ParseScenarioHeader, CreateUniverseFromScenario } from './newgame.js';
import { env } from './env.js';

export const session = {
  loaded: false,
  modified: false,
  gameOver: false,
};

// ---- helpers ---------------------------------------------------------------------------

export function ResetEmpiresToMove() {
  env.EmpiresToMove = 0;
  for (let e = Empire1; e <= Empire8; e++)
    if (EmpireActive(e) && EmpirePlayer(e)) env.EmpiresToMove |= 1 << e;
}

export function NoMorePlayers() {
  let e = Empire1;
  while (e !== Indep && (!EmpireActive(e) || !EmpirePlayer(e))) e++;
  return e === Indep;
}

function UpdateEmpireTimeLimit(Player) {
  const d = Universe.EmpireData[Player];
  if (1.0 * d.TimeLeft + env.TimePerTurn < MaxInt) d.TimeLeft += env.TimePerTurn;
}

function SetUpTurn(Player) {
  ClearScoutSet(Player);
  ScoutFleets(Player);
  ScoutObjects(Player);
  UpdateProbes(Player);
}

function runNPEs() {
  // Asynchronous turns: every NPE moves, then all fleets and the universe update.
  ResetEmpiresToMove();
  for (let e = Empire1; e <= Empire8; e++) {
    if (EmpireActive(e) && !EmpirePlayer(e)) {
      // NOTE: the original scouts for `Player` here (quirk preserved)
      ClearScoutSet(env.Player);
      ScoutFleets(env.Player);
      ScoutObjects(env.Player);
      UpdateProbes(env.Player);
      ImplementNPE(e);
      EraseNews(e);
    }
  }
  for (let e = Empire1; e <= Empire8; e++) {
    if (EmpireActive(e)) {
      UpdateAllFleets(e, e);
      MovePlayerStarbases(e);
    }
  }
  UpdateUniverse();
}

function advanceSequential(onProgress) {
  let guard = 0;
  do {
    env.Player++;
    if (env.Player === Indep) {
      env.Player = Empire1;
      ResetEmpiresToMove();
      if (onProgress) onProgress('Updating the universe...');
      UpdateUniverse();
    }
    const p = env.Player;
    if (EmpireActive(p) && !EmpirePlayer(p)) {
      if (onProgress) onProgress('Updating ' + EmpireName(p) + '...');
      ClearScoutSet(p);
      ScoutFleets(p);
      ScoutObjects(p);
      UpdateProbes(p);
      ImplementNPE(p);
      EraseNews(p);
      UpdateAllFleets(p, NextEmpire(p));
      MovePlayerStarbases(NextEmpire(p));
    }
    if (guard++ > 1000) break;
  } while (!(EmpireActive(env.Player) && EmpirePlayer(env.Player)));
}

// UpdateTurn(Player) from ANACREON.PAS
function UpdateTurn(onProgress) {
  const Player = env.Player;
  if (EmpireActive(Player)) {
    UpdateEmpireTimeLimit(Player);
    EraseNews(Player);
    if (!env.AsyncTurns) {
      UpdateAllFleets(Player, NextEmpire(Player));
      MovePlayerStarbases(NextEmpire(Player));
    }
  }
  env.EmpiresToMove &= ~(1 << Player);
  if (!env.AsyncTurns) {
    if (NoMorePlayers()) return;
    advanceSequential(onProgress);
  } else {
    if (env.EmpiresToMove === 0) {
      if (onProgress) onProgress('Updating the universe...');
      runNPEs();
    }
    env.Player = Empire1;
  }
}

function UpdateTurnAfterEmpireDestroyed(onProgress) {
  const Player = env.Player;
  if (!env.AsyncTurns) {
    UpdateAllFleets(Indep, NextEmpire(Player));
    MovePlayerStarbases(NextEmpire(Player));
  }
  env.EmpiresToMove &= ~(1 << Player);
  if (!env.AsyncTurns) {
    if (NoMorePlayers()) return;
    let guard = 0;
    do {
      env.Player++;
      if (env.Player === Indep) {
        env.Player = Empire1;
        ResetEmpiresToMove();
        if (onProgress) onProgress('Updating the universe...');
        UpdateUniverse();
      }
      if (guard++ > 100) break;
    } while (!(EmpireActive(env.Player) && EmpirePlayer(env.Player)));
  } else {
    if (env.EmpiresToMove === 0) runNPEs();
    env.Player = Empire1;
  }
}

// ---- public API ----------------------------------------------------------------------------

export function currentPlayer() { return env.Player; }

export function listScenarios() {
  return vfs.list('*.SCN').map((f) => {
    const h = ParseScenarioHeader(vfs.read(f.name));
    return h ? { file: f.name, ...h } : null;
  }).filter(Boolean);
}

export function scenarioHeader(file) { return ParseScenarioHeader(vfs.read(file)); }

// players: [{ name, password, isEmpress }] for Empire1..N
export function startNewGame(file, header, players) {
  const r = CreateUniverseFromScenario(vfs.read(file), header, players, players.length);
  if (!r.ok) return r;
  env.ScenaFilename = file;
  session.loaded = true;
  session.modified = true;
  session.gameOver = false;
  ResetEmpiresToMove();
  env.AsyncTurns = false;
  env.ReEnterGame = false;
  env.CurrentGame = 'ANACREON.SAV';
  env.Player = Empire1;
  return r;
}

export function needsPassword() {
  return EmpirePlayer(env.Player) && Universe.EmpireData[env.Player].Pass !== '';
}
export function checkPassword(pw) {
  return Universe.EmpireData[env.Player].Pass === pw;
}

// Called when a turn is about to start for env.Player (after the password).
// For NPE-first new games, the NPE's turn is run immediately and the next player returned.
// Returns { kind: 'turn' } | { kind: 'capitalLost', conqueror } | { kind: 'gameOver' }
export function beginTurn(onProgress) {
  let guard = 0;
  for (;;) {
    if (guard++ > 20) return { kind: 'gameOver' };
    const Player = env.Player;
    if (EmpireActive(Player) && !EmpirePlayer(Player)) {
      // "a NPE's turn is first" case of the main loop
      if (!env.ReEnterGame) SetUpTurn(Player); else env.ReEnterGame = false;
      UpdateTurn(onProgress);
      continue;
    }
    if (!EmpireActive(Player)) {
      if (NoMorePlayers()) { session.gameOver = true; session.modified = false; return { kind: 'gameOver' }; }
      UpdateTurnAfterEmpireDestroyed(onProgress);
      continue;
    }
    // EmpireNews: the capital has been captured
    const CapID = GetCapital(Player);
    if (CapID.ObjTyp === Void) {
      const conqueror = CapID.Index;
      DestroyEmpire(Player);
      return { kind: 'capitalLost', conqueror, conquerorName: EmpireName(conqueror), lord: MyLord(Player), lord2: MyLord(Player) };
    }
    if (!env.ReEnterGame) SetUpTurn(Player); else env.ReEnterGame = false;
    session.modified = true;
    return { kind: 'turn' };
  }
}

// After the capital-lost letter: advance to the next empire.
export function afterEmpireDestroyed(onProgress) {
  if (NoMorePlayers()) { session.gameOver = true; session.modified = false; return { kind: 'gameOver' }; }
  UpdateTurnAfterEmpireDestroyed(onProgress);
  return { kind: 'next' };
}

// End of PlayerTakesTurn + UpdateTurn + AutoBackup
export function endTurn(elapsedSeconds, onProgress) {
  const Player = env.Player;
  SetTimeLeft(Player, Math.round(GetTimeLeft(Player) - elapsedSeconds));
  DeleteAllFleetDestNames(Player);
  UpdateTurn(onProgress);
  autoBackup();
  if (!env.AsyncTurns && NoMorePlayers()) { session.gameOver = true; return { kind: 'gameOver' }; }
  return { kind: 'next', player: env.Player };
}

// Leaving the game in the middle of a turn (Game > Quit)
export function exitTurn(elapsedSeconds) {
  const Player = env.Player;
  SetTimeLeft(Player, Math.round(GetTimeLeft(Player) - elapsedSeconds));
  DeleteAllFleetDestNames(Player);
  env.ReEnterGame = true;
  autoBackup();
}

export function timeLeft(elapsedSeconds) {
  return Math.round(GetTimeLeft(env.Player) - elapsedSeconds);
}

// ---- save / load ------------------------------------------------------------------------------

function baseName(f) { const i = f.indexOf('.'); return i < 0 ? f : f.slice(0, i); }

export function autoBackup() {
  if (!env.AutoSave || !session.loaded) return null;
  try {
    vfs.write(baseName(env.CurrentGame) + '.BAK', serializeGame());
    return null;
  } catch (e) {
    return "AutoSave: Can't save the game.";
  }
}

export function saveGame(filename) {
  filename = filename.toUpperCase();
  if (filename.indexOf('.') < 0) filename += '.SAV';
  vfs.write(filename, serializeGame());
  env.CurrentGame = filename;
  session.modified = false;
  return filename;
}

export function loadGame(filename) {
  const data = vfs.read(filename);
  if (data === null) return '"' + filename + '" does not exist.';
  const err = deserializeGame(data);
  if (err) return '"' + filename + '" is probably not an Anacreon save file.';
  env.CurrentGame = filename.toUpperCase();
  session.loaded = true;
  session.modified = false;
  session.gameOver = false;
  return null;
}

export function savedGames() {
  return vfs.list('*.*').filter((f) => /\.(SAV|BAK)$/.test(f.name) || vfs.isUser(f.name) && !/\.(SCN|HLP|CNF)$/.test(f.name));
}

// ---- options (PROLOG) --------------------------------------------------------------------------

export function playersToMove() {
  const out = [];
  for (let e = Empire1; e <= Empire8; e++) if (env.EmpiresToMove & (1 << e)) out.push({ emp: e, name: EmpireName(e) });
  return out;
}

export function setAsyncTurns(on) {
  env.AsyncTurns = on;
  if (!on) { ResetEmpiresToMove(); env.Player = Empire1; }
  session.modified = true;
}

export function playerEmpires() {
  const out = [];
  for (let e = Empire1; e <= Empire8; e++) if (EmpireActive(e) && EmpirePlayer(e)) out.push({ emp: e, name: EmpireName(e) });
  return out;
}

// Returns { ok, continueTurn }
export function deletePlayerEmpire(Emp) {
  env.EmpiresToMove &= ~(1 << Emp);
  DestroyEmpire(Emp);
  session.modified = true;
  let cont = false;
  if (env.AsyncTurns) { env.Player = Emp; cont = true; }
  else if (env.Player === Emp) cont = true;
  return { ok: true, continueTurn: cont };
}

// AddPlayerEmpire precondition check. Returns { error } or { emp, world }
export function newPlayerEmpireSlot() {
  let NewEmp = Empire1;
  while (NewEmp !== Indep && EmpireActive(NewEmp)) NewEmp++;
  let World = null;
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    const id = { ObjTyp: Pln, Index: i };
    if (GetStatus(id) === Indep && GetTech(id) >= BioTchLvl && GetPopulation(id) > 2000) { World = id; break; }
  }
  if (NewEmp === Indep) return { error: 'There are already eight empires in the galaxy.' };
  if (!World) return { error: 'A suitable world cannot be found for a capital.' };
  return { emp: NewEmp, world: World };
}

export function addPlayerEmpire(name, password, isEmpress) {
  const slot = newPlayerEmpireSlot();
  if (slot.error) return slot;
  const { emp: NewEmp, world: WorldID } = slot;
  let MaxTech = 1, MaxTechnology = 0;
  for (let e = Empire1; e <= Empire8; e++) {
    if (!EmpireActive(e)) continue;
    if (Known(e, WorldID)) AddNews(e, N.NewPlEmp, { ID: cpID(WorldID), XY: { ...Limbo } }, NewEmp, 0, 0);
    const { Tech, TechSet } = GetEmpireTechnology(e);
    if (Tech > MaxTech) { MaxTech = Tech; MaxTechnology = TechSet; }
    else MaxTechnology |= TechSet;
  }
  CreateEmpire(NewEmp, true, isEmpress, name, password, WorldID, MaxTech, MaxTechnology, 0, 0, env.Year);
  ClearKnownSet(NewEmp);
  SetStatus(WorldID, NewEmp);
  SetType(WorldID, CapTyp);
  SetTech(WorldID, MaxTech);
  Scout(NewEmp, GetCoord(WorldID));
  session.modified = true;
  return { ok: true, emp: NewEmp };
}

export function setTimeLimit(minutes) {
  env.TimePerTurn = minutes * 60;
  session.modified = true;
}

export { env, EmpireName };
