// Player commands (PLAYTURN, DESIGN, FLTCOMM, CLSCOMM, MSCCOMM, CONSTR, NAMES, ATTCOMM entry points)
// exposed as UI-free functions. Validation mirrors PLAYTURN's CheckForObjectErrors.
import { bIn, Val, UpCase, UpCaseStr, Trunc } from '../runtime/pascal.js';
import {
  Universe, G, MaxNoOfFleets, MaxNoOfStarbases, MaxNoOfStargates, NoOfFleetsPerEmpire, Empire1,
  Empire8, Indep, Void, Con, Pln, Base, Gate, Flt, DestFlt, fgt, hkr, jmp, jtn, pen, ssp, trn,
  men, nnj, amb, tri, LAM, ter, WrpTchLvl, ArtCls, TerCls, CapTyp, TerTyp, IndTyp, OutTyp, BseSTyp,
  JmpSTyp, StrSTyp, TrnSTyp, RawSTyp, AgrTyp, TriTyp, RsrTyp, RawTyp, MinTyp, BseTyp, JmpTyp,
  StrTyp, TrnTyp, NnjTyp, AmbTyp, AmbCls, ParCls, GsGCls, IceCls, OcnCls, PsnCls, ArdCls, BarCls,
  DrtCls, UndCls, VlcCls, cmp, SRM, dis, DpSpc, Grnd, SbOrb, EmptyQuadrant, Limbo, cpID, cpXY,
  ResArr, MaxResources,
} from './types.js';
import {
  TechDev, MinTechForType, TypeName, IndusNames, PrincipalIndustry, TerraformPotentialClasses,
  ThingNames, CargoSpace, TrnAdj, FuelPerTon, TechnologyName, ConsCargoNeeded, YearsToBuild,
  MaxISSP,
} from './datacnst.js';
import {
  SameID, SameXY, NoShips, FleetCargoSpace, ThgLmt, LesserInt, Distance, FuelCapacity, Rnd,
} from './misc.js';
import {
  GetStatus, GetType, GetClass, GetTech, GetShips, GetCargo, GetDefns, PutDefns, GetTrillum,
  GetObject, GetFleets, GetCoord, Scouted, Known, MyLord, EmpireName, EmpireActive, GetCapital,
  GetEmpireTechnology, SetEmpireTechnology, GetBaseType, GetEfficiency, ObjectName, GetName,
  ShortFormat, LongFormat, Name2Index, GetDefinedName, DeleteName, AddName, GetProbe, LaunchProbe,
  EnemyMine, PutMine, GetISSP, SetISSP, InitializeISSP, SetStatus, GetFleetFuel, GetLocation,
  GetWarpLinkFreq, SetWarpLinkFreq, GetDefenseSettings, SetDefenseSettings, Location2Index,
  GetCoordName, GetPopulation, GetConstrType,
} from './primintr.js';
import {
  DesignateWorld, TerraformWorld, BalanceFleet, Construction, DestroyConstruction,
} from './intrface.js';
import {
  DeployFleet, AbortFleet, DestroyFleet, ChangeCompositionOfFleet, SetFleetDestination,
  RefuelFleet,
} from './fleet.js';
import {
  CompileOrders, FleetNextStatement, SetFleetNextStatement, GetFleetCode, SetFleetCode,
  NumberOfCommands, NoOER, BadCommandOER, BadDestOER, BadResourceOER, BadTransferOER,
} from './orders.js';
import { AddNews, N } from './news.js';
import { SendMessage as SendMsg, SetMessageRead } from './mess.js';
import { LAMAttack, DestroyConstructionOrGate, ConquerAIT, DefConqueredART } from './attack.js';
import { NPEAttack } from './attnpe.js';
import { SelfDestructObject } from './sbase.js';
import { ClrMineScout as ClearMineScout } from './types.js';
import { env } from './env.js';

const P = () => env.Player;
const lord = () => MyLord(P());
const ok = (message = '') => ({ ok: true, message });
const fail = (message) => ({ ok: false, message });

// ---- validation (PLAYTURN CheckForObjectErrors) ----------------------------------------

export const Cond = {
  NotAFlt: 'NotAFlt', NotPartOfEmp: 'NotPartOfEmp', InUse: 'InUse', NotInUse: 'NotInUse',
  NotMoving: 'NotMoving', NoPlaceToTra: 'NoPlaceToTra', NotKnown: 'NotKnown', NoPlaceToRef: 'NoPlaceToRef',
  NotAWorld: 'NotAWorld', NotConsSite: 'NotConsSite', NoTarget: 'NoTarget', NotEmpty: 'NotEmpty',
  IsACap: 'IsACap', CapDes: 'CapDes', TerDes: 'TerDes', OutDes: 'OutDes', TerTech: 'TerTech',
  TerCap: 'TerCap', TerWrongCls: 'TerWrongCls', TerNotWarp: 'TerNotWarp', NoLAMs: 'NoLAMs',
  NoStr1: 'NoStr1', NoOrders: 'NoOrders', NoFltToTrans: 'NoFltToTrans',
};

const ORDER = ['NotKnown', 'InUse', 'NotInUse', 'NotMoving', 'NotAFlt', 'NotAWorld', 'NoFltToTrans',
  'NotConsSite', 'NotScouted', 'NotPartOfEmp', 'NoStr1', 'NoPlaceToTra', 'NoPlaceToRef',
  'NoTarget', 'NoLAMs', 'IsACap', 'CapDes', 'TerDes', 'OutDes', 'TerTech', 'TerNotWarp',
  'TerCap', 'TerWrongCls', 'NoOrders'];

