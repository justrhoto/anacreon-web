// DATACNST.PAS: universal constants.
import {
  fgt, hkr, jmp, jtn, pen, ssp, trn, men, nnj, amb, che, met, sup, tri, LAM, def, GDM, ion,
  SRM, cmm, frt, cmp, out, gte, lnk, dis, ter,
  AmbCls, ArdCls, ArtCls, BarCls, ClsJ, ClsK, ClsL, ClsM, DrtCls, EthCls, FstCls, GsGCls,
  HLfCls, IceCls, JngCls, OcnCls, ParCls, PsnCls, RnsCls, UndCls, TerCls, VlcCls,
  PreTchLvl, PrimitLvl, PreAtmLvl, AtomicLvl, PreWrpLvl, WrpTchLvl, JmpTchLvl, BioTchLvl,
  StrTchLvl, PreGteLvl, GteTchLvl, ResArr,
} from './types.js';

export const K1 = 1.76, K2 = 10, K3 = 0.75;
export const K4 = 0.0, K5 = 2.0, K6 = 11000.0;
export const SafetyAdj = 1.05;
export const AmbrosiaAdj = 1.45;
export const DrugsPerBillion = 11.5;
export const ChanceToAddict = 25;
export const AddictDeathCoeff = 0.12;
export const AddictEffCoeff = 0.9;
export const AddictRevICoeff = 0.55;
export const SuppliesPerBillion = 25;
export const TechIncCap = 12, TechIncUnv = 15, TechIncRns = 5, TechIncUnvRns = 17;
export const TechLvlInc = 16;

export const TechnologyName = ['', 'LAM', 'defense satellite', 'GDM', 'ion cannon',
  'fighter', 'hunter-killer', 'jumpship', 'jumptransport', 'penetrator',
  'starship', 'transport', 'troop', 'ninja', 'ambrosia', 'chemical',
  'metal', 'supply', 'trillum', 'SRM',
  'command base', 'fortress', 'industrial complex', 'outpost',
  'gate', 'link', 'disrupter', 'terraforming'];

export const TypeName = ['agricultural world', 'ambrosia world', 'base planet', 'base planet',
  'capital', 'chemical planet', 'independent world', 'jumpship base', 'jumpship base',
  'metal mine', 'ninja world', 'outpost', 'raw material mine', 'raw material mine',
  'starship base', 'starship base', 'transport base', 'transport base', 'university world',
  'terraforming', 'trillum mine'];

const A = AmbCls, Ar = ArdCls, At = ArtCls, Ba = BarCls, J = ClsJ, K = ClsK, L = ClsL, M = ClsM,
  Dr = DrtCls, Et = EthCls, Fs = FstCls, Gs = GsGCls, HL = HLfCls, Ic = IceCls, Jn = JngCls,
  Oc = OcnCls, Pa = ParCls, Ps = PsnCls, Rn = RnsCls, Un = UndCls, Te = TerCls, Vl = VlcCls;
// index [class][1..10] stored as [class][0..9]
export const TerraformPotentialClasses = [
  [Oc, M, J, A, A, A, A, A, A, A],
  [Dr, Ar, Ar, Ar, Ar, Ar, Ar, Ar, Ar, Ar],
  [At, At, At, At, At, At, At, At, At, At],
  [Vl, Ba, Ba, Ba, Ba, Ba, Ba, Ba, Ba, Ba],
  [J, K, L, M, Et, Ps, Oc, J, J, J],
  [J, K, L, M, Et, Ps, Un, K, K, K],
  [J, K, L, M, Et, Dr, Un, L, L, L],
  [J, K, L, M, Et, Dr, Oc, M, M, M],
  [L, Ar, M, Dr, Dr, Dr, Dr, Dr, Dr, Dr],
  [Fs, Et, J, K, L, M, Et, Et, Et, Et],
  [Et, Jn, Fs, Fs, Fs, Fs, Fs, Fs, Fs, Fs],
  [Ps, Gs, Gs, Gs, Gs, Gs, Gs, Gs, Gs, Gs],
  [HL, Fs, Et, HL, HL, HL, HL, HL, HL, HL],
  [Oc, Ic, Ic, Ic, Ic, Ic, Ic, Ic, Ic, Ic],
  [Pa, Fs, Jn, Jn, Jn, Jn, Jn, Jn, Jn, Jn],
  [Ic, A, Oc, Oc, Oc, Oc, Oc, Oc, Oc, Oc],
  [Pa, Jn, Pa, Pa, Pa, Pa, Pa, Pa, Pa, Pa],
  [Gs, J, K, Ps, Ps, Ps, Ps, Ps, Ps, Ps],
  [Et, Rn, Rn, Rn, Rn, Rn, Rn, Rn, Rn, Rn],
  [Vl, K, L, Un, Un, Un, Un, Un, Un, Un],
  [Te, Te, Te, Te, Te, Te, Te, Te, Te, Te],
  [Un, Ba, Vl, Vl, Vl, Vl, Vl, Vl, Vl, Vl],
];

