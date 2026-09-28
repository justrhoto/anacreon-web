// NPE00.PAS: kingdom empire behaviours.
import { bIn, Round, Random } from '../runtime/pascal.js';
import {
  G, MaxNoOfFleets, NoOfFleetsPerEmpire, Empire1, Empire8, Indep, Pln, Base, Gate, Flt,
  BseTyp, CapTyp, fgt, jtn, men, nnj, met, tri, LAM, EmptyQuadrant, cpID, ResArr,
} from './types.js';
import { MPower, FuelPerTon } from './datacnst.js';
import {
  LesserInt, GreaterInt, Distance, SameID, SameXY, MilitaryPower, Rnd, RndVar, NoShips,
  FuelCapacity, FleetCargoSpace, InGalaxy, ISqrt,
} from './misc.js';
import {
  GetShips, GetCargo, GetDefns, PutDefns, GetStatus, GetType, GetCoord, GetCapital, Scouted,
  GetProbe, LaunchProbe, EmpireActive,
} from './primintr.js';
import { DesignateWorld } from './intrface.js';
import { DeployFleet, AbortFleet, DestroyFleet } from './fleet.js';
import { LAMAttack, CaptTrnAIT, AttDestroyedART, DefConqueredART } from './attack.js';
import { NPEAttack } from './attnpe.js';
import { GetNewsList, N } from './news.js';
import {
  ReturnMSN, StackMSN, GuardMSN, ConquerMSN, JumpAttackMSN, RaidTrnMSN, RefuelMSN, SupplyMSN,
  SupplyTrnMSN, NeutralPLT, HarassPLT, PreemptPLT, ConflictPLT, WarPLT,
} from './npetypes.js';
import {
  MaxNoOfRegions, MaxNoOfGuards, MaxNoOfRaiders, AverageMilitaryPower, GetRegionalCapital,
  DeployCargoFleet, DeployBattleFleet, GetPotentialRes, MinimumDefense, GetFleetComposition,
  GetBestPlanetToProtect, GetBestTarget, DeployHKRaiders, DeployJumpAttack, DeploySlowAttack,
  AlreadyTargetted, GetNewDesignation,
} from './npeintr.js';

const NullDf = () => ResArr();

function RNIndustryLack(Emp, ID, RCap, FleetData) {
  const Cr = ResArr();
  Cr[met] = 1000;
  CargoSupplyFleet(Emp, ID, Cr, RCap, FleetData);
}

function RespondToEnemyAttack(Emp, AttEmp, Severity, Persona, State) {
  const s = State[AttEmp];
  switch (s.Policy) {
    case NeutralPLT:
      s.Policy = Severity > 50 && Rnd(1, 100) < Persona.Provoke ? PreemptPLT : HarassPLT;
      break;
    case HarassPLT:
      if (Severity > 50 && Rnd(1, 100) < Persona.Provoke) s.Policy = ConflictPLT;
      else if (Rnd(1, 100) < Persona.Provoke) s.Policy = PreemptPLT;
      break;
    case PreemptPLT:
      if (Severity > 35 && Rnd(1, 100) <= Persona.Provoke) s.Policy = ConflictPLT;
      break;
    case ConflictPLT:
      if (Severity > 75 && Rnd(1, 100) <= Math.floor(Persona.Provoke / 2)) s.Policy = WarPLT;
      break;
  }
  const AggInc = 10 + Round(Severity / 5);
  if (s.Aggressiveness + AggInc > 100) s.Aggressiveness = 100;
  else if (AggInc > 0 && s.Aggressiveness + AggInc < 35) s.Aggressiveness = 35;
  else s.Aggressiveness = (s.Aggressiveness + AggInc) & 0xFF;
}

function AttackSeverity(list, idx, BasePower) {
  let Total = 1;
  for (let k = idx + 1; k < list.length && list[k].Headline === N.DestDetail; k++)
    Total += list[k].Parm1 * (MPower[list[k].Parm2] || 0);
  if (BasePower === 0) BasePower = 1;
  return LesserInt(100, 10 + Round(50 * Total / BasePower));
}

function SendRescueFleet(Emp, FltID, RCap, FleetData) {
  if (FltID.ObjTyp !== Flt || !bIn(FltID.Index, G.SetOfActiveFleets)) return;
  const BaseID = GetRegionalCapital(FltID, RCap);
  const FuelNeeded = 1 + Round(FuelCapacity(GetShips(FltID)) / FuelPerTon);
  const JtnNeeded = 1 + Round(FuelNeeded / 10);
  const Sh = GetShips(BaseID), Cr = GetCargo(BaseID);
  if (Sh[jtn] > JtnNeeded && Cr[tri] > FuelNeeded) {
    const c = ResArr();
    c[tri] = FuelNeeded;
    DeployCargoFleet(Emp, FleetData, BaseID, c, true, RefuelMSN, FltID);
  }
}