function checkOne(c, Obj) {
  const Player = P();
  const isFleetActive = Obj.ObjTyp === Flt && bIn(Obj.Index, G.SetOfActiveFleets);
  switch (c) {
    case 'NotKnown':
      return (Obj.ObjTyp === Flt && bIn((~Obj.Index) & 0xFF, G.SetOfActiveFleets)) ||
        !(Obj.ObjTyp === Pln || Obj.ObjTyp === Flt || Obj.ObjTyp === Base) ||
        (!Known(Player, Obj) && !Scouted(Player, Obj));
    case 'InUse': return Obj.ObjTyp === Flt && isFleetActive;
    case 'NotInUse': return Obj.ObjTyp === Flt && !isFleetActive;
    case 'NotMoving': return !(Obj.ObjTyp === Flt || Obj.ObjTyp === Base);
    case 'NotAFlt': return Obj.ObjTyp !== Flt;
    case 'NotAWorld': return !(Obj.ObjTyp === Pln || Obj.ObjTyp === Base);
    case 'NoFltToTrans': return (GetFleets(GetCoord(Obj)) & G.SetOfFleetsOf[Player]) === 0n;
    case 'NotConsSite': return Obj.ObjTyp !== Con;
    case 'NotScouted': return !Scouted(Player, Obj);
    case 'NotPartOfEmp': return GetStatus(Obj) !== Player;
    case 'NoStr1': return GetShips(Obj)[ssp] < 100;
    case 'NoPlaceToTra': {
      const XY1 = GetCoord(Obj);
      const O2 = GetObject(XY1);
      if (O2.ObjTyp === Pln || O2.ObjTyp === Base) return false;
      const fl = GetFleets(XY1) & ~(1n << BigInt(Obj.Index));
      for (let i = MaxNoOfFleets; i > 0; i--) if (bIn(i, fl) && Scouted(Player, { ObjTyp: Flt, Index: i })) return false;
      return true;
    }
    case 'NoPlaceToRef': {
      const XY1 = GetCoord(Obj);
      const O2 = GetObject(XY1);
      if ((O2.ObjTyp === Pln || O2.ObjTyp === Base) && GetStatus(O2) === Player && GetTrillum(O2) !== 0) return false;
      const fl = GetFleets(XY1);
      for (let i = 1; i <= MaxNoOfFleets; i++) {
        if (!bIn(i, fl)) continue;
        const f = { ObjTyp: Flt, Index: i };
        if (GetStatus(f) === Player && GetTrillum(f) > 0) return false;
      }
      return true;
    }
    case 'NoTarget': {
      const XY1 = GetCoord(Obj);
      const O2 = GetObject(XY1);
      if (!(GetStatus(O2) === Player || SameID(O2, EmptyQuadrant))) return false;
      const fl = GetFleets(XY1) & ~G.SetOfFleetsOf[Player];
      for (let i = MaxNoOfFleets; i > 0; i--) if (bIn(i, fl) && Scouted(Player, { ObjTyp: Flt, Index: i })) return false;
      return true;
    }
    case 'NoLAMs': return GetDefns(Obj)[LAM] === 0;
    case 'IsACap': case 'CapDes': case 'TerCap': return GetType(Obj) === CapTyp;
    case 'TerDes': return GetType(Obj) === TerTyp;
    case 'OutDes': return Obj.ObjTyp === Base && GetBaseType(Obj) !== cmp;
    case 'TerTech': return !(GetEmpireTechnology(Player).TechSet & (1 << ter));
    case 'TerNotWarp': return GetTech(Obj) < WrpTchLvl;
    case 'TerWrongCls': return GetClass(Obj) === ArtCls || GetClass(Obj) === TerCls;
    case 'NoOrders': return Obj.ObjTyp === Flt && FleetNextStatement(Obj) === 0;
  }
  return false;
}

function errorText(c, parm) {
  const Player = P();
  const t = {
    NotAFlt: '* is not a fleet, @.',
    NotPartOfEmp: '@, * is not part of ' + EmpireName(Player),
    InUse: '* has already been deployed, @.',
    NotInUse: '@, * has not yet been deployed.',
    NotMoving: 'What an idea!  Unfortunately, @, * is immobile.',
    NoPlaceToTra: 'There is no place to transfer to, @.',
    NoPlaceToRef: 'There is no place to refuel a fleet in this sector, @.',
    NotAWorld: '* is not a world, @.',
    NotConsSite: '* is not a construction site, @.',
    NoTarget: '* has no targets, @.',
    NotEmpty: '* is not empty, @.',
    NotKnown: "There's no information available on *, @.",
    NotScouted: "There's no information available on *, @.",
    IsACap: "Not your capital, @.  If you wish for a coup d'grace, try abdicating.",
    CapDes: '@ is surely joking!  * is your capital!',
    TerDes: '@, * cannot be designated, for it is being terraformed.',
    OutDes: '@, * cannot be designated, for it has no industrial capacity.',
    TerTech: 'We have not yet developed Terraforming technology, @.',
    TerCap: 'That would be far too great a disruption to administration, @!',
    TerWrongCls: 'That class of planet is not suitable for terraforming, @.',
    TerNotWarp: '@, a planet must be warp-level or above to be terraformed.',
    NoLAMs: 'There are no LAMs at *, @.',
    NoStr1: 'You need at least 100 starships to sweep an SRM field, @.',
    NoOrders: '* has no orders, @.',
    NoFltToTrans: '@, we need to have a fleet in the sector before we can transact.',
  }[c] || '';
  return t.replace('@', lord()).replace('*', parm);
}

// Returns an error message or null
export function checkObject(Obj, conds, parm) {
  const name = parm || ObjectName(P(), Obj, ShortFormat);
  for (const c of ORDER) if (conds.includes(c) && checkOne(c, Obj)) return errorText(c, name);
  return null;
}

