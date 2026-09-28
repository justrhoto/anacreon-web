// INTRFACE.PAS: higher-level interface to the data base.
import { bIn, bAdd, bDel, Round, Random, Sqr, RealStr } from '../runtime/pascal.js';
import {
  Universe, G, gal, NoOfProbesPerEmpire, MaxNoOfStarbases, MaxNoOfStargates, MaxNoOfConstrSites,
  MaxNoOfFleets, Empire1, Empire8, Indep, Void, Con, Pln, Base, Gate, Flt, DestFlt,
  NoDir, Nw, DarkNebula, NoNeb, CapTyp, BseTyp, TerTyp, TerCls, IndTyp, AgrTyp, CheTyp, MinTyp,
  RawTyp, RawSTyp, RsrTyp, TriTyp, BioInd, CheInd, MinInd, SYGInd, SYJInd, SYSInd, SYTInd,
  SupInd, TriInd, AmbAddict, FReady, PInTrans, PReady, PAtDest, HKFleet, Penetrator, frt, gte,
  lnk, cmp, che, sup, met, men, nnj, amb, tri, EmptyQuadrant, Limbo, cpXY, cpID, IndusArray,
  ResArr, newStarbase, newStargate, newConstr,
} from './types.js';
import {
  DirX, DirY, TechDev, TechAdj2, K4, K6, AmbrosiaAdj, ClassIndAdj, ISSP, SafetyAdj,
  SuppliesPerBillion, ThgAdj, TypeData, PrincipalIndustry, CargoSpace, YearsToBuild,
  FltMovementRate, TechN, TechnologyName, IndusNames, ThingNames, ObjName,
} from './datacnst.js';
import {
  InGalaxy, SameXY, SameID, Distance, TotalProd, FleetCargoSpace, GreaterInt, LesserInt, Rnd,
  ISqrt, FuelConsumption, StringReplace,
} from './misc.js';
import {
  GetObject, GetStatus, Scouted, Known, ScoutObject, GetNebula, GetCapital, GetTech,
  SetEmpireTechnology, SetCapital, SetType, GetEfficiency, SetEfficiency, ChangeTotalRevIndex,
  GetIndus, SetClass, SetTerraformTarget, PutIndus, GetClass, GetPopulation, GetType,
  GetSpecial, GetISSP, GetWarpLinkFreq, GetGateType, GetBaseType, GetCoord, GetShips, GetCargo,
  GetFleetFuel, TypeOfFleet, SetStatus, InitializeISSP, EmpireName, EmpirePlayer, DeleteAllNames,
  GetFleets, GetName, LongFormat, AddIDCell, GetCoord as GC,
} from './primintr.js';
import { AddNews, EraseNews, N } from './news.js';
import { AbortFleet, DestroyFleet } from './fleet.js';
import { CleanUpNPE } from './npe.js';

const LimboLoc = (id) => ({ XY: cpXY(Limbo), ID: cpID(id) });

export function Scout(Emp, XY) {
  if (SameXY(XY, Limbo)) return;
  for (let d = NoDir; d <= Nw; d++) {
    const x = XY.x + DirX[d], y = XY.y + DirY[d];
    if (!InGalaxy(x, y)) continue;
    const TempLoc = { x, y };
    const Obj = GetObject(TempLoc);
    const OtherEmp = GetStatus(Obj);
    if (!Scouted(Emp, Obj) && Obj.ObjTyp !== Void) {
      if (!Known(Emp, Obj) && OtherEmp !== Emp) AddNews(Emp, N.POk, LimboLoc(Obj), 0, 0, 0);
      ScoutObject(Emp, Obj);
    }
    if (GetNebula(TempLoc) === DarkNebula) return;
  }
}

function forActive(max, set, fn) { for (let i = 1; i <= max; i++) if (bIn(i, set)) fn(i); }

export function ClearScoutSet(Emp) {
  const m = ~(1 << Emp);
  for (let i = 1; i <= G.NoOfPlanets; i++) Universe.Planet[i].ScoutedBy &= m;
  forActive(MaxNoOfStarbases, G.SetOfActiveStarbases, (i) => { Universe.Starbase[i].ScoutedBy &= m; });
  forActive(MaxNoOfStargates, G.SetOfActiveGates, (i) => { Universe.Stargate[i].ScoutedBy &= m; });
  forActive(MaxNoOfConstrSites, G.SetOfActiveConstructionSites, (i) => { Universe.Constr[i].ScoutedBy &= m; });
}

