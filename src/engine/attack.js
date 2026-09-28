// ATTACK.PAS: combat engine.
import { bIn, Round, Trunc, Random, Sqr } from '../runtime/pascal.js';
import {
  G, Universe, Indep, Void, Con, Pln, Base, Gate, Flt, NoRes, LAM, def, GDM, ion, fgt, hkr, jmp,
  jtn, pen, ssp, trn, men, nnj, DpSpc, HiOrb, Orbit, SbOrb, Grnd, AtomicLvl, WrpTchLvl,
  JmpTchLvl, PreWrpLvl, StrTchLvl, PreTchLvl, CapTyp, IndTyp, BseTyp, BseSTyp, JmpTyp, JmpSTyp,
  StrTyp, StrSTyp, BioInd, TriInd, HKFleet, EmptyQuadrant, Limbo, cpXY, cpID, ResArr, IndusArray,
} from './types.js';
import {
  CombatTable, WeapEff, ShipValue, ProtecOffered, ProtecNeeded, CargoSpace, TrnAdj, TechDev,
} from './datacnst.js';
import {
  IntLmt, ThgLmt, Rnd, LesserInt, GreaterInt, Distance, SameID, NoShips, FuelCapacity,
  FleetCargoSpace, MilitaryPower,
} from './misc.js';
import {
  GetCapital, GetTech, GetStatus, GetEmpireTechnology, GetBaseType, GetClass, GetRevIndex,
  SetStatus, GetEfficiency, SetEfficiency, ChangeRevIndex, GetCoord, GetPopulation,
  SetEmpireTechnology, SetCapital, SetType, GetType, CentralizedCapital, EmpirePlayer,
  GetShips, GetCargo, GetDefns, PutShips, PutCargo, PutDefns, GetFleetFuel, SetFleetFuel,
  ChangeTotalRevIndex, GetDefenseSettings, TypeOfFleet, Scouted, SetPopulation, GetIndus,
  PutIndus, SetTech,
} from './primintr.js';
import { Scout, DestroyEmpire, BalanceFleet, DestroyConstruction, DestroyStargate } from './intrface.js';
import { AddNews, AddGlobalNews, N } from './news.js';
import { FleetNameDestruction, DestroyFleet, AbortFleet } from './fleet.js';

export const MaxNoOfGroups = 9;

export const NoAIT = 0, ConquerAIT = 1, DestTrnAIT = 2, CaptTrnAIT = 3;
export const NoART = 0, AttDestroyedART = 1, AttRetreatsART = 2, DefConqueredART = 3, DefCapturedART = 4;
export const NoHRT = 0, WorldSurrendersHRT = 1, WorldDestroyedHRT = 2;
export const GReady = 0, GAdvc = 1, GRtrt = 2, GDst = 3;

export const CombatPower = [0, 80, 75, 20, 65, 2, 15, 10, 1, 20, 100, 1, 20, 100];

const CombatTechAdj = [
  [100, 90, 50, 25, 10, 5, 3, 1, 1, 1, 1],
  [120, 100, 80, 40, 25, 10, 5, 3, 1, 1, 1],
  [150, 110, 100, 60, 40, 25, 10, 5, 3, 1, 1],
  [160, 140, 130, 100, 60, 40, 30, 20, 10, 5, 3],
  [200, 170, 145, 120, 100, 90, 85, 75, 70, 55, 45],
  [250, 200, 175, 140, 110, 100, 95, 90, 85, 70, 55],
  [280, 210, 190, 175, 115, 110, 100, 97, 93, 80, 70],
  [320, 250, 210, 195, 120, 115, 105, 100, 95, 90, 80],
  [360, 320, 280, 220, 125, 120, 115, 110, 100, 97, 90],
  [500, 400, 300, 250, 130, 125, 120, 115, 110, 100, 95],
  [530, 415, 310, 260, 135, 130, 125, 120, 115, 110, 100],
];
const CombatClassAdj = [100, 100, 100, 50, 100, 100, 100, 100, 140, 100, 140, 50, 100, 160, 150, 80, 100, 60, 100, 130, 100, 120];
// indexed by StarbaseTypes cmm(20)..out(23)
const CombatBaseAdj = { 20: 150, 21: 250, 22: 100, 23: 125 };
const GDMLaunch = [0, 0, 0, 20, 217, 662, 1013, 1261, 2163, 2644, 2759];
const GDMKill = (() => { const a = ResArr(); [0, 3, 2, 1, 15, 20, 0].forEach((v, i) => { a[fgt + i] = v; }); return a; })();

export function AttackArray() { return new Array(14).fill(0); }
export function EnemyArray() { return [0, 1, 2, 3, 4].map(() => AttackArray()); }
export function DetailArray() { return new Array(14).fill(0).map(() => new Array(MaxNoOfGroups + 1).fill(0)); }
export function newGroup() {
  return { Typ: NoRes, Num: 0, Trg: NoRes, Pos: DpSpc, Sta: GReady, GAT: 0, GATTyp: NoRes, TrnTyp: fgt, Flg: false };
}
// Gp is a 1-based array of groups (index 0 unused)
export function GroupArray() {
  const g = [null];
  for (let i = 1; i <= MaxNoOfGroups; i++) g.push(newGroup());
  return g;
}