// Error conditions for each command's object parameter (PLAYTURN ParameterData)
export const CommandConds = {
  production: ['NotPartOfEmp', 'NotAWorld'],
  attack: ['NotAFlt', 'NotPartOfEmp', 'NotInUse', 'NoTarget'],
  abortConstruction: ['NotPartOfEmp', 'NotConsSite'],
  designate: ['NotPartOfEmp', 'NotInUse', 'NotAWorld', 'CapDes', 'TerDes', 'OutDes'],
  launchFrom: ['NotPartOfEmp', 'NotInUse'],
  abortFleet: ['NotPartOfEmp', 'NotInUse', 'NotAFlt', 'NoPlaceToTra'],
  changeDestination: ['NotPartOfEmp', 'NotInUse', 'NotMoving'],
  transfer: ['NotAFlt', 'NotPartOfEmp', 'NotInUse', 'NoPlaceToTra'],
  refuel: ['NotAFlt', 'NotPartOfEmp', 'NotInUse', 'NoPlaceToRef'],
  liberate: ['NotPartOfEmp', 'NotInUse', 'NotAWorld', 'IsACap'],
  launchLAMs: ['NotPartOfEmp', 'NotAWorld', 'NoLAMs'],
  issp: ['NotPartOfEmp', 'NotAWorld'],
  terraform: ['NotPartOfEmp', 'NotInUse', 'NotAWorld', 'TerTech', 'TerCap', 'TerWrongCls', 'TerNotWarp'],
  closeUp: ['NotKnown'],
  srmSweep: ['NotPartOfEmp', 'NotInUse', 'NotAFlt', 'NoStr1'],
  orders: ['NotPartOfEmp', 'NotInUse', 'NotAFlt'],
  cancelOrders: ['NotPartOfEmp', 'NotInUse', 'NotAFlt', 'NoOrders'],
};

export function canDo(cmd, Obj) { return checkObject(Obj, CommandConds[cmd] || []) === null; }

// ---- names ------------------------------------------------------------------------------

export function validateNewName(name, forFleet) {
  if (name.length > 8) return 'That name is too long, please restrict yourself to 8 characters, ' + lord() + '.';
  if (name === '' || name.indexOf(',') >= 0) return 'I can not use "' + name + '" as a name, ' + lord() + '.';
  const Player = P();
  const idx = Name2Index(Player, name);
  if (idx !== null) {
    if (!forFleet) return '"' + name + '" is already defined, ' + lord() + '.';
    const d = GetDefinedName(Player, idx);
    if (d.Coord.ID.ObjTyp !== Flt && d.Coord.ID.ObjTyp !== DestFlt) return '"' + name + '" is already defined, ' + lord() + '.';
    if (d.Coord.ID.ObjTyp !== DestFlt && bIn(d.Coord.ID.Index, G.SetOfActiveFleets)) return '"' + name + '" is already defined, ' + lord() + '.';
  }
  return null;
}

export function addNameCommand(Obj, Coord, NameVar) {
  const err = validateNewName(NameVar, false);
  if (err) return fail(err);
  const Player = P();
  const Loc = { ID: cpID(Obj), XY: cpXY(Coord) };
  NameVar = UpCase(NameVar[0]) + NameVar.slice(1);
  AddName(Player, Loc, NameVar);
  return ok('"' + NameVar + '" has been added to the list, ' + lord() + '.');
}

export function deleteNameCommand(NameVar) {
  const Player = P();
  if (Name2Index(Player, NameVar) === null) return fail('I have not heard of "' + NameVar + '", ' + lord() + '.');
  DeleteName(Player, NameVar);
  return ok('"' + NameVar + '" has been deleted from the list, ' + lord() + '.');
}

// Interpret typed coordinates/names (for text entry fields). Returns { xy, id } or error.
export function interpretLocation(text) {
  const Loc = GetLocation(P(), text);
  if (SameID(Loc.ID, EmptyQuadrant) && SameXY(Loc.XY, Limbo)) return { error: 'Those coordinates are undefined, ' + lord() + '.' };
  if (Loc.ID.ObjTyp !== Void && Loc.ID.ObjTyp !== DestFlt && !Known(P(), Loc.ID) && GetStatus(Loc.ID) !== P())
    return { error: 'Those coordinates are undefined, ' + lord() + '.' };
  let xy = Loc.XY;
  if (Loc.ID.ObjTyp !== Void && Loc.ID.ObjTyp !== DestFlt) xy = GetCoord(Loc.ID);
  return { xy, id: Loc.ID };
}

// ---- designate / terraform / ISSP / liberate ----------------------------------------------

export const DesignationText = ['an agricultural world', 'an ambrosia world', 'a base planet',
  'a specialized base planet', 'the capital of the empire', 'a chemical factory world',
  'an independent world', 'a jumpship complex', 'a specialized jumpship complex',
  'a metal-mining world', 'a ninja world', 'an outpost', 'a mining world',
  'a specialized mining world', 'a starship complex', 'a specialized starship complex',
  'a warpship complex', 'a specialized warpship complex', 'a research university world',
  'a terraforming world', 'a trillum-mining world'];

export function designationOptions(World) {
  const Tech = GetTech(World), Cls = GetClass(World);
  const out = [];
  for (let t = AgrTyp; t <= TriTyp; t++) {
    if (MinTechForType[t] <= Tech && ![OutTyp, BseSTyp, JmpSTyp, StrSTyp, TrnSTyp, RawSTyp, TerTyp].includes(t) &&
        (t !== AmbTyp || Cls === AmbCls || Cls === ParCls)) {
      let industry;
      if (t === RsrTyp) industry = '(research)';
      else if (t === RawTyp) industry = 'raw material mining';
      else if (t === CapTyp) industry = 'administration';
      else industry = IndusNames[PrincipalIndustry[t]];
      out.push({ type: t, name: TypeName[t][0].toUpperCase() + TypeName[t].slice(1), industry });
    }
  }
  return out;
}

// Returns a warning that must be confirmed, or null
export function designationWarning(World, Typ) {
  const Player = P();
  const WorldN = ObjectName(Player, World, LongFormat);
  const CapID = GetCapital(Player);
  const Cls = GetClass(World);
  if (Typ === CapTyp)
    return lord() + ', changing the capital will result in short-term loss of efficiency and increased unrest among the people of the empire.';
  if (World.ObjTyp === Base && GetBaseType(World) === cmp && ![BseTyp, JmpTyp, StrTyp, TrnTyp, CapTyp, NnjTyp].includes(Typ))
    return 'But ' + lord() + ', an industrial complex would be wasted on such a trivial designation.';
  if (Typ === RsrTyp && GetTech(World) < GetTech(CapID))
    return 'But ' + lord() + ', ' + WorldN + " is not yet as advanced as the capital. As a university world it wouldn't be of much use.";
  if ([MinTyp, RawTyp, TriTyp].includes(Typ) && [GsGCls, IceCls, OcnCls, PsnCls].includes(Cls))
    return lord() + ', the environment of ' + WorldN + ' is not really suited to large scale mining operations.';
  if (Typ === AgrTyp && [ArdCls, ArtCls, BarCls, DrtCls, IceCls, PsnCls, UndCls, VlcCls].includes(Cls))
    return 'I hope you will reconsider, ' + lord() + ', ' + WorldN + ' would not be an ideal agricultural world.';
  return null;
}