export function ReviewNews(Emp, FleetData, RCap, Persona, State) {
  const BasePower = AverageMilitaryPower(RCap);
  const list = GetNewsList(Emp);
  for (let k = 0; k < list.length; k++) {
    const n = list[k];
    switch (n.Headline) {
      case N.BattleL: case N.BattleW1: case N.BattleW2: case N.ConDs: case N.GteDs:
      case N.LAMDm: case N.LAMDs: case N.LAMDef: {
        const att = n.Parm1 >= 0 && n.Parm1 <= 8 ? n.Parm1 : Indep;
        if (n.Headline === N.BattleL && [Pln, Base, Gate].includes(n.Loc1.ID.ObjTyp)) State[att].Balance--;
        else if (Rnd(1, 100) < 25) State[att].Balance--;
        const Severity = AttackSeverity(list, k, BasePower);
        RespondToEnemyAttack(Emp, att, Severity, Persona, State);
        break;
      }
      case N.NoFuel: SendRescueFleet(Emp, n.Loc1.ID, RCap, FleetData); break;
      case N.IndLack: RNIndustryLack(Emp, n.Loc1.ID, RCap, FleetData); break;
    }
  }
}

function AttackEnemyFleets(Emp, ID, BaseID) {
  const XY = GetCoord(ID), BaseXY = GetCoord(BaseID);
  const Enemy = G.SetOfActiveFleets & ~G.SetOfFleetsOf[Emp];
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    const FltID = { ObjTyp: Flt, Index: i };
    if (!(bIn(i, Enemy) && bIn(i, G.SetOfActiveFleets) && Scouted(Emp, FltID))) continue;
    if (!SameXY(GetCoord(FltID), XY)) continue;
    const FltSh = GetShips(FltID);
    const MPow = MilitaryPower(FltSh, NullDf());
    if (MPow > 30000 && Distance(BaseXY, XY) <= 5) {
      const Df = GetDefns(BaseID);
      if (Df[LAM] > 500 && Rnd(1, 100) < 50) {
        LAMAttack(Emp, Df[LAM], FltID);
        const Df2 = GetDefns(BaseID);
        Df2[LAM] = 0;
        PutDefns(BaseID, Df2);
      }
    }
    if (bIn(i, G.SetOfActiveFleets)) {
      const Df = GetDefns(BaseID);
      const { Ships: Sh, Cargo: Cr } = GetFleetComposition(ID, MPow * 2, 0, JumpAttackMSN);
      if (!NoShips(Sh) && (MilitaryPower(Sh, Df) < MPow || MilitaryPower(Sh, NullDf()) > MPow)) {
        const BattleID = DeployFleet(Emp, ID, Sh, Cr, XY);
        if (!SameID(BattleID, EmptyQuadrant) && bIn(BattleID.Index, G.SetOfActiveFleets)) {
          const Result = NPEAttack(BattleID, FltID, CaptTrnAIT, 0);
          if (Result !== AttDestroyedART && bIn(BattleID.Index, G.SetOfActiveFleets)) {
            AbortFleet(BattleID, ID, true);
            DestroyFleet(BattleID);
          }
        }
      }
    }
  }
}

function NoOfGuardsAtBase(Emp, BaseID, FleetData) {
  let n = 0;
  const BaseXY = GetCoord(BaseID);
  for (let i = 1; i <= NoOfFleetsPerEmpire; i++) {
    const f = FleetData[i];
    if (bIn(f.Index, G.SetOfActiveFleets) && f.Mission === GuardMSN &&
        SameXY(GetCoord({ ObjTyp: Flt, Index: f.Index }), BaseXY)) n++;
  }
  return n;
}

function GetBestBaseToProtect(Emp, RCap, FleetData, FromID) {
  let Lowest = MaxNoOfGuards;
  let Best = cpID(EmptyQuadrant);
  for (let i = 1; i <= MaxNoOfRegions; i++) {
    if (!SameID(RCap[i], EmptyQuadrant) && !SameID(RCap[i], FromID)) {
      const g = NoOfGuardsAtBase(Emp, RCap[i], FleetData);
      if (g < Lowest) { Lowest = g; Best = RCap[i]; }
    }
  }
  return Best;
}

