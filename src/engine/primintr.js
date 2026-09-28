// PRIMINTR.PAS: primitive interface to the universe data base.
import { MaxInt, Trunc, UpCaseStr, sN, Val, B, bIn, bAdd, bDel } from '../runtime/pascal.js';
import {
  Universe, G, gal, MaxNoOfFleets, NoOfProbesPerEmpire, Indep, Empire1, Empire8,
  Void, Con, Pln, Base, Gate, Flt, DestFlt, ArtCls, PrimitLvl, AgrTyp, MaxResources,
  NoNeb, LAM, fgt, men, ssp, pen, jmp, jtn, trn, hkr, BioInd, SYGInd, SYTInd, CheInd, MinInd,
  SupInd, TriInd, HKFleet, JumpFleet, Penetrator, AdvWrpFleet, Standard, FReady, PReady,
  PInTrans, cmm, gte, SRM, tri, CentralEMD, EmptyQuadrant, Limbo, ResArr, IndusArray,
  cpXY, cpID, XY, ID, Loc as mkLoc, CargoArray,
} from './types.js';
import { TechDev, DefaultISSP, InitDefenseRecord, ObjName } from './datacnst.js';
import { InGalaxy, SameXY, SameID, SameLocation, Rnd } from './misc.js';
import { env } from './env.js';

export const ShortFormat = false;
export const LongFormat = true;

// ---- QUAD procedures -----------------------------------------------------------------

export function GetNebula(Pos) {
  if (InGalaxy(Pos.x, Pos.y)) return gal.Sector[Pos.x][Pos.y].Special % 16;
  return NoNeb;
}
export function PutNebula(Pos, Neb) {
  const s = gal.Sector[Pos.x][Pos.y];
  s.Special = (s.Special & 0xF0) | Neb;
}
export function PutMine(Pos, Emp) {
  const s = gal.Sector[Pos.x][Pos.y];
  s.Special = (s.Special & 0x0F) | ((16 * Emp) & 0xF0);
}
export function EnemyMine(Pos) {
  return Math.floor(gal.Sector[Pos.x][Pos.y].Special / 16);
}
export function GetObject(Pos) {
  return cpID(gal.Sector[Pos.x][Pos.y].Obj);
}
export function GetFleets(Pos) {
  let Flts = 0n;
  for (let i = 1; i <= MaxNoOfFleets; i++)
    if (bIn(i, G.SetOfActiveFleets) && SameXY(Pos, Universe.Fleet[i].XY)) Flts |= B(i);
  return Flts;
}

// ---- GET INFO procedures ----------------------------------------------------------------

function objRec(o) {
  switch (o.ObjTyp) {
    case Pln: return Universe.Planet[o.Index];
    case Base: return Universe.Starbase[o.Index];
    case Flt: return Universe.Fleet[o.Index];
    case Gate: return Universe.Stargate[o.Index];
    case Con: return Universe.Constr[o.Index];
  }
  return null;
}

export function GetResources(o) {
  const r = ResArr();
  const rec = o.ObjTyp === Pln || o.ObjTyp === Base || o.ObjTyp === Flt ? objRec(o) : null;
  if (!rec) return r;
  for (let i = LAM; i <= tri; i++) {
    if (i >= fgt && i <= trn) r[i] = rec.Ships[i];
    else if (i >= men) r[i] = rec.Cargo[i];
    else if (o.ObjTyp !== Flt) r[i] = rec.Defns[i];
  }
  return r;
}
export function PutResources(o, R) {
  const rec = o.ObjTyp === Pln || o.ObjTyp === Base || o.ObjTyp === Flt ? objRec(o) : null;
  if (!rec) return;
  for (let i = LAM; i <= tri; i++) {
    if (i >= fgt && i <= trn) rec.Ships[i] = R[i];
    else if (i >= men) rec.Cargo[i] = R[i];
    else if (o.ObjTyp !== Flt) rec.Defns[i] = R[i];
  }
}

export function GetCoord(Obj) {
  switch (Obj.ObjTyp) {
    case Pln: case Base: case Flt: case Gate: case Con: {
      const r = objRec(Obj);
      return r ? cpXY(r.XY) : cpXY(Limbo);
    }
  }
  return cpXY(Limbo);
}