export function designate(World, Typ) {
  const err = checkObject(World, CommandConds.designate);
  if (err) return fail(err);
  if (Typ !== GetType(World)) DesignateWorld(World, Typ);
  const WorldN = ObjectName(P(), World, LongFormat);
  return ok(WorldN + ' has been designated as ' + DesignationText[Typ] + '. All industries are being re-distributed.  New efficiency: ' + GetEfficiency(World) + '%');
}

export function terraformOptions(World) {
  const Cls = GetClass(World);
  const out = [];
  for (let i = 0; i < 10; i++) {
    const c = TerraformPotentialClasses[Cls][i];
    if (c !== Cls) out.push(c);
  }
  return out;
}

export function terraform(World, NewCls) {
  const err = checkObject(World, CommandConds.terraform);
  if (err) return fail(err);
  if (NewCls !== GetClass(World)) TerraformWorld(World, NewCls);
  return ok('All industries on ' + ObjectName(P(), World, LongFormat) + ' are being dismantled and the process of terraforming has begun.');
}

export const ISSPText = ['  1%  (imports 99% of need)', ' 10%  (imports 90% of need)',
  ' 25%  (imports 75% of need)', ' 50%  (imports 50% of need)', ' 75%  (imports 25% of need)',
  '100%  (no import/export)', '150%  (exports 33% of production)',
  '200%  (exports 50% of production)', '300%  (exports 67% of production)',
  '400%  (exports 75% of production)', '500%  (exports 80% of production)'];
export const ISSPIndustries = [{ ind: 1, name: 'Chemical industry' }, { ind: 2, name: 'Mining industry' },
  { ind: 7, name: 'Supply industry' }, { ind: 8, name: 'Trillum industry' }];

export function getISSP(World) { return ISSPIndustries.map((x) => GetISSP(World, x.ind)); }
export function setISSP(World, values) {
  const err = checkObject(World, CommandConds.issp);
  if (err) return fail(err);
  ISSPIndustries.forEach((x, i) => SetISSP(World, x.ind, Math.max(0, Math.min(MaxISSP, values[i]))));
  return ok('');
}

export function liberateOptions(WorldID) {
  const Player = P();
  const out = [Indep];
  const added = new Set([Player]);
  const fl = GetFleets(GetCoord(WorldID));
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, fl)) continue;
    const f = { ObjTyp: Flt, Index: i };
    const e = GetStatus(f);
    if (!added.has(e) && Scouted(Player, f)) { out.push(e); added.add(e); }
  }
  return out.map((e) => ({ emp: e, name: EmpireName(e) }));
}

export function liberate(WorldID, Emp) {
  const err = checkObject(WorldID, CommandConds.liberate);
  if (err) return fail(err);
  const Player = P();
  const WorldN = ObjectName(Player, WorldID, LongFormat);
  if (Emp === Indep && WorldID.ObjTyp !== Base) DesignateWorld(WorldID, IndTyp);
  else DesignateWorld(WorldID, GetType(WorldID));
  InitializeISSP(WorldID);
  SetStatus(WorldID, Emp);
  AddNews(Emp, N.GInd, { ID: cpID(WorldID), XY: cpXY(Limbo) }, Player, 0, 0);
  return ok(Emp === Indep ? WorldN + ' is now independent.' : WorldN + ' is now part of the empire of ' + EmpireName(Emp) + '.');
}

// ---- self destruct ----------------------------------------------------------------------

export function selfDestructCheck(ObjID) {
  const Player = P();
  if (GetStatus(ObjID) !== Player) return '"' + ObjectName(Player, ObjID, ShortFormat) + '" is not a part of ' + EmpireName(Player) + ', ' + lord() + '.';
  if ((ObjID.ObjTyp !== Base || GetBaseType(ObjID) === cmp) && ObjID.ObjTyp !== Gate)
    return lord() + ', only bases, and stargates can be destroyed.';
  return null;
}

export function selfDestructWarning(ObjID) {
  const BaseN = ObjectName(P(), ObjID, LongFormat);
  const B = BaseN[0].toUpperCase() + BaseN.slice(1);
  if (ObjID.ObjTyp === Base)
    return B + ' reports: Destruct sequence activated... Are you sure about this, ' + lord() + '?  Destruction of the base will result in the deaths of ' + (GetPopulation(ObjID) * 10) + ' million people and will destroy all ships in the sector.';
  return 'Atomic charges set on ' + BaseN + '... Are you sure about this, ' + lord() + '?  It took us many years to build this structure.';
}

export function selfDestruct(ObjID) {
  const err = selfDestructCheck(ObjID);
  if (err) return fail(err);
  const BaseN = ObjectName(P(), ObjID, LongFormat);
  SelfDestructObject(ObjID);
  return ok(BaseN[0].toUpperCase() + BaseN.slice(1) + ' has been destroyed, ' + lord() + '.');
}

// ---- fleets -----------------------------------------------------------------------------

// Candidate "ground" objects in the fleet's sector (GetGround in FLTCOMM)
export function groundOptions(FltID, PlayerOnly, IncludeFleet) {
  const Player = P();
  const XY = GetCoord(FltID);
  const out = [];
  let fl = GetFleets(XY);
  if (!IncludeFleet) fl &= ~(1n << BigInt(FltID.Index));
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, fl)) continue;
    const f = { ObjTyp: Flt, Index: i };
    const e = GetStatus(f);
    if ((!PlayerOnly || e === Player) && Scouted(Player, f))
      out.push({ id: f, label: ObjectName(Player, f, LongFormat) + '  (' + EmpireName(e) + ')', owner: e });
  }
  const O2 = GetObject(XY);
  if (O2.ObjTyp === Pln || O2.ObjTyp === Base) {
    const e = GetStatus(O2);
    if (e === Player || !PlayerOnly)
      out.push({ id: O2, label: ObjectName(Player, O2, LongFormat) + '  (' + EmpireName(e) + ')', owner: e });
  }
  return out;
}