export function DefendEmpire(Emp, RCap, FleetData, Persona) {
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const ID = { ObjTyp: Pln, Index: i };
    const t = GetType(ID);
    if (t !== BseTyp && t !== CapTyp) {
      const { Ships, Cargo } = GetPotentialRes(ID, FleetData);
      const PowerAvail = MilitaryPower(Ships, GetDefns(ID));
      const ShipPower = MilitaryPower(Ships, NullDf());
      const OptimumPower = MinimumDefense(ID, Persona);
      const OptimumGAT = Math.trunc(OptimumPower / 20);
      const GATPower = Cargo[men] + 3 * Cargo[nnj];
      const BaseID = GetRegionalCapital(ID, RCap);
      AttackEnemyFleets(Emp, ID, BaseID);
      const PowerDiff = (OptimumPower - PowerAvail) | 0;
      let GATDiff = OptimumGAT - GATPower;
      if (LesserInt(ShipPower, Math.abs(PowerDiff)) > 10000) {
        if (PowerAvail < OptimumPower) {
          const BaseCargo = GetCargo(BaseID);
          const MaxBaseGAT = GreaterInt(0, (BaseCargo[men] + 3 * BaseCargo[nnj]) - 3000);
          GATDiff = LesserInt(MaxBaseGAT, GreaterInt(0, GATDiff));
          DeployBattleFleet(Emp, FleetData, BaseID, PowerDiff, GATDiff, ReturnMSN, ID);
        } else if (NoOfGuardsAtBase(Emp, BaseID, FleetData) < MaxNoOfGuards) {
          GATDiff = GreaterInt(0, -GATDiff);
          DeployBattleFleet(Emp, FleetData, ID, -PowerDiff, GATDiff, StackMSN, BaseID);
        }
      }
    } else {
      AttackEnemyFleets(Emp, ID, ID);
      if (NoOfGuardsAtBase(Emp, ID, FleetData) === MaxNoOfGuards) {
        const WorldID = GetBestPlanetToProtect(ID);
        if (!SameID(WorldID, EmptyQuadrant))
          DeployBattleFleet(Emp, FleetData, ID, 9000 * MPower[fgt], 0, ReturnMSN, WorldID);
        const BaseID = GetBestBaseToProtect(Emp, RCap, FleetData, ID);
        if (!SameID(BaseID, EmptyQuadrant))
          DeployBattleFleet(Emp, FleetData, ID, 150000, 0, StackMSN, BaseID);
      }
    }
  }
}

export function ImperialExpansion(Emp, RCap, FleetData, Persona) {
  if (Rnd(1, 100) <= Persona.Imperialist) {
    const BasePower = AverageMilitaryPower(RCap);
    const Threshold = (2 + 10 - Math.floor(Persona.SphereX / 10)) & 0xFFFF;
    let Poss = 0n;
    for (let i = 1; i <= G.NoOfPlanets; i++) {
      const W = { ObjTyp: Pln, Index: i };
      if (GetStatus(W) === Indep) {
        const BaseID = GetRegionalCapital(W, RCap);
        if (Distance(GetCoord(W), GetCoord(BaseID)) <= Threshold) Poss |= 1n << BigInt(i);
      }
    }
    const t = GetBestTarget(Emp, Poss, BasePower, Persona, FleetData);
    if (!SameID(t.TargetID, EmptyQuadrant)) {
      const FleetPower = Round((1.5 + Random()) * t.TargetDefense);
      const FleetGAT = Round(1.5 * t.TargetMen);
      const BaseID = GetRegionalCapital(t.TargetID, RCap);
      if (MilitaryPower(GetShips(BaseID), NullDf()) > t.TargetDefense)
        DeployBattleFleet(Emp, FleetData, BaseID, FleetPower, FleetGAT, ConquerMSN, t.TargetID);
    }
  }
  // ModifyPersona
  const p = Persona;
  if (Rnd(1, 100) <= p.RandomGene) {
    const Delta = RndVar(p.ImpGene, p.FactorGene) - RndVar(p.Imperialist, p.FactorGene);
    const Temp = p.Imperialist + Round((Delta / 12) * p.FactorGene);
    p.Imperialist = Temp > 100 ? 100 : Temp < 0 ? 0 : Temp;
  }
}

