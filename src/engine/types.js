// TYPES.PAS / GALAXY.PAS / DATASTRC.PAS: global types, enums and data structures.

// ---- constants -------------------------------------------------------------------
export const MaxNoOfScenarios = 10;
export const MaxNoOfSavedGames = 20;
export const MaxNoOfPlanets = 200;
export const MaxNoOfStarbases = 100;
export const NoOfFleetsPerEmpire = 30;
export const MaxNoOfFleets = 240;
export const MaxNoOfStargates = 50;
export const MaxNoOfConstrSites = 50;
export const MaxNoOfWanderers = 20;
export const MaxNoOfMessages = 10;
export const MaxNoOfNewsItems = 200;
export const NoOfProbesPerEmpire = 10;
export const NoOfNamesPerEmpire = 100;
export const MaxNoOfNPEObjectives = 25;
export const MaxNoOfParameters = 10;
export const MaxResources = 9999;
export const MaxSizeOfGalaxy = 100;

// ---- enums -----------------------------------------------------------------------
// Empire
export const Empire1 = 0, Empire2 = 1, Empire3 = 2, Empire4 = 3, Empire5 = 4, Empire6 = 5,
  Empire7 = 6, Empire8 = 7, Indep = 8;
export const MaxNoOfEmpires = Empire8;

// Directions
export const NoDir = 0, No = 1, Ne = 2, Ea = 3, Se = 4, So = 5, Sw = 6, We = 7, Nw = 8;

// TechnologyTypes (also used as resource index)
export const NoRes = 0, LAM = 1, def = 2, GDM = 3, ion = 4,
  fgt = 5, hkr = 6, jmp = 7, jtn = 8, pen = 9, ssp = 10, trn = 11,
  men = 12, nnj = 13, amb = 14, che = 15, met = 16, sup = 17, tri = 18,
  SRM = 19, cmm = 20, frt = 21, cmp = 22, out = 23, gte = 24, lnk = 25, dis = 26, ter = 27;
export const FirstResource = LAM, LastResource = tri;

// TechLevel
export const PreTchLvl = 0, PrimitLvl = 1, PreAtmLvl = 2, AtomicLvl = 3, PreWrpLvl = 4,
  WrpTchLvl = 5, JmpTchLvl = 6, BioTchLvl = 7, StrTchLvl = 8, PreGteLvl = 9, GteTchLvl = 10;

// WorldClass
export const AmbCls = 0, ArdCls = 1, ArtCls = 2, BarCls = 3, ClsJ = 4, ClsK = 5, ClsL = 6,
  ClsM = 7, DrtCls = 8, EthCls = 9, FstCls = 10, GsGCls = 11, HLfCls = 12, IceCls = 13,
  JngCls = 14, OcnCls = 15, ParCls = 16, PsnCls = 17, RnsCls = 18, UndCls = 19, TerCls = 20,
  VlcCls = 21;

// WorldTypes
export const AgrTyp = 0, AmbTyp = 1, BseTyp = 2, BseSTyp = 3, CapTyp = 4, CheTyp = 5,
  IndTyp = 6, JmpTyp = 7, JmpSTyp = 8, MinTyp = 9, NnjTyp = 10, OutTyp = 11, RawTyp = 12,
  RawSTyp = 13, StrTyp = 14, StrSTyp = 15, TrnTyp = 16, TrnSTyp = 17, RsrTyp = 18,
  TerTyp = 19, TriTyp = 20;

// IndusTypes
export const BioInd = 0, CheInd = 1, MinInd = 2, SYGInd = 3, SYJInd = 4, SYSInd = 5,
  SYTInd = 6, SupInd = 7, TriInd = 8;

// SpecialConditions
export const AmbAddict = 0, Holocst = 1, Plague = 2, SelfSuff = 3, Virgin = 4;

// EmpireModifiers
export const CentralEMD = 0;