export function GetShips(Obj) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base || Obj.ObjTyp === Flt) return objRec(Obj).Ships.slice();
  return ResArr();
}

export function GetShipsKnown(Player, Obj) {
  const Ships = ResArr();
  switch (Obj.ObjTyp) {
    case Pln: {
      const Tech = GetTech(Obj);
      const Emp = GetStatus(Obj);
      const p = Universe.Planet[Obj.Index];
      if (Emp !== Indep) return p.Ships.slice();
      for (let s = fgt; s <= trn; s++)
        if (p.Ships[s] > 0 && (TechDev[Tech] & (1 << s))) Ships[s] = p.Ships[s];
      return Ships;
    }
    case Base: return Universe.Starbase[Obj.Index].Ships.slice();
    case Flt: return Universe.Fleet[Obj.Index].Ships.slice();
  }
  return Ships;
}

export function GetCargo(Obj) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base || Obj.ObjTyp === Flt) return objRec(Obj).Cargo.slice();
  return ResArr();
}
export function GetDefns(Obj) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base) return objRec(Obj).Defns.slice();
  return ResArr();
}
export function GetIndus(Obj) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base) return objRec(Obj).Indus.slice();
  return IndusArray();
}
export function GetTrillum(Obj) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base || Obj.ObjTyp === Flt) return objRec(Obj).Cargo[tri];
  return 0;
}
export function TroopStrength(Obj) {
  const Cr = GetCargo(Obj);
  return Cr[men] + 2 * Cr[13];
}
export function GetClass(Obj) {
  if (Obj.ObjTyp === Pln) return Universe.Planet[Obj.Index].Cls;
  return ArtCls;
}
export function GetTech(Obj) {
  if (Obj.ObjTyp === Pln) return Universe.Planet[Obj.Index].Tech;
  if (Obj.ObjTyp === Base) return Universe.Starbase[Obj.Index].Tech;
  return PrimitLvl;
}
export function GetPopulation(Obj) {
  if (Obj.ObjTyp === Pln) return Universe.Planet[Obj.Index].Pop;
  if (Obj.ObjTyp === Base) return Universe.Starbase[Obj.Index].Pop;
  return 0;
}
export function GetEfficiency(Obj) {
  if (Obj.ObjTyp === Pln) return Universe.Planet[Obj.Index].Eff;
  if (Obj.ObjTyp === Base) return Universe.Starbase[Obj.Index].Eff;
  return 0;
}
export function GetStatus(Obj) {
  switch (Obj.ObjTyp) {
    case Pln: case Base: case Flt: case Gate: case Con: {
      const r = objRec(Obj);
      return r ? r.Emp : Indep;
    }
  }
  return Indep;
}
export function GetType(Obj) {
  if (Obj.ObjTyp === Pln) return Universe.Planet[Obj.Index].Typ;
  if (Obj.ObjTyp === Base) return Universe.Starbase[Obj.Index].Typ;
  return AgrTyp;
}
export function GetTerraformTarget(Obj) { return Universe.Planet[Obj.Index].TerraformTarget; }
export function TrillumReserves(Obj) {
  if (Obj.ObjTyp === Pln) return Universe.Planet[Obj.Index].TriReserve;
  if (Obj.ObjTyp === Base) return MaxResources;
  return 0;
}
export function PutTrillumReserves(Obj, NewRes) {
  if (Obj.ObjTyp === Pln) Universe.Planet[Obj.Index].TriReserve = NewRes & 0xFFFF;
}

export function GetISSP(Obj, Ind) {
  if (Ind === BioInd || (Ind >= SYGInd && Ind <= SYTInd)) return 6;
  if (Obj.ObjTyp === Pln) {
    const ie = Universe.Planet[Obj.Index].ImpExp;
    switch (Ind) {
      case CheInd: return (ie & 0xFF) % 16;
      case MinInd: return Math.floor((ie & 0xFF) / 16);
      case SupInd: return ((ie >> 8) & 0xFF) % 16;
      case TriInd: return Math.floor(((ie >> 8) & 0xFF) / 16);
    }
  }
  return 0;
}