// Indexed by StarbaseTypes (cmm..out) / StargateTypes (gte..dis)
export const BaseTypeData = { [cmm]: '■', [frt]: '≡', [cmp]: 'π', [out]: 'o' };
export const GateTypeData = { [gte]: '↕', [lnk]: '↑', [dis]: '@' };

export const ThingNames = ['', 'LAMs', 'defense satellites', 'GDMs', 'ion canons',
  'fighter squadrons', 'hunter-killers', 'jumpships', 'jumptransports', 'penetrators',
  'starships', 'transports', 'legions', 'ninja legions', 'kilotons of ambrosia',
  'megatons of chemicals', 'megatons of metals', 'megatons of supplies', 'kilotons of trillum'];

export const IndusNames = ['bio-tech labs', 'chemical plants', 'metal mines', 'ship yards',
  'jumpship yards', 'starship yards', 'transport yards', 'food factories', 'trillum mines'];

export const ObjName = ['', 'construction', 'star system', 'starbase', 'stargate', 'black hole',
  'pulsar', 'worm hole', 'fleet', '(destroyed)', 'unknown', 'artifact'];

export const TypeStr = 'aAbBCcijJmNorRsStTUXz';
export const ClassStr = 'Aa0BjklmDEFGhIJO1P2UXV';
export const TechStr = ['pt', ' p', 'pa', ' a', 'pw', ' w', ' j', ' b', ' s', 'pg', ' g'];
export const TechN = ['pre-tech', 'primitive', 'pre-atomic', 'atomic', 'pre-warp', 'warp',
  'jump', 'bio-tech', 'starship', 'pre-gate', 'gate'];
export const SYLetN = '---AJST--';

// Build a resource-indexed array from a start index
function R(start, vals) {
  const a = ResArr();
  vals.forEach((v, i) => { a[start + i] = v; });
  return a;
}

export const MPower = R(LAM, [100, 100, 10, 50, 1, 20, 12, 1, 25, 100, 0]);

// CombatTable[att][def], AttackTypes = NoRes..nnj (0..13)
export const CombatTable = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 200, 100, 200, 150, 250, 60, 75, 100, 50, 15, 200, 0, 0],
  [0, 0, 0, 0, 0, 25, 90, 100, 100, 50, 6, 250, 0, 0],
  [0, 0, 0, 0, 0, 250, 100, 100, 100, 50, 25, 50, 0, 0],
  [0, 0, 0, 0, 0, 50, 65, 75, 75, 15, 2, 100, 0, 0],
  [0, 5, 5, 1, 25, 25, 15, 8, 20, 12, 1, 25, 5, 4],
  [0, 12, 40, 38, 20, 50, 50, 75, 50, 50, 4, 75, 0, 0],
  [0, 8, 15, 25, 10, 150, 25, 38, 50, 25, 1, 150, 0, 0],
  [0, 0, 1, 0, 0, 25, 1, 1, 5, 0, 0, 10, 0, 0],
  [0, 15, 35, 50, 35, 50, 65, 105, 125, 50, 5, 250, 0, 0],
  [0, 45, 90, 200, 50, 1000, 250, 300, 500, 100, 15, 500, 0, 0],
  [0, 0, 0, 0, 0, 12, 0, 0, 1, 0, 0, 5, 0, 0],
  [0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 7, 2],
  [0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 20, 10],
];

