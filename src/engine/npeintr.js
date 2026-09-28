// NPEINTR.PAS: shared routines used by the non-player empires.
import { bIn, bDel, Round, Trunc, Random, Sqr, MaxInt } from '../runtime/pascal.js';
import {
  G, MaxNoOfFleets, MaxNoOfStargates, MaxNoOfConstrSites, NoOfFleetsPerEmpire, Empire1, Empire8,
  Indep, Void, Con, Pln, Base, Gate, Flt, fgt, hkr, jmp, jtn, pen, ssp, trn, men, nnj, tri, LAM,
  def, GDM, ion, BseTyp, CapTyp, JmpTyp, StrTyp, AgrTyp, TriTyp, RawTyp, MinTyp, CheTyp, IndTyp,
  AmbTyp, AmbCls, ParCls, BioTchLvl, BioInd, TriInd, MinInd, CheInd, SupInd, EmptyQuadrant,
  Limbo, cpID, cpXY, ResArr,
} from './types.js';
import {
  MPower, CargoSpace, TrnAdj, FuelPerTon, ClassIndAdj, MinTechForType, InitDefenseRecord,
} from './datacnst.js';
import {
  LesserInt, GreaterInt, Distance, SameID, SameXY, MilitaryPower, Rnd, AddThings, MoveThings,
  FuelCapacity, FleetCargoSpace, ThgLmt,
} from './misc.js';
import {
  GetShips, GetCargo, GetDefns, PutDefns, PutShips, PutCargo, GetStatus, GetType, GetPopulation,
  GetCoord, GetTech, GetClass, GetCapital, Known, Scouted, GetProbe, LaunchProbe, SetNPEDataIndex,
  NPEDataIndex, GetTrillum, GetFleetFuel, GetFleets, GetObject, EmpireActive, SetDefenseSettings,
  SetType, SetStatus,
} from './primintr.js';
import {
  EstimatedDateOfArrival, EstimatedRange, BalanceFleet, DesignateWorld, GetEmpireStatus,
} from './intrface.js';
import {
  DeployFleet, AbortFleet, DestroyFleet, SetFleetDestination, ChangeCompositionOfFleet, RefuelFleet,
} from './fleet.js';
import { LAMAttack, CaptTrnAIT, ConquerAIT, DestTrnAIT, DefConqueredART, AttRetreatsART, NoART } from './attack.js';
import { NPEAttack } from './attnpe.js';
import {
  ReturnMSN, ConquerMSN, StackMSN, JumpAttackMSN, RaidTrnMSN, BSRKAttackMSN, GuardMSN,
  SlowAttackMSN, NeutralPLT, HarassPLT, PreemptPLT, ConflictPLT,
} from './npetypes.js';
import { newDefenseRecord } from './types.js';

export const MaxNoOfRegions = 20;
export const MaxNoOfGuards = 3;
export const MaxNoOfRaiders = 3;