export function WarCabinet(Emp, RCap, FleetData, Persona, State) {
  const raidersOut = () => {
    let c = 0;
    for (let i = 1; i <= NoOfFleetsPerEmpire; i++)
      if (FleetData[i].Index > 0 && FleetData[i].Mission === RaidTrnMSN) c++;
    return c;
  };
  for (let e = Empire1; e <= Empire8; e++) {
    if (!EmpireActive(e)) continue;
    const s = State[e];
    const NoOfRaidersOut = raidersOut();
    if (NoOfRaidersOut < MaxNoOfRaiders &&
        (s.Balance < 0 || (s.Policy >= HarassPLT && Rnd(1, 100) <= s.AttackChance)))
      DeployHKRaiders(Emp, e, RCap, FleetData);

    if ((s.Balance < 0 && Rnd(1, 2) === 1) || Rnd(1, 100) <= s.AttackChance) {
      switch (s.Policy) {
        case HarassPLT:
          if (NoOfRaidersOut < MaxNoOfRaiders) DeployHKRaiders(Emp, e, RCap, FleetData);
          break;
        case PreemptPLT:
          if (Rnd(1, 100) <= 50) { if (NoOfRaidersOut < MaxNoOfRaiders) DeployHKRaiders(Emp, e, RCap, FleetData); }
          else DeployJumpAttack(Emp, e, RCap, Persona, FleetData);
          break;
        case ConflictPLT:
          if (Rnd(1, 100) <= 75) DeployJumpAttack(Emp, e, RCap, Persona, FleetData);
          else DeploySlowAttack(Emp, e, RCap, Persona, FleetData);
          break;
        case WarPLT:
          if (Rnd(1, 100) <= 50) DeployJumpAttack(Emp, e, RCap, Persona, FleetData);
          else DeploySlowAttack(Emp, e, RCap, Persona, FleetData);
          break;
      }
    }

    if (Rnd(1, 100) <= s.Aggressiveness) {
      const CapXY = GetCoord(GetCapital(e));
      const n = Rnd(1, 4);
      for (let k = 1; k <= n; k++) {
        const x = Rnd(CapXY.x - 4, CapXY.x + 4), y = Rnd(CapXY.y - 4, CapXY.y + 4);
        if (InGalaxy(x, y)) {
          const PNum = GetProbe(Emp);
          if (PNum !== 0) LaunchProbe(Emp, PNum, { x, y });
        }
      }
    }
  }
}

function GetClosestCargoWorld(Emp, WorldID, Cr) {
  const XY = GetCoord(WorldID);
  let ClosestDist = 99;
  let Closest = cpID(EmptyQuadrant);
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const O = { ObjTyp: Pln, Index: i };
    const OXY = GetCoord(O);
    if (Distance(OXY, XY) < ClosestDist) {
      const OC = GetCargo(O);
      let r = men;
      while (r <= tri && OC[r] >= Cr[r]) r++;
      if (r === tri + 1) { Closest = O; ClosestDist = Distance(OXY, XY); }
    }
  }
  return Closest;
}

export function CargoSupplyFleet(Emp, WorldID, Cr, RCap, FleetData) {
  const CargoID = GetClosestCargoWorld(Emp, WorldID, Cr);
  if (SameID(CargoID, EmptyQuadrant)) return;
  if (FleetCargoSpace(GetShips(CargoID), Cr) > 0) {
    if (!AlreadyTargetted(Emp, WorldID, SupplyMSN, FleetData))
      DeployCargoFleet(Emp, FleetData, CargoID, Cr, true, SupplyMSN, WorldID);
  } else if (!AlreadyTargetted(Emp, CargoID, SupplyTrnMSN, FleetData)) {
    const BaseID = GetRegionalCapital(CargoID, RCap);
    DeployCargoFleet(Emp, FleetData, BaseID, Cr, false, SupplyTrnMSN, CargoID);
  }
}

export function NPEConquest(Emp, WorldID, Result, RCap, Persona) {
  if (Result === DefConqueredART && Emp === GetStatus(WorldID)) {
    const NewTyp = GetNewDesignation(WorldID, Persona, RCap);
    if (NewTyp !== GetType(WorldID)) DesignateWorld(WorldID, NewTyp);
  }
}

export function ExplorationAndProbing(Emp, RCap, Persona) {
  const MaxProbeDist = 24 - 2 * ISqrt(Persona.SphereX);
  let NoMoreProbes = false;
  let guard = 0;
  do {
    let any = false;
    for (let i = 1; i <= MaxNoOfRegions; i++) {
      if (SameID(RCap[i], EmptyQuadrant)) continue;
      any = true;
      const B = GetCoord(RCap[i]);
      const x = Rnd(B.x - MaxProbeDist, B.x + MaxProbeDist);
      const y = Rnd(B.y - MaxProbeDist, B.y + MaxProbeDist);
      if (InGalaxy(x, y)) {
        const PNum = GetProbe(Emp);
        if (PNum !== 0) LaunchProbe(Emp, PNum, { x, y });
        else NoMoreProbes = true;
      }
    }
    if (!any) break;
  } while (!NoMoreProbes && ++guard < 1000);
}