export function GetRevIndex(Obj) {
  if (Obj.ObjTyp === Pln) return Universe.Planet[Obj.Index].RevIndex;
  if (Obj.ObjTyp === Base) return Universe.Starbase[Obj.Index].RevIndex;
  return 0;
}
export function GetSpecial(Obj) {
  if (Obj.ObjTyp === Pln) return Universe.Planet[Obj.Index].Special;
  if (Obj.ObjTyp === Base) return Universe.Starbase[Obj.Index].Special;
  return 0;
}
export function Scouted(Emp, Obj) {
  switch (Obj.ObjTyp) {
    case Pln: case Base: case Flt: case Gate: case Con: {
      const r = objRec(Obj);
      return !!r && (r.ScoutedBy & (1 << Emp)) !== 0;
    }
  }
  return false;
}
export function Known(Emp, Obj) {
  switch (Obj.ObjTyp) {
    case Pln: case Base: case Flt: case Gate: case Con: {
      const r = objRec(Obj);
      return !!r && (r.KnownBy & (1 << Emp)) !== 0;
    }
  }
  return false;
}
export function GetWarpLinkFreq(Emp, Obj) { return Universe.Stargate[Obj.Index].WLF[Emp]; }
export function SetWarpLinkFreq(Emp, Obj, F) { Universe.Stargate[Obj.Index].WLF[Emp] = F; }

// ---- SET INFO procedures -------------------------------------------------------------------

export function PutShips(Obj, Ships) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base || Obj.ObjTyp === Flt) objRec(Obj).Ships = Ships.slice();
}
export function PutCargo(Obj, Cargo) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base || Obj.ObjTyp === Flt) objRec(Obj).Cargo = Cargo.slice();
}
export function PutDefns(Obj, Defns) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base) objRec(Obj).Defns = Defns.slice();
}
export function PutIndus(Obj, Indus) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base) objRec(Obj).Indus = Indus.slice();
}
export function InitializeISSP(Obj) {
  if (Obj.ObjTyp === Pln) Universe.Planet[Obj.Index].ImpExp = DefaultISSP;
}
export function SetISSP(Obj, Ind, v) {
  if (Ind === BioInd || (Ind >= SYGInd && Ind <= SYTInd)) return;
  if (Obj.ObjTyp !== Pln) return;
  const p = Universe.Planet[Obj.Index];
  switch (Ind) {
    case CheInd: p.ImpExp = ((p.ImpExp & 0xFFF0) + v) & 0xFFFF; break;
    case MinInd: p.ImpExp = ((p.ImpExp & 0xFF0F) + v * 0x10) & 0xFFFF; break;
    case SupInd: p.ImpExp = ((p.ImpExp & 0xF0FF) + v * 0x100) & 0xFFFF; break;
    case TriInd: p.ImpExp = ((p.ImpExp & 0x0FFF) + v * 0x1000) & 0xFFFF; break;
  }
}
export function PutTrillum(Obj, T) {
  if (Obj.ObjTyp === Pln || Obj.ObjTyp === Base || Obj.ObjTyp === Flt) objRec(Obj).Cargo[tri] = T & 0xFFFF;
}
export function SetClass(Obj, Cls) { if (Obj.ObjTyp === Pln) Universe.Planet[Obj.Index].Cls = Cls; }
export function SetTech(Obj, Tech) {
  if (Obj.ObjTyp === Pln) Universe.Planet[Obj.Index].Tech = Tech;
  else if (Obj.ObjTyp === Base) Universe.Starbase[Obj.Index].Tech = Tech;
}
export function SetPopulation(Obj, Pop) {
  Pop &= 0xFFFF;
  if (Obj.ObjTyp === Pln) Universe.Planet[Obj.Index].Pop = Pop;
  else if (Obj.ObjTyp === Base) Universe.Starbase[Obj.Index].Pop = Pop;
}
export function SetEfficiency(Obj, Eff) {
  Eff &= 0xFF;
  if (Obj.ObjTyp === Pln) Universe.Planet[Obj.Index].Eff = Eff;
  else if (Obj.ObjTyp === Base) Universe.Starbase[Obj.Index].Eff = Eff;
}
export function SetStatus(Obj, Emp) {
  const i = Obj.Index;
  switch (Obj.ObjTyp) {
    case Pln: {
      const Old = Universe.Planet[i].Emp;
      Universe.Planet[i].Emp = Emp;
      G.SetOfPlanetsOf[Old] = bDel(G.SetOfPlanetsOf[Old], i);
      G.SetOfPlanetsOf[Emp] = bAdd(G.SetOfPlanetsOf[Emp], i);
      break;
    }
    case Base: {
      const Old = Universe.Starbase[i].Emp;
      Universe.Starbase[i].Emp = Emp;
      G.SetOfStarbasesOf[Old] = bDel(G.SetOfStarbasesOf[Old], i);
      G.SetOfStarbasesOf[Emp] = bAdd(G.SetOfStarbasesOf[Emp], i);
      break;
    }
    case Con: {
      const Old = Universe.Constr[i].Emp;
      Universe.Constr[i].Emp = Emp;
      G.SetOfConstructionSitesOf[Old] = bDel(G.SetOfConstructionSitesOf[Old], i);
      G.SetOfConstructionSitesOf[Emp] = bAdd(G.SetOfConstructionSitesOf[Emp], i);
      break;
    }
  }
}
export function SetType(Obj, Typ) {
  if (Obj.ObjTyp === Pln) Universe.Planet[Obj.Index].Typ = Typ;
  else if (Obj.ObjTyp === Base) Universe.Starbase[Obj.Index].Typ = Typ;
}
export function ChangeRevIndex(Obj, Chg) {
  let Rev = 0;
  if (Obj.ObjTyp === Pln) Rev = Universe.Planet[Obj.Index].RevIndex;
  else if (Obj.ObjTyp === Base) Rev = Universe.Starbase[Obj.Index].RevIndex;
  if (Rev + Chg > 100) Rev = 100;
  else if (Rev + Chg < 0) Rev = 0;
  else Rev += Chg;
  if (Obj.ObjTyp === Pln) Universe.Planet[Obj.Index].RevIndex = Rev;
  else if (Obj.ObjTyp === Base) Universe.Starbase[Obj.Index].RevIndex = Rev;
}
export function SetSpecial(Obj, S) {
  if (Obj.ObjTyp === Pln) Universe.Planet[Obj.Index].Special = S;
  else if (Obj.ObjTyp === Base) Universe.Starbase[Obj.Index].Special = S;
}
export function ScoutObject(Emp, Obj) {
  switch (Obj.ObjTyp) {
    case Pln: case Base: case Gate: case Con: {
      const r = objRec(Obj);
      r.ScoutedBy |= 1 << Emp;
      r.KnownBy |= 1 << Emp;
    }
  }
}
export function SetTerraformTarget(Obj, T) { Universe.Planet[Obj.Index].TerraformTarget = T; }