function mkDefense(rows) {
  const d = newDefenseRecord();
  rows.forEach((r, p) => r.forEach((v, k) => { d.ShellDefDist[p][fgt + k] = v; }));
  return d;
}
const Defense1 = mkDefense([[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 100, 100, 0], [50, 100, 100, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [50, 0, 0, 100, 0, 0, 100]]);
const Defense2 = mkDefense([[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [100, 100, 100, 0, 100, 100, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 100, 0, 0, 100]]);
const Defense3 = mkDefense([[0, 0, 0, 0, 0, 0, 0], [0, 25, 50, 0, 75, 75, 0], [0, 75, 50, 0, 25, 25, 0], [0, 0, 0, 0, 0, 0, 0], [100, 0, 0, 100, 0, 0, 100]]);

const NPETypeDefault = [10, 0, 75, 0, 0, 30, 0, 100, 0, 50, 0, 0, 50, 0, 100, 0, 20, 0, 50, 0, 40];
const NPETypeValue = [30, 100, 10, 0, 100, 50, 25, 25, 0, 50, 100, 100, 50, 0, 25, 0, 60, 0, 50, 0, 50];
const NPEClassValue = [100, 35, 100, 50, 65, 65, 65, 65, 50, 65, 75, 60, 80, 25, 75, 50, 100, 50, 100, 60, 90, 75];

const i32 = (x) => x | 0;
const NullDf = () => ResArr();

// RCap: 1-based array of IDs (MaxNoOfRegions)
export function newRegionArray() {
  const a = [null];
  for (let i = 1; i <= MaxNoOfRegions; i++) a.push(cpID(EmptyQuadrant));
  return a;
}

export function NextFleetDataSlot(FleetData) {
  let i = NoOfFleetsPerEmpire;
  while (i > 0 && bIn(FleetData[i].Index, G.SetOfActiveFleets)) i--;
  return i;
}

const Seq = {
  J: [jmp, hkr, pen, ssp, fgt],
  A: [pen, hkr, ssp, fgt, jmp],
  S: [hkr, pen, jmp, ssp, fgt],
  E: [jmp, hkr, hkr, hkr, hkr],
  R: [hkr, hkr, hkr, hkr, hkr],
  L: [fgt, jmp, pen, hkr, ssp],
};

// Returns { Ships, Cargo }
export function GetFleetComposition(ObjID, Power, GAT, Mission) {
  let Sequence;
  switch (Mission) {
    case ReturnMSN: Sequence = Seq.L; break;
    case ConquerMSN: Sequence = Seq.J; break;
    case StackMSN: Sequence = Seq.A; break;
    case JumpAttackMSN: Sequence = Seq.E; break;
    case RaidTrnMSN: Sequence = Seq.R; break;
    default: Sequence = Seq.J;
  }
  const Ships = ResArr(), Cargo = ResArr();
  const ShpAtBase = GetShips(ObjID), CarAtBase = GetCargo(ObjID);
  let i = 0;
  while (Power > 0 && i < 5) {
    const s = Sequence[i];
    Ships[s] = LesserInt(ShpAtBase[s], Round(Power / MPower[s]) + 1);
    Power = i32(Power - Ships[s] * MPower[s]);
    i++;
  }
  if (GAT > 0) {
    const NnjToTake = LesserInt(Math.trunc(GAT / 3), CarAtBase[nnj]);
    GAT -= 3 * NnjToTake;
    const MenToTake = LesserInt(GAT, GreaterInt(0, CarAtBase[men] - 500));
    GAT -= MenToTake;
    let CSN = Round((MenToTake + NnjToTake) / CargoSpace[men]) & 0xFFFF;
    Ships[jtn] = LesserInt(ShpAtBase[jtn], Round(CSN / TrnAdj[jtn]));
    CSN = (CSN - Round(Ships[jtn] * TrnAdj[jtn])) & 0xFFFF;
    Ships[trn] = LesserInt(ShpAtBase[trn], Round(CSN / TrnAdj[trn]));
    CSN = (CSN - Round(Ships[trn] * TrnAdj[trn])) & 0xFFFF;
    let TCS = Round(Ships[jtn] * TrnAdj[jtn] + Ships[trn] * TrnAdj[trn]) & 0xFFFF;
    Cargo[nnj] = LesserInt(NnjToTake, Round(TCS * CargoSpace[nnj]));
    TCS = (TCS - Round(Cargo[nnj] * CargoSpace[nnj])) & 0xFFFF;
    Cargo[men] = LesserInt(MenToTake, Round(TCS * CargoSpace[men]));
  }
  if (Mission === BSRKAttackMSN) {
    Ships[trn] = ShpAtBase[trn];
    Ships[jtn] = ShpAtBase[jtn];
  }
  if (Ships[hkr] + Ships[jmp] + Ships[jtn] + Ships[pen] + Ships[ssp] + Ships[trn] === 0) Cargo[tri] = 10;
  return { Ships, Cargo };
}

export function AlreadyTargetted(Emp, ID, M, FleetData) {
  for (let i = 1; i <= NoOfFleetsPerEmpire; i++) {
    const f = FleetData[i];
    if (bIn(f.Index, G.SetOfActiveFleets) && M === f.Mission && SameID(f.TargetID, ID)) return true;
  }
  return false;
}

export function GetPotentialRes(ID, FleetData) {
  const Ships = GetShips(ID), Cargo = GetCargo(ID);
  let idx = NoOfFleetsPerEmpire * GetStatus(ID) + 1;
  for (let i = 1; i <= NoOfFleetsPerEmpire; i++) {
    const f = FleetData[i];
    const FltID = { ObjTyp: Flt, Index: idx };
    if (bIn(idx, G.SetOfActiveFleets) && f.Mission === ReturnMSN && SameID(ID, f.TargetID))
      AddThings(Ships, Cargo, GetShips(FltID), GetCargo(FltID));
    idx++;
  }
  return { Ships, Cargo };
}

export function MinimumDefense(ID, Persona) {
  let BaseValue = NPETypeValue[GetType(ID)];
  BaseValue = Round(BaseValue * (0.5 + (GetPopulation(ID) / 2500)));
  BaseValue = Math.imul(Math.imul(BaseValue, Persona.Defensive), 50);
  const WorldXY = GetCoord(ID);
  const Emp = GetStatus(ID);
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const Obj = { ObjTyp: Pln, Index: i };
    if (GetStatus(Obj) !== Indep && Distance(GetCoord(Obj), WorldXY) <= 5) {
      BaseValue = Math.imul(BaseValue, 3);
      const t = GetType(Obj);
      if (t === BseTyp || t === CapTyp) BaseValue = Math.imul(BaseValue, 2);
    }
  }
  return BaseValue;
}

export function AverageMilitaryPower(RCap) {
  let n = 0, total = 0;
  for (let i = 1; i <= MaxNoOfRegions; i++) {
    if (!SameID(RCap[i], EmptyQuadrant)) {
      n++;
      total += MilitaryPower(GetShips(RCap[i]), NullDf());
    }
  }
  return n > 0 ? Round(total / n) : 0;
}

function GetBestBase(Emp, TargetID, FleetPower, FleetGAT) {
  let Best = cpID(EmptyQuadrant), BestDistance = 15;
  const TargetXY = GetCoord(TargetID);
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const TestID = { ObjTyp: Pln, Index: i };
    const TestXY = GetCoord(TestID);
    const qualifies = () => {
      const Ships = GetShips(TestID), Cargo = GetCargo(TestID);
      return MilitaryPower(Ships, NullDf()) > Math.trunc(FleetPower / 2) && (Cargo[men] + 5 * Cargo[nnj]) > FleetGAT;
    };
    if (Distance(TestXY, TargetXY) < BestDistance && qualifies()) {
      Best = TestID;
      BestDistance = Distance(TestXY, TargetXY);
    }
  }
  return Best;
}

