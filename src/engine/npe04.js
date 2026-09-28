// NPE04.PAS: berserker empires (mobile command bases that raid and plunder).
import { bIn, Round, Random, int16 } from '../runtime/pascal.js';
import {
  G, gal, MaxNoOfStarbases, NoOfFleetsPerEmpire, Pln, Base, Flt, FReady, cmm, frt, men, nnj,
  che, met, tri, LAM, BioInd, TriInd, EmptyQuadrant, Limbo, cpID, cpXY, ResArr,
} from './types.js';
import { LesserInt, GreaterInt, Distance, SameID, MilitaryPower, Rnd } from './misc.js';
import {
  GetCoord, GetShips, GetDefns, GetCargo, GetStatus, GetBaseType, GetCapital, GetPopulation,
  SetPopulation, GetIndus, PutIndus, SetTech, NPEDataIndex, GetFleetStatus,
} from './primintr.js';
import { AbortFleet, DestroyFleet, SetFleetDestination } from './fleet.js';
import { AddNews, GetNewsList, N } from './news.js';
import { DefConqueredART, AttDestroyedART } from './attack.js';
import {
  BSRKAttackMSN, BSRKReturnMSN, AttackBMS, DefendBMS, FindHomeBMS, RefuelBMS, WaitForAttackBMS,
  WanderAroundBMS, newFleetDataArray, newBaseDataArray,
} from './npetypes.js';
import {
  MaxNoOfRegions, DeployBattleFleet, ImplementJumpAttackMSN, PlunderWorld, EnforceNPEDataLinks,
  CreateRegionArray, SetEmpireDefenses,
} from './npeintr.js';

const MinBasePower = 100000;
const MaxDistanceToHome = 10;

function randomXY() { return { x: Rnd(1, gal.SizeOfGalaxy), y: Rnd(1, gal.SizeOfGalaxy) }; }

function NewBSRKBaseTarget(Emp, BaseID, BaseData) {
  let BestDistance = 1000;
  let BestTargetID = null, BestTargetXY = null;
  const BaseXY = GetCoord(BaseID);
  const FltSh = GetShips(BaseID);
  const BaseLAMs = GetDefns(BaseID)[LAM];
  const BasePower = MilitaryPower(FltSh, ResArr());
  const bd = BaseData[BaseID.Index];
  if (BasePower < MinBasePower) {
    bd.Mission = FindHomeBMS;
    return;
  }
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    const T = { ObjTyp: Pln, Index: i };
    if (GetStatus(T) === Emp) continue;
    const TC = GetCargo(T);
    if (TC[met] + TC[che] > 2000 || TC[tri] > 1000) {
      const TS = GetShips(T);
      const TD = BaseLAMs < 4000 ? GetDefns(T) : ResArr();
      if (BasePower + Round(BasePower * Random()) > MilitaryPower(TS, TD)) {
        const TXY = GetCoord(T);
        if (Distance(TXY, BaseXY) < BestDistance) {
          BestDistance = Distance(TXY, BaseXY);
          BestTargetID = T;
          BestTargetXY = TXY;
        }
      }
    }
  }
  if (BestDistance < 1000) {
    bd.Mission = AttackBMS;
    bd.TargetID = BestTargetID;
    SetFleetDestination(BaseID, BestTargetXY);
  } else {
    bd.Mission = WanderAroundBMS;
    bd.Count = 0;
    SetFleetDestination(BaseID, randomXY());
  }
}

function BSRKDestroyWorld(Emp, TargetID) {
  const Owner = GetStatus(TargetID);
  const Loc = { ID: cpID(TargetID), XY: cpXY(Limbo) };
  AddNews(Owner, N.WHolo, Loc, 0, 0, 0);
  const Pop = GetPopulation(TargetID);
  const Deaths = LesserInt(Pop - 10, GreaterInt(Math.floor(Pop / 2), 100 + Rnd(1, 100))) & 0xFFFF;
  SetPopulation(TargetID, (Pop - Deaths) & 0xFFFF);
  AddNews(Owner, N.DthHolo, Loc, int16(Deaths), 0, 0);
  const Indus = GetIndus(TargetID);
  for (let i = BioInd; i <= TriInd; i++) {
    const IndLost = Rnd(1, 2) === 1 ? GreaterInt(Indus[i], Indus[i] - Rnd(10, 50)) : Math.floor(Indus[i] / 2);
    if (IndLost > 0) {
      Indus[i] -= IndLost;
      AddNews(Owner, N.IndDs, Loc, IndLost, i, 0);
    }
  }
  PutIndus(TargetID, Indus);
  const NewTech = Rnd(0, 2);
  SetTech(TargetID, NewTech);
  AddNews(Owner, N.RTech, Loc, NewTech, 0, 0);
}