export function ClearKnownSet(Emp) {
  const m = ~(1 << Emp);
  for (let i = 1; i <= G.NoOfPlanets; i++) Universe.Planet[i].KnownBy &= m;
  forActive(MaxNoOfStarbases, G.SetOfActiveStarbases, (i) => { Universe.Starbase[i].KnownBy &= m; });
  forActive(MaxNoOfStargates, G.SetOfActiveGates, (i) => { Universe.Stargate[i].KnownBy &= m; });
  forActive(MaxNoOfConstrSites, G.SetOfActiveConstructionSites, (i) => { Universe.Constr[i].KnownBy &= m; });
}

export function DesignateWorld(World, NewType) {
  if (NewType === CapTyp) {
    const Emp = GetStatus(World);
    const CapID = GetCapital(Emp);
    const OldTech = GetTech(CapID), NewTech = GetTech(World);
    if (OldTech > NewTech) SetEmpireTechnology(Emp, NewTech, TechDev[NewTech]);
    else if (OldTech < NewTech) SetEmpireTechnology(Emp, NewTech, TechDev[NewTech - 1]);
    SetCapital(Emp, World);
    SetType(CapID, BseTyp);
    const Eff = GetEfficiency(CapID);
    SetEfficiency(CapID, Eff - Round(Eff / (1.5 + Random())));
    ChangeTotalRevIndex(Emp, Rnd(35, 45));
  }
  const Eff = GetEfficiency(World);
  SetEfficiency(World, Eff - Round(Eff / (1.5 + Random())));
  SetType(World, NewType);
}

export function TerraformWorld(World, NewClass) {
  const Old = GetIndus(World);
  SetClass(World, TerCls);
  SetType(World, TerTyp);
  SetTerraformTarget(World, NewClass);
  const New = IndusArray();
  for (let i = BioInd; i <= TriInd; i++) New[i] = Round(Old[i] / 2);
  PutIndus(World, New);
  SetEfficiency(World, Round(GetEfficiency(World) / 100 * Rnd(30, 60)));
}

// Gamma[IndusTypes][IndusTypes]
const Gamma = (() => {
  const g = [];
  for (let i = 0; i < 9; i++) g.push(new Array(9).fill(0));
  g[CheInd] = [1.12857, 0, 0, 0.19143, 0.50000, 0.36714, 0.25286, 0, 0];
  g[MinInd] = [0.10000, 0, 0, 0.30514, 0.27286, 0.53714, 0.83571, 0, 0];
  g[TriInd] = [0.10000, 0, 0, 0.07627, 0.20400, 0.16667, 0.08000, 0, 0];
  return g;
})();

export function GetIndustrialDistribution(Obj) {
  const Tech = GetTech(Obj), Cls = GetClass(Obj), Pop = GetPopulation(Obj), Typ = GetType(Obj);
  const Eff = GetEfficiency(Obj);
  const AmbAdd = (GetSpecial(Obj) & (1 << AmbAddict)) !== 0;
  const IndDist = new Array(9).fill(0);

  const Alpha = (TechAdj2[Tech] / 100) * (Eff + 250) / K6;
  let TIP = TotalProd(Pop, Tech);
  if (AmbAdd) TIP *= AmbrosiaAdj;
  if (TIP > 999) TIP = 999;

  const Beta = new Array(9);
  const Temp = TIP / 10000;
  for (let i = BioInd; i <= TriInd; i++) {
    Beta[i] = Temp * ClassIndAdj[Cls][i];
    if (Beta[i] === 0) Beta[i] = 1;
  }

  let I = (Math.sqrt((SafetyAdj * ISSP[GetISSP(Obj, SupInd)] * (SuppliesPerBillion / 100) * Pop) /
    ((ThgAdj[SupInd][sup] / 100) * Alpha)) - K4) / Beta[SupInd];
  if (I > 95 || I < 0 || Typ === AgrTyp || !isFinite(I)) I = 95;
  IndDist[SupInd] = I;

  if ([AgrTyp, CheTyp, MinTyp, RawTyp, RawSTyp, RsrTyp, TerTyp, TriTyp].includes(Typ)) {
    I = 100 - IndDist[SupInd];
    IndDist[CheInd] = I * (TypeData[Typ][CheInd] / 100);
    IndDist[MinInd] = I * (TypeData[Typ][MinInd] / 100);
    IndDist[TriInd] = I * (TypeData[Typ][TriInd] / 100);
  } else {
    const MainInd = PrincipalIndustry[Typ];
    const A = -K4 * (1 / Beta[CheInd] + 1 / Beta[MinInd] + 1 / Beta[TriInd]);
    const sq = (ind) => Math.sqrt(SafetyAdj * ISSP[GetISSP(Obj, ind)] * Gamma[ind][MainInd]);
    const B = sq(CheInd) / Beta[CheInd] + sq(MinInd) / Beta[MinInd] + sq(TriInd) / Beta[TriInd];
    I = (100 - (IndDist[SupInd] + A + (K4 * B))) / (1 + (Beta[MainInd] * B));
    if (I > TypeData[Typ][MainInd]) I = TypeData[Typ][MainInd];
    IndDist[MainInd] = I;
    for (const ind of [CheInd, MinInd, TriInd]) {
      let v = ((IndDist[MainInd] * Beta[MainInd] + K4) * sq(ind) - K4) / Beta[ind];
      if (v < 0) v = 1;
      IndDist[ind] = v;
    }
  }
  return IndDist;
}