function registerFleet(Emp, FleetData, FltID, FromID, NewMission, ToID) {
  const Slot = NextFleetDataSlot(FleetData);
  if (Slot === 0 || EstimatedDateOfArrival(FltID) > EstimatedRange(FltID)) {
    AbortFleet(FltID, FromID, true);
    DestroyFleet(FltID);
    return false;
  }
  SetNPEDataIndex(FltID, Slot);
  const f = FleetData[Slot];
  f.Mission = NewMission;
  f.HomeBaseID = cpID(FromID);
  f.TargetID = cpID(ToID);
  f.Waiting = 0;
  f.Index = FltID.Index;
  return true;
}

export function DeployBattleFleet(Emp, FleetData, FromID, Power, GAT, NewMission, ToID) {
  const { Ships, Cargo } = GetFleetComposition(FromID, Power, GAT, NewMission);
  const DestXY = GetCoord(ToID);
  const FltID = DeployFleet(Emp, FromID, Ships, Cargo, DestXY);
  if (SameID(FltID, EmptyQuadrant) || !bIn(FltID.Index, G.SetOfActiveFleets)) return;
  if (registerFleet(Emp, FleetData, FltID, FromID, NewMission, ToID)) {
    if (GetStatus(ToID) !== Emp && GetStatus(ToID) !== Indep) {
      const n = Rnd(1, 4);
      for (let i = 1; i <= n; i++) {
        const PNum = GetProbe(Emp);
        if (PNum !== 0) LaunchProbe(Emp, PNum, DestXY);
      }
    }
  }
}

export function DeployCargoFleet(Emp, FleetData, FromID, Cr, CarryCargo, NewMission, ToID) {
  const Sh = ResArr();
  const Ships = GetShips(FromID);
  const CS = (-FleetCargoSpace(Sh, Cr)) & 0xFFFF;
  Sh[jtn] = LesserInt(Ships[jtn], 1 + Round(CS / TrnAdj[jtn]));
  Sh[trn] = LesserInt(Ships[trn], 1 + CS);
  const JtnCargo = Round(Sh[jtn] * TrnAdj[jtn]);
  if (JtnCargo < CS && JtnCargo < Sh[trn]) Sh[jtn] = 0;
  else Sh[trn] = 0;
  if (CarryCargo) {
    const GroundCr = GetCargo(FromID);
    for (let c = men; c <= tri; c++) Cr[c] = LesserInt(Cr[c], GroundCr[c]);
  } else for (let c = men; c <= tri; c++) Cr[c] = 0;
  BalanceFleet(Sh, Cr);
  const DestXY = GetCoord(ToID);
  const FltID = DeployFleet(Emp, FromID, Sh, Cr, DestXY);
  if (SameID(FltID, EmptyQuadrant) || !bIn(FltID.Index, G.SetOfActiveFleets)) return;
  registerFleet(Emp, FleetData, FltID, FromID, NewMission, ToID);
}

export function GetBestPlanetToProtect(BaseID) {
  const Emp = GetStatus(BaseID);
  const BaseXY = GetCoord(BaseID);
  let Lowest = 2147483647;
  let Best = GetCapital(Emp);
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const ObjID = { ObjTyp: Pln, Index: i };
    const t = GetType(ObjID);
    if (Distance(GetCoord(ObjID), BaseXY) <= 5 && t !== BseTyp && t !== CapTyp) {
      const Power = MilitaryPower(GetShips(ObjID), GetDefns(ObjID));
      if (Power < Lowest) { Best = ObjID; Lowest = Power; }
    }
  }
  return Best;
}

function GetBestRaiderTarget(Emp, EnemyEmp) {
  let Best = cpID(EmptyQuadrant);
  for (let i = 1; i <= MaxNoOfStargates; i++) {
    if (!bIn(i, G.SetOfActiveGates)) continue;
    const o = { ObjTyp: Gate, Index: i };
    if (Rnd(1, 100) < 50 && Known(Emp, o) && GetStatus(o) === EnemyEmp) Best = o;
  }
  if (SameID(Best, EmptyQuadrant)) {
    for (let i = 1; i <= MaxNoOfConstrSites; i++) {
      if (!bIn(i, G.SetOfConstructionSitesOf[EnemyEmp])) continue;
      const o = { ObjTyp: Con, Index: i };
      if (Rnd(1, 100) < 50 && Known(Emp, o)) Best = o;
    }
  }
  if (SameID(Best, EmptyQuadrant)) {
    for (let i = 1; i <= G.NoOfPlanets; i++) {
      if (!bIn(i, G.SetOfPlanetsOf[EnemyEmp])) continue;
      const o = { ObjTyp: Pln, Index: i };
      if (Rnd(1, 100) < 25 && Known(Emp, o)) Best = o;
    }
  }
  return Best;
}