export function AdvanceGroups(NoOfGroups, Gp) {
  for (let i = 1; i <= NoOfGroups; i++) {
    const g = Gp[i];
    if (g.Sta === GAdvc) {
      g.Pos++;
      g.Sta = GReady;
      if (g.Pos === Grnd && g.GAT !== 0) {
        const t = g.Num;
        g.Num = g.GAT;
        g.GAT = t;
        g.TrnTyp = g.Typ;
        g.Typ = g.GATTyp;
        g.Trg = men;
      }
    } else if (g.Sta === GRtrt) {
      g.Pos--;
      g.Sta = GReady;
    }
  }
}

export function AllGroupsDestroyed(NoOfGroups, Gp) {
  let i = NoOfGroups;
  while (i > 0 && Gp[i].Sta === GDst) i--;
  return i === 0;
}

const inRange = (v, a, b) => v >= a && v <= b;

export function EnemySurrenders(NoOfGroups, Gp, En, Casualties, Killed, CD) {
  let PlGAT = 0, PlShPow = 0, EnMen = 0, EnShPow = 0, AtShPow = 0, AttKilled = 0, DefKilled = 0;
  for (let i = 1; i <= NoOfGroups; i++) {
    const g = Gp[i];
    if (g.Sta === GDst) continue;
    if (g.Typ === nnj) PlGAT += 5.0 * g.Num;
    else if (g.Typ === men) PlGAT += g.Num;
    else if (g.Typ === trn) PlGAT += g.Num / 5;
    else if (g.Typ === jtn) PlGAT += g.Num / 2;
    else PlShPow += CombatPower[g.Typ] * (g.Num / 100);
  }
  PlGAT = PlGAT * CD.AShipAdj / 100;
  PlShPow = PlShPow * CD.AShipAdj / 100;
  for (let p = DpSpc; p <= Grnd; p++) {
    for (let s = LAM; s <= trn; s++) {
      const t = CombatPower[s] * (En[p][s] / 100);
      EnShPow += t;
      if (inRange(s, LAM, jmp) || s === pen || s === ssp || s === men || s === nnj) AtShPow += t;
    }
  }
  EnMen = En[Grnd][men] + 5.0 * En[Grnd][nnj];
  EnMen = EnMen * CD.DGrndAdj / 100;
  EnShPow = EnShPow * CD.DShipAdj / 100;
  for (let s = LAM; s <= trn; s++) {
    AttKilled += (CombatPower[s] / 100) * Casualties[s];
    DefKilled += (CombatPower[s] / 100) * Killed[s];
  }
  const AttA = PlShPow > 0 ? AttKilled / PlShPow : 0;
  const DefA = EnShPow > 0 ? DefKilled / EnShPow : 0;

  if (CD.DTyp === Flt) {
    if (DefA > AttA * 2 && EnShPow < PlShPow / 3) return true;
    if (DefA > 0 && AttA === 0 && PlShPow > AtShPow) return true;
    if (EnShPow === 0) return true;
    return false;
  }
  if (CD.RevIndex > 70 && PlGAT > EnMen && PlShPow > AtShPow) return true;
  if (EnMen === 0 && PlGAT > 0) return true;
  if (AtShPow < PlShPow / 2 && EnMen < PlGAT / 2 && DefA > AttA && inRange(CD.DTech, AtomicLvl, WrpTchLvl)) return true;
  if (EnMen < PlGAT / 4 && inRange(CD.DTech, AtomicLvl, WrpTchLvl)) return true;
  if (DefA > AttA * 2 && EnMen < PlGAT / 2 && inRange(CD.DTech, WrpTchLvl, JmpTchLvl)) return true;
  return false;
}

export function CalculateCombatData(Attacker, FltID, TargetID) {
  const CD = {};
  CD.DTyp = TargetID.ObjTyp;
  const ATech = GetTech(GetCapital(Attacker));
  CD.DTech = CD.DTyp === Flt ? GetEmpireTechnology(GetStatus(TargetID)).Tech : GetTech(TargetID);
  CD.AShipAdj = CombatTechAdj[ATech][CD.DTech];
  CD.DShipAdj = CombatTechAdj[CD.DTech][ATech];
  CD.DGrndAdj = CD.DShipAdj;
  if (CD.DTyp === Base) CD.DGrndAdj = Round((CD.DGrndAdj / 100) * CombatBaseAdj[GetBaseType(TargetID)]);
  else if (CD.DTyp === Flt) CD.DGrndAdj = 0;
  else CD.DGrndAdj = Round((CD.DGrndAdj / 100) * CombatClassAdj[GetClass(TargetID)]);
  CD.MaxGDM = GDMLaunch[CD.DTech];
  CD.RevIndex = CD.DTyp === Pln ? GetRevIndex(TargetID) : 0;
  return CD;
}

function GetConflict(CurPos, NoOfGroups, Gp) {
  const s = new Set();
  for (let i = 1; i <= NoOfGroups; i++) if (Gp[i].Pos === CurPos && Gp[i].Sta !== GDst) s.add(i);
  return s;
}