export function CreatePlanet(ID, NewXY) {
  gal.Sector[NewXY.x][NewXY.y].Obj = cpID(ID);
  const p = Universe.Planet[ID.Index];
  p.XY = cpXY(NewXY);
  p.ImpExp = 0x5555;
}

export function NextStarbaseSlot() {
  let s = MaxNoOfStarbases;
  while (s > 0 && bIn(s, G.SetOfActiveStarbases)) s--;
  return s;
}

export function CreateStarbase(ID, NewEmp, NewXY, NewTyp) {
  gal.Sector[NewXY.x][NewXY.y].Obj = cpID(ID);
  const old = Universe.Starbase[ID.Index];
  const b = newStarbase();
  // fields not initialized by the original keep their old values
  b.Typ = old.Typ; b.Tech = old.Tech; b.Eff = old.Eff; b.Special = old.Special; b.Pop = old.Pop;
  b.XY = cpXY(NewXY);
  b.STyp = NewTyp;
  b.Dest = cpXY(NewXY);
  b.Status = FReady;
  b.Emp = NewEmp;
  b.ScoutedBy = 1 << NewEmp;
  b.KnownBy = 1 << NewEmp;
  b.RevIndex = 0;
  Universe.Starbase[ID.Index] = b;
  G.SetOfActiveStarbases = bAdd(G.SetOfActiveStarbases, ID.Index);
  G.SetOfStarbasesOf[NewEmp] = bAdd(G.SetOfStarbasesOf[NewEmp], ID.Index);
}

export function NextStargateSlot() {
  let s = MaxNoOfStargates;
  while (s > 0 && bIn(s, G.SetOfActiveGates)) s--;
  return s;
}

export function CanUseGate(Emp, GateID) {
  return GetWarpLinkFreq(Emp, GateID) === GetWarpLinkFreq(GetStatus(GateID), GateID);
}

export function CreateStargate(ID, NewEmp, GateType, Pos) {
  G.SetOfActiveGates = bAdd(G.SetOfActiveGates, ID.Index);
  const g = newStargate();
  g.XY = cpXY(Pos);
  g.Emp = NewEmp;
  g.ScoutedBy = 1 << NewEmp;
  g.KnownBy = 1 << NewEmp;
  g.GTyp = GateType;
  g.Dest = cpXY(Limbo);
  g.WLF[NewEmp] = Random(9999);
  Universe.Stargate[ID.Index] = g;
  gal.Sector[Pos.x][Pos.y].Obj = cpID(ID);
}

// BalanceFleet: mutates Cr
export function BalanceFleet(Sh, Cr) {
  const CargoPriority = [che, sup, met, men, nnj, tri, amb];
  let k = 0;
  let ThgI = CargoPriority[k];
  let SpaceLeft = FleetCargoSpace(Sh, Cr);
  while (SpaceLeft < 0) {
    Cr[ThgI] = 0;
    const NewSpaceLeft = FleetCargoSpace(Sh, Cr);
    if (NewSpaceLeft < 0) {
      SpaceLeft = NewSpaceLeft;
      k++;
      if (k >= CargoPriority.length) break;
      ThgI = CargoPriority[k];
    } else {
      Cr[ThgI] = NewSpaceLeft * CargoSpace[ThgI];
      SpaceLeft = 0;
    }
  }
}

export function DestroyStargate(GteID) {
  const g = Universe.Stargate[GteID.Index];
  gal.Sector[g.XY.x][g.XY.y].Obj = cpID(EmptyQuadrant);
  G.SetOfActiveGates = bDel(G.SetOfActiveGates, GteID.Index);
}