// Returns { TargetID, TargetDefense, TargetMen }
export function GetBestTarget(Emp, SetOfPossibilities, BasePower, Persona, FleetData) {
  const r = { TargetID: cpID(EmptyQuadrant), TargetDefense: 0, TargetMen: 0 };
  let TargetValue = 0;
  const Factor = (1.5 + Random()) * (Persona.WorldPower / 20);
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    const id = { ObjTyp: Pln, Index: i };
    if (bIn(i, SetOfPossibilities) && Known(Emp, id) && !AlreadyTargetted(Emp, id, ConquerMSN, FleetData)) {
      const Sh = GetShips(id), Cr = GetCargo(id), Df = GetDefns(id);
      let CalcValue = Factor * (GetTech(id) + 1) * NPEClassValue[GetClass(id)];
      CalcValue *= GetPopulation(id) / 1000;
      const Defense = MilitaryPower(Sh, Df);
      const Troops = Cr[men] + 4 * Cr[nnj] + 10;
      const DefValue = 100 + Round((Defense + Troops) / 1000);
      CalcValue /= DefValue;
      if (CalcValue > TargetValue && Defense < BasePower) {
        TargetValue = CalcValue;
        r.TargetDefense = Defense;
        r.TargetMen = Troops;
        r.TargetID = id;
      }
    }
  }
  return r;
}

export function DeployHarassFleet() { /* empty in original */ }

function deployAttack(Emp, EnemyEmp, RCap, Persona, FleetData, base, mission, fallbackMission) {
  const BasePower = AverageMilitaryPower(RCap);
  const t = GetBestTarget(Emp, G.SetOfPlanetsOf[EnemyEmp], BasePower, Persona, FleetData);
  if (SameID(t.TargetID, EmptyQuadrant)) return;
  const FleetPower = i32(base + Round((Random() + Rnd(2, 5)) * t.TargetDefense));
  const FleetGAT = Round(2.0 * t.TargetMen);
  const BaseID = GetRegionalCapital(t.TargetID, RCap);
  if (MilitaryPower(GetShips(BaseID), NullDf()) > Math.trunc(FleetPower / 2))
    DeployBattleFleet(Emp, FleetData, BaseID, FleetPower, FleetGAT, mission, t.TargetID);
  else {
    const b2 = GetBestBase(Emp, t.TargetID, FleetPower, FleetGAT);
    if (!SameID(b2, EmptyQuadrant))
      DeployBattleFleet(Emp, FleetData, b2, FleetPower, FleetGAT, fallbackMission, t.TargetID);
  }
}

export function DeployJumpAttack(Emp, EnemyEmp, RCap, Persona, FleetData) {
  deployAttack(Emp, EnemyEmp, RCap, Persona, FleetData, 30000, JumpAttackMSN, JumpAttackMSN);
}
export function DeploySlowAttack(Emp, EnemyEmp, RCap, Persona, FleetData) {
  // NOTE: original falls back to JumpAttackMSN when deploying from another base
  deployAttack(Emp, EnemyEmp, RCap, Persona, FleetData, 50000, SlowAttackMSN, JumpAttackMSN);
}

export function DeployHKRaiders(Emp, EnemyEmp, RCap, FleetData) {
  const TargetID = GetBestRaiderTarget(Emp, EnemyEmp);
  if (!SameID(TargetID, EmptyQuadrant)) {
    const BaseID = GetRegionalCapital(TargetID, RCap);
    const FleetPower = MPower[hkr] * Rnd(100, 5000);
    DeployBattleFleet(Emp, FleetData, BaseID, FleetPower, 0, RaidTrnMSN, TargetID);
  }
}

// Returns nearest regional capital (EmptyQuadrant if none)
export function GetRegionalCapital(ID, RCap) {
  const XY = GetCoord(ID);
  let BestDist = 100;
  let Closest = cpID(EmptyQuadrant);
  let i = 1;
  while (i <= MaxNoOfRegions && !SameID(RCap[i], EmptyQuadrant)) {
    const d = Distance(XY, GetCoord(RCap[i]));
    if (d < BestDist) { BestDist = d; Closest = cpID(RCap[i]); }
    i++;
  }
  if (SameID(Closest, EmptyQuadrant)) {
    // original leaves this undefined; fall back to the empire capital
    Closest = GetCapital(GetStatus(ID.ObjTyp === Flt || ID.ObjTyp === Pln || ID.ObjTyp === Base ? ID : ID));
  }
  return Closest;
}