function TotalProtection(NoOfGroups, Gp, AG) {
  let t = 0;
  for (let i = 1; i <= NoOfGroups; i++) {
    if (!AG.has(i)) continue;
    const g = Gp[i];
    if (g.Trg !== NoRes && g.Typ !== men && g.Typ !== nnj) t += ProtecOffered[g.Typ] * g.Num;
  }
  return t;
}

function ShipsDestroyed(NumberAttacking, Attacker, Defender, Adj) {
  let temp = NumberAttacking * (CombatTable[Attacker][Defender] / 100);
  if (Adj === 0) Adj = 1;
  temp = 100 * (temp / Adj);
  let temp3 = Trunc(IntLmt(temp));
  let temp2 = (temp - temp3) * 100;
  if (temp2 > 100) temp2 = 0;
  if (Rnd(1, 100) < temp2) temp3++;
  return ThgLmt(temp3);
}

function GetTargetArray(CurPos, NoOfGroups, Gp, AG, En, Killed, CD) {
  const Targ = [null];
  for (let i = 1; i <= MaxNoOfGroups; i++) Targ.push(AttackArray());
  const P1 = new Array(MaxNoOfGroups + 1).fill(0);
  const P2 = new Array(MaxNoOfGroups + 1).fill(0).map(() => AttackArray());

  // BuildPriority1
  const Cover = TotalProtection(NoOfGroups, Gp, AG);
  let Total = 0;
  for (let i = 1; i <= NoOfGroups; i++) {
    if (!AG.has(i)) continue;
    const g = Gp[i];
    P1[i] = Round((ShipValue[g.Typ] / 1000) * g.Num) + 1;
    if ((g.Typ === trn || g.Typ === jtn) && CD.DTyp !== Flt) P1[i] = IntLmt(P1[i] * (1.0 + g.Pos));
    else if (g.Typ === ssp) P1[i] = IntLmt(P1[i] * (16.0 - 2 * g.Pos));
    if (g.Trg === NoRes && g.Typ !== men && g.Typ !== nnj) {
      let PerCentCover = IntLmt(((Cover / g.Num) / ProtecNeeded[g.Typ]) * 100);
      if (!isFinite(PerCentCover) || PerCentCover > 100) PerCentCover = 100;
      P1[i] = Round(P1[i] * (1 - PerCentCover / 100));
    }
    if (g.Trg === NoRes && g.Typ === hkr && g.Flg === false) P1[i] = 0;
    Total += P1[i];
  }
  if (Total === 0) Total = 1;
  for (let i = 1; i <= NoOfGroups; i++) P1[i] = Round((P1[i] / Total) * 1000);

  // BuildPriority2
  for (let i = 1; i <= NoOfGroups; i++) {
    if (!AG.has(i)) continue;
    for (let s = LAM; s <= nnj; s++) P2[i][s] = Round(P1[i] * (CombatTable[s][Gp[i].Typ] / WeapEff[s]));
  }
  for (let s = LAM; s <= nnj; s++) {
    let t = 0;
    for (let i = 1; i <= NoOfGroups; i++) t += P2[i][s];
    if (t === 0) t = 1;
    for (let i = 1; i <= NoOfGroups; i++) P2[i][s] = Round((P2[i][s] / t) * 1000);
  }

  // BuildTargetArray
  for (let s = fgt; s <= trn; s++)
    for (let i = 1; i <= NoOfGroups; i++) Targ[i][s] = Round((P2[i][s] / 1000) * En[CurPos][s]);
  if (CurPos === Grnd) {
    for (let i = 1; i <= NoOfGroups; i++) {
      Targ[i][men] = Round((P2[i][men] / 1000) * En[Grnd][men]);
      Targ[i][nnj] = Round((P2[i][nnj] / 1000) * En[Grnd][nnj]);
    }
  }
  if (CurPos === HiOrb || CurPos === Orbit)
    for (let i = 1; i <= NoOfGroups; i++) Targ[i][def] = Round((P2[i][def] / 1000) * En[Orbit][def]);
  if (CurPos === SbOrb)
    for (let i = 1; i <= NoOfGroups; i++) Targ[i][ion] = Round((P2[i][ion] / 1000) * En[SbOrb][ion]);

  let NoOfLAM = 0;
  for (let i = 1; i <= NoOfGroups; i++) {
    if (P2[i][LAM] !== 0) {
      const g = Gp[i];
      NoOfLAM = ThgLmt(NoOfLAM + (g.Num * ((100 + Rnd(0, 100)) / CombatTable[LAM][g.Typ])));
    }
  }
  NoOfLAM = LesserInt(NoOfLAM, En[SbOrb][LAM]);
  En[SbOrb][LAM] -= NoOfLAM;
  Killed[LAM] += NoOfLAM;
  for (let i = 1; i <= NoOfGroups; i++) Targ[i][LAM] = Round((P2[i][LAM] / 1000) * NoOfLAM);

  if (CurPos === Orbit) {
    let NoOfGDM = 0;
    for (let i = 1; i <= NoOfGroups; i++) {
      if (P2[i][GDM] !== 0) {
        const g = Gp[i];
        NoOfGDM = ThgLmt(NoOfGDM + (g.Num * ((100 + Rnd(0, 100)) / CombatTable[GDM][g.Typ])));
      }
    }
    NoOfGDM = LesserInt(NoOfGDM, CD.MaxGDM + Rnd(0, 10));
    NoOfGDM = LesserInt(NoOfGDM, En[SbOrb][GDM]);
    En[SbOrb][GDM] -= NoOfGDM;
    Killed[GDM] += NoOfGDM;
    for (let i = 1; i <= NoOfGroups; i++) {
      const g = Gp[i];
      let at = Round((P2[i][GDM] / 1000) * NoOfGDM);
      at -= Round(((GDMKill[g.Typ] || 0) / 10) * g.Num);
      if (at < 0) at = 0;
      Targ[i][GDM] = at;
    }
  }
  return Targ;
}

