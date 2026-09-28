// NPE01.PAS: pirate empires.
import { bIn } from '../runtime/pascal.js';
import {
  G, gal, MaxNoOfFleets, NoOfFleetsPerEmpire, Void, Pln, Flt, FReady, AtomicLvl, fgt, hkr,
  jmp, jtn, pen, ssp, trn, men, nnj, che, met, tri, sup, def, GDM, ion, EmptyQuadrant, cpID, cpXY,
  ResArr,
} from './types.js';
import { LesserInt, GreaterInt, Distance, SameXY, Rnd, RndVar, NoShips } from './misc.js';
import {
  GetShips, GetCargo, GetDefns, PutShips, PutCargo, GetCoord, GetObject, GetFleetStatus,
  GetTech, GetFleets, SetNPEDataIndex, NPEDataIndex,
} from './primintr.js';
import { BalanceFleet, GetNearestWorlds } from './intrface.js';
import { DeployFleet, DestroyFleet, SetFleetDestination, GetFleetDestination, GetNewPos } from './fleet.js';
import { CaptTrnAIT, DefConqueredART } from './attack.js';
import { NPEAttack } from './attnpe.js';
import { GetNewsList, N } from './news.js';
import { ReturnMSN, WaitForTrnMSN, AttackTrnMSN, AttackWrldMSN, newFleetDataArray, MaxNoOfBlocks } from './npetypes.js';
import {
  ImplementReturnMSN, NextFleetDataSlot, EnforceNPEDataLinks, SetEmpireDefenses, PlunderWorld,
} from './npeintr.js';

function FindTarget(Emp, FltID) {
  const targets = G.SetOfActiveFleets & ~G.SetOfFleetsOf[Emp];
  const FltXY = GetCoord(FltID);
  const FltSh = GetShips(FltID);
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, targets)) continue;
    const T = { ObjTyp: Flt, Index: i };
    if (Distance(GetCoord(T), FltXY) <= 5) {
      const Sh = GetShips(T);
      if (Sh[jtn] + Sh[trn] > 0 && Sh[jmp] + Sh[hkr] <= FltSh[jmp] + FltSh[hkr] &&
          Sh[pen] + Sh[ssp] <= Math.floor(FltSh[hkr] / 2)) return T;
    }
  }
  return cpID(EmptyQuadrant);
}

function FindNearestBase(Emp, XY) {
  const l = GetNearestWorlds(XY, 1, G.SetOfPlanetsOf[Emp]);
  return l.length ? GetCoord(l[0]) : cpXY(XY);
}

function hg(Data, x, y) { return x >= 1 && y >= 1 && x <= MaxNoOfBlocks && y <= MaxNoOfBlocks; }