export const WeapEff = [0, 100, 150, 100, 30, 30, 100, 100, 10, 150, 100, 10, 100, 100];
export const ShipValue = [0, 0, 0, 0, 0, 5, 50, 50, 30, 100, 200, 30, 50, 100];
export const ProtecOffered = R(fgt, [5, 10, 10, 1, 50, 100, 0]);
export const ProtecNeeded = R(fgt, [5, 30, 20, 50, 200, 500, 150]);

export const BasePop = [3, 10, 100, 250, 500, 700, 1100, 1700, 2000, 2500, 3000];
export const TechAdj = [25, 40, 49, 57, 66, 80, 85, 90, 94, 97, 100];
export const TechAdj2 = [12, 24, 36, 47, 58, 67, 76, 84, 90, 95, 100];
export const MinSupInd = [95, 90, 80, 70, 50, 40, 34, 30, 28, 26, 23];

export const MinTechLevel = [BioTchLvl, PreAtmLvl, PrimitLvl, PreWrpLvl, JmpTchLvl, StrTchLvl,
  WrpTchLvl, PreTchLvl, AtomicLvl];

export const MinTechForType = [PreTchLvl, BioTchLvl, PreWrpLvl, GteTchLvl, JmpTchLvl, PreAtmLvl,
  PreTchLvl, JmpTchLvl, GteTchLvl, PrimitLvl, StrTchLvl, GteTchLvl, PrimitLvl, GteTchLvl,
  BioTchLvl, GteTchLvl, PreWrpLvl, GteTchLvl, JmpTchLvl, WrpTchLvl, AtomicLvl];

export const MinTechForClass = [PreTchLvl, PrimitLvl, JmpTchLvl, PreWrpLvl, PreTchLvl, PreTchLvl,
  PreTchLvl, PreTchLvl, PrimitLvl, PreTchLvl, PreTchLvl, PreWrpLvl, PreAtmLvl, PreAtmLvl,
  PreTchLvl, PreWrpLvl, PreTchLvl, AtomicLvl, PreTchLvl, PrimitLvl, WrpTchLvl, PreAtmLvl];

export const TriResByClass = [200, 350, 50, 1200, 700, 800, 900, 800, 1500, 800, 500, 450, 500,
  900, 600, 300, 600, 350, 200, 900, 800, 1100];

export const ClassIndAdj = [
  [100, 100, 75, 100, 100, 100, 100, 100, 75],
  [100, 80, 100, 100, 100, 100, 100, 85, 100],
  [100, 40, 40, 250, 200, 300, 300, 40, 40],
  [100, 60, 175, 100, 100, 100, 100, 40, 175],
  [100, 120, 120, 100, 100, 100, 100, 100, 90],
  [100, 90, 120, 100, 100, 100, 100, 100, 100],
  [100, 100, 100, 100, 100, 100, 100, 90, 120],
  [100, 100, 100, 100, 100, 100, 100, 120, 90],
  [100, 60, 80, 100, 100, 100, 100, 60, 190],
  [100, 100, 100, 100, 100, 100, 100, 100, 100],
  [100, 120, 100, 100, 100, 100, 100, 145, 100],
  [100, 150, 50, 150, 125, 175, 150, 40, 60],
  [100, 100, 100, 100, 100, 100, 100, 100, 100],
  [100, 90, 80, 100, 100, 100, 100, 60, 80],
  [100, 130, 100, 100, 100, 100, 100, 125, 100],
  [100, 135, 40, 100, 100, 100, 100, 130, 40],
  [120, 150, 125, 100, 100, 100, 100, 200, 150],
  [100, 200, 80, 100, 100, 100, 100, 40, 80],
  [100, 100, 100, 100, 100, 100, 100, 100, 100],
  [100, 100, 150, 100, 100, 100, 100, 70, 125],
  [1, 1, 1, 1, 1, 1, 1, 10, 1],
  [100, 125, 175, 100, 100, 100, 100, 75, 150],
];

