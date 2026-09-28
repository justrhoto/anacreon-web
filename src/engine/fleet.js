// FLEET.PAS
import { bIn, bAdd, bDel, Round } from '../runtime/pascal.js';
import {
  Universe, G, gal, MaxNoOfFleets, MaxNoOfStargates, MaxResources, Flt, Base, Pln, DestFlt, Gate,
  Void, Indep, FReady, FInTrans, FInactive, DenseNebula, dis, fgt, hkr, jtn, trn, men, tri, ssp,
  Standard, Penetrator, AdvWrpFleet, JumpFleet, HKFleet, EmptyQuadrant, Limbo,
  cpXY, cpID, newFleet, ResArr,
} from './types.js';
import { FuelPerTon, CargoSpace, ProtecNeeded, FltMovementRate } from './datacnst.js';
import {
  ThgLmt, NoShips, FuelCapacity, FuelConsumption, FleetCargoSpace, AddThings, SubThings,
  SameXY, SameID, Distance, LesserInt, GreaterInt, Rnd,
} from './misc.js';
import {
  GetFleetFuel, SetFleetFuel, GetStatus, GetShips, GetCargo, PutShips, PutCargo, GetTrillum,
  PutTrillum, GetCoord, GetObject, GetFleets, SetFleetStatus, GetFleetStatus, TypeOfFleet,
  GetNebula, EnemyMine, PutMine, GetGateType, GetWarpLinkFreq, DeleteName, ObjectName,
  ShortFormat, Location2Index, GetDefinedName, AddName,
} from './primintr.js';
import { AddNews, N, GetNewsList } from './news.js';
import {
  FleetNextStatement, SetFleetNextStatement, GetFleetCode, SetFleetCode, NumberOfCommands,
  GetCommandRecord, DestCOM, TransCOM, SweepCOM, RepeatCOM, WaitCOM,
} from './orders.js';
import { BalanceFleet, PassingThroughGate, PassingThroughFortress } from './intrface.js';
import { ClrMineScout, SetMineScout } from './types.js';
import { Sgn } from '../runtime/pascal.js';

const L = (id) => ({ XY: cpXY(Limbo), ID: cpID(id) });

// Returns the new location (VAR NewLoc)
export function FleetNameDestruction(Emp, FltID) {
  let NewLoc = { XY: cpXY(Limbo), ID: cpID(FltID) };
  if (FltID.ObjTyp === Flt) {
    const NamePtr = Location2Index(Emp, NewLoc);
    if (NamePtr !== null) {
      const d = GetDefinedName(Emp, NamePtr);
      NewLoc = d.Coord;
      DeleteName(Emp, d.Name);
      NewLoc.ID.ObjTyp = DestFlt;
      AddName(Emp, NewLoc, d.Name);
      for (const n of GetNewsList(Emp))
        if (SameID(n.Loc1.ID, FltID)) n.Loc1 = { XY: cpXY(NewLoc.XY), ID: cpID(NewLoc.ID) };
    }
  }
  return NewLoc;
}

export function GetFleetDestination(FltID) {
  if (FltID.ObjTyp === Flt) return cpXY(Universe.Fleet[FltID.Index].Dest);
  if (FltID.ObjTyp === Base) return cpXY(Universe.Starbase[FltID.Index].Dest);
  return cpXY(Limbo);
}

export function SetFleetDestination(FltID, NewDest) {
  if (FltID.ObjTyp === Flt) Universe.Fleet[FltID.Index].Dest = cpXY(NewDest);
  else if (FltID.ObjTyp === Base) Universe.Starbase[FltID.Index].Dest = cpXY(NewDest);
  const FltXY = GetCoord(FltID);
  SetFleetStatus(FltID, SameXY(FltXY, NewDest) ? FReady : FInTrans);
}

function NoOtherFleetsInSect(FltID, Emp, XY) {
  let s = GetFleets(XY) & G.SetOfFleetsOf[Emp];
  s = bDel(s, FltID.Index);
  return s === 0n;
}