function InRangeOfDefense(Attacker, Target, From) {
  switch (Target) {
    case GDM: case LAM: return From === SbOrb;
    case ion: return (From === SbOrb && Attacker !== fgt) || From === Grnd;
    case def: return From === Orbit;
    case men: case nnj: return From === Grnd || (From === SbOrb && (Attacker === pen || Attacker === ssp));
  }
  return true;
}

function GroupAttack(NoOfGroups, Gp, AG, EShDest, CD) {
  for (let i = 1; i <= NoOfGroups; i++) {
    if (!AG.has(i)) continue;
    const g = Gp[i];
    let t = (g.Trg === men || g.Trg === nnj)
      ? ShipsDestroyed(g.Num, g.Typ, g.Trg, CD.DGrndAdj)
      : ShipsDestroyed(g.Num, g.Typ, g.Trg, CD.DShipAdj);
    if (g.Sta === GAdvc && ((g.Trg >= ssp && g.Trg <= trn) || g.Trg === def)) t += Math.floor(t / 2);
    if (!InRangeOfDefense(g.Typ, g.Trg, g.Pos)) t = 0;
    EShDest[g.Trg] = ThgLmt(EShDest[g.Trg] + t);
    if (g.Typ === hkr && g.Trg !== NoRes) g.Flg = true;
  }
}

function EnemyAttack(NoOfGroups, Gp, AG, GShDest, Targ, CD, Details) {
  for (let i = 1; i <= NoOfGroups; i++) {
    if (!AG.has(i)) continue;
    for (let s = LAM; s <= nnj; s++) {
      let t = ShipsDestroyed(Targ[i][s], s, Gp[i].Typ, CD.AShipAdj);
      if (Gp[i].Sta === GAdvc && ((s >= ssp && s <= trn) || (s === def && Gp[i].Pos === Orbit))) t += Math.floor(t / 2);
      GShDest[i] = ThgLmt(GShDest[i] + t);
      Details[s][i] = LesserInt(ThgLmt(Details[s][i] + t), Gp[i].Num);
      if (t > 0) Details[s][0] = 1;
    }
  }
}

function UpdateEnemyDestroyed(CurPos, En, EShDest, Killed) {
  for (let s = LAM; s <= nnj; s++) {
    const d = LesserInt(EShDest[s], En[CurPos][s]);
    En[CurPos][s] -= d;
    Killed[s] += d;
  }
}

function UpdateGroupsDestroyed(NoOfGroups, Gp, AG, GShDest, Casualties) {
  const destroyed = new Set();
  for (let i = 1; i <= NoOfGroups; i++) {
    if (!AG.has(i)) continue;
    const g = Gp[i];
    if (g.Num - GShDest[i] <= 0) {
      Casualties[g.Typ] += g.Num;
      g.Num = 0;
      g.Sta = GDst;
      if ((g.Typ === jtn || g.Typ === trn) && g.GAT > 0) Casualties[g.GATTyp] += g.GAT;
      destroyed.add(i);
    } else {
      if ((g.Typ === jtn || g.Typ === trn) && GShDest[i] > 0 && g.GAT > 0) {
        const TrnWithMen = g.GAT / (CargoSpace[men] * TrnAdj[g.Typ]);
        let MenLost = ThgLmt((GShDest[i] * TrnWithMen / g.Num) + 2);
        MenLost = LesserInt(g.GAT, MenLost);
        g.GAT -= MenLost;
        Casualties[g.GATTyp] += MenLost;
      }
      g.Num -= GShDest[i];
      Casualties[g.Typ] += GShDest[i];
    }
  }
  return destroyed;
}

// Battle: one orbit of conflict. Returns the set of groups destroyed this round.
export function Battle(NoOfGroups, Gp, En, CurPos, CD, Details, Casualties, Killed) {
  const AG = GetConflict(CurPos, NoOfGroups, Gp);
  if (AG.size === 0) return new Set();
  const EShDest = AttackArray();
  const GShDest = new Array(MaxNoOfGroups + 1).fill(0);
  const Targ = GetTargetArray(CurPos, NoOfGroups, Gp, AG, En, Killed, CD);
  GroupAttack(NoOfGroups, Gp, AG, EShDest, CD);
  EnemyAttack(NoOfGroups, Gp, AG, GShDest, Targ, CD, Details);
  const d = UpdateGroupsDestroyed(NoOfGroups, Gp, AG, GShDest, Casualties);
  UpdateEnemyDestroyed(CurPos, En, EShDest, Killed);
  return d;
}