// Interactive redistribution of ships/cargo between a fleet and its ground (InputNewDistribution)
export class TransferSession {
  constructor(GrndID, FltSh, FltCr, GrnSh, GrnCr) {
    this.GrndID = cpID(GrndID);
    this.GroundStatus = GetStatus(GrndID);
    this.FltSh = FltSh.slice(); this.FltCr = FltCr.slice();
    this.GrnSh = GrnSh.slice(); this.GrnCr = GrnCr.slice();
    this.ResTrans = ResArr();
  }
  groundIsPlayers() { return this.GroundStatus === P(); }
  get(r, fleet) { return r <= trn ? (fleet ? this.FltSh : this.GrnSh)[r] : (fleet ? this.FltCr : this.GrnCr)[r]; }
  set(r, fleet, v) { (r <= trn ? (fleet ? this.FltSh : this.GrnSh) : (fleet ? this.FltCr : this.GrnCr))[r] = v; }
  fleetCargoSpace() { return FleetCargoSpace(this.FltSh, this.FltCr); }
  groundCargoSpace() { return this.GrndID.ObjTyp === Flt && this.groundIsPlayers() ? FleetCargoSpace(this.GrnSh, this.GrnCr) : 0; }

  // GetChange: positive = ground->fleet
  change(r, Trns) {
    const Player = P();
    const onGrn = this.get(r, false), inFlt = this.get(r, true);
    if (!Number.isInteger(Trns) || Math.abs(Trns) > 9999) return 'Please, ' + lord() + ', numbers from -9999 to 9999.';
    if (Trns <= 0) {
      if (Math.abs(Trns) > inFlt) return 'Not enough ' + ThingNames[r] + ' in fleet.';
    } else if (this.GroundStatus !== Player) return 'This is not ' + EmpireName(Player) + ' territory.';
    else if (Trns > onGrn) return 'Not enough ' + ThingNames[r] + ' on ground.';
    this.set(r, true, ThgLmt(inFlt + Trns));
    this.set(r, false, ThgLmt(onGrn - Trns));
    this.ResTrans[r] += Trns;
    return null;
  }

  fill(r) {
    const Player = P();
    const avail = FleetCargoSpace(this.FltSh, this.FltCr);
    const onGrn = this.get(r, false), inFlt = this.get(r, true);
    let move = 0;
    if (this.GroundStatus !== Player) return 'This is not ' + EmpireName(Player) + ' territory.';
    if ((r >= fgt && r <= jmp) || r === pen || r === ssp) move = onGrn;
    else if (r === jtn || r === trn) move = avail >= 0 ? onGrn : LesserInt(onGrn, Math.round(-avail / TrnAdj[r]));
    else if (avail > 0) move = LesserInt(avail * CargoSpace[r], onGrn);
    else move = onGrn;
    if (inFlt + move > 9999) move = 9999 - inFlt;
    this.set(r, true, ThgLmt(inFlt + move));
    this.set(r, false, ThgLmt(onGrn - move));
    this.ResTrans[r] += move;
    return null;
  }

  // EmptyFleet (note: original adds the moved amount to ResTrans with a positive sign)
  empty(r) {
    const avail = FleetCargoSpace(this.GrnSh, this.GrnCr);
    const onGrn = this.get(r, false), inFlt = this.get(r, true);
    let move = 0;
    if (r <= trn || this.GrndID.ObjTyp !== Flt) move = inFlt;
    else if (avail > 0) move = LesserInt(avail * CargoSpace[r], inFlt);
    if (onGrn + move > 9999) move = 9999 - onGrn;
    this.set(r, true, ThgLmt(inFlt - move));
    this.set(r, false, ThgLmt(onGrn + move));
    this.ResTrans[r] += move;
    return null;
  }

  // Validation when the player finishes (Esc). Returns error or null.
  finishError() {
    if (FleetCargoSpace(this.FltSh, this.FltCr) < 0) return "There aren't enough transports in the fleet.";
    if (this.GrndID.ObjTyp === Flt && FleetCargoSpace(this.GrnSh, this.GrnCr) < 0) {
      if (this.GroundStatus !== P()) BalanceFleet(this.GrnSh, this.GrnCr);
      else return "There aren't enough transports left in the fleet.";
    }
    return null;
  }

  // News for foreign ground when the player left things there
  reportGift() {
    const Player = P();
    if (this.GroundStatus === Player) return;
    let any = false;
    for (let r = fgt; r <= tri; r++) if (this.ResTrans[r] < 0) any = true;
    if (!any) return;
    const Loc = { ID: cpID(this.GrndID), XY: cpXY(Limbo) };
    AddNews(this.GroundStatus, N.TrnsShp, Loc, Player, 0, 0);
    for (let r = fgt; r <= tri; r++) AddNews(this.GroundStatus, N.Trns2, Loc, -this.ResTrans[r], r, 0);
  }
}

export function fleetLimitReached() {
  let n = 0;
  for (let i = MaxNoOfFleets; i > 0 && n < NoOfFleetsPerEmpire; i--) if (bIn(i, G.SetOfFleetsOf[P()])) n++;
  return n >= NoOfFleetsPerEmpire;
}

export function launchSession(LaunchPt) {
  return new TransferSession(LaunchPt, ResArr(), ResArr(), GetShips(LaunchPt), GetCargo(LaunchPt));
}