// ---- FLEET procedures -------------------------------------------------------------------------

export function SetNPEDataIndex(FltID, Index) { Universe.Fleet[FltID.Index].NPEDataIndex = Index & 0xFF; }
export function NPEDataIndex(FltID) { return Universe.Fleet[FltID.Index].NPEDataIndex; }

export function TypeOfFleet(FltID) {
  if (FltID.ObjTyp !== Flt) return Standard;
  const S = Universe.Fleet[FltID.Index].Ships;
  if (S[ssp] + S[pen] + S[jmp] + S[fgt] + S[jtn] + S[trn] === 0) return HKFleet;
  if (S[ssp] + S[pen] + S[fgt] + S[trn] === 0) return JumpFleet;
  if (S[ssp] + S[jmp] + S[jtn] + S[trn] + S[fgt] === 0) return Penetrator;
  if (S[ssp] + S[fgt] + S[trn] === 0) return AdvWrpFleet;
  return Standard;
}
export function SetFleetStatus(FltID, s) {
  if (FltID.ObjTyp === Flt) Universe.Fleet[FltID.Index].Status = s;
  else if (FltID.ObjTyp === Base) Universe.Starbase[FltID.Index].Status = s;
}
export function GetFleetStatus(FltID) {
  if (FltID.ObjTyp === Flt) return Universe.Fleet[FltID.Index].Status;
  if (FltID.ObjTyp === Base) return Universe.Starbase[FltID.Index].Status;
  return FReady;
}
export function GetFleetFuel(FltID) {
  if (FltID.ObjTyp !== Flt) return 0;
  const f = Universe.Fleet[FltID.Index];
  return 1.0 * f.FuelHigh * MaxInt + f.Fuel;
}
export function SetFleetFuel(FltID, FuelLeft) {
  if (FltID.ObjTyp !== Flt) return;
  const f = Universe.Fleet[FltID.Index];
  f.FuelHigh = Trunc(FuelLeft / MaxInt) & 0xFF;
  f.Fuel = Trunc(FuelLeft - 1.0 * f.FuelHigh * MaxInt);
}

