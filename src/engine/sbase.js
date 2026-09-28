// SBASE.PAS: self-destruct and starbase movement.
import { bIn, bDel, Sgn } from '../runtime/pascal.js';
import {
  Universe, G, gal, MaxNoOfFleets, MaxNoOfStarbases, Empire1, Empire8, Flt, Base, Void,
  cmm, frt, fgt, trn, DenseNebula, No, Nw, NoDir, FReady, EmptyQuadrant, Limbo, cpXY, cpID,
} from './types.js';
import { DirX, DirY } from './datacnst.js';
import { SameXY, InGalaxy } from './misc.js';
import {
  GetCoord, GetFleets, GetStatus, EmpireActive, Scouted, GetShips, GetObject, GetNebula,
  GetBaseType, GetTrillum, PutTrillum, SetFleetStatus,
} from './primintr.js';
import { AddNews, N } from './news.js';
import { FleetNameDestruction, DestroyFleet, GetNewPos, GetFleetDestination } from './fleet.js';

export function SelfDestructObject(ObjID) {
  const XY = GetCoord(ObjID);
  const SetOfFleets = GetFleets(XY);
  const Emp = GetStatus(ObjID);
  let Loc = { ID: cpID(ObjID), XY: cpXY(Limbo) };

  for (let o = Empire1; o <= Empire8; o++)
    if (EmpireActive(o) && o !== Emp && Scouted(o, ObjID))
      AddNews(o, N.BseSD, { ID: cpID(ObjID), XY: cpXY(Limbo) }, Emp, 0, 0);

  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (bIn(i, SetOfFleets)) {
      const FltID = { ObjTyp: Flt, Index: i };
      const Other = GetStatus(FltID);
      const Ships = GetShips(FltID);
      if (Other !== Emp) {
        Loc = FleetNameDestruction(Other, FltID);
        AddNews(Other, N.FltSD, Loc, 0, 0, 0);
        for (let s = fgt; s <= trn; s++) if (Ships[s] > 0) AddNews(Other, N.DestDetail, Loc, Ships[s], s, 0);
      }
      DestroyFleet(FltID);
    }
  }

  if (ObjID.ObjTyp === Base) {
    G.SetOfStarbasesOf[Emp] = bDel(G.SetOfStarbasesOf[Emp], ObjID.Index);
    G.SetOfActiveStarbases = bDel(G.SetOfActiveStarbases, ObjID.Index);
  } else G.SetOfActiveGates = bDel(G.SetOfActiveGates, ObjID.Index);
  gal.Sector[XY.x][XY.y].Obj = cpID(EmptyQuadrant);
}

function XY2Dir(Pos, Dest) {
  const dx = Sgn(Dest.x - Pos.x), dy = Sgn(Dest.y - Pos.y);
  let d = Nw;
  while (d !== NoDir && (dx !== DirX[d] || dy !== DirY[d])) d--;
  return d;
}

function TentativeMove(NewPos, Dest) {
  let p = GetNewPos(NewPos, Dest);
  if (!SameXY(p, Limbo) && GetObject(p).ObjTyp !== Void) p = cpXY(Limbo);
  return p;
}

function GetNewBasePos(Pos, Dest) {
  const Dir = XY2Dir(Pos, Dest);
  let PosTest = TentativeMove(Pos, Dest);
  if (!SameXY(PosTest, Limbo)) return PosTest;

  const trySide = (DirTest) => {
    let pt = { x: Pos.x + DirX[DirTest], y: Pos.y + DirY[DirTest] };
    if (!InGalaxy(pt.x, pt.y)) return null;
    const pt2 = TentativeMove(pt, Dest);
    if (GetNebula(pt) === DenseNebula) pt = cpXY(Limbo);
    else if (GetObject(pt).ObjTyp !== Void) pt = cpXY(Limbo);
    return !SameXY(pt, Limbo) && !SameXY(pt2, Limbo) ? pt : null;
  };
  let r = trySide(Dir === Nw ? No : Dir + 1);
  if (r) return r;
  r = trySide(Dir === No ? Nw : Dir - 1);
  if (r) return r;
  return cpXY(Limbo);
}

function MoveBase(BaseID, NewPos) {
  const b = Universe.Starbase[BaseID.Index];
  gal.Sector[b.XY.x][b.XY.y].Obj = cpID(EmptyQuadrant);
  gal.Sector[NewPos.x][NewPos.y].Obj = cpID(BaseID);
  b.XY = cpXY(NewPos);
}

export function MovePlayerStarbases(Emp) {
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfStarbasesOf[Emp])) continue;
    const BaseID = { ObjTyp: Base, Index: i };
    const Loc = { ID: cpID(BaseID), XY: cpXY(Limbo) };
    const STyp = GetBaseType(BaseID);
    if (STyp === cmm || STyp === frt) {
      const OldPos = GetCoord(BaseID);
      const Dest = GetFleetDestination(BaseID);
      if (!SameXY(Dest, OldPos)) {
        let TriLeft = GetTrillum(BaseID);
        const FuelCon = 100;
        if (TriLeft >= FuelCon) {
          let NewPos = GetNewBasePos(OldPos, Dest);
          if (SameXY(NewPos, Limbo)) {
            NewPos = OldPos;
            AddNews(Emp, N.BseBlocked, Loc, 0, 0, 0);
          }
          MoveBase(BaseID, NewPos);
          TriLeft -= FuelCon;
          PutTrillum(BaseID, TriLeft);
          if (SameXY(Dest, NewPos)) SetFleetStatus(BaseID, FReady);
        } else AddNews(Emp, N.BseFuel, Loc, 0, 0, 0);
      }
    }
  }
}