export function MoveFleet(FltID, NewCoord) {
  const f = Universe.Fleet[FltID.Index];
  const OldCoord = cpXY(f.XY);
  f.XY = cpXY(NewCoord);
  if (NoOtherFleetsInSect(FltID, f.Emp, OldCoord))
    gal.Sector[OldCoord.x][OldCoord.y].Flts &= ~(1 << f.Emp);
  gal.Sector[NewCoord.x][NewCoord.y].Flts |= 1 << f.Emp;
}

export function AbortFleet(Flt1, GroundID, Report) {
  if (!bIn(Flt1.Index, G.SetOfActiveFleets)) return;
  if (GroundID.ObjTyp === Flt && !bIn(GroundID.Index, G.SetOfActiveFleets)) return;
  const FuelLeft = GetFleetFuel(Flt1);
  const f = Universe.Fleet[Flt1.Index];
  const Sh2 = f.Ships.slice();
  const Cr2 = f.Cargo.slice();
  if (GroundID.ObjTyp !== Flt) Cr2[tri] = ThgLmt(Cr2[tri] + ThgLmt(FuelLeft / FuelPerTon));
  else SetFleetFuel(GroundID, GetFleetFuel(GroundID) + FuelLeft);

  const OtherEmp = GetStatus(GroundID);
  const Emp = GetStatus(Flt1);
  const Loc = L(GroundID);
  if (OtherEmp !== Emp && Report) {
    AddNews(OtherEmp, N.TrnsShp, Loc, Emp, 0, 0);
    for (let r = fgt; r <= trn; r++) if (Sh2[r] !== 0) AddNews(OtherEmp, N.Trns2, Loc, Sh2[r], r, 0);
    for (let r = men; r <= tri; r++) if (Cr2[r] !== 0) AddNews(OtherEmp, N.Trns2, Loc, Cr2[r], r, 0);
  }
  const Sh = GetShips(GroundID), Cr = GetCargo(GroundID);
  AddThings(Sh, Cr, Sh2, Cr2);
  PutShips(GroundID, Sh);
  PutCargo(GroundID, Cr);
  DeleteName(Emp, ObjectName(Emp, Flt1, ShortFormat));
}

export function DestroyFleet(FltID) {
  if (!bIn(FltID.Index, G.SetOfActiveFleets)) return;
  const f = Universe.Fleet[FltID.Index];
  const FltPos = cpXY(f.XY), FltSta = f.Emp;
  Universe.Fleet[FltID.Index] = null;
  G.SetOfActiveFleets = bDel(G.SetOfActiveFleets, FltID.Index);
  G.SetOfFleetsOf[FltSta] = bDel(G.SetOfFleetsOf[FltSta], FltID.Index);
  if (NoOtherFleetsInSect(FltID, FltSta, FltPos))
    gal.Sector[FltPos.x][FltPos.y].Flts &= ~(1 << FltSta);
}

function GetNextFleet(NewEmp) {
  let NextSlot = 0;
  let i = MaxNoOfFleets;
  while (i > 0 && NextSlot === 0) {
    if (!bIn(i, G.SetOfActiveFleets)) NextSlot = i;
    i--;
  }
  if (NextSlot === 0) return cpID(EmptyQuadrant);
  const f = newFleet();
  f.Emp = NewEmp;
  f.NextOrder = 0;
  Universe.Fleet[NextSlot] = f;
  G.SetOfFleetsOf[NewEmp] = bAdd(G.SetOfFleetsOf[NewEmp], NextSlot);
  G.SetOfActiveFleets = bAdd(G.SetOfActiveFleets, NextSlot);
  return { ObjTyp: Flt, Index: NextSlot };
}