export function launchFleet(FleetName, LaunchPt, Destination, session) {
  const Player = P();
  if (fleetLimitReached()) return fail("I'm sorry, " + lord() + ', there are too many fleets in space already.');
  const nerr = validateNewName(FleetName, true);
  if (nerr) return fail(nerr);
  const err = checkObject(LaunchPt, CommandConds.launchFrom);
  if (err) return fail(err);
  const ferr = session.finishError();
  if (ferr) return fail(ferr);
  if (NoShips(session.FltSh)) return fail('No ships were assigned to the fleet.');
  // DupFltName side effect: a name used by an inactive fleet is freed
  const idx = Name2Index(Player, FleetName);
  if (idx !== null) DeleteName(Player, FleetName);
  FleetName = UpCase(FleetName[0]) + FleetName.slice(1);
  const FltID = DeployFleet(Player, LaunchPt, session.FltSh, session.FltCr, Destination);
  if (FltID.ObjTyp === Void) return fail('(ERROR: Discrepancy in SetOfActiveFleets.)');
  AddName(Player, { ID: FltID, XY: cpXY(Limbo) }, FleetName);
  return { ok: true, message: FleetName + ' deployed, ' + lord() + '.', fleet: FltID };
}

export function transferSession(FltID, Ground) {
  return new TransferSession(Ground, GetShips(FltID), GetCargo(FltID), GetShips(Ground), GetCargo(Ground));
}

export function commitTransfer(FltID, Ground, session) {
  const ferr = session.finishError();
  if (ferr) return fail(ferr);
  session.reportGift();
  const FltName = ObjectName(P(), FltID, ShortFormat);
  const GrnName = ObjectName(P(), Ground, LongFormat);
  ChangeCompositionOfFleet(FltID, Ground, session.FltSh, session.FltCr, session.GrnSh, session.GrnCr);
  return ok('Transfer from ' + FltName + ' to ' + GrnName + ' completed.');
}

// Returns list of confirmation warnings (may be empty)
export function abortFleetWarnings(FltID, Ground) {
  const Player = P();
  const w = [];
  const GrnName = ObjectName(Player, Ground, LongFormat);
  if (GetStatus(Ground) !== Player) w.push(lord() + ', ' + GrnName + ' is not part of ' + EmpireName(Player) + '. Are you sure you want to abort the fleet?');
  const g = GetShips(Ground), f = GetShips(FltID);
  for (let s = trn; s >= fgt; s--) if (g[s] + f[s] > 9999) { w.push(lord() + ', an object cannot hold so many ships--some will be lost. Are you sure you want to abort the fleet?'); break; }
  return w;
}

export function abortFleet(FltID, Ground) {
  const err = checkObject(FltID, CommandConds.abortFleet);
  if (err) return fail(err);
  const FltName = ObjectName(P(), FltID, ShortFormat);
  const GrnName = ObjectName(P(), Ground, LongFormat);
  AbortFleet(FltID, Ground, true);
  DestroyFleet(FltID);
  return ok(Ground.ObjTyp === Flt ? FltName + ' has been joined with ' + GrnName + ', ' + lord() + '.'
    : FltName + ' has been aborted to ' + GrnName + ', ' + lord() + '.');
}

export function changeDestination(FltID, NewDestination) {
  const err = checkObject(FltID, CommandConds.changeDestination);
  if (err) return fail(err);
  SetFleetDestination(FltID, NewDestination);
  const n = GetName(P(), { ID: cpID(EmptyQuadrant), XY: cpXY(NewDestination) }, ShortFormat);
  return ok('New destination for ' + ObjectName(P(), FltID, ShortFormat) + ': ' + n);
}

export function refuelInfo(FltID, Ground) {
  const TonsOnGround = GetTrillum(Ground);
  const MaxFuel = FuelCapacity(GetShips(FltID));
  const TonsNeeded = Trunc((MaxFuel - GetFleetFuel(FltID)) / FuelPerTon) + 1;
  return { max: LesserInt(TonsNeeded, TonsOnGround), fromCargo: SameID(FltID, Ground) };
}

export function refuel(FltID, Ground, tons) {
  const { max } = refuelInfo(FltID, Ground);
  if (tons === 0) tons = max;
  if (tons > max) return fail('The maximum amount allowable is ' + max + ' tons, ' + lord() + '.');
  if (tons < 0) return fail('That is a most bizarre request, ' + lord() + '.');
  RefuelFleet(FltID, Ground, tons);
  return ok(ObjectName(P(), FltID, ShortFormat) + ' refueled with ' + tons + ' tons of trillum.');
}

export function launchProbe(Coord) {
  const Player = P();
  const PNum = GetProbe(Player);
  if (PNum === 0) return fail("I'm sorry, " + lord() + ' there are no more probes available.');
  LaunchProbe(Player, PNum, Coord);
  const LocN = GetName(Player, { ID: cpID(EmptyQuadrant), XY: cpXY(Coord) }, LongFormat);
  return ok('Probe #' + (11 - PNum) + ' launched to ' + LocN);
}

export function srmSweep(FltID) {
  const err = checkObject(FltID, CommandConds.srmSweep);
  if (err) return fail(err);
  const Player = P();
  const XY = GetCoord(FltID);
  const Emp = EnemyMine(XY);
  if (Emp === Indep) return ok('No SRMs found, ' + lord() + '.');
  if (Emp !== Player) AddNews(Emp, N.SRMClear, { ID: cpID(EmptyQuadrant), XY }, Player, 0, 0);
  PutMine(XY, Indep);
  ClearMineScout(XY);
  return ok('Mine sweeping completed, ' + lord() + '.');
}

const OrderErrorText = {
  [BadCommandOER]: 'Unknown command in line ', [BadDestOER]: 'Unknown destination in line ',
  [BadResourceOER]: 'Unknown resource in line ', [BadTransferOER]: 'Bad transfer value in line ',
};

// Compile and install orders. lines: array of strings.
export function setOrders(FltID, lines) {
  const err = checkObject(FltID, CommandConds.orders);
  if (err) return fail(err);
  const Player = P();
  let Com = FleetNextStatement(FltID);
  if (Com === 0) Com = 1;
  const r = CompileOrders(Player, lines);
  if (r.Error !== NoOER) return fail(OrderErrorText[r.Error] + r.LineNo);
  const FltN = ObjectName(Player, FltID, LongFormat);
  if (NumberOfCommands(r.Code) === 0) {
    SetFleetNextStatement(FltID, 0);
    SetFleetCode(FltID, []);
    return ok('All orders to ' + FltN + ' cancelled, ' + lord() + '.');
  }
  if (Com > r.Code.length) Com = 1;
  SetFleetNextStatement(FltID, Com);
  SetFleetCode(FltID, r.Code);
  return ok('Orders to ' + FltN + ' completed, ' + lord() + '.');
}