function fd(FleetData, FltID) {
  const i = NPEDataIndex(FltID);
  return i >= 1 && i <= NoOfFleetsPerEmpire ? FleetData[i] : null;
}

function BSRKCourseCorrection(FltID, FleetData) {
  const f = fd(FleetData, FltID);
  if (f && f.Mission === BSRKReturnMSN) SetFleetDestination(FltID, GetCoord(f.TargetID));
}

function DeployBSRKAttackMSN(Emp, BaseID, TargetID, FleetData) {
  const Ships = GetShips(TargetID), Cargo = GetCargo(TargetID), Defns = GetDefns(TargetID);
  const TargetDefense = MilitaryPower(Ships, Defns);
  const TargetMen = Cargo[men] + 4 * Cargo[nnj] + 10;
  const FleetPower = (50000 + Rnd(2, 5) * TargetDefense + Math.trunc(TargetDefense / Rnd(2, 25))) | 0;
  const FleetGAT = 2 * TargetMen;
  DeployBattleFleet(Emp, FleetData, BaseID, FleetPower, FleetGAT, BSRKAttackMSN, TargetID);
}

function ImplementBSRKReturnMSN(Emp, FltID, BaseID, Data) {
  if (Emp === GetStatus(BaseID)) {
    AbortFleet(FltID, BaseID, true);
    DestroyFleet(FltID);
    if (BaseID.ObjTyp === Base) NewBSRKBaseTarget(Emp, BaseID, Data.BaseData);
  } else DestroyFleet(FltID);
}

function ImplementBSRKAttackMSN(Emp, FltID, BaseID, TargetID, Data) {
  const Result = ImplementJumpAttackMSN(Emp, FltID, TargetID, BaseID, Data.FleetData);
  if (Result === DefConqueredART) {
    PlunderWorld(Emp, FltID, TargetID);
    if (Rnd(1, 3) === 1) BSRKDestroyWorld(Emp, TargetID);
  }
  if (Result === AttDestroyedART) {
    if (BaseID.ObjTyp === Base) NewBSRKBaseTarget(Emp, BaseID, Data.BaseData);
  } else if (bIn(FltID.Index, G.SetOfActiveFleets)) {
    const f = fd(Data.FleetData, FltID);
    if (f) { f.Mission = BSRKReturnMSN; f.TargetID = cpID(BaseID); }
    SetFleetDestination(FltID, GetCoord(BaseID));
  }
}

function ImplementAttackBMS(Emp, BaseID, Data) {
  const bd = Data.BaseData[BaseID.Index];
  const STyp = GetBaseType(BaseID);
  const Dist = Distance(GetCoord(BaseID), GetCoord(bd.TargetID));
  if ((STyp === frt && Dist <= 5) || Dist === 1) {
    DeployBSRKAttackMSN(Emp, BaseID, bd.TargetID, Data.FleetData);
    bd.Mission = WaitForAttackBMS;
    bd.Count = 0;
  }
}

function ImplementFindHomeBMS(Emp, BaseID, RCap, BaseData) {
  let BestDistance = 1000, BestHomeID = null;
  const BaseXY = GetCoord(BaseID);
  for (let i = 1; i <= MaxNoOfRegions; i++) {
    if (SameID(RCap[i], EmptyQuadrant)) continue;
    const d = Distance(GetCoord(RCap[i]), BaseXY);
    if (d < BestDistance) { BestDistance = d; BestHomeID = RCap[i]; }
  }
  const bd = BaseData[BaseID.Index];
  if (BestDistance <= MaxDistanceToHome) {
    bd.Mission = RefuelBMS;
    bd.TargetID = cpID(BestHomeID);
    SetFleetDestination(BaseID, GetCoord(BestHomeID));
  } else {
    bd.Mission = WanderAroundBMS;
    bd.Count = 0;
    SetFleetDestination(BaseID, randomXY());
  }
}

function ImplementRefuelBMS(Emp, BaseID, Data) {
  const bd = Data.BaseData[BaseID.Index];
  if (Distance(GetCoord(BaseID), GetCoord(bd.TargetID)) < 5 && GetStatus(bd.TargetID) === Emp) {
    DeployBattleFleet(Emp, Data.FleetData, bd.TargetID, 9000000, 9000000, BSRKReturnMSN, BaseID);
    bd.Mission = WaitForAttackBMS;
    bd.Count = 0;
  }
}