export function ConquerWorld(WorldID, Emp) {
  SetStatus(WorldID, Emp);
  const t = Rnd(10, 20);
  SetEfficiency(WorldID, GetEfficiency(WorldID) - t < 0 ? 0 : GetEfficiency(WorldID) - t);
  const Rev = GetRevIndex(WorldID);
  if (Rev <= 10) ChangeRevIndex(WorldID, Rnd(10, 20));
  else if (Rev <= 30) {
    const r = Rnd(1, 100);
    if (r <= 20) ChangeRevIndex(WorldID, -Rnd(5, 15));
    else if (r <= 50) ChangeRevIndex(WorldID, -Rnd(3, 10));
    else if (r <= 90) ChangeRevIndex(WorldID, Rnd(10, 15));
    else ChangeRevIndex(WorldID, Rnd(20, 30));
  } else if (Rev <= 55) {
    const r = Rnd(1, 100);
    if (r <= 50) ChangeRevIndex(WorldID, -Rnd(10, 20));
    else if (r <= 75) ChangeRevIndex(WorldID, -Rnd(5, 10));
    else if (r <= 90) ChangeRevIndex(WorldID, Rnd(1, 5));
    else ChangeRevIndex(WorldID, Rnd(5, 15));
  } else if (Rev <= 75) ChangeRevIndex(WorldID, -Rnd(40, 55));
  else if (Rev <= 90) ChangeRevIndex(WorldID, -Rnd(50, 65));
  else ChangeRevIndex(WorldID, -Rnd(30, 40));
  Scout(Emp, GetCoord(WorldID));
}

const BaseTypes = [BseTyp, BseSTyp, JmpTyp, JmpSTyp, StrTyp, StrSTyp];

// Returns Booty (BigInt planet set)
function ConquerEmpire(Player, EnemyEmp) {
  const CapXY = GetCoord(GetCapital(EnemyEmp));
  const ConqXY = GetCoord(GetCapital(Player));
  let NewCapID = cpID(EmptyQuadrant);
  let Booty = 0n;
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[EnemyEmp])) continue;
    const WorldID = { ObjTyp: Pln, Index: i };
    const Loc = { XY: cpXY(Limbo), ID: cpID(WorldID) };
    const XY = GetCoord(WorldID);
    const Dist = Distance(XY, CapXY), DistToConq = Distance(XY, ConqXY);
    const Pop = GetPopulation(WorldID), RevI = GetRevIndex(WorldID);
    if (Dist > 10 && DistToConq < 10 && Pop < Rnd(900, 1100)) {
      ConquerWorld(WorldID, Player);
      AddNews(EnemyEmp, N.Join, Loc, Player, 0, 0);
      Booty |= 1n << BigInt(i);
    } else if (Pop > Rnd(900, 1100) && RevI > 50 && Rnd(1, 100) < 75) {
      SetStatus(WorldID, Indep);
      SetType(WorldID, IndTyp);
      AddNews(EnemyEmp, N.DInd, Loc, 0, 0, 0);
    } else if (DistToConq < 10 && Rnd(1, 100) < 60 && RevI > 35) {
      ConquerWorld(WorldID, Player);
      AddNews(EnemyEmp, N.Join, Loc, Player, 0, 0);
      Booty |= 1n << BigInt(i);
    } else if (SameID(NewCapID, EmptyQuadrant)) {
      if (GetTech(WorldID) > JmpTchLvl) NewCapID = WorldID;
    } else if (GetTech(WorldID) > GetTech(NewCapID)) {
      NewCapID = WorldID;
    } else if (GetTech(WorldID) === GetTech(NewCapID)) {
      if (!BaseTypes.includes(GetType(NewCapID))) {
        if (Pop > GetPopulation(NewCapID) || BaseTypes.includes(GetType(WorldID))) NewCapID = WorldID;
      } else if (BaseTypes.includes(GetType(WorldID)) && Pop > GetPopulation(NewCapID)) NewCapID = WorldID;
    }
  }
  if (CentralizedCapital(EnemyEmp) || SameID(NewCapID, EmptyQuadrant)) {
    if (EmpirePlayer(EnemyEmp)) SetCapital(EnemyEmp, { ObjTyp: Void, Index: Player });
    else DestroyEmpire(EnemyEmp);
  } else {
    const { Tech: OldTech } = GetEmpireTechnology(EnemyEmp);
    const NewTech = GetTech(NewCapID);
    if (OldTech > NewTech) SetEmpireTechnology(EnemyEmp, NewTech, TechDev[NewTech]);
    else if (OldTech < NewTech) SetEmpireTechnology(EnemyEmp, NewTech, TechDev[NewTech - 1]);
    SetCapital(EnemyEmp, NewCapID);
    SetType(NewCapID, CapTyp);
    ChangeRevIndex(NewCapID, -Rnd(30, 50));
    SetEfficiency(NewCapID, Rnd(40, 60));
    AddNews(EnemyEmp, N.NewCap, { XY: cpXY(Limbo), ID: cpID(NewCapID) }, 0, 0, 0);
  }
  return Booty;
}