export function ChangeCompositionOfFleet(FltID, GroundID, NewFSh, NewFCr, NewGSh, NewGCr) {
  const OldFSh = GetShips(FltID);
  const OldGSh = GetShips(GroundID);
  if (NoShips(NewFSh)) {
    AbortFleet(FltID, GroundID, true);
    DestroyFleet(FltID);
  } else if (NoShips(NewGSh) && GroundID.ObjTyp === Flt) {
    AbortFleet(GroundID, FltID, true);
    DestroyFleet(GroundID);
  } else if (GroundID.ObjTyp === Flt) {
    let FltFuel = GetFleetFuel(FltID);
    let GrdFuel = GetFleetFuel(GroundID);
    const OldFuCap = FuelCapacity(OldFSh), NewFuCap = FuelCapacity(NewFSh);
    let FuelChange = (FltFuel * NewFuCap / OldFuCap) - FltFuel;
    if (FuelChange > GrdFuel) FuelChange = GrdFuel;
    GrdFuel -= FuelChange;
    FltFuel += FuelChange;
    SetFleetFuel(FltID, FltFuel);
    SetFleetFuel(GroundID, GrdFuel);
    PutShips(FltID, NewFSh); PutCargo(FltID, NewFCr);
    PutShips(GroundID, NewGSh); PutCargo(GroundID, NewGCr);
  } else {
    let FltFuel = GetFleetFuel(FltID);
    const NewFuCap = FuelCapacity(NewFSh);
    PutShips(GroundID, NewGSh);
    PutCargo(GroundID, NewGCr);
    let FuelChange = NewFuCap - FltFuel;
    const TonsNeeded = Round(FuelChange / FuelPerTon);
    let TonsOnGround = GetTrillum(GroundID);
    if (TonsOnGround >= TonsNeeded) {
      TonsOnGround = ThgLmt(TonsOnGround - TonsNeeded);
      PutTrillum(GroundID, TonsOnGround);
    } else {
      PutTrillum(GroundID, 0);
      FuelChange = 1.0 * TonsOnGround * FuelPerTon;
    }
    FltFuel += FuelChange;
    SetFleetFuel(FltID, FltFuel);
    PutShips(FltID, NewFSh);
    PutCargo(FltID, NewFCr);
  }
}

// Returns new fleet ID (Void if none available)
export function DeployFleet(Emp, LaunchID, Sh, Cr, DestXY) {
  const FltID = GetNextFleet(Emp);
  if (FltID.ObjTyp !== Void) {
    const LaunchXY = GetCoord(LaunchID);
    const f = Universe.Fleet[FltID.Index];
    f.XY = cpXY(Limbo);
    f.ScoutedBy = 1 << Emp;
    f.KnownBy = 1 << Emp;
    f.Ships = ResArr();
    f.Cargo = ResArr();
    SetFleetFuel(FltID, 0);
    G.SetOfActiveFleets = bAdd(G.SetOfActiveFleets, FltID.Index);
    MoveFleet(FltID, LaunchXY);
    SetFleetDestination(FltID, DestXY);

    const LauSh = GetShips(LaunchID), LauCr = GetCargo(LaunchID);
    SubThings(LauSh, LauCr, Sh, Cr);
    if (LaunchID.ObjTyp === Flt) ChangeCompositionOfFleet(LaunchID, FltID, LauSh, LauCr, Sh, Cr);
    else ChangeCompositionOfFleet(FltID, LaunchID, Sh, Cr, LauSh, LauCr);

    if (bIn(FltID.Index, G.SetOfActiveFleets) && GetFleetFuel(FltID) === 0) SetFleetFuel(FltID, 10);
  }
  return FltID;
}

// GetNewPos: returns new position (Limbo if blocked by dense nebula)
export function GetNewPos(Pos, Dest) {
  const NewPos = { x: Pos.x + Sgn(Dest.x - Pos.x), y: Pos.y + Sgn(Dest.y - Pos.y) };
  if (GetNebula(NewPos) === DenseNebula) return cpXY(Limbo);
  return NewPos;
}