// Returns ConID (Void index 0 if no slot)
export function Construction(Empr, ConsType, Loc) {
  let i = MaxNoOfConstrSites;
  while (i > 0 && bIn(i, G.SetOfActiveConstructionSites)) i--;
  if (i === 0) return cpID(EmptyQuadrant);
  const ConID = { ObjTyp: Con, Index: i };
  const c = newConstr();
  c.XY = cpXY(Loc);
  c.Emp = Empr;
  c.CTyp = ConsType;
  c.ScoutedBy = 1 << Empr;
  c.KnownBy = 1 << Empr;
  c.TimeToCompletion = YearsToBuild[ConsType];
  Universe.Constr[i] = c;
  G.SetOfActiveConstructionSites = bAdd(G.SetOfActiveConstructionSites, i);
  G.SetOfConstructionSitesOf[Empr] = bAdd(G.SetOfConstructionSitesOf[Empr], i);
  gal.Sector[Loc.x][Loc.y].Obj = cpID(ConID);
  return ConID;
}

export function DestroyConstruction(ConID) {
  const c = Universe.Constr[ConID.Index];
  const OldEmp = c.Emp;
  gal.Sector[c.XY.x][c.XY.y].Obj = cpID(EmptyQuadrant);
  G.SetOfActiveConstructionSites = bDel(G.SetOfActiveConstructionSites, ConID.Index);
  G.SetOfConstructionSitesOf[OldEmp] = bDel(G.SetOfConstructionSitesOf[OldEmp], ConID.Index);
}

export function PassingThroughFortress(FltXY) {
  const b = GetObject(FltXY);
  return b.ObjTyp === Base && GetBaseType(b) === frt;
}

export function PassingThroughGate(FltID, FltXY, DestXY) {
  const GateObj = GetObject(FltXY);
  if (GateObj.ObjTyp === Gate &&
      GetWarpLinkFreq(GetStatus(FltID), GateObj) === GetWarpLinkFreq(GetStatus(GateObj), GateObj)) {
    const GateType = GetGateType(GateObj);
    if (GateType === gte) return true;
    if (GateType === lnk) {
      const DestObj = GetObject(DestXY);
      // NOTE: original compares with <> for the destination gate (preserved)
      if (DestObj.ObjTyp === Gate && (GetGateType(DestObj) === lnk || GetGateType(DestObj) === gte) &&
          GetWarpLinkFreq(GetStatus(FltID), DestObj) !== GetWarpLinkFreq(GetStatus(DestObj), DestObj))
        return true;
    }
  }
  return false;
}

export function EstimatedDateOfArrival(ID) {
  let EDA = 0;
  if (ID.ObjTyp === Flt) {
    const f = Universe.Fleet[ID.Index];
    if (PassingThroughGate(ID, f.XY, f.Dest)) EDA = 1;
    else {
      let Dist = GreaterInt(Math.abs(f.XY.x - f.Dest.x), Math.abs(f.XY.y - f.Dest.y));
      if (PassingThroughFortress(f.XY)) Dist = GreaterInt(Dist - 4, 1);
      const Q = FltMovementRate[TypeOfFleet(ID)];
      EDA = Math.floor(Dist / Q);
      if (Dist % Q > 0) EDA++;
    }
  } else if (ID.ObjTyp === Base) {
    const b = Universe.Starbase[ID.Index];
    EDA = GreaterInt(Math.abs(b.XY.x - b.Dest.x), Math.abs(b.XY.y - b.Dest.y));
  }
  return EDA;
}

export function EstimatedRange(ID) {
  const Ships = GetShips(ID), Cargo = GetCargo(ID);
  if (ID.ObjTyp === Flt) return Math.trunc(GetFleetFuel(ID) / FuelConsumption(Ships, Cargo));
  if (ID.ObjTyp === Base) return Math.floor(Cargo[tri] / 100);
  return 0;
}

// ---- news text -------------------------------------------------------------------------

const ThgN = { [men]: '', [nnj]: '', [amb]: 'ambrosia', [che]: 'chemicals', [met]: 'metals', [sup]: 'supplies', [tri]: 'trillum' };