export function RestoreCombatant(ObjID, Casualties) {
  const Sh = GetShips(ObjID), Cr = GetCargo(ObjID);
  for (let s = fgt; s <= trn; s++) Sh[s] = GreaterInt(0, Sh[s] - Casualties[s]);
  for (let s = men; s <= nnj; s++) Cr[s] = GreaterInt(0, Cr[s] - Casualties[s]);
  if (ObjID.ObjTyp === Pln || ObjID.ObjTyp === Base) {
    const Df = GetDefns(ObjID);
    for (let s = LAM; s <= ion; s++) Df[s] = GreaterInt(0, Df[s] - Casualties[s]);
    PutShips(ObjID, Sh); PutCargo(ObjID, Cr); PutDefns(ObjID, Df);
  } else if (ObjID.ObjTyp === Flt) {
    if (FleetCargoSpace(Sh, Cr) < 0) BalanceFleet(Sh, Cr);
    PutShips(ObjID, Sh); PutCargo(ObjID, Cr);
    const cap = FuelCapacity(Sh);
    if (GetFleetFuel(ObjID) > cap) SetFleetFuel(ObjID, cap);
  }
}

// Returns Booty (BigInt)
export function ResolveAttack(Result, FltID, Target, HKAttack, Capture, Casualties, Killed) {
  const Loc = { ID: cpID(Target), XY: cpXY(Limbo) };
  const Emp = GetStatus(FltID);
  const EnemyEmp = GetStatus(Target);
  let EmpireConquered = false;
  let Booty = 0n;
  const ReportLosses = (e, l, k) => {
    for (let s = LAM; s <= nnj; s++) if (k[s] > 0) AddNews(e, N.DestDetail, l, k[s], s, 0);
  };
  const ex = (1 << Emp) | (1 << EnemyEmp);
  switch (Result) {
    case AttDestroyedART:
      if (EnemyEmp === Indep) ChangeTotalRevIndex(Emp, Rnd(1, 4));
      else {
        ChangeTotalRevIndex(Emp, Rnd(2, 5));
        ChangeTotalRevIndex(EnemyEmp, -Rnd(3, 6));
        AddNews(EnemyEmp, N.BattleW1, Loc, Emp, 0, 0);
        ReportLosses(EnemyEmp, Loc, Killed);
        AddGlobalNews(ex, Target, N.GLBDest, Loc, Emp, EnemyEmp, 0);
      }
      FleetNameDestruction(Emp, FltID);
      DestroyFleet(FltID);
      break;
    case AttRetreatsART:
      if (EnemyEmp !== Indep) {
        if (HKAttack) AddNews(EnemyEmp, N.BattleW2UNK, Loc, 0, 0, 0);
        else {
          AddNews(EnemyEmp, N.BattleW2, Loc, Emp, 0, 0);
          AddGlobalNews(ex, Target, N.GLBDest, Loc, Emp, EnemyEmp, 0);
        }
        ReportLosses(EnemyEmp, Loc, Killed);
        ChangeTotalRevIndex(Emp, Rnd(1, 3));
        ChangeTotalRevIndex(EnemyEmp, -Rnd(1, 3));
      }
      break;
    case DefConqueredART: {
      let RevChange;
      let L2 = Loc;
      if (Target.ObjTyp === Pln || Target.ObjTyp === Base) {
        ConquerWorld(Target, Emp);
        if (GetType(Target) === CapTyp) {
          SetType(Target, IndTyp);
          EmpireConquered = true;
          RevChange = Rnd(25, 50);
          AddGlobalNews(ex, Target, N.GLBCapConq, Loc, Emp, EnemyEmp, 0);
        } else {
          RevChange = Rnd(5, 10);
          AddGlobalNews(ex, Target, N.GLBConq, Loc, Emp, EnemyEmp, 0);
        }
      } else {
        const Sh = GetShips(Target);
        for (let s = fgt; s <= trn; s++) Killed[s] += Sh[s];
        L2 = FleetNameDestruction(EnemyEmp, Target);
        if (bIn(Target.Index, G.SetOfActiveFleets) && Capture) AbortFleet(Target, FltID, false);
        DestroyFleet(Target);
        RevChange = Rnd(1, 5);
        AddGlobalNews(ex, Target, N.GLBConq, L2, Emp, EnemyEmp, 0);
      }
      if (EnemyEmp === Indep) ChangeTotalRevIndex(Emp, -Rnd(2, 4));
      else {
        if (HKAttack && Target.ObjTyp === Flt) AddNews(EnemyEmp, N.BattleLUNK, L2, 0, 0, 0);
        else AddNews(EnemyEmp, N.BattleL, L2, Emp, 0, 0);
        ReportLosses(EnemyEmp, L2, Killed);
        ChangeTotalRevIndex(Emp, -Rnd(3, 6));
        ChangeTotalRevIndex(EnemyEmp, RevChange);
      }
      if (EmpireConquered) Booty = ConquerEmpire(Emp, EnemyEmp);
      break;
    }
  }
  return Booty;
}