// FleetTypes
export const Standard = 0, JumpFleet = 1, HKFleet = 2, Penetrator = 3, AdvWrpFleet = 4;
// FleetStatus
export const FReady = 0, FInTrans = 1, FInactive = 2, FLost = 3;
// ProbeStatus
export const PReady = 0, PInTrans = 1, PAtDest = 2, PLost = 3;

// ObjectTypes
export const Void = 0, Con = 1, Pln = 2, Base = 3, Gate = 4, BlkHl = 5, Plsr = 6, WrmHl = 7,
  Flt = 8, DestFlt = 9, Wndr = 10, ArtOBJ = 11;

// NebulaTypes
export const NoNeb = 0, Nebula = 1, DarkNebula = 2, DenseNebula = 3;

// ShellPos
export const DpSpc = 0, HiOrb = 1, Orbit = 2, SbOrb = 3, Grnd = 4;

// ---- primitive records --------------------------------------------------------------

export function ID(ObjTyp = Void, Index = 0) { return { ObjTyp, Index }; }
export function XY(x = 0, y = 0) { return { x, y }; }
export function Loc(xy = XY(), id = ID()) { return { XY: xy, ID: id }; }
export const EmptyQuadrant = Object.freeze({ ObjTyp: Void, Index: 0 });
export const Limbo = Object.freeze({ x: 0, y: 0 });
export function cpID(id) { return { ObjTyp: id.ObjTyp, Index: id.Index }; }
export function cpXY(xy) { return { x: xy.x, y: xy.y }; }
export function cpLoc(l) { return { XY: cpXY(l.XY), ID: cpID(l.ID) }; }

// Resource arrays are indexed by TechnologyTypes ordinal (0..18)
export function ResArr() { return new Array(19).fill(0); }
export const ShipArray = ResArr, CargoArray = ResArr, DefnsArray = ResArr;
export function IndusArray() { return new Array(9).fill(0); }

// ---- galaxy ----------------------------------------------------------------------------

export const NoSRMField = Indep * 16;

export const gal = {
  Sector: [],          // Sector[x][y] = { Obj, Flts, MineScout, Special }
  SizeOfGalaxy: 0,
};

export function InitializeSector(SectorSize) {
  if (SectorSize > 0) {
    if (SectorSize > MaxSizeOfGalaxy) SectorSize = MaxSizeOfGalaxy;
    gal.Sector = [];
    for (let i = 0; i <= SectorSize; i++) {
      const row = [];
      for (let j = 0; j <= SectorSize; j++)
        row.push({ Obj: { ObjTyp: Void, Index: 0 }, Flts: 0, MineScout: 0, Special: NoSRMField });
      gal.Sector.push(row);
    }
  }
  gal.SizeOfGalaxy = SectorSize;
}

export function CleanUpSector() { /* garbage collected */ }

export function ClrMineScout(xy) { gal.Sector[xy.x][xy.y].MineScout = 0; }
export function SetMineScout(emp, xy) { gal.Sector[xy.x][xy.y].MineScout |= 1 << emp; }

// ---- global sets (TYPES.PAS VAR section) --------------------------------------------

export const G = {
  SetOfActiveFleets: 0n,
  SetOfFleetsOf: new Array(9).fill(0n),
  SetOfActivePlanets: 0n,
  SetOfPlanetsOf: new Array(9).fill(0n),
  SetOfActiveStarbases: 0n,
  SetOfStarbasesOf: new Array(9).fill(0n),
  SetOfActiveGates: 0n,
  SetOfActiveConstructionSites: 0n,
  SetOfConstructionSitesOf: new Array(9).fill(0n),
  NoOfPlanets: 0,
};

export function ClearGlobalSets() {
  G.SetOfActiveFleets = 0n;
  G.SetOfFleetsOf = new Array(9).fill(0n);
  G.SetOfActivePlanets = 0n;
  G.SetOfPlanetsOf = new Array(9).fill(0n);
  G.SetOfActiveStarbases = 0n;
  G.SetOfStarbasesOf = new Array(9).fill(0n);
  G.SetOfActiveGates = 0n;
  G.SetOfActiveConstructionSites = 0n;
  G.SetOfConstructionSitesOf = new Array(9).fill(0n);
}