export function GetNewDesignation(WorldID, Persona, RCap) {
  const Tech = GetTech(WorldID), Pop = GetPopulation(WorldID);
  const Cls = GetClass(WorldID);
  const ClssAdj = [];
  for (let i = BioInd; i <= TriInd; i++) ClssAdj[i] = Sqr(ClassIndAdj[Cls][i] / 100);
  const Chance = [];
  for (let t = AgrTyp; t <= TriTyp; t++) Chance[t] = Tech < MinTechForType[t] ? 0 : NPETypeDefault[t];
  Chance[GetType(WorldID)] *= 20;
  Chance[RawTyp] *= ClssAdj[MinInd] * ClssAdj[CheInd] * ClssAdj[TriInd];
  Chance[MinTyp] *= ClssAdj[MinInd];
  Chance[CheTyp] *= ClssAdj[CheInd];
  Chance[TriTyp] *= ClssAdj[TriInd];
  Chance[AgrTyp] *= ClssAdj[SupInd];
  Chance[JmpTyp] *= ClssAdj[CheInd] * ClssAdj[MinInd] * ClssAdj[SupInd];
  Chance[StrTyp] *= ClssAdj[MinInd] * ClssAdj[SupInd];
  Chance[BseTyp] *= ClssAdj[MinInd] * ClssAdj[SupInd];
  if (Pop > 2000) { Chance[BseTyp] *= 25; Chance[StrTyp] *= 28; Chance[JmpTyp] *= 30; }
  else if (Pop > 1000) { Chance[BseTyp] *= 12; Chance[StrTyp] *= 6; Chance[JmpTyp] *= 12; }

  const BaseID = GetRegionalCapital(WorldID, RCap);
  const BaseXY = GetCoord(BaseID), WorldXY = GetCoord(WorldID);
  const dB = Distance(BaseXY, WorldXY);
  if (dB < 5 && dB > 0) Chance[BseTyp] *= 0.01;

  const Emp = GetStatus(WorldID);
  for (let e = Empire1; e <= Empire8; e++) {
    if (!EmpireActive(e)) continue;
    const CapID = GetCapital(e);
    if (Known(Emp, CapID) && Distance(WorldXY, GetCoord(CapID)) <= 5) {
      Chance[BseTyp] *= 30;
      break;
    }
  }

  if ((Cls === AmbCls || Cls === ParCls) && Tech >= BioTchLvl) return AmbTyp;
  let Total = 0;
  for (let t = AgrTyp; t <= TriTyp; t++) {
    Chance[t] = Round(Chance[t]);
    Total += Round(Chance[t]);
  }
  if (Total < 100) return IndTyp;
  let Roll = Trunc(Random() * Total) + 1;
  let NewType = AgrTyp;
  while ((Roll > Chance[NewType] || Round(Chance[NewType]) === 0) && NewType !== TriTyp) {
    Roll -= Round(Chance[NewType]);
    NewType++;
  }
  if (NewType === TriTyp && Chance[TriTyp] === 0) NewType = IndTyp;
  return NewType;
}

export function ReDesignateEmpire(Emp, RCap, Persona) {
  const CapID = GetCapital(Emp);
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    const W = { ObjTyp: Pln, Index: i };
    if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const t = GetType(W);
    if (!((t === JmpTyp || t === StrTyp || t === BseTyp) || Rnd(1, 100) < 10) && !SameID(CapID, W)) {
      const NewType = GetNewDesignation(W, Persona, RCap);
      if (NewType !== GetType(W)) DesignateWorld(W, NewType);
    }
  }
}

// ---- fleet mission implementations ----------------------------------------------

function fd(FleetData, FltID) {
  const i = NPEDataIndex(FltID);
  return i >= 1 && i <= NoOfFleetsPerEmpire ? FleetData[i] : null;
}

export function SetFleetReturn(Emp, FltID, BaseID, FleetData) {
  const BaseXY = GetCoord(BaseID);
  const f = fd(FleetData, FltID);
  if (f) {
    f.Mission = ReturnMSN;
    f.TargetID = cpID(BaseID);
  }
  SetFleetDestination(FltID, BaseXY);
}

export function SetRaidingFleetNewTarget(Emp, FltID, TargetID, BaseID, FleetData, Persona) {
  const EnemyEmp = GetStatus(TargetID);
  const FleetPower = MilitaryPower(GetShips(FltID), NullDf());
  if (Rnd(1, 100) <= Persona.Offensive && EnemyEmp !== Emp) {
    const t = GetBestTarget(Emp, G.SetOfPlanetsOf[EnemyEmp], FleetPower, Persona, FleetData);
    if (!SameID(t.TargetID, EmptyQuadrant)) {
      SetFleetDestination(FltID, GetCoord(t.TargetID));
      const f = fd(FleetData, FltID);
      if (f) { f.Mission = JumpAttackMSN; f.TargetID = cpID(t.TargetID); }
    } else SetFleetReturn(Emp, FltID, BaseID, FleetData);
  } else SetFleetReturn(Emp, FltID, BaseID, FleetData);
}

function DestroyAllFleetsInSector(Emp, FltID, FleetPower) {
  const FltXY = GetCoord(FltID);
  let all = true;
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, G.SetOfActiveFleets)) continue;
    const E = { ObjTyp: Flt, Index: i };
    if (SameXY(FltXY, GetCoord(E)) && GetStatus(E) !== Emp && Scouted(Emp, E)) {
      if (FleetPower > Math.trunc(MilitaryPower(GetShips(E), NullDf()) / 2)) {
        if (!bIn(FltID.Index, G.SetOfActiveFleets)) { all = false; continue; }
        const Result = NPEAttack(FltID, E, CaptTrnAIT, 0);
        if (Result !== DefConqueredART) all = false;
      } else all = false;
    }
  }
  return all;
}

export function ImplementReturnMSN(FltID, TargetID) {
  if (TargetID.ObjTyp === Void) { DestroyFleet(FltID); return; }
  AbortFleet(FltID, TargetID, true);
  DestroyFleet(FltID);
}