export function GetNewsLine(Player, Item) {
  const { Headline, Loc1: Loc, Parm1, Parm2 } = Item;
  const LocN = GetName(Player, Loc, LongFormat);
  let EmpN = '';
  if (Parm1 <= 8 && Parm1 >= 0) EmpN = EmpireName(Parm1);
  const Parm1N = String(Parm1), Parm2N = String(Parm2);
  const DeathN = Parm1 < 100 ? (Parm1 * 10) + ' million' : RealStr(Parm1 / 100, 4, 1) + ' billion';
  const lack = () => {
    const Verb = [' needs more ', ' lacks ', ' has run out of ', ' requires more ', ' has used up all its '][Rnd(1, 5) - 1];
    return LocN + Verb + (ThgN[Parm1] || '') + '.';
  };
  const en2 = () => EmpireName(Parm2 >= 0 && Parm2 <= 8 ? Parm2 : 8);
  let Line = '';
  switch (Headline) {
    case N.Lack: Line = lack(); break;
    case N.DefLack: Line = '* needs ' + (ThgN[Parm1] || '') + ' to build defenses.'; break;
    case N.IndLack: Line = '* cannot build up its industry due to a lack of metals.'; break;
    case N.Starv: Line = DeathN + ' people have died of starvation on *.'; break;
    case N.NTech: Line = '* has advanced to ' + TechN[Parm1] + ' level technology.'; break;
    case N.RTech: Line = '* has regressed to ' + TechN[Parm1] + ' level technology.'; break;
    case N.ConsLack: Line = lack(); break;
    case N.ConsDone: Line = 'Construction at * has been completed.'; break;
    case N.RebelW1: Line = 'The people of * are dissatisfied with the empire.'; break;
    case N.RebelW2: Line = 'Riots and demonstrations are widespread on *.'; break;
    case N.RebelW3: Line = 'Some signs of organized rebellion detected on *.'; break;
    case N.RebelW4: Line = 'Rebel forces on * are well organized and plan an attack.'; break;
    case N.Rebel: Line = 'Rebel forces on * have succeeded in taking over.'; break;
    case N.URebel: Line = 'Imperial troops ended a rebellion on *.  ' + Parm1N + ' legions lost.'; break;
    case N.POk: Line = 'Imperial probe has scouted *.'; break;
    case N.NCapTech: Line = '* has developed ' + TechnologyName[Parm1] + ' technology.'; break;
    case N.NCapLvl: Line = '* has developed ' + TechN[Parm1] + ' level technology.'; break;
    case N.BattleW1: Line = '* was attacked by @.  Attack force destroyed.'; break;
    case N.BattleW2: Line = '* was attacked by @.  Attack force retreated.'; break;
    case N.BattleL: Line = '* has been conquered by the empire of @.'; break;
    case N.WAddict: Line = 'The people of * are now addicted to ambrosia.'; break;
    case N.UAddict: Line = '* is no longer addicted to ambrosia.'; break;
    case N.AddictDie: Line = DeathN + ' people have died on * of ambrosia withdrawal.'; break;
    case N.RiotsDie: Line = DeathN + ' people have died in large-scale riots on *.'; break;
    case N.IndDs: Line = '   ' + Parm1N + ' ' + IndusNames[Parm2] + ' have been destroyed on *.'; break;
    case N.DInd: Line = '* has declared independence.'; break;
    case N.Join: Line = '* has joined the empire of @.'; break;
    case N.NewCap: Line = '* has become the temporary capital of the empire.'; break;
    case N.EndEmp: Line = 'The empire has been conquered.'; break;
    case N.NoFuel: Line = '* is out of fuel.'; break;
    case N.FltDet: Line = '@ fleet has been scanned near *.'; break;
    case N.MinesDm: Line = '* suffered damage from @ SRM field.'; break;
    case N.MinesDs: Line = '* was destroyed in @ SRM field.'; break;
    case N.Mines: Line = '@ fleet damaged in SRM field at *.'; break;
    case N.ConDs: Line = '@ has attacked and destroyed construction at *.'; break;
    case N.GteDs: Line = 'Stargate at * has been destroyed by @.'; break;
    case N.LAMDm: Line = '* was damaged by @ LAMs.'; break;
    case N.LAMDs: Line = '* has been destroyed by a @ LAM attack.'; break;
    case N.LAMDef: Line = '* has been hit by @ LAMs.'; break;
    case N.DestDetail: Line = '   ' + Parm1N + ' ' + ThingNames[Parm2] + ' destroyed.'; break;
    case N.TrnsShp: Line = '* has received the following resources from @:'; break;
    case N.Trns2: Line = '   ' + Parm1N + ' ' + ThingNames[Parm2]; break;
    case N.NSellTech: Line = '@ has given the empire ' + TechnologyName[Parm2] + ' technology.'; break;
    case N.GInd: Line = '@ has granted this empire the rights to *.'; break;
    case N.NewPlEmp: Line = 'The empire of @ has been formed on *.'; break;
    case N.PCap: Line = 'Enemy probe from @ destroyed at *.'; break;
    case N.PDest: Line = 'Lost contact with probe at *.'; break;
    case N.MessR: Line = 'Message received from @.'; break;
    case N.MessI: Line = '* has intercepted a message from @.'; break;
    case N.ConDsUNK: Line = 'Construction at * has been destroyed by unknown force.'; break;
    case N.GteDsUNK: Line = 'Unknown forces have destroyed stargate at *.'; break;
    case N.BattleW2UNK: Line = '* has been attacked by unknown forces.'; break;
    case N.BattleLUNK: Line = 'Lost contact with *.  Presume destroyed.'; break;
    case N.HLPopKill: Line = 'Native alien life-forms have killed ' + DeathN + ' on *.'; break;
    case N.HLMenKill: Line = 'Aliens on * attack.  Casualties: ' + Parm1N + ' men, ' + Parm2N + ' ninja.'; break;
    case N.HLJoin: Line = Parm1N + ' alien legions have joined imperial forces on *.'; break;
    case N.BseFuel: Line = '* is out of trillum.'; break;
    case N.BseBlocked: Line = '* blocked in transit.'; break;
    case N.SRMClear: Line = 'SRMs at * have been cleared by @.'; break;
    case N.OrdersSRMClear: Line = '* sweeped SRMs as ordered.'; break;
    case N.OrdersNoSRMs: Line = 'SRM sweep by * failed - no SRMs found.'; break;
    case N.OrdersNoSSP: Line = 'SRM sweep by * failed - not enough starships.'; break;
    case N.FltBlocked: Line = '* blocked by dense nebula.'; break;
    case N.NebGate: Line = '* unable to gate to inpenetrable nebula.'; break;
    case N.BseSD: Line = '@ has destroyed *.'; break;
    case N.FltSD: Line = '* destroyed by explosion.'; break;
    case N.WHolo: Line = 'Population centers on * have been bombarded by @.'; break;
    case N.DthHolo: Line = '   ' + DeathN + ' people were killed in the attack.'; break;
    case N.Disrupt: Line = '* has been stopped by @ disrupter.'; break;
    case N.NoTriRes: Line = 'All trillum deposits on * have been exhausted.'; break;
    case N.TriResWarn1: Line = 'Trillum deposits on * are nearly depleted.'; break;
    case N.TriResWarn2: Line = 'Trillum deposits on * are very low.'; break;
    case N.MilitRev: Line = 'Demonstrations on * call for removal of imperial troops.'; break;
    case N.RevControl: Line = 'Imperial troops on * disband angry rioters.'; break;
    case N.GLBDest: Line = '@ has attacked * (' + en2() + '). Attack Failed.'; break;
    case N.GLBConq: Line = '@ has conquered * (' + en2() + ').'; break;
    case N.GLBCapConq: Line = '@ has attacked and conquered the ' + en2() + ' capital.'; break;
    case N.GLBLAMStrk: Line = '@ has hit * (' + en2() + ') with LAMs.'; break;
    case N.GLBRev: Line = '* has declared independence from @.'; break;
    case N.OutProbe: Line = '* has been scouted by outpost scanners.'; break;
    case N.TerChaos: Line = 'Terraforming on * catastrophically failed.'; break;
    case N.TerSuccess: Line = 'Terraforming on * has been completed successfully.'; break;
  }
  Line = StringReplace(Line, '*', LocN);
  Line = StringReplace(Line, '@', EmpN);
  return Line;
}