export function RefuelFleet(FltID, GroundID, Trillum) {
  const FltSh = GetShips(FltID), FltCr = GetCargo(FltID);
  let FltFuel = GetFleetFuel(FltID);
  const MaxFuel = FuelCapacity(FltSh);
  let TonsOnGround = GetTrillum(GroundID);
  TonsOnGround -= Trillum;
  FltFuel += 1.0 * Trillum * FuelPerTon;
  if (FltFuel > MaxFuel) FltFuel = MaxFuel;
  PutTrillum(GroundID, TonsOnGround);
  SetFleetFuel(FltID, FltFuel);
  const FuelCons = FuelConsumption(FltSh, FltCr);
  if (FltFuel > FuelCons) {
    const FPos = GetCoord(FltID), FDes = GetFleetDestination(FltID);
    SetFleetStatus(FltID, SameXY(FPos, FDes) ? FReady : FInTrans);
  }
}

function ExecuteDestCOM(FltID, Loc) {
  let xy = cpXY(Loc.XY);
  if (SameXY(xy, Limbo)) xy = GetCoord(Loc.ID);
  SetFleetDestination(FltID, xy);
}

function ExecuteSweepCOM(FltID) {
  const XY = GetCoord(FltID);
  const SRMOwner = EnemyMine(XY);
  const Player = GetStatus(FltID);
  const SRMLoc = { ID: cpID(EmptyQuadrant), XY: cpXY(XY) };
  const FleetLoc = L(FltID);
  const Ships = GetShips(FltID);
  if (Ships[ssp] < 100) AddNews(Player, N.OrdersNoSSP, FleetLoc, 0, 0, 0);
  else {
    if (SRMOwner === Indep) AddNews(Player, N.OrdersNoSRMs, FleetLoc, 0, 0, 0);
    if (SRMOwner !== Indep) {
      if (SRMOwner !== Player) AddNews(SRMOwner, N.SRMClear, SRMLoc, Player, 0, 0);
      PutMine(XY, Indep);
      ClrMineScout(XY);
      AddNews(Player, N.OrdersSRMClear, FleetLoc, 0, 0, 0);
    }
  }
}

function GetRes(Sh, Cr, Res) { return Res > trn ? Cr[Res] : Sh[Res]; }
function PutRes(Sh, Cr, Res, v) { if (Res > trn) Cr[Res] = v; else Sh[Res] = v; }

function ExecuteTransCOM(FltID, Res, Trans) {
  const FltXY = GetCoord(FltID);
  const GroundID = GetObject(FltXY);
  if (!SameID(GroundID, EmptyQuadrant) && GetStatus(GroundID) === GetStatus(FltID) &&
      (GroundID.ObjTyp === Pln || GroundID.ObjTyp === Base)) {
    const GrnSh = GetShips(GroundID), GrnCr = GetCargo(GroundID);
    const FltSh = GetShips(FltID), FltCr = GetCargo(FltID);
    const FltRes = GetRes(FltSh, FltCr, Res);
    const GrnRes = GetRes(GrnSh, GrnCr, Res);
    if (Trans > 0) {
      Trans = LesserInt(Trans, GrnRes);
      Trans = LesserInt(Trans, MaxResources - FltRes);
      if (Res >= men && Res <= tri)
        Trans = LesserInt(FleetCargoSpace(FltSh, FltCr) * CargoSpace[Res], Trans);
    } else {
      Trans = -Trans;
      Trans = LesserInt(Trans, FltRes);
      Trans = LesserInt(Trans, MaxResources - GrnRes);
      Trans = -Trans;
    }
    PutRes(FltSh, FltCr, Res, (FltRes + Trans) & 0xFFFF);
    PutRes(GrnSh, GrnCr, Res, (GrnRes - Trans) & 0xFFFF);
    BalanceFleet(FltSh, FltCr);
    ChangeCompositionOfFleet(FltID, GroundID, FltSh, FltCr, GrnSh, GrnCr);
  }
}