// ---- universe (DATASTRC.PAS) ----------------------------------------------------------

export function newPlanet() {
  return {
    XY: XY(), Emp: Empire1, ScoutedBy: 0, KnownBy: 0,
    Cls: AmbCls, Typ: AgrTyp, ImpExp: 0, Tech: PreTchLvl, Eff: 0, RevIndex: 0, Special: 0,
    TerraformTarget: AmbCls, Pop: 0,
    Ships: ResArr(), Cargo: ResArr(), Defns: ResArr(), Indus: IndusArray(),
    TriReserve: 0,
  };
}

export function newStarbase() {
  return {
    XY: XY(), Emp: Empire1, ScoutedBy: 0, KnownBy: 0,
    STyp: SRM, Typ: AgrTyp, Tech: PreTchLvl, Eff: 0, RevIndex: 0, Special: 0, Pop: 0,
    Ships: ResArr(), Cargo: ResArr(), Defns: ResArr(), Indus: IndusArray(),
    Move: 0, Dest: XY(), Status: FReady,
  };
}

export function newFleet() {
  return {
    XY: XY(), Emp: Empire1, ScoutedBy: 0,
    Ships: ResArr(), Cargo: ResArr(),
    Dest: XY(), Status: FReady,
    FuelHigh: 0, Fuel: 0,
    KnownBy: 0,
    NextOrder: 0,
    Orders: [],            // OrderData: list of CommandRecord
    NPEDataIndex: 0,
  };
}

export function newStargate() {
  return {
    XY: XY(), Emp: Empire1, ScoutedBy: 0, KnownBy: 0,
    GTyp: SRM, Dest: XY(), WLF: new Array(9).fill(0),
  };
}

export function newConstr() {
  return { XY: XY(), Emp: Empire1, ScoutedBy: 0, KnownBy: 0, CTyp: SRM, TimeToCompletion: 0 };
}

export function newDefenseRecord() {
  const mk = () => [0, 1, 2, 3, 4].map(() => ResArr());
  return { ShellDefDist: mk(), StarbaseDefDist: mk() };
}

export function newEmpireData() {
  const Probe = [];
  for (let i = 0; i <= NoOfProbesPerEmpire; i++) Probe.push({ Dest: XY(), Status: PReady });
  return {
    InUse: false, IsAPlayer: false, EmpireName: '', Pass: '',
    TimeLeft: 0, Capital: ID(),
    DefenseSettings: newDefenseRecord(),
    Probe,                 // 1..10
    Names: [],             // list of NameRecord { Name, Coord: Location }
    TotalRevIndex: 0,
    TechnologyLevel: PreTchLvl, Technology: 0,
    IsAnEmpress: false, RevFactor: 0, Founding: 0, Modifiers: 0,
  };
}

export const Universe = {
  Planet: [],
  Starbase: [],
  Fleet: [],
  Stargate: [],
  Constr: [],
  EmpireData: [],
};

export function ClearUniverse() {
  Universe.Planet = [null];
  for (let i = 1; i <= MaxNoOfPlanets; i++) Universe.Planet.push(newPlanet());
  Universe.Starbase = [null];
  for (let i = 1; i <= MaxNoOfStarbases; i++) Universe.Starbase.push(newStarbase());
  Universe.Fleet = new Array(MaxNoOfFleets + 1).fill(null);
  Universe.Stargate = [null];
  for (let i = 1; i <= MaxNoOfStargates; i++) Universe.Stargate.push(newStargate());
  Universe.Constr = [null];
  for (let i = 1; i <= MaxNoOfConstrSites; i++) Universe.Constr.push(newConstr());
  Universe.EmpireData = [];
  for (let e = 0; e <= Indep; e++) Universe.EmpireData.push(newEmpireData());
}
ClearUniverse();