// ---- misc ------------------------------------------------------------------------------

// Returns an array of up to N planet IDs ordered by distance from XY
export function GetNearestWorlds(XY, Nn, SetToConsider) {
  const Bucket = [];
  for (let i = 0; i <= gal.SizeOfGalaxy; i++) Bucket.push([]);
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (bIn(i, SetToConsider)) {
      const id = { ObjTyp: Pln, Index: i };
      const d = Distance(GetCoord(id), XY);
      if (d <= gal.SizeOfGalaxy) Bucket[d].push(id);
    }
  }
  const out = [];
  for (let i = 0; i <= gal.SizeOfGalaxy; i++)
    for (const id of Bucket[i]) if (out.length < Nn) out.push(id);
  return out;
}

export function GetOptimumIndus(Obj) {
  const IndusDist = GetIndustrialDistribution(Obj);
  const Pop = GetPopulation(Obj), Cls = GetClass(Obj), Tech = GetTech(Obj);
  let TIP = TotalProd(Pop, Tech);
  if (GetSpecial(Obj) & (1 << AmbAddict)) TIP = Round(TIP * AmbrosiaAdj);
  const Indus = IndusArray();
  for (let i = BioInd; i <= TriInd; i++)
    Indus[i] = Round(TIP * (IndusDist[i] / 100) * (ClassIndAdj[Cls][i] / 100));
  return Indus;
}