export function cancelOrders(FltID) {
  const err = checkObject(FltID, CommandConds.cancelOrders);
  if (err) return fail(err);
  SetFleetCode(FltID, []);
  SetFleetNextStatement(FltID, 0);
  return ok('All orders to ' + ObjectName(P(), FltID, LongFormat) + ' cancelled, ' + lord() + '.');
}

// ---- attack targets -------------------------------------------------------------------------

export function attackTargets(FltID) {
  const Player = P();
  const XY = GetCoord(FltID);
  const out = [];
  const fl = GetFleets(XY);
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, fl)) continue;
    const t = { ObjTyp: Flt, Index: i };
    const e = GetStatus(t);
    if (e !== Player && Scouted(Player, t)) out.push({ id: t, label: ObjectName(Player, t, LongFormat) + '  (' + EmpireName(e) + ')', owner: e });
  }
  if (out.length === 0) {
    const t = GetObject(XY);
    const e = GetStatus(t);
    if (e !== Player && t.ObjTyp !== Void) out.push({ id: t, label: ObjectName(Player, t, LongFormat) + '  (' + EmpireName(e) + ')', owner: e });
  }
  return out;
}

// Construction site or gate: immediate destruction (TakeOverConOrGate)
export function destroyConstructionOrGate(FltID, Target, HKSurprise) {
  const n = ObjectName(P(), Target, LongFormat);
  DestroyConstructionOrGate(P(), HKSurprise, Target);
  return ok(n + ' has been destroyed.');
}

// Auto attack (AutoAttackCommand). Returns { result, casualties, message }
export function autoAttack(FltID, TargetID) {
  const Player = P();
  const Old = GetShips(FltID);
  if (TargetID.ObjTyp === Con || TargetID.ObjTyp === Gate) {
    // NOTE: the original only printed a message here without destroying the target
    const n = ObjectName(Player, TargetID, LongFormat);
    NPEAttack(FltID, TargetID, ConquerAIT, 0);
    return { ok: true, result: DefConqueredART, message: n + ' has been destroyed.', casualties: [] };
  }
  const Result = NPEAttack(FltID, TargetID, ConquerAIT, 0);
  const New = bIn(FltID.Index, G.SetOfActiveFleets) ? GetShips(FltID) : ResArr();
  const casualties = [];
  for (let s = fgt; s <= trn; s++) casualties.push({ name: ThingNames[s], n: Math.max(0, Old[s] - New[s]) });
  return { ok: true, result: Result, casualties };
}

// ---- LAMs -------------------------------------------------------------------------------------

export function lamTargets(BaseID) {
  const Player = P();
  const BaseXY = GetCoord(BaseID);
  const out = [];
  const tf = G.SetOfActiveFleets & ~G.SetOfFleetsOf[Player];
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, tf)) continue;
    const o = { ObjTyp: Flt, Index: i };
    const xy = GetCoord(o);
    if (Known(Player, o) && Distance(BaseXY, xy) <= 5) {
      const label = !Scouted(Player, o) ? 'Enemy fleet at ' + GetCoordName(xy) + '  (Unknown)'
        : ObjectName(Player, o, LongFormat) + '  (' + EmpireName(GetStatus(o)) + ')';
      out.push({ id: o, label });
    }
  }
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    const o = { ObjTyp: Pln, Index: i };
    const e = GetStatus(o);
    if (Known(Player, o) && e !== Player && Distance(BaseXY, GetCoord(o)) <= 5)
      out.push({ id: o, label: ObjectName(Player, o, LongFormat) + '  (' + EmpireName(e) + ')' });
  }
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfActiveStarbases)) continue;
    const o = { ObjTyp: Base, Index: i };
    const e = GetStatus(o);
    if (Known(Player, o) && e !== Player && Distance(BaseXY, GetCoord(o)) <= 5)
      out.push({ id: o, label: ObjectName(Player, o, LongFormat) + '  (' + EmpireName(e) + ')' });
  }
  return out;
}

export function launchLAMs(BaseID, Target, count) {
  const err = checkObject(BaseID, CommandConds.launchLAMs);
  if (err) return fail(err);
  const Defns = GetDefns(BaseID);
  const BasN = ObjectName(P(), BaseID, LongFormat);
  if (count < 0) return fail('You must use a positive number, ' + lord() + '!');
  if (count > Defns[LAM]) return fail("There aren't that many LAMs at " + BasN + ', ' + lord() + '.');
  let ShipsDest = ResArr(), DefnsDest = ResArr();
  if (count > 0) {
    const r = LAMAttack(P(), count, Target);
    ShipsDest = r.ShipsDest; DefnsDest = r.DefnsDest;
    Defns[LAM] -= count;
    PutDefns(BaseID, Defns);
  }
  const lines = [];
  if (Target.ObjTyp === Flt) {
    for (let s = fgt; s <= trn; s++) if (ShipsDest[s] > 0) lines.push(ShipsDest[s] + ' ' + ThingNames[s] + ' were destroyed.');
    if (!lines.length) lines.push('No ships were destroyed.');
  } else {
    for (let d = LAM; d <= 4; d++) if (DefnsDest[d] > 0) lines.push(DefnsDest[d] + ' ' + ThingNames[d] + ' were destroyed.');
    if (!lines.length) lines.push('No defenses were destroyed.');
  }
  return { ok: true, message: lines.join(' '), lines };
}

// ---- defenses ---------------------------------------------------------------------------------

export function getDefenseSettings() { return GetDefenseSettings(P()).ShellDefDist; }