function DefaultGroup(Sh, Cr, g, ThgI) {
  g.Typ = ThgI;
  g.Num = Sh[ThgI];
  Sh[ThgI] = 0;
  g.Trg = NoRes;
  g.Pos = DpSpc;
  g.Sta = GReady;
  g.Flg = false;
  if (ThgI === jtn || ThgI === trn) {
    const cargo = Cr[nnj] > 0 ? nnj : men;
    let MaxMen = ThgLmt(Round(TrnAdj[ThgI] * g.Num * CargoSpace[cargo]));
    MaxMen = LesserInt(MaxMen, Cr[cargo]);
    g.GAT = MaxMen;
    g.GATTyp = cargo;
    Cr[cargo] -= MaxMen;
  } else g.GAT = 0;
}

// Returns { NoOfGroups, Gp }
export function DefaultDistribution(FltID) {
  const Sh = GetShips(FltID), Cr = GetCargo(FltID);
  const Gp = GroupArray();
  let n = 0;
  for (let s = fgt; s <= trn; s++)
    if (Sh[s] !== 0 && (s <= jmp || s === pen || s === ssp)) DefaultGroup(Sh, Cr, Gp[++n], s);
  for (let s = fgt; s <= trn; s++)
    if (Sh[s] !== 0 && (s === jtn || s === trn)) DefaultGroup(Sh, Cr, Gp[++n], s);
  return { NoOfGroups: n, Gp };
}

export function GetEnemy(Target) {
  const En = EnemyArray();
  const Status = GetStatus(Target);
  const Tech = GetTech(Target);
  const Sh = GetShips(Target), Cr = GetCargo(Target);
  if (Target.ObjTyp === Pln || Target.ObjTyp === Base) {
    const D = GetDefenseSettings(Status);
    const Defns = GetDefns(Target);
    for (let p = DpSpc; p <= Grnd; p++)
      for (let s = fgt; s <= trn; s++)
        if (Status !== Indep || (TechDev[Tech] & (1 << s)))
          En[p][s] = Round((D.ShellDefDist[p][s] / 100) * Sh[s]);
    En[Orbit][def] = Defns[def];
    En[SbOrb][GDM] = Defns[GDM];
    En[SbOrb][ion] = Defns[ion];
    En[SbOrb][LAM] = Defns[LAM];
    En[Grnd][men] = Cr[men];
    En[Grnd][nnj] = Cr[nnj];
  } else if (Target.ObjTyp === Flt) {
    const Split = Sh[jtn] + Sh[trn] === 0 ? 1 : 0.75;
    for (let s = fgt; s <= trn; s++) {
      if (s !== jtn && s !== trn) {
        En[HiOrb][s] = Round(Split * Sh[s]);
        En[Orbit][s] = Round((1 - Split) * Sh[s]);
      } else En[Orbit][s] = Sh[s];
    }
  }
  return En;
}

export function ForcesUnknown(FltID, Target) {
  const Sh = GetShips(FltID);
  return TypeOfFleet(FltID) === HKFleet && Sh[hkr] <= 500 && !Scouted(GetStatus(Target), FltID);
}

export function HolocaustEffectiveness(FltID, WorldID) {
  const TotalDefense = MilitaryPower(GetShips(WorldID), GetDefns(WorldID));
  const TotalAttack = MilitaryPower(GetShips(FltID), ResArr());
  if (TotalDefense === 0) return 100;
  if (TotalAttack < 5000 || TotalAttack / TotalDefense < 1) return 0;
  return LesserInt(100, Round(10 * TotalAttack / TotalDefense));
}

// Returns { Losses, IndusDest, Deaths, Revert, Result }
export function HolocaustWorld(Emp, Effectiveness, WorldID, FltID) {
  const out = { Losses: ResArr(), IndusDest: IndusArray(), Deaths: 0, Revert: false, Result: NoHRT };
  const EnemyEmp = GetStatus(WorldID);
  let RevChange = 0, EnemyRev = 0;
  const surrenders = () => {
    const Tech = GetTech(WorldID), Pop = GetPopulation(WorldID);
    let c = Sqr(Effectiveness / 100);
    if (Pop > 1000) c /= 2;
    if (Tech < PreWrpLvl) return true;
    if (Tech > StrTchLvl) return false;
    return Random(1) <= c;
  };
  if (EnemyEmp === Indep && surrenders()) {
    out.Result = WorldSurrendersHRT;
    ConquerWorld(WorldID, Emp);
    ChangeRevIndex(WorldID, Rnd(20, 45));
    RevChange = Rnd(1, 100) <= 50 ? Rnd(15, 25) : -Rnd(1, 10);
  } else {
    out.Result = WorldDestroyedHRT;
    let Pop = GetPopulation(WorldID);
    out.Deaths = Round((Pop / Rnd(850, 1200)) * Effectiveness);
    Pop -= out.Deaths;
    SetPopulation(WorldID, Pop);
    const Indus = GetIndus(WorldID);
    const Pct = Effectiveness / Rnd(200, 800);
    for (let i = BioInd; i <= TriInd; i++) {
      out.IndusDest[i] = Round(Indus[i] * Pct);
      Indus[i] -= out.IndusDest[i];
    }
    PutIndus(WorldID, Indus);
    SetEfficiency(WorldID, Rnd(1, 10));
    if (Rnd(1, 100) <= Math.floor((out.Deaths & 0xFF) / 2)) {
      out.Revert = true;
      SetTech(WorldID, PreTchLvl);
    }
    const PctD = (100 - Effectiveness) / Rnd(600, 1000);
    const Sh = GetShips(FltID);
    for (let s = fgt; s <= trn; s++) {
      if (s !== jtn && s !== trn) {
        out.Losses[s] = Round(Sh[s] * PctD * CombatTable[GDM][s] / 100);
        Sh[s] -= out.Losses[s];
      }
    }
    const cap = FuelCapacity(Sh);
    if (GetFleetFuel(FltID) > cap) SetFleetFuel(FltID, cap);
    EnemyRev = Math.floor(out.Deaths / 7) + Rnd(1, 10);
    if (EnemyRev > 30) EnemyRev = 30;
    RevChange = Math.floor(out.Deaths / 6) + Rnd(-15, 3);
    if (RevChange > 50) RevChange = 50;
    const Loc = { ID: cpID(WorldID), XY: cpXY(Limbo) };
    AddNews(EnemyEmp, N.WHolo, Loc, Emp, 0, 0);
    AddNews(EnemyEmp, N.DthHolo, Loc, out.Deaths, 0, 0);
    for (let i = BioInd; i <= TriInd; i++)
      if (out.IndusDest[i] > 0) AddNews(EnemyEmp, N.IndDs, Loc, Indus[i], i, 0);
  }
  ChangeTotalRevIndex(Emp, RevChange);
  ChangeTotalRevIndex(EnemyEmp, EnemyRev);
  return out;
}