function ExecuteFleetOrders(Emp, FltID) {
  let Com = FleetNextStatement(FltID);
  let IgnoreRepeat = false, FleetDestroyed = false;
  if (Com === 0) return;
  let Code = GetFleetCode(FltID);
  const LastCommand = NumberOfCommands(Code);
  let Command;
  do {
    Command = GetCommandRecord(Code, Com);
    if (!Command) { Com = 0; break; }
    switch (Command.Typ) {
      case DestCOM: ExecuteDestCOM(FltID, Command.Loc); break;
      case TransCOM: ExecuteTransCOM(FltID, Command.Res, Command.Trns); break;
      case SweepCOM: ExecuteSweepCOM(FltID); break;
    }
    if (bIn(FltID.Index, G.SetOfActiveFleets)) {
      if (Command.Typ === RepeatCOM && !IgnoreRepeat) {
        Com = 1;
        IgnoreRepeat = true;
      } else if (Com < LastCommand) Com++;
      else {
        Com = 0;
        Code = [];
        SetFleetCode(FltID, Code);
      }
    } else FleetDestroyed = true;
  } while (!(Command.Typ === DestCOM || Command.Typ === WaitCOM || Com === 0 || FleetDestroyed));
  if (!FleetDestroyed) SetFleetNextStatement(FltID, Com);
}

function InRangeOfDisrupter(Emp, Pos) {
  for (let i = 1; i <= MaxNoOfStargates; i++) {
    if (bIn(i, G.SetOfActiveGates)) {
      const g = { ObjTyp: Gate, Index: i };
      if (GetGateType(g) === dis && GetWarpLinkFreq(Emp, g) !== GetWarpLinkFreq(GetStatus(g), g)) {
        if (Distance(GetCoord(g), Pos) <= 3) return { hit: true, by: GetStatus(g) };
      }
    }
  }
  return { hit: false, by: Indep };
}

export function InRangeOfMyDisrupter(Emp, Pos) {
  for (let i = 1; i <= MaxNoOfStargates; i++) {
    if (bIn(i, G.SetOfActiveGates)) {
      const g = { ObjTyp: Gate, Index: i };
      if (GetGateType(g) === dis && GetWarpLinkFreq(Emp, g) === GetWarpLinkFreq(GetStatus(g), g)) {
        if (Distance(GetCoord(g), Pos) <= 2) return true;
      }
    }
  }
  return false;
}

function UseUpFuel(FltID) {
  for (let guard = 0; guard < 1000; guard++) {
    const Sh = GetShips(FltID), Cr = GetCargo(FltID);
    const Emp = GetStatus(FltID);
    const FuelCon = FuelConsumption(Sh, Cr);
    const FuelLeft = GetFleetFuel(FltID);
    if (FuelLeft >= FuelCon) {
      SetFleetFuel(FltID, FuelLeft - FuelCon);
      return true;
    }
    if (Cr[tri] === 0) {
      AddNews(Emp, N.NoFuel, L(FltID), 0, 0, 0);
      SetFleetStatus(FltID, FInactive);
      return false;
    }
    const TriToUse = GreaterInt(1, LesserInt(Cr[tri], Round(FuelCon / FuelPerTon)));
    RefuelFleet(FltID, FltID, TriToUse);
  }
  return false;
}

// returns FltDestroyed
function MineFieldDamage(FltID, MinedBy) {
  const Sh = GetShips(FltID), Cr = GetCargo(FltID);
  const Emp = GetStatus(FltID);
  const ShipsDest = ResArr();
  let destroyed = false;
  for (let r = hkr; r <= jtn; r++) {
    ShipsDest[r] = LesserInt(Sh[r], Rnd(1, 100) + Round(Sh[r] * ((ProtecNeeded[r] + 20) / 100)));
    Sh[r] -= ShipsDest[r];
  }
  let Loc = L(FltID);
  if (NoShips(Sh)) {
    Loc = FleetNameDestruction(Emp, FltID);
    AddNews(Emp, N.MinesDs, Loc, MinedBy, 0, 0);
    DestroyFleet(FltID);
    destroyed = true;
  } else {
    AddNews(Emp, N.MinesDm, Loc, MinedBy, 0, 0);
    BalanceFleet(Sh, Cr);
    PutShips(FltID, Sh);
    PutCargo(FltID, Cr);
  }
  for (let r = hkr; r <= jtn; r++) if (ShipsDest[r] !== 0) AddNews(Emp, N.DestDetail, Loc, ShipsDest[r], r, 0);
  return destroyed;
}