export function ImplementSupplyMSN(Emp, FltID, TargetID, BaseID, FleetData) {
  const FltSh = GetShips(FltID), FltCr = GetCargo(FltID);
  const TargSh = GetShips(TargetID), TargCr = GetCargo(TargetID);
  for (let c = men; c <= tri; c++) {
    const r = MoveThings(FltCr[c], FltCr[c], TargCr[c]);
    FltCr[c] = r[0]; TargCr[c] = r[1];
  }
  ChangeCompositionOfFleet(FltID, TargetID, FltSh, FltCr, TargSh, TargCr);
  if (bIn(FltID.Index, G.SetOfActiveFleets)) SetFleetReturn(Emp, FltID, BaseID, FleetData);
}

export function ImplementRefuelMSN(FltID, TargetID) {
  if (TargetID.ObjTyp === Flt && !bIn(TargetID.Index, G.SetOfActiveFleets)) {
    // target fleet no longer exists (dangling reference in the original)
    DestroyFleet(FltID);
    return;
  }
  AbortFleet(FltID, TargetID, true);
  DestroyFleet(FltID);
  if (TargetID.ObjTyp !== Flt || !bIn(TargetID.Index, G.SetOfActiveFleets)) return;
  const TonsOnGround = GetTrillum(TargetID);
  const Sh = GetShips(TargetID);
  const FltFuel = GetFleetFuel(TargetID);
  const MaxFuel = FuelCapacity(Sh);
  const TonsNeeded = Trunc((MaxFuel - FltFuel) / FuelPerTon) + 1;
  RefuelFleet(TargetID, TargetID, LesserInt(TonsNeeded, TonsOnGround));
}

export function ImplementConquerMSN(Emp, FltID, TargetID, BaseID, FleetData) {
  let Result = NoART;
  const TargetXY = GetCoord(TargetID);
  const FleetsAtTarget = GetFleets(TargetXY) & ~G.SetOfFleetsOf[GetStatus(FltID)];
  let Return = false;
  if (FleetsAtTarget === 0n && GetStatus(TargetID) === Indep) {
    Result = NPEAttack(FltID, TargetID, ConquerAIT, 0);
    Return = true;
  } else {
    if (Rnd(1, 4) === 1) Return = true;
    Result = AttRetreatsART;
  }
  if (Return && bIn(FltID.Index, G.SetOfActiveFleets)) SetFleetReturn(Emp, FltID, BaseID, FleetData);
  return Result;
}

export function ImplementRaidTrnMSN(Emp, FltID, TargetID, BaseID, FleetData) {
  const FleetPower = MilitaryPower(GetShips(FltID), NullDf());
  const all = DestroyAllFleetsInSector(Emp, FltID, FleetPower);
  if (!bIn(FltID.Index, G.SetOfActiveFleets)) return;
  const T = GetObject(GetCoord(FltID));
  if (all && (T.ObjTyp === Con || T.ObjTyp === Gate)) NPEAttack(FltID, T, DestTrnAIT, 0);
  if (!bIn(FltID.Index, G.SetOfActiveFleets)) return;
  const f = fd(FleetData, FltID);
  if (f) {
    if (f.Waiting === 5) SetFleetReturn(Emp, FltID, BaseID, FleetData);
    else f.Waiting = (f.Waiting + 1) & 0xFF;
  }
  const Sh = GetShips(FltID);
  Sh[fgt] = 0; Sh[jmp] = 0; Sh[jtn] = 0; Sh[pen] = 0; Sh[ssp] = 0; Sh[trn] = 0;
  PutShips(FltID, Sh);
  PutCargo(FltID, ResArr());
}

export function ImplementJumpAttackMSN(Emp, FltID, TargetID, BaseID, FleetData) {
  let Result = AttRetreatsART;
  const FleetPower = MilitaryPower(GetShips(FltID), NullDf());
  const all = DestroyAllFleetsInSector(Emp, FltID, FleetPower);
  if (!bIn(FltID.Index, G.SetOfActiveFleets)) return AttRetreatsART;
  if (all && GetStatus(TargetID) !== Emp) {
    const TargetXY = GetCoord(TargetID), BaseXY = GetCoord(BaseID);
    let EnemySh = GetShips(TargetID);
    let EnemyDf = GetDefns(TargetID);
    const Sh = GetShips(FltID);
    const Df = GetDefns(BaseID);
    if (Df[LAM] > 500 && Distance(TargetXY, BaseXY) <= 5) {
      const LAMsToUse = LesserInt(Df[LAM], 2 * EnemyDf[def] + EnemyDf[ion] + Math.floor(EnemyDf[GDM] / 2));
      const r = LAMAttack(Emp, LAMsToUse, TargetID);
      EnemySh = r.ShipsDest;
      EnemyDf = r.DefnsDest;
      Df[LAM] -= LAMsToUse;
      PutDefns(BaseID, Df);
    }
    EnemyDf = GetDefns(TargetID);
    // NOTE: EnemySh here holds the LAM "ships destroyed" output if LAMs were fired (original quirk)
    if (MilitaryPower(Sh, NullDf()) > Math.trunc(MilitaryPower(EnemySh, EnemyDf) / 2))
      Result = NPEAttack(FltID, TargetID, ConquerAIT, 0);
    else Result = NoART;
  } else Result = NoART;
  return Result;
}