function UpdateFleets(Emp, Data) {
  for (let i = 1; i <= NoOfFleetsPerEmpire; i++) {
    const f = Data.FleetData[i];
    if (!bIn(f.Index, G.SetOfActiveFleets)) continue;
    const FltID = { ObjTyp: Flt, Index: f.Index };
    if (GetFleetStatus(FltID) !== FReady) continue;
    const FltXY = GetCoord(FltID);
    switch (f.Mission) {
      case ReturnMSN:
        ImplementReturnMSN(FltID, GetObject(FltXY));
        break;
      case WaitForTrnMSN: {
        f.TargetID = FindTarget(Emp, FltID);
        if (f.TargetID.ObjTyp === Void) {
          if (f.Waiting === 0) {
            SetFleetDestination(FltID, FindNearestBase(Emp, FltXY));
            f.Mission = ReturnMSN;
            if (hg(Data, f.BlockX, f.BlockY))
              Data.HuntingGround[f.BlockX][f.BlockY] = (Data.HuntingGround[f.BlockX][f.BlockY] - 5) & 0xFF;
          } else f.Waiting--;
        } else {
          let TargetXY = GetCoord(f.TargetID);
          const TargetDestXY = GetFleetDestination(f.TargetID);
          TargetXY = GetNewPos(TargetXY, TargetDestXY);
          SetFleetDestination(FltID, TargetXY);
          f.Waiting = Rnd(1, 2);
          f.Mission = AttackTrnMSN;
          if (hg(Data, f.BlockX, f.BlockY))
            Data.HuntingGround[f.BlockX][f.BlockY] = (Data.HuntingGround[f.BlockX][f.BlockY] + 15) & 0xFF;
        }
        break;
      }
      case AttackTrnMSN: {
        const TargetXY = GetCoord(f.TargetID);
        if (SameXY(TargetXY, FltXY) && bIn(f.TargetID.Index, G.SetOfActiveFleets)) {
          f.Mission = ReturnMSN;
          f.Waiting = 0;
          SetFleetDestination(FltID, FindNearestBase(Emp, FltXY));
          NPEAttack(FltID, f.TargetID, CaptTrnAIT, 0);
          if (bIn(FltID.Index, G.SetOfActiveFleets)) {
            const Sh = GetShips(FltID), Cr = GetCargo(FltID);
            Sh[fgt] = 0;
            Sh[trn] = 0;
            BalanceFleet(Sh, Cr);
            PutShips(FltID, Sh);
            PutCargo(FltID, Cr);
          }
        } else if (f.Waiting === 0) {
          f.Mission = ReturnMSN;
          SetFleetDestination(FltID, FindNearestBase(Emp, FltXY));
        } else f.Waiting--;
        break;
      }
      case AttackWrldMSN: {
        const TargetXY = GetCoord(f.TargetID);
        const At = GetFleets(TargetXY) & ~G.SetOfFleetsOf[Emp];
        let Abort = false;
        if (At !== 0n) {
          for (let j = 1; j <= MaxNoOfFleets; j++) {
            if (bIn(j, At) && !Abort) {
              if (!bIn(FltID.Index, G.SetOfActiveFleets) || !bIn(j, G.SetOfActiveFleets)) { Abort = true; break; }
              const r = NPEAttack(FltID, { ObjTyp: Flt, Index: j }, CaptTrnAIT, 0);
              if (r !== DefConqueredART) Abort = true;
            }
          }
        }
        if (!bIn(FltID.Index, G.SetOfActiveFleets)) break;
        f.Mission = ReturnMSN;
        f.Waiting = 0;
        SetFleetDestination(FltID, FindNearestBase(Emp, FltXY));
        if (!Abort) {
          const r = NPEAttack(FltID, f.TargetID, CaptTrnAIT, 0);
          if (r === DefConqueredART) PlunderWorld(Emp, FltID, f.TargetID);
        }
        break;
      }
    }
  }
}

// Returns { BX, BY, XY } or null if no destination
function GetPatrolDestination(HG) {
  const Max = Math.floor(gal.SizeOfGalaxy / 5);
  let Total = 0;
  for (let x = 1; x <= Max; x++) for (let y = 1; y <= Max; y++) Total += HG[x][y];
  let RN = Rnd(1, Total & 0xFFFF);
  for (let x = 1; x <= Max; x++) {
    for (let y = 1; y <= Max; y++) {
      if (RN <= HG[x][y]) return { BX: x, BY: y, XY: { x: Rnd(1 + (x - 1) * 5, x * 5), y: Rnd(1 + (y - 1) * 5, y * 5) } };
      RN -= HG[x][y];
    }
  }
  return null;
}

function DeployRaiders(Emp, Data) {
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const BaseID = { ObjTyp: Pln, Index: i };
    const Ships = GetShips(BaseID), Cargo = GetCargo(BaseID);
    const FltSh = ResArr(), FltCr = ResArr();
    if (!(Ships[hkr] > 1500 && Ships[jmp] > 2500 && Ships[jtn] > 4000)) continue;
    FltSh[hkr] = LesserInt(Rnd(1500, 5000), Ships[hkr]);
    FltSh[jmp] = LesserInt(Rnd(2500, 9500), Ships[jmp]);
    FltSh[jtn] = LesserInt(Rnd(4000, 9500), Ships[jtn]);
    FltCr[men] = LesserInt(Math.floor(Ships[jtn] / 2), Cargo[men]);

    // GetTarget
    const GAT = FltCr[men];
    const Possible = new Array(G.NoOfPlanets + 1).fill(0);
    const FltPower = GreaterInt(1, FltSh[jmp] + 2 * FltSh[hkr]);
    for (let k = 1; k <= G.NoOfPlanets; k++) {
      if (bIn(k, G.SetOfPlanetsOf[Emp])) continue;
      const T = { ObjTyp: Pln, Index: k };
      if (GetTech(T) >= AtomicLvl) {
        const Sh = GetShips(T), Cr = GetCargo(T), Df = GetDefns(T);
        const Gain = Cr[che] + Cr[met] + 5 * Cr[tri] + Math.floor(Cr[sup] / 2);
        const Protect = 10 * Df[def] + Df[GDM] + 5 * Df[ion] + 2 * Sh[hkr] + Sh[jmp] + 4 * Sh[pen] + 10 * Sh[ssp];
        if (Protect < FltPower && GAT > Cr[men] + 2 * Cr[nnj])
          Possible[k] = Math.round((1 - Protect / FltPower) * Math.floor(Gain / 10));
      }
    }
    let Best = 0, BestValue = 0;
    for (let k = 1; k <= G.NoOfPlanets; k++) {
      if (RndVar(Possible[k], 25) > BestValue) { Best = k; BestValue = Possible[k]; }
    }
    if (Best !== 0) {
      const TargID = { ObjTyp: Pln, Index: Best };
      const Slot = NextFleetDataSlot(Data.FleetData);
      if (Slot !== 0) {
        const FltID = DeployFleet(Emp, BaseID, FltSh, FltCr, GetCoord(TargID));
        if (FltID.ObjTyp !== Void && bIn(FltID.Index, G.SetOfActiveFleets)) {
          SetNPEDataIndex(FltID, Slot);
          const f = Data.FleetData[Slot];
          f.Mission = AttackWrldMSN;
          f.Waiting = 1;
          f.TargetID = TargID;
          f.Index = FltID.Index;
        }
      }
    }
  }
}