// ---- STARBASE / STARGATE / CONSTRUCTION --------------------------------------------------------

export function GetBaseType(BaseID) {
  return BaseID.ObjTyp === Base ? Universe.Starbase[BaseID.Index].STyp : cmm;
}
export function GetGateType(GateID) {
  return GateID.ObjTyp === Gate ? Universe.Stargate[GateID.Index].GTyp : gte;
}
export function GetConstrType(ConID) {
  return ConID.ObjTyp === Con ? Universe.Constr[ConID.Index].CTyp : SRM;
}
export function GetConstrTimeLeft(ConID) {
  return ConID.ObjTyp === Con ? Universe.Constr[ConID.Index].TimeToCompletion : 0;
}

// ---- EMPIRE procedures --------------------------------------------------------------------------

export function GetProbe(Player) {
  let PNum = NoOfProbesPerEmpire;
  const P = Universe.EmpireData[Player].Probe;
  while (PNum > 0 && P[PNum].Status !== PReady) PNum--;
  return PNum;
}
export function LaunchProbe(Player, PNum, Loc) {
  const p = Universe.EmpireData[Player].Probe[PNum];
  p.Dest = cpXY(Loc);
  p.Status = PInTrans;
}
export function GetTimeLeft(Player) { return Universe.EmpireData[Player].TimeLeft; }
export function SetTimeLeft(Player, Time) {
  let t = Time & 0xFFFF;
  if (t >= 0x8000) t -= 0x10000;
  Universe.EmpireData[Player].TimeLeft = t;
}
export function CentralizedCapital(Emp) {
  return (Universe.EmpireData[Emp].Modifiers & (1 << CentralEMD)) !== 0;
}
export function EmpireActive(Emp) { return Universe.EmpireData[Emp].InUse; }
export function EmpirePlayer(Emp) { return Universe.EmpireData[Emp].IsAPlayer; }
export function Empress(Emp) { return Universe.EmpireData[Emp].IsAnEmpress; }
export function EmpireAge(Emp) { return (env.Year - Universe.EmpireData[Emp].Founding) & 0xFFFF; }

export function CreateEmpire(Emp, Player, IsEmpress, Name, Password, CapID, Tech, TechSet,
  Restlessness, NewModifiers, YearFounded) {
  const e = Universe.EmpireData[Emp];
  e.InUse = true;
  e.IsAPlayer = Player;
  e.IsAnEmpress = IsEmpress;
  e.EmpireName = sN(Name, 32);
  e.Pass = sN(Password, 8);
  e.TimeLeft = 1500;
  e.Capital = cpID(CapID);
  e.DefenseSettings = InitDefenseRecord();
  e.TechnologyLevel = Tech;
  e.Technology = TechSet;
  e.RevFactor = Restlessness;
  e.Modifiers = NewModifiers;
  e.Founding = YearFounded;
}

export function EmpireName(Emp) { return Universe.EmpireData[Emp].EmpireName; }

export function MyLord(Emp) {
  if (Universe.EmpireData[Emp].IsAnEmpress) {
    return ['My Lady', 'Your Highness', 'Your Excellency', 'My Empress'][Rnd(1, 4) - 1];
  }
  return ['My Lord', 'Your Highness', 'Your Majesty', 'My Liege', 'Your Excellency', 'Sir'][Rnd(1, 6) - 1];
}