// Returns { ShipsDest, DefnsDest }
export function LAMAttack(Player, LAMToUse, Target) {
  const ShipsDest = ResArr(), DefnsDest = ResArr();
  let Loc = { ID: cpID(Target), XY: cpXY(Limbo) };
  const Emp = GetStatus(Target);
  if (Target.ObjTyp === Flt) {
    const Ships = GetShips(Target);
    let Space = 0;
    for (let s = fgt; s <= trn; s++) Space += Ships[s] * (ProtecNeeded[s] / 100);
    if (Space === 0) Space = 1;
    for (let s = fgt; s <= trn; s++) {
      const per = Round(LAMToUse * ((Ships[s] * (ProtecNeeded[s] / 100)) / Space));
      ShipsDest[s] = LesserInt(Trunc((per / 100) * CombatTable[LAM][s]), Ships[s]);
      Ships[s] -= ShipsDest[s];
    }
    if (NoShips(Ships)) {
      Loc = FleetNameDestruction(Emp, Target);
      AddNews(Emp, N.LAMDs, Loc, Player, 0, 0);
      DestroyFleet(Target);
    } else {
      AddNews(GetStatus(Target), N.LAMDm, Loc, Player, 0, 0);
      const Cargo = GetCargo(Target);
      BalanceFleet(Ships, Cargo);
      PutShips(Target, Ships);
      PutCargo(Target, Cargo);
    }
    for (let s = fgt; s <= trn; s++) if (ShipsDest[s] > 0) AddNews(Emp, N.DestDetail, Loc, ShipsDest[s], s, 0);
  } else {
    AddNews(Emp, N.LAMDef, Loc, Player, 0, 0);
    const Defns = GetDefns(Target);
    let Total = 0;
    for (let s = LAM; s <= ion; s++) Total += Defns[s];
    if (Total === 0) Total = 1;
    for (let s = LAM; s <= ion; s++) {
      const per = Round((LAMToUse / Total) * Defns[s]);
      DefnsDest[s] = LesserInt(Trunc((per / 100) * CombatTable[LAM][s]), Defns[s]);
      Defns[s] -= DefnsDest[s];
      if (DefnsDest[s] > 0) AddNews(Emp, N.DestDetail, Loc, DefnsDest[s], s, 0);
    }
    PutDefns(Target, Defns);
  }
  AddGlobalNews((1 << Emp) | (1 << Player), Target, N.GLBLAMStrk, Loc, Player, Emp, 0);
  return { ShipsDest, DefnsDest };
}

export function DestroyConstructionOrGate(Emp, ForcesUnk, TargetID) {
  const Loc = { ID: cpID(EmptyQuadrant), XY: GetCoord(TargetID) };
  const EnemyEmp = GetStatus(TargetID);
  if (TargetID.ObjTyp === Con) {
    DestroyConstruction(TargetID);
    ChangeTotalRevIndex(EnemyEmp, Rnd(3, 7));
    if (ForcesUnk) AddNews(EnemyEmp, N.ConDsUNK, Loc, 0, 0, 0);
    else AddNews(EnemyEmp, N.ConDs, Loc, Emp, 0, 0);
  } else if (TargetID.ObjTyp === Gate) {
    DestroyStargate(TargetID);
    ChangeTotalRevIndex(EnemyEmp, Rnd(7, 15));
    if (ForcesUnk) AddNews(EnemyEmp, N.GteDsUNK, Loc, 0, 0, 0);
    else AddNews(EnemyEmp, N.GteDs, Loc, Emp, 0, 0);
  }
}