export function ProbeScout(Emp, XY) {
  if (SameXY(XY, Limbo)) return;
  for (let d = NoDir; d <= Nw; d++) {
    const x = XY.x + DirX[d], y = XY.y + DirY[d];
    if (!InGalaxy(x, y)) continue;
    const TempLoc = { x, y };
    const Obj = GetObject(TempLoc);
    const OtherEmp = GetStatus(Obj);
    if (!Scouted(Emp, Obj) && Obj.ObjTyp !== Void) {
      const Loc = LimboLoc(Obj);
      const Cargo = GetCargo(Obj);
      const Chance = ISqrt(Cargo[men]);
      if (OtherEmp !== Indep && Rnd(1, 100) < Chance) {
        AddNews(Emp, N.PDest, Loc, 0, 0, 0);
        AddNews(OtherEmp, N.PCap, Loc, Emp, 0, 0);
        return;
      }
      if (!Known(Emp, Obj) && OtherEmp !== Emp) AddNews(Emp, N.POk, Loc, 0, 0, 0);
      ScoutObject(Emp, Obj);
    }
    if (GetNebula(TempLoc) === DarkNebula) return;
  }
}

export function UpdateProbes(Emp) {
  const P = Universe.EmpireData[Emp].Probe;
  for (let i = 1; i <= NoOfProbesPerEmpire; i++) {
    if (P[i].Status === PInTrans) {
      ProbeScout(Emp, P[i].Dest);
      P[i].Status = PReady;
    }
  }
}

export function ProbesReturn(Emp) {
  const P = Universe.EmpireData[Emp].Probe;
  for (let i = 1; i <= NoOfProbesPerEmpire; i++) if (P[i].Status === PAtDest) P[i].Status = PReady;
}

function InRangeOfStarbase(Emp, ObjXY) {
  let r = false;
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (bIn(i, G.SetOfStarbasesOf[Emp])) {
      const b = { ObjTyp: Base, Index: i };
      if (Distance(GetCoord(b), ObjXY) < 6 && GetBaseType(b) !== cmp) r = true;
    }
  }
  return r;
}

function InRangeOfPlanet(Emp, FTyp, ObjXY) {
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (bIn(i, G.SetOfPlanetsOf[Emp])) {
      const p = { ObjTyp: Pln, Index: i };
      if (Distance(GetCoord(p), ObjXY) <= 5 && FTyp !== HKFleet && FTyp !== Penetrator &&
          GetNebula(ObjXY) === NoNeb) return true;
    }
  }
  return false;
}

function DetermineIfScouted(Emp, Obj) {
  const ObjXY = GetCoord(Obj);
  if (Known(Emp, Obj)) {
    if (!Scouted(Emp, Obj)) {
      const CapXY = GetCoord(GetCapital(Emp));
      if (GetStatus(Obj) === Emp) ScoutObject(Emp, Obj);
      else if (Distance(CapXY, ObjXY) < 6) ScoutObject(Emp, Obj);
      else if (InRangeOfStarbase(Emp, ObjXY)) ScoutObject(Emp, Obj);
    }
  } else if (Rnd(1, 2) === 1 && InRangeOfStarbase(Emp, ObjXY)) {
    AddNews(Emp, N.OutProbe, LimboLoc(Obj), 0, 0, 0);
    ScoutObject(Emp, Obj);
  }
}

export function ScoutFleets(PlayerEmp) {
  const pbit = 1 << PlayerEmp;
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, G.SetOfActiveFleets)) continue;
    const f = Universe.Fleet[i];
    const FltID = { ObjTyp: Flt, Index: i };
    const FTyp = TypeOfFleet(FltID);
    f.ScoutedBy &= ~pbit;
    f.KnownBy &= ~pbit;
    if (f.Emp === PlayerEmp) {
      f.ScoutedBy |= pbit;
      f.KnownBy |= pbit;
      continue;
    }
    let done = false;
    if (FTyp !== HKFleet) {
      for (let d = NoDir; d <= Nw && !done; d++) {
        const x = f.XY.x + DirX[d], y = f.XY.y + DirY[d];
        if (!InGalaxy(x, y)) continue;
        const s = gal.Sector[x][y];
        if (GetStatus(s.Obj) === PlayerEmp || (s.Flts & pbit)) {
          f.ScoutedBy |= pbit;
          f.KnownBy |= pbit;
          let Loc = { ID: cpID(s.Obj), XY: cpXY(Limbo) };
          if (GetStatus(s.Obj) !== PlayerEmp) {
            let j = MaxNoOfFleets;
            const Fleets = GetFleets({ x, y }) & G.SetOfFleetsOf[PlayerEmp];
            while (!bIn(j, Fleets) && j > 0) j--;
            Loc = { ID: { ObjTyp: Flt, Index: j }, XY: cpXY(Limbo) };
          }
          AddNews(PlayerEmp, N.FltDet, Loc, f.Emp, 0, 0);
          done = true;
        }
      }
    }
    if (done) continue;
    if (InRangeOfStarbase(PlayerEmp, f.XY)) {
      f.ScoutedBy |= pbit;
      f.KnownBy |= pbit;
      continue;
    }
    if (InRangeOfPlanet(PlayerEmp, FTyp, f.XY)) f.KnownBy |= pbit;
  }
}