export function GetDefenseSettings(Emp) {
  const d = Universe.EmpireData[Emp].DefenseSettings;
  return { ShellDefDist: d.ShellDefDist.map((a) => a.slice()), StarbaseDefDist: d.StarbaseDefDist.map((a) => a.slice()) };
}
export function SetDefenseSettings(Emp, Def) {
  Universe.EmpireData[Emp].DefenseSettings = {
    ShellDefDist: Def.ShellDefDist.map((a) => a.slice()),
    StarbaseDefDist: Def.StarbaseDefDist.map((a) => a.slice()),
  };
}
export function GetEmpireTechnology(Emp) {
  const e = Universe.EmpireData[Emp];
  return { Tech: e.TechnologyLevel, TechSet: e.Technology };
}
export function SetEmpireTechnology(Emp, Tech, TechSet) {
  const e = Universe.EmpireData[Emp];
  e.TechnologyLevel = Tech;
  e.Technology = TechSet;
}
export function ChangeTotalRevIndex(Emp, Inc) { Universe.EmpireData[Emp].TotalRevIndex += Inc; }
export function SetTotalRevIndex(Emp, v) { Universe.EmpireData[Emp].TotalRevIndex = v; }
export function TotalRevIndex(Emp) {
  if (Emp === Indep) return 0;
  const e = Universe.EmpireData[Emp];
  return e.TotalRevIndex + e.RevFactor;
}
export function GetCapital(Emp) { return cpID(Universe.EmpireData[Emp].Capital); }
export function SetCapital(Emp, CapID) { Universe.EmpireData[Emp].Capital = cpID(CapID); }

export function AbsoluteX(X) { return X + GetCoord(Universe.EmpireData[env.Player].Capital).x; }
export function AbsoluteY(Y) { return GetCoord(Universe.EmpireData[env.Player].Capital).y - Y; }
export function RelativeX(X) { return X - GetCoord(Universe.EmpireData[env.Player].Capital).x; }
export function RelativeY(Y) { return GetCoord(Universe.EmpireData[env.Player].Capital).y - Y; }

// ---- NAME procedures ------------------------------------------------------------------------------
// A name record is { Name, Coord: Location }; the record object stands in for NameRecordPtr.

function names(Emp) { return Universe.EmpireData[Emp].Names; }

export function GetNewName(Player) {
  const rec = { Name: '', Coord: mkLoc() };
  names(Player).push(rec);
  return rec;
}
export function GetDefinedName(Emp, NamePtr) {
  return { Name: NamePtr.Name, Coord: { XY: cpXY(NamePtr.Coord.XY), ID: cpID(NamePtr.Coord.ID) } };
}
export function DefineName(Emp, NamePtr, DefName, DefCoord) {
  NamePtr.Name = sN(DefName, 8);
  NamePtr.Coord = { XY: cpXY(DefCoord.XY), ID: cpID(DefCoord.ID) };
}

// AddName: Loc is modified in place (VAR param). Returns Error.
export function AddName(Player, Loc, NameVar) {
  NameVar = sN(NameVar, 8);
  if (Loc.ID.ObjTyp === Con || Loc.ID.ObjTyp === Pln || Loc.ID.ObjTyp === Gate) Loc.XY = GetCoord(Loc.ID);
  let slot = Location2Index(Player, Loc);
  if (slot === null) slot = GetNewName(Player);
  DefineName(Player, slot, NameVar, Loc);
  return false;
}

function NAMDelete(Emp, rec) {
  const list = names(Emp);
  const i = list.indexOf(rec);
  if (i >= 0) list.splice(i, 1);
}

export function DeleteName(Player, NameToDelete) {
  const target = UpCaseStr(sN(NameToDelete, 32));
  const rec = names(Player).find((n) => UpCaseStr(n.Name) === target);
  if (rec) NAMDelete(Player, rec);
}

export function DeleteAllFleetDestNames(Emp) {
  const list = names(Emp);
  for (let i = list.length - 1; i >= 0; i--)
    if (list[i].Coord.ID.ObjTyp === DestFlt) list.splice(i, 1);
}

export function Location2Index(Emp, Loc) {
  for (const n of names(Emp)) if (SameLocation(Loc, n.Coord)) return n;
  return null;
}

export function Name2Index(Emp, NameToFind) {
  const t = UpCaseStr(sN(NameToFind, 16));
  for (const n of names(Emp)) if (UpCaseStr(n.Name) === t) return n;
  return null;
}