// Normalize like DefenseCommand; returns { dist, warning }
export function normalizeDefenses(dist) {
  const d = dist.map((a) => a.slice());
  let warning = null;
  for (let s = fgt; s <= trn; s++) {
    let t = 0;
    for (let o = DpSpc; o <= Grnd; o++) t += d[o][s];
    if (t !== 100) warning = 'Total for each ship type must be 100 .. Normalizing';
    if (d[Grnd][s] !== 0 && !(s === fgt || s === trn || s === jtn)) warning = 'Only fgt, trn and jtn can be on the ground .. Normalizing';
  }
  for (let s = fgt; s <= trn; s++) {
    if (!(s === fgt || s === trn || s === jtn)) { d[SbOrb][s] += d[Grnd][s]; d[Grnd][s] = 0; }
    let total = 0;
    for (let o = DpSpc; o <= Grnd; o++) total += d[o][s];
    if (total < 100) d[SbOrb][s] += 100 - total;
    if (total > 100) {
      for (let o = DpSpc; o <= Grnd; o++) d[o][s] = Trunc((d[o][s] / total) * 100);
      total = 0;
      for (let o = DpSpc; o <= Grnd; o++) total += d[o][s];
      if (total < 100) d[SbOrb][s] += 100 - total;
    }
  }
  return { dist: d, warning };
}

export function setDefenseSettings(dist) {
  const { dist: d } = normalizeDefenses(dist);
  const cur = GetDefenseSettings(P());
  cur.ShellDefDist = d;
  SetDefenseSettings(P(), cur);
  return ok('');
}

// ---- construction -------------------------------------------------------------------------------

export function constructionOptions() {
  const { TechSet } = GetEmpireTechnology(P());
  const out = [];
  for (let c = SRM; c <= dis; c++) if (TechSet & (1 << c)) out.push(c);
  return out;
}

export function construct(ConsType, XY) {
  const Player = P();
  const obj = GetObject(XY);
  if (!SameID(obj, EmptyQuadrant)) return fail(GetCoordName(XY) + ' is not empty, ' + lord() + '.');
  if (!constructionOptions().includes(ConsType)) return fail(lord() + ", you don't have the technology to build anything!");
  const ConID = Construction(Player, ConsType, XY);
  if (ConID.ObjTyp === Void) return fail('There are too many construction sites, ' + lord() + '.');
  // carry an existing sector name over to the construction site
  const np = Location2Index(Player, { XY: cpXY(XY), ID: cpID(EmptyQuadrant) });
  if (np !== null) {
    const d = GetDefinedName(Player, np);
    DeleteName(Player, d.Name);
    AddName(Player, { XY: cpXY(Limbo), ID: ConID }, d.Name);
  }
  const need = [15, 16, 18].map((r) => ConsCargoNeeded[ConsType][r] + ' ' + ThingNames[r] + ' per year');
  return { ok: true, id: ConID, years: YearsToBuild[ConsType], need,
    message: 'Starting construction at ' + GetCoordName(XY) + '. It will take approximately ' + YearsToBuild[ConsType] + ' years.' };
}

export function abortConstruction(ConID) {
  const err = checkObject(ConID, CommandConds.abortConstruction);
  if (err) return fail(err);
  let n = ObjectName(P(), ConID, LongFormat);
  DestroyConstruction(ConID);
  n = n[0].toUpperCase() + n.slice(1);
  return ok(n + ' aborted, ' + lord() + '.');
}

// ---- warp link frequencies ------------------------------------------------------------------------

export function knownGates() {
  const Player = P();
  const out = [];
  for (let i = 1; i <= MaxNoOfStargates; i++) {
    const o = { ObjTyp: Gate, Index: i };
    if (Known(Player, o)) out.push({ id: o, label: ObjectName(Player, o, LongFormat) + ' (' + EmpireName(GetStatus(o)) + ')', owner: GetStatus(o), freq: GetWarpLinkFreq(Player, o) });
  }
  return out;
}

export function setFrequency(GateID, f) {
  if (!Number.isInteger(f) || f < 0 || f > 9999) return fail('Frequency must be between 0 and 9999.');
  SetWarpLinkFreq(P(), GateID, f);
  return ok('Our warp link frequency has been set to ' + f + '.');
}

// ---- technology trade ---------------------------------------------------------------------------

export function techTradeEmpires() {
  const Player = P();
  const my = GetEmpireTechnology(Player).TechSet;
  const out = [];
  for (let e = Empire1; e <= Empire8; e++) {
    if (!EmpireActive(e) || e === Player) continue;
    const { Tech } = GetEmpireTechnology(e);
    if (my & (TechDev[Tech] & ~TechDev[Math.max(0, Tech - 1)])) out.push({ emp: e, name: EmpireName(e) });
  }
  return out;
}

export function techTradeOptions(Emp) {
  const my = GetEmpireTechnology(P()).TechSet;
  const { Tech } = GetEmpireTechnology(Emp);
  const pot = my & (TechDev[Tech] & ~TechDev[Math.max(0, Tech - 1)]);
  const out = [];
  for (let t = LAM; t <= ter; t++) if (pot & (1 << t)) out.push({ tech: t, name: TechnologyName[t] + ' technology' });
  return out;
}

export function tradeTechnology(Emp, t) {
  const { Tech, TechSet } = GetEmpireTechnology(Emp);
  SetEmpireTechnology(Emp, Tech, TechSet | (1 << t));
  AddNews(Emp, N.NSellTech, { ID: cpID(EmptyQuadrant), XY: cpXY(Limbo) }, P(), t, 0);
  return ok('Transfer of ' + TechnologyName[t] + ' technology to ' + EmpireName(Emp) + ' completed.');
}

// ---- messages -------------------------------------------------------------------------------------

export function messageRecipients() {
  const out = [];
  for (let e = Empire1; e <= Empire8; e++) if (EmpireActive(e)) out.push({ emp: e, name: EmpireName(e) });
  return out;
}

export function sendMessage(empires, lines) {
  let mask = 0;
  for (const e of empires) mask |= 1 << e;
  if (!mask) return fail('No recipients selected.');
  SendMsg(P(), mask, lines.map((l) => (l.length > 80 ? l.slice(0, 80) : l)));
  return ok('Message sent, ' + lord() + '.');
}

export function markMessageRead(m) { SetMessageRead(P(), m); }