function ImplementWaitForAttackBMS(Emp, BaseID, BaseData) {
  const bd = BaseData[BaseID.Index];
  if (bd.Count > 10) NewBSRKBaseTarget(Emp, BaseID, BaseData);
  else if (bd.Count === 3) {
    SetFleetDestination(BaseID, GetCoord(BaseID));
    bd.Count++;
  } else bd.Count++;
}

function ImplementWanderAroundBMS(Emp, BaseID, BaseData) {
  const bd = BaseData[BaseID.Index];
  if (bd.Count > 10) NewBSRKBaseTarget(Emp, BaseID, BaseData);
  else bd.Count++;
}

function BSRKReviewNews(Emp, Data) {
  for (const n of GetNewsList(Emp)) {
    if (n.Headline !== N.BseBlocked || n.Loc1.ID.ObjTyp !== Base) continue;
    const BaseID = n.Loc1.ID;
    const bd = Data.BaseData[BaseID.Index];
    const BaseXY = GetCoord(BaseID), TargetXY = GetCoord(bd.TargetID);
    switch (bd.Mission) {
      case AttackBMS:
        if (Distance(BaseXY, TargetXY) < 8) {
          DeployBSRKAttackMSN(Emp, BaseID, bd.TargetID, Data.FleetData);
          bd.Mission = WaitForAttackBMS;
          bd.Count = 0;
        } else {
          bd.Mission = WanderAroundBMS;
          bd.Count = 0;
          SetFleetDestination(BaseID, randomXY());
        }
        break;
      case RefuelBMS:
        bd.Mission = WanderAroundBMS;
        bd.Count = 0;
        SetFleetDestination(BaseID, randomXY());
        break;
      case WaitForAttackBMS: SetFleetDestination(BaseID, BaseXY); break;
      case WanderAroundBMS: SetFleetDestination(BaseID, randomXY()); break;
    }
  }
}

function UpdateBases(Emp, RCap, Data) {
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfStarbasesOf[Emp])) continue;
    const BaseID = { ObjTyp: Base, Index: i };
    const STyp = GetBaseType(BaseID);
    if (STyp !== cmm && STyp !== frt) continue;
    switch (Data.BaseData[i].Mission) {
      case AttackBMS: ImplementAttackBMS(Emp, BaseID, Data); break;
      case DefendBMS: break;
      case FindHomeBMS: ImplementFindHomeBMS(Emp, BaseID, RCap, Data.BaseData); break;
      case RefuelBMS: ImplementRefuelBMS(Emp, BaseID, Data); break;
      case WaitForAttackBMS: ImplementWaitForAttackBMS(Emp, BaseID, Data.BaseData); break;
      case WanderAroundBMS: ImplementWanderAroundBMS(Emp, BaseID, Data.BaseData); break;
      default: NewBSRKBaseTarget(Emp, BaseID, Data.BaseData);
    }
  }
}

function UpdateFleets(Emp, Data) {
  for (let i = 1; i <= NoOfFleetsPerEmpire; i++) {
    const idx = Data.FleetData[i].Index;
    if (!(idx > 0 && bIn(idx, G.SetOfActiveFleets))) continue;
    const FltID = { ObjTyp: Flt, Index: idx };
    BSRKCourseCorrection(FltID, Data.FleetData);
    if (GetFleetStatus(FltID) !== FReady) continue;
    const f = Data.FleetData[i];
    switch (f.Mission) {
      case BSRKReturnMSN: ImplementBSRKReturnMSN(Emp, FltID, { ...f.TargetID }, Data); break;
      case BSRKAttackMSN: ImplementBSRKAttackMSN(Emp, FltID, { ...f.HomeBaseID }, { ...f.TargetID }, Data); break;
      default: DestroyFleet(FltID);
    }
  }
}

export function InitializeBerserkerNPE(Emp) {
  const Data = { FleetData: newFleetDataArray(), BaseData: newBaseDataArray() };
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfStarbasesOf[Emp])) continue;
    const BaseID = { ObjTyp: Base, Index: i };
    const STyp = GetBaseType(BaseID);
    if (STyp === cmm || STyp === frt) NewBSRKBaseTarget(Emp, BaseID, Data.BaseData);
  }
  SetEmpireDefenses(Emp);
  return Data;
}

export function ImplementBerserkerNPE(Emp, Data) {
  EnforceNPEDataLinks(Emp, Data.FleetData);
  const RCap = CreateRegionArray(Emp);
  BSRKReviewNews(Emp, Data);
  UpdateFleets(Emp, Data);
  UpdateBases(Emp, RCap, Data);
}

export { GetCapital };