export function GetFleetName(Emp, FltID) {
  if (FltID.ObjTyp === DestFlt || bIn(FltID.Index, G.SetOfFleetsOf[Emp])) return 'Fleet' + FltID.Index;
  return 'Enemy' + FltID.Index;
}

export function GetCoordName(Coord) {
  return RelativeX(Coord.x) + ',' + RelativeY(Coord.y);
}

export function Name2Fleet(Emp, Strg) {
  Strg = UpCaseStr(Strg);
  let id = cpID(EmptyQuadrant);
  if ((Strg.slice(0, 5) === 'ENEMY' || Strg.slice(0, 5) === 'FLEET') && Strg.length > 5) {
    const r = Val(Strg.substr(5, 16));
    if (r.code === 0 && r.value > 0 && r.value <= MaxNoOfFleets) id = { ObjTyp: Flt, Index: r.value };
  }
  return id;
}

export function Name2Coord(Strg) {
  let Coord = cpXY(Limbo);
  const Del = Strg.indexOf(',') + 1;
  if (Del > 0) {
    const rx = Val(Strg.slice(0, Del - 1));
    if (rx.code === 0 && rx.value >= -32768 && rx.value <= 32767) {
      const ry = Val(Strg.substr(Del, 16));
      if (ry.code === 0 && ry.value >= -32768 && ry.value <= 32767) {
        const X = AbsoluteX(rx.value), Y = AbsoluteY(ry.value);
        if (InGalaxy(X, Y)) Coord = { x: X, y: Y };
      }
    }
  }
  return Coord;
}

export function GetName(Emp, LocIn, LongFmt) {
  const Loc = { XY: cpXY(LocIn.XY), ID: cpID(LocIn.ID) };
  if (Loc.ID.ObjTyp === Con || Loc.ID.ObjTyp === Pln || Loc.ID.ObjTyp === Gate) Loc.XY = GetCoord(Loc.ID);
  else if (!SameXY(Loc.XY, Limbo)) {
    Loc.ID = GetObject(Loc.XY);
    if (Loc.ID.ObjTyp === Base) Loc.XY = cpXY(Limbo);
  }
  const NamePtr = Location2Index(Emp, Loc);
  let Strg;
  if (NamePtr === null) {
    if (Loc.ID.ObjTyp !== Void) {
      if (Loc.ID.ObjTyp === Flt || Loc.ID.ObjTyp === DestFlt) Strg = GetFleetName(Emp, Loc.ID);
      else {
        Strg = GetCoordName(GetCoord(Loc.ID));
        if (LongFmt && Known(Emp, Loc.ID)) Strg = ObjName[Loc.ID.ObjTyp] + ' at ' + Strg;
      }
    } else Strg = GetCoordName(Loc.XY);
  } else Strg = NamePtr.Name;
  return sN(Strg, 32);
}

export function GetLocation(Emp, Strg) {
  const Loc = { XY: cpXY(Limbo), ID: cpID(EmptyQuadrant) };
  const NamePtr = Name2Index(Emp, Strg);
  if (NamePtr === null) {
    Loc.ID = Name2Fleet(Emp, Strg);
    if (SameID(Loc.ID, EmptyQuadrant)) {
      const TempCoord = Name2Coord(Strg);
      if (!SameXY(TempCoord, Limbo)) {
        const TempID = GetObject(TempCoord);
        if (!SameID(TempID, EmptyQuadrant)) Loc.ID = TempID;
        else Loc.XY = TempCoord;
      }
    }
    return Loc;
  }
  const d = GetDefinedName(Emp, NamePtr);
  return d.Coord;
}

export function ObjectName(Emp, ObjID, LongFmt) {
  return GetName(Emp, { XY: cpXY(Limbo), ID: cpID(ObjID) }, LongFmt);
}

export function DeleteAllNames(Emp) {
  Universe.EmpireData[Emp].Names = [];
}

// ---- MISC ---------------------------------------------------------------------------------------------

// ID lists are plain JS arrays of IDNumber
export function AddIDCell(list, NewID) { list.push(cpID(NewID)); }

export function NextEmpire(Player) {
  let guard = 0;
  do {
    Player = Player === Empire8 ? Empire1 : Player + 1;
  } while (!EmpireActive(Player) && guard++ < 16);
  return Player;
}