export const MilitPer = [1, 80, 100, 90, 80, 75, 60, 50, 30, 15, 10];
export const OptMilitary = [5, 100, 200, 200, 200, 10, 80, 100, 100, 20, 150, 0,
  20, 20, 150, 150, 80, 80, 1, 10, 30];

// TechnologySet bitmasks
function TS(...items) {
  let s = 0;
  for (const it of items) {
    if (Array.isArray(it)) for (let i = it[0]; i <= it[1]; i++) s |= 1 << i;
    else s |= 1 << it;
  }
  return s;
}
export const TechDev = [
  TS(sup),
  TS(men, met, sup),
  TS(men, [che, sup]),
  TS(GDM, men, [che, tri]),
  TS(GDM, fgt, men, [che, tri]),
  TS(GDM, fgt, trn, men, [che, tri]),
  TS(GDM, ion, fgt, trn, jmp, jtn, men, [che, tri]),
  TS([def, ion], [fgt, pen], trn, men, [amb, tri], out),
  TS([LAM, trn], [men, tri], SRM, cmm, cmp, out),
  TS([LAM, tri], [SRM, out], lnk, dis),
  TS([LAM, ter]),
];

// InitDefenseRecord: ShellDefDist[ShellPos][ShipTypes]; StarbaseDefDist zero
export function InitDefenseRecord() {
  const sh = [
    R(fgt, [5, 50, 10, 0, 15, 0, 0]),
    R(fgt, [10, 10, 20, 0, 30, 50, 0]),
    R(fgt, [10, 10, 30, 0, 30, 30, 0]),
    R(fgt, [55, 30, 40, 0, 25, 20, 0]),
    R(fgt, [20, 0, 0, 100, 0, 0, 100]),
  ];
  const sb = [0, 1, 2, 3, 4].map(() => ResArr());
  return { ShellDefDist: sh, StarbaseDefDist: sb };
}

export const CargoSpace = R(men, [5, 5, 100, 3, 3, 2, 100]);
export const TrnAdj = R(fgt, [0, 0, 0, 0.2, 0, 0, 1]);
export const JumpCargoRatio = 5;
export const FuelCons = R(fgt, [10, 1086, 659, 894, 943, 1427, 994, 10, 10, 15, 10, 10, 15, 20]);
export const FuelCap = R(fgt, [3, 851, 329, 1341, 1886, 2854, 1988]);
export const FltMovementRate = [1, 10, 10, 2, 2];

// ThgAdj[IndusTypes][fgt..tri]
export const ThgAdj = [
  R(fgt, [0, 0, 0, 0, 0, 0, 0, 0, 10, 175, 0, 0, 0, 0]),
  R(fgt, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 175, 0, 0, 0]),
  R(fgt, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 350, 0, 0]),
  R(fgt, [27, 5, 9, 5, 4, 2, 10, 0, 0, 0, 0, 0, 0, 0]),
  R(fgt, [0, 25, 50, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  R(fgt, [0, 0, 0, 0, 40, 15, 0, 0, 0, 0, 0, 0, 0, 0]),
  R(fgt, [75, 0, 0, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0]),
  R(fgt, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 320, 0]),
  R(fgt, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 75]),
];

// RawM[ResourceTypes][CargoTypes]
const RM = (v) => R(men, v);
export const RawM = [
  RM([0, 0, 0, 0, 0, 0, 0]),
  RM([0, 0, 0, 25, 20, 0, 5]),
  RM([0, 0, 0, 30, 140, 0, 20]),
  RM([0, 0, 0, 10, 20, 0, 2]),
  RM([0, 0, 0, 25, 150, 0, 10]),
  RM([0, 0, 0, 5, 30, 0, 2]),
  RM([0, 0, 0, 100, 110, 0, 18]),
  RM([0, 0, 0, 65, 70, 0, 12]),
  RM([0, 0, 0, 100, 110, 0, 16]),
  RM([0, 0, 0, 95, 275, 0, 20]),
  RM([0, 0, 0, 175, 520, 0, 30]),
  RM([0, 0, 0, 90, 600, 0, 10]),
  RM([0, 0, 0, 0, 0, 0, 0]),
  RM([0, 0, 100, 50, 0, 0, 0]),
  RM([0, 0, 0, 110, 0, 0, 0]),
  RM([0, 0, 0, 0, 0, 0, 0]),
  RM([0, 0, 0, 0, 0, 0, 0]),
  RM([0, 0, 0, 0, 0, 0, 0]),
  RM([0, 0, 0, 0, 0, 0, 0]),
];