export function ImplementStackMSN(FltID, FleetData) {
  const Emp = GetStatus(FltID);
  const XY = GetCoord(FltID);
  const Active = bDel(GetFleets(XY) & G.SetOfFleetsOf[Emp], FltID.Index);
  let NoOfGuards = 0;
  const DumpStuff = (GuardID) => {
    if (!bIn(FltID.Index, G.SetOfActiveFleets)) return;
    const FltSh = GetShips(FltID), GrdSh = GetShips(GuardID);
    const FltCr = GetCargo(FltID), GrdCr = GetCargo(GuardID);
    for (let s = fgt; s <= trn; s++) {
      let Trans = FltSh[s] + GrdSh[s] < 9999 ? FltSh[s] : (9999 - GrdSh[s]) & 0xFFFF;
      FltSh[s] = (FltSh[s] - Trans) & 0xFFFF;
      GrdSh[s] = (GrdSh[s] + Trans) & 0xFFFF;
      if (s === jtn) {
        let g = LesserInt(Trans, FltCr[men]);
        FltCr[men] -= g; GrdCr[men] = LesserInt(9999, GrdCr[men] + g); Trans -= g;
        g = LesserInt(Trans, FltCr[nnj]);
        FltCr[nnj] -= g; GrdCr[nnj] = LesserInt(9999, GrdCr[nnj] + g);
      } else if (s === trn) {
        let g = LesserInt(Trans, CargoSpace[men] * FltCr[men]);
        FltCr[men] = (FltCr[men] - g) & 0xFFFF; GrdCr[men] = LesserInt(9999, GrdCr[men] + g);
        Trans = GreaterInt(0, Trans - Math.floor(g / CargoSpace[men]));
        g = LesserInt(Trans, FltCr[nnj]);
        FltCr[nnj] -= g; GrdCr[nnj] = LesserInt(9999, GrdCr[nnj] + g);
      }
    }
    ChangeCompositionOfFleet(FltID, GuardID, FltSh, FltCr, GrdSh, GrdCr);
  };
  for (let i = 1; i <= NoOfFleetsPerEmpire; i++) {
    const f = FleetData[i];
    if (bIn(f.Index, Active) && f.Mission === GuardMSN) {
      NoOfGuards++;
      DumpStuff({ ObjTyp: Flt, Index: f.Index });
    }
  }
  if (bIn(FltID.Index, G.SetOfActiveFleets) && NoOfGuards < MaxNoOfGuards) {
    const f = fd(FleetData, FltID);
    if (f) f.Mission = GuardMSN;
  } else if (bIn(FltID.Index, G.SetOfActiveFleets)) {
    const NewWorldID = GetBestPlanetToProtect(FltID);
    SetFleetReturn(Emp, FltID, NewWorldID, FleetData);
  }
}

export function ImplementGuardMSN(FltID, BaseID) {
  const FltSh = GetShips(FltID), BaseSh = GetShips(BaseID);
  const FltCr = GetCargo(FltID), BaseCr = GetCargo(BaseID);
  for (let s = fgt; s <= trn; s++) {
    let Trans = BaseSh[s] + FltSh[s] <= 9000 ? FltSh[s] : 9000 - BaseSh[s];
    if (FltSh[s] - Trans > 9999) Trans = FltSh[s] - 9999;
    BaseSh[s] = ThgLmt(BaseSh[s] + Trans);
    FltSh[s] = ThgLmt(FltSh[s] - Trans);
  }
  ChangeCompositionOfFleet(FltID, BaseID, FltSh, FltCr, BaseSh, BaseCr);
}

// ---- state department ----------------------------------------------------------------

export function StateDepartment(Emp, Persona, State) {
  const me = State[Emp];
  const UsefulPower = me.Worlds === 0 ? me.TotalMilitary : me.TotalMilitary / me.Worlds;
  for (let e = Empire1; e <= Empire8; e++) {
    if (!EmpireActive(e) || e === Emp) continue;
    const s = State[e];
    const EnemyPower = s.Worlds === 0 ? s.TotalMilitary : s.TotalMilitary / s.Worlds;
    let NewPolicy = s.Policy;
    if (s.Balance < -1) NewPolicy = ConflictPLT;
    else if (s.Balance < 0) NewPolicy = PreemptPLT;
    else {
      switch (s.Policy) {
        case NeutralPLT:
          if (UsefulPower > EnemyPower && UsefulPower > 10 && s.ThreatAssess > 50 && Rnd(1, 100) < Persona.Offensive) NewPolicy = HarassPLT;
          else if (UsefulPower > 3 * EnemyPower && UsefulPower > 30 && s.ThreatAssess > 75 && Rnd(1, 100) < Math.floor(Persona.Offensive / 2)) NewPolicy = PreemptPLT;
          break;
        case HarassPLT:
          if (UsefulPower > EnemyPower && UsefulPower > 30 && s.ThreatAssess > 50 && Rnd(1, 100) < Persona.Offensive) NewPolicy = PreemptPLT;
          else if (UsefulPower > 3 * EnemyPower && UsefulPower > 30 && s.ThreatAssess > 75 && Rnd(1, 100) < Persona.Offensive) NewPolicy = PreemptPLT;
          else if (s.Aggressiveness < 10 && Rnd(1, 100) > Persona.Offensive) NewPolicy = NeutralPLT;
          else if (UsefulPower < 5) NewPolicy = NeutralPLT;
          break;
        case PreemptPLT:
          if (UsefulPower > EnemyPower && s.ThreatAssess > 50 && Rnd(1, 100) < Persona.Offensive) NewPolicy = ConflictPLT;
          else if (UsefulPower > 4 * EnemyPower && s.ThreatAssess > 50 && Rnd(1, 100) < Persona.Offensive) NewPolicy = ConflictPLT;
          else if (s.Aggressiveness < 15 && s.ThreatAssess < 50 && Rnd(1, 100) > Persona.Offensive) NewPolicy = NeutralPLT;
          else if (UsefulPower < 10) NewPolicy = HarassPLT;
          break;
        case ConflictPLT:
          if (s.Aggressiveness < 20 && s.ThreatAssess < 50 && Rnd(1, 100) > Persona.Offensive) NewPolicy = NeutralPLT;
          else if (s.Aggressiveness > 80 && EnemyPower > 2 * UsefulPower) NewPolicy = NeutralPLT;
          break;
      }
    }
    s.Policy = NewPolicy;
    s.Aggressiveness = (s.Aggressiveness - Rnd(1, 2)) & 0xFF;
  }
}