export function UpdateFleet(FltID) {
  let FltXY = GetCoord(FltID);
  const Dest = GetFleetDestination(FltID);
  const FltTyp = TypeOfFleet(FltID);
  const Emp = GetStatus(FltID);
  let FltDestroyed = false;

  if (!SameXY(Dest, FltXY)) {
    let Teleport = false;
    if (PassingThroughGate(FltID, FltXY, Dest)) Teleport = true;
    else if (PassingThroughFortress(FltXY)) {
      if (Distance(FltXY, Dest) <= 5) Teleport = true;
      else {
        let j = 5;
        let NewPos = cpXY(FltXY);
        while (j > 0 && !SameXY(NewPos, Limbo)) {
          FltXY = NewPos;
          NewPos = GetNewPos(NewPos, Dest);
          j--;
        }
        MoveFleet(FltID, FltXY);
      }
    }

    const EnoughFuel = UseUpFuel(FltID);
    if (EnoughFuel) {
      if (Teleport) {
        if (GetNebula(Dest) === DenseNebula) AddNews(Emp, N.NebGate, L(FltID), 0, 0, 0);
        else {
          MoveFleet(FltID, Dest);
          SetFleetStatus(FltID, FReady);
        }
      } else {
        let NewPos = cpXY(FltXY);
        let OldPos;
        moveLoop:
        for (let j = 1; j <= FltMovementRate[FltTyp]; j++) {
          OldPos = NewPos;
          NewPos = GetNewPos(NewPos, Dest);

          if (FltTyp === JumpFleet || FltTyp === HKFleet) {
            const MinedBy = SameXY(NewPos, Limbo) ? Indep : EnemyMine(NewPos);
            if (MinedBy !== Indep && MinedBy !== Emp) {
              FltDestroyed = MineFieldDamage(FltID, MinedBy);
              AddNews(MinedBy, N.Mines, { XY: cpXY(NewPos), ID: cpID(EmptyQuadrant) }, Emp, 0, 0);
              SetMineScout(Emp, NewPos);
              break moveLoop;
            }
            const d = InRangeOfDisrupter(Emp, NewPos);
            if (d.hit) {
              AddNews(Emp, N.Disrupt, L(FltID), d.by, 0, 0);
              break moveLoop;
            }
          }

          if (FltTyp === Standard || FltTyp === Penetrator || FltTyp === AdvWrpFleet) {
            if (InRangeOfMyDisrupter(Emp, NewPos)) {
              let counter = 1;
              while (InRangeOfMyDisrupter(Emp, NewPos) && counter <= 10 &&
                     !SameXY(NewPos, Dest) && !SameXY(NewPos, Limbo)) {
                OldPos = NewPos;
                NewPos = GetNewPos(NewPos, Dest);
                counter++;
              }
            }
          }

          if (SameXY(NewPos, Limbo)) {
            FltDestroyed = false;
            NewPos = OldPos;
            AddNews(Emp, N.FltBlocked, L(FltID), 0, 0, 0);
            break moveLoop;
          }
        }

        if (!FltDestroyed) {
          MoveFleet(FltID, NewPos);
          if (SameXY(Dest, NewPos)) SetFleetStatus(FltID, FReady);
        }
      }
    }
  }

  if (!FltDestroyed && GetFleetStatus(FltID) === FReady) ExecuteFleetOrders(Emp, FltID);
}

export function UpdateAllFleets(Player, NextPlayer) {
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (bIn(i, G.SetOfActiveFleets)) {
      const FltID = { ObjTyp: Flt, Index: i };
      const FltTyp = TypeOfFleet(FltID);
      const ObjID = GetObject(GetCoord(FltID));
      const Emp = GetStatus(FltID);
      if (Emp === NextPlayer &&
          (FltTyp === Standard || FltTyp === Penetrator || FltTyp === AdvWrpFleet || ObjID.ObjTyp === Gate)) {
        UpdateFleet(FltID);
      } else if (Emp === Player && (FltTyp === HKFleet || FltTyp === JumpFleet) && ObjID.ObjTyp !== Gate) {
        UpdateFleet(FltID);
      }
    }
  }
}