export const NewIndRawN = [100, 500, 100, 1900, 1200, 1500, 1000, 0, 300];

export const TypeData = [
  [0, 40, 40, 0, 0, 0, 0, 10.0, 20],
  [100, 1.2, 5.0, 0, 0, 0, 0, 1.1, 5.0],
  [0, 1.2, 1.7, 100, 0, 0, 0, 1.1, 1.7],
  [0, 0.5, 0.5, 100, 0, 0, 0, 0.5, 0.5],
  [0, 2.0, 2.5, 100, 0, 0, 0, 1.5, 2.0],
  [0, 80, 10, 0, 0, 0, 0, 1.1, 10],
  [0, 2.0, 2.5, 100, 0, 0, 0, 1.5, 2.0],
  [0, 1.2, 1.7, 0, 100, 0, 0, 1.1, 1.7],
  [0, 0.5, 0.5, 0, 100, 0, 0, 0.5, 0.5],
  [0, 10, 80, 0, 0, 0, 0, 1.1, 10],
  [100, 1.2, 5.0, 0, 0, 0, 0, 1.1, 5.0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 40, 40, 0, 0, 0, 0, 1.1, 20],
  [0, 40, 40, 0, 0, 0, 0, 0.5, 20],
  [0, 1.2, 1.3, 0, 0, 100, 0, 1.1, 1.2],
  [0, 0.5, 0.5, 0, 0, 100, 0, 0.5, 0.5],
  [0, 1.2, 1.7, 0, 0, 0, 100, 1.1, 1.2],
  [0, 0.5, 0.5, 0, 0, 0, 100, 0.5, 0.5],
  [0, 10, 10, 0, 0, 0, 0, 1.1, 5],
  [0, 10, 10, 0, 0, 0, 0, 1.1, 5],
  [0, 10, 10, 0, 0, 0, 0, 1.1, 80],
];

// SupInd=7, BioInd=0, SYGInd=3, CheInd=1, SYJInd=4, MinInd=2, SYSInd=5, SYTInd=6, TriInd=8
export const PrincipalIndustry = [7, 0, 3, 3, 3, 1, 3, 4, 4, 2, 0, 3, 2, 2, 5, 5, 6, 6, 2, 2, 8];

export const DefaultISSP = 0x5555;
export const MaxISSP = 10;
export const NormalISSP = 5;
export const ISSP = [0.01, 0.10, 0.25, 0.50, 0.75, 1.00, 1.50, 2.00, 3.00, 4.00, 5.00];

export const YearsToBuild = { [SRM]: 2, [cmm]: 6, [frt]: 12, [cmp]: 10, [out]: 3, [gte]: 15, [lnk]: 5, [dis]: 8 };

export const ConsCargoNeeded = {
  [SRM]: RM([0, 0, 0, 110, 500, 0, 80]),
  [cmm]: RM([0, 0, 0, 460, 2300, 0, 180]),
  [frt]: RM([0, 0, 0, 840, 2870, 0, 250]),
  [cmp]: RM([0, 0, 0, 590, 2600, 0, 150]),
  [out]: RM([0, 0, 0, 350, 1120, 0, 150]),
  [gte]: RM([0, 0, 0, 2530, 3920, 0, 1450]),
  [lnk]: RM([0, 0, 0, 1560, 2550, 0, 290]),
  [dis]: RM([0, 0, 0, 1110, 1180, 0, 1120]),
};

export const DefAdj = R(LAM, [145, 76, 215, 83]);
export const DefBuildRate = R(LAM, [220, 50, 250, 95]);

export const FuelPerTon = 265;
export const TriToLaunch = 0;
export const SFuelCons = 10;

export const DirX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
export const DirY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