function DeployNewFleets(Emp, Data) {
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const BaseID = { ObjTyp: Pln, Index: i };
    const Ships = GetShips(BaseID);
    const FltSh = ResArr(), FltCr = ResArr();
    if (Ships[jtn] > 4000 && Ships[jmp] > 2000) {
      FltSh[hkr] = LesserInt(Rnd(1000, 5000), Ships[hkr]);
      FltSh[jmp] = LesserInt(Rnd(1900, 9200), Ships[jmp]);
      FltSh[jtn] = LesserInt(Rnd(3900, 9200), Ships[jtn]);
    } else if (Ships[jtn] > 1000 && Ships[jmp] > 1000 && Rnd(1, 100) <= 75) {
      FltSh[jmp] = LesserInt(Rnd(900, 3100), Ships[jmp]);
      FltSh[jtn] = LesserInt(Rnd(1900, 2100), Ships[jtn]);
    } else if (Ships[hkr] > 250) {
      FltSh[hkr] = LesserInt(Rnd(400, 2500), Ships[hkr]);
    }
    if (NoShips(FltSh)) continue;
    const pd = GetPatrolDestination(Data.HuntingGround);
    if (!pd) continue;
    const Slot = NextFleetDataSlot(Data.FleetData);
    if (Slot === 0) continue;
    const FltID = DeployFleet(Emp, BaseID, FltSh, FltCr, pd.XY);
    if (FltID.ObjTyp === Void || !bIn(FltID.Index, G.SetOfActiveFleets)) continue;
    SetNPEDataIndex(FltID, Slot);
    const f = Data.FleetData[Slot];
    f.Mission = WaitForTrnMSN;
    f.Waiting = Rnd(2, 5);
    f.BlockX = pd.BX;
    f.BlockY = pd.BY;
    f.Index = FltID.Index;
  }
}

function ReviewNews(Emp, Data) {
  const list = GetNewsList(Emp);
  for (let k = 0; k < list.length; k++) {
    const n = list[k];
    if (n.Headline === N.FltBlocked) {
      const FltID = n.Loc1.ID;
      if (FltID.ObjTyp !== Flt || !bIn(FltID.Index, G.SetOfActiveFleets)) continue;
      const pd = GetPatrolDestination(Data.HuntingGround);
      if (!pd) continue;
      SetFleetDestination(FltID, pd.XY);
      const idx = NPEDataIndex(FltID);
      if (idx >= 1 && idx <= NoOfFleetsPerEmpire) {
        Data.FleetData[idx].BlockX = pd.BX;
        Data.FleetData[idx].BlockY = pd.BY;
      }
    } else if (n.Headline === N.NoFuel) {
      if (n.Loc1.ID.ObjTyp === Flt) DestroyFleet(n.Loc1.ID);
    }
  }
}

export function ImplementPirateNPE(Emp, Data) {
  EnforceNPEDataLinks(Emp, Data.FleetData);
  ReviewNews(Emp, Data);
  DeployRaiders(Emp, Data);
  DeployNewFleets(Emp, Data);
  UpdateFleets(Emp, Data);
}

export function InitializePirateNPE(Emp) {
  const HuntingGround = [];
  for (let x = 0; x <= MaxNoOfBlocks; x++) HuntingGround.push(new Array(MaxNoOfBlocks + 1).fill(25));
  const Data = { FleetData: newFleetDataArray(), HuntingGround, Sheep: new Array(9).fill(0) };
  SetEmpireDefenses(Emp);
  return Data;
}