export function MidCourseCorrection(Emp, FltID, RCap, FleetData) {
  const f = fd(FleetData, FltID);
  if (f && f.Mission === ReturnMSN && GetStatus(f.TargetID) !== Emp) {
    const BaseID = GetRegionalCapital(FltID, RCap);
    SetFleetDestination(FltID, GetCoord(BaseID));
    f.TargetID = cpID(BaseID);
  }
}

export function StateDeptReport(Emp, State) {
  const mine = GetEmpireStatus(Emp);
  let EmpireMilitary = 1;
  for (let s = fgt; s <= trn; s++) EmpireMilitary += Round(mine.TotalShips[s] / 1000) * MPower[s];
  State[Emp].TotalMilitary = EmpireMilitary;
  State[Emp].Worlds = mine.Planets;
  const EmpireTech = GetTech(GetCapital(Emp));
  for (let e = Empire1; e <= Empire8; e++) {
    if (!EmpireActive(e) || e === Emp) continue;
    const s = State[e];
    const st = GetEmpireStatus(e);
    s.Worlds = st.Planets;
    let TM = 1;
    for (let k = fgt; k <= trn; k++) TM += Round(st.TotalShips[k] / 1000) * MPower[k];
    s.TotalMilitary = TM;
    const Tech = GetTech(GetCapital(Emp)); // original quirk: uses own capital
    let Threat = 50;
    if (Tech > EmpireTech) Threat *= 1.5;
    else if (Tech < EmpireTech) Threat *= 0.75;
    Threat *= 1 + (((st.SInd - mine.SInd) & 0xFFFF) / 5);
    Threat *= TM / EmpireMilitary;
    s.ThreatAssess = Threat > 100 ? 100 : Round(Threat) & 0xFF;
  }
}

export function CreateRegionArray(Emp) {
  const Region = newRegionArray();
  let Next = 1;
  for (let i = 1; i <= G.NoOfPlanets && Next <= MaxNoOfRegions; i++) {
    const id = { ObjTyp: Pln, Index: i };
    if (bIn(i, G.SetOfPlanetsOf[Emp]) && (GetType(id) === BseTyp || GetType(id) === CapTyp)) {
      Region[Next++] = id;
    }
  }
  return Region;
}

export function EnforceNPEDataLinks(Emp, FleetData) {
  const Active = G.SetOfActiveFleets & G.SetOfFleetsOf[Emp];
  const recs = new Set();
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (bIn(i, Active)) {
      const Rec = NPEDataIndex({ ObjTyp: Flt, Index: i });
      if (Rec !== 0) recs.add(Rec);
    }
  }
  for (let i = 1; i <= NoOfFleetsPerEmpire; i++) if (!recs.has(i)) FleetData[i].Index = 0;
}

export function SetEmpireDefenses(Emp) {
  const r = Rnd(1, 100);
  if (r <= 25) SetDefenseSettings(Emp, InitDefenseRecord());
  else if (r <= 75) SetDefenseSettings(Emp, Defense1);
  else if (r <= 85) SetDefenseSettings(Emp, Defense3);
  else SetDefenseSettings(Emp, Defense2);
}

export function PlunderWorld(Emp, FltID, TargetID) {
  if (Emp !== GetStatus(TargetID)) return;
  if (!bIn(FltID.Index, G.SetOfActiveFleets)) return;
  const FltSh = GetShips(FltID), FltCr = GetCargo(FltID);
  AddThings(FltSh, FltCr, GetShips(TargetID), GetCargo(TargetID));
  BalanceFleet(FltSh, FltCr);
  PutShips(FltID, FltSh);
  PutCargo(FltID, FltCr);
  PutShips(TargetID, ResArr());
  PutCargo(TargetID, ResArr());
  SetType(TargetID, IndTyp);
  SetStatus(TargetID, Indep);
}

export { MaxInt };