export function ScoutObjects(Emp) {
  for (let i = 1; i <= G.NoOfPlanets; i++)
    if (bIn(i, G.SetOfPlanetsOf[Emp])) Scout(Emp, GetCoord({ ObjTyp: Pln, Index: i }));
  const fl = G.SetOfFleetsOf[Emp] & G.SetOfActiveFleets;
  for (let i = 1; i <= MaxNoOfFleets; i++)
    if (bIn(i, fl)) Scout(Emp, GetCoord({ ObjTyp: Flt, Index: i }));
  for (let i = 1; i <= G.NoOfPlanets; i++) DetermineIfScouted(Emp, { ObjTyp: Pln, Index: i });
  for (let i = 1; i <= MaxNoOfStarbases; i++)
    if (bIn(i, G.SetOfActiveStarbases)) DetermineIfScouted(Emp, { ObjTyp: Base, Index: i });
  for (let i = 1; i <= MaxNoOfStargates; i++)
    if (bIn(i, G.SetOfActiveGates)) DetermineIfScouted(Emp, { ObjTyp: Gate, Index: i });
}

export function DestroyEmpire(Emp) {
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    const id = { ObjTyp: Pln, Index: i };
    if (GetStatus(id) === Emp) {
      SetStatus(id, Indep);
      SetType(id, IndTyp);
      InitializeISSP(id);
    }
  }
  for (let i = 1; i <= MaxNoOfStarbases; i++)
    if (bIn(i, G.SetOfStarbasesOf[Emp])) SetStatus({ ObjTyp: Base, Index: i }, Indep);
  const fl = G.SetOfFleetsOf[Emp] & G.SetOfActiveFleets;
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (bIn(i, fl)) {
      const id = { ObjTyp: Flt, Index: i };
      const Ground = GetObject(GetCoord(id));
      if (!SameID(Ground, EmptyQuadrant)) AbortFleet(id, Ground, true);
      DestroyFleet(id);
    }
  }
  EraseNews(Emp);
  DeleteAllNames(Emp);
  if (!EmpirePlayer(Emp)) CleanUpNPE(Emp);
  Universe.EmpireData[Emp].InUse = false;
}

// GetEmpireStatus: { Planets, TotalPop, SInd, TotalShips }
export function GetEmpireStatus(Emp) {
  let Planets = 0, TotalPop = 0, ShipInd = 0;
  const TotalShips = ResArr();
  const addShips = (s) => { for (let k = 5; k <= 11; k++) TotalShips[k] += s[k]; };
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const p = Universe.Planet[i];
    Planets++; TotalPop += p.Pop;
    const IP = (TechAdj2[p.Tech] / 100) * ((p.Eff + 250) / 100) / K6;
    for (let k = SYGInd; k <= SYTInd; k++) ShipInd += IP * Sqr(p.Indus[k] + K4);
    addShips(p.Ships);
  }
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfStarbasesOf[Emp])) continue;
    const b = Universe.Starbase[i];
    Planets++; TotalPop += b.Pop;
    addShips(b.Ships);
    if (b.STyp === cmp) {
      const IP = (TechAdj2[b.Tech] / 100) * ((b.Eff + 250) / 100) / K6;
      for (let k = SYGInd; k <= SYTInd; k++) ShipInd += IP * Sqr(b.Indus[k] + K4);
    }
  }
  const fl = G.SetOfFleetsOf[Emp] & G.SetOfActiveFleets;
  for (let i = 1; i <= MaxNoOfFleets; i++) if (bIn(i, fl)) addShips(Universe.Fleet[i].Ships);
  return { Planets, TotalPop, SInd: Round(ShipInd), TotalShips };
}
