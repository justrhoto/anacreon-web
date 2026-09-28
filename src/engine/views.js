// Read-only views of the game state for the UI. These follow the visibility rules of the
// original status windows (STAWIND, FLTWIND, EMPWIND, NWSWIND, NMSWIND, CLSCOMM, MAPWIND).
import { bIn, Round, Sqr } from '../runtime/pascal.js';
import {
  Universe, G, gal, MaxNoOfFleets, MaxNoOfStarbases, MaxNoOfStargates, MaxNoOfConstrSites,
  Empire1, Empire8, Indep, Void, Con, Pln, Base, Gate, Flt, NoNeb, fgt, trn, men, nnj, amb, tri,
  LAM, ion, che, sup, cmm, frt, cmp, out, BioInd, TriInd, SYGInd, SYTInd, AmbAddict, FInTrans,
  FReady, NoOfProbesPerEmpire, PReady, Limbo, cpID, cpXY, ResArr, NoRes, BseTyp, CapTyp, NnjTyp,
  AmbTyp, AmbCls, ParCls,
} from './types.js';
import {
  TypeStr, ClassStr, TechStr, TechN, TypeName, ThingNames, ObjName, BaseTypeData, GateTypeData,
  ISSP, ClassIndAdj, TechAdj2, K4, K6, ThgAdj, RawM, TechDev, SuppliesPerBillion, DrugsPerBillion,
  AmbrosiaAdj, DefAdj, DefBuildRate, TechnologyName, ConsCargoNeeded, IndusNames, YearsToBuild,
} from './datacnst.js';
import {
  YesNo, HiLo, ThgLmt, IntLmt, GreaterInt, TotalProd, ShipYardInd, FleetCargoSpace, FuelCapacity,
} from './misc.js';
import {
  GetStatus, GetType, GetClass, GetTech, GetPopulation, GetEfficiency, GetRevIndex, GetSpecial,
  GetShips, GetShipsKnown, GetCargo, GetDefns, GetIndus, GetISSP, TrillumReserves, Scouted, Known,
  ObjectName, GetName, GetCoordName, GetCoord, GetCapital, EmpireName, EmpireActive, EmpirePlayer,
  GetEmpireTechnology, GetBaseType, GetGateType, GetFleetStatus, TypeOfFleet, GetFleetFuel,
  ShortFormat, LongFormat, GetObject, GetFleets, GetConstrType, GetConstrTimeLeft, EnemyMine,
  GetNebula, RelativeX, RelativeY, EmpireAge, GetTimeLeft, GetProbe, GetWarpLinkFreq,
} from './primintr.js';
import {
  GetIndustrialDistribution, EstimatedDateOfArrival, EstimatedRange, GetEmpireStatus, GetNewsLine,
} from './intrface.js';
import { GetFleetDestination } from './fleet.js';
import { FleetNextStatement, DeCompileOrders, GetFleetCode } from './orders.js';
import { GetNewsList, LocalNews } from './news.js';
import { GetMessages } from './mess.js';
import { env } from './env.js';

export const ClassName = ['Ambrosia', 'Arid', 'Artificial', 'Barren', 'Class j', 'Class k',
  'Class l', 'Class m', 'Desert', 'Earth-like', 'Forest world', 'Gas Giant', 'Hostile life',
  'Ice world', 'Jungle world', 'Ocean world', 'Paradise', 'Poisonous', 'Ancient ruins',
  'Underground', 'Terraforming', 'Volcanic'];
export const FleetTypeName = ['Warpfleet', 'Jumpfleet', 'Hunter-Killer Fleet', 'Stealth Fleet', 'Fast-Warp Fleet'];
export const FleetStatusName = ['at destination', 'in transit', 'out of trillum', 'lost'];
export const ShortRes = { 5: 'fgt', 6: 'hkr', 7: 'jmp', 8: 'jtn', 9: 'pen', 10: 'str', 11: 'trn', 12: 'men', 13: 'nnj', 14: 'amb', 15: 'che', 16: 'met', 17: 'sup', 18: 'tri', 1: 'LAM', 2: 'def', 3: 'GDM', 4: 'ion' };
export const StarbaseName = { [cmm]: 'command base', [frt]: 'fortress', [cmp]: 'industrial complex', [out]: 'outpost' };
export const GateName = { 24: 'stargate', 25: 'warp link', 26: 'jumpspace disrupter' };

export const idKey = (id) => id.ObjTyp + ':' + id.Index;
export const coordName = (xy) => GetCoordName(xy);

export function popString(Pop) {
  return Pop < 100 ? (Pop * 10) + ' million' : (Pop / 100).toFixed(2) + ' billion';
}

// ---- map ---------------------------------------------------------------------------

// Per-sector map information visible to Player. Returns { size, cells[x][y] }
export function mapView(Player) {
  const S = gal.SizeOfGalaxy;
  const pbit = 1 << Player;
  const cells = [];
  for (let x = 0; x <= S; x++) {
    const col = [];
    for (let y = 0; y <= S; y++) col.push(null);
    cells.push(col);
  }
  for (let x = 1; x <= S; x++) {
    for (let y = 1; y <= S; y++) {
      const s = gal.Sector[x][y];
      const mineOwner = Math.floor(s.Special / 16);
      const mined = (s.MineScout & pbit) !== 0 || mineOwner === Player;
      cells[x][y] = {
        x, y,
        nebula: s.Special % 16,
        mine: mined ? { own: mineOwner === Player, owner: mineOwner } : null,
        obj: null,          // { kind, glyph, owner (or -1 unknown), known, scouted, id }
        ownFleets: [],
        enemyFleets: [],
        name: null,
      };
    }
  }
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    const p = Universe.Planet[i];
    const c = cells[p.XY.x] && cells[p.XY.x][p.XY.y];
    if (!c) continue;
    const id = { ObjTyp: Pln, Index: i };
    if (p.KnownBy & pbit) {
      c.obj = { kind: 'planet', id, glyph: TypeStr[p.Typ], owner: ownerVisible(Player, id, p.Emp), mine: p.Emp === Player };
    } else if (c.nebula === NoNeb) {
      c.obj = { kind: 'unknown', id: null, glyph: 'p', owner: -1, mine: false };
    }
  }
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfActiveStarbases)) continue;
    const b = Universe.Starbase[i];
    if (!(b.KnownBy & pbit)) continue;
    const id = { ObjTyp: Base, Index: i };
    cells[b.XY.x][b.XY.y].obj = { kind: 'starbase', id, glyph: BaseTypeData[b.STyp], owner: ownerVisible(Player, id, b.Emp), mine: b.Emp === Player, styp: b.STyp };
  }
  for (let i = 1; i <= MaxNoOfStargates; i++) {
    if (!bIn(i, G.SetOfActiveGates)) continue;
    const g = Universe.Stargate[i];
    if (!(g.KnownBy & pbit)) continue;
    const id = { ObjTyp: Gate, Index: i };
    cells[g.XY.x][g.XY.y].obj = { kind: 'gate', id, glyph: GateTypeData[g.GTyp], owner: ownerVisible(Player, id, g.Emp), mine: g.Emp === Player, gtyp: g.GTyp };
  }
  for (let i = 1; i <= MaxNoOfConstrSites; i++) {
    if (!bIn(i, G.SetOfActiveConstructionSites)) continue;
    const c = Universe.Constr[i];
    if (!(c.KnownBy & pbit)) continue;
    const id = { ObjTyp: Con, Index: i };
    cells[c.XY.x][c.XY.y].obj = { kind: 'construction', id, glyph: '#', owner: ownerVisible(Player, id, c.Emp), mine: c.Emp === Player };
  }
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, G.SetOfActiveFleets)) continue;
    const f = Universe.Fleet[i];
    const c = cells[f.XY.x] && cells[f.XY.x][f.XY.y];
    if (!c) continue;
    const id = { ObjTyp: Flt, Index: i };
    if (f.Emp === Player) c.ownFleets.push(id);
    else if (f.KnownBy & pbit) c.enemyFleets.push({ id, owner: (f.ScoutedBy & pbit) ? f.Emp : -1 });
  }
  for (const n of Universe.EmpireData[Player].Names) {
    let xy = null;
    if (n.Coord.ID.ObjTyp === Pln) xy = n.Coord.XY;
    else if (n.Coord.ID.ObjTyp === Base) xy = GetCoord(n.Coord.ID);
    if (xy && cells[xy.x] && cells[xy.x][xy.y]) cells[xy.x][xy.y].name = n.Name;
  }
  const cap = GetCoord(GetCapital(Player));
  return { size: S, cells, capital: cap };
}

function ownerVisible(Player, id, emp) {
  if (emp === Player) return Player;
  return Scouted(Player, id) ? emp : -1;
}

// What is in a sector (for the selection panel)
export function sectorView(Player, xy) {
  const obj = GetObject(xy);
  const out = { xy: cpXY(xy), coord: GetCoordName(xy), name: GetName(Player, { XY: xy, ID: { ObjTyp: Void, Index: 0 } }, ShortFormat), object: null, fleets: [], nebula: GetNebula(xy), mine: null };
  const m = mapView.cache ? null : null;
  const s = gal.Sector[xy.x][xy.y];
  const mineOwner = Math.floor(s.Special / 16);
  if ((s.MineScout & (1 << Player)) || mineOwner === Player)
    out.mine = { owner: mineOwner, ownerName: EmpireName(mineOwner) };
  if (obj.ObjTyp !== Void && Known(Player, obj)) out.object = cpID(obj);
  else if (obj.ObjTyp === Pln && GetNebula(xy) === NoNeb) out.unknownPlanet = true;
  const fl = GetFleets(xy);
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, fl)) continue;
    const id = { ObjTyp: Flt, Index: i };
    if (GetStatus(id) === Player || Known(Player, id)) out.fleets.push(id);
  }
  return out;
}

// ---- world close-up / production ----------------------------------------------------

export function worldView(Player, id) {
  const emp = GetStatus(id);
  const scouted = Scouted(Player, id) || emp === Player;
  const known = Known(Player, id) || emp === Player;
  const v = {
    id: cpID(id),
    kind: id.ObjTyp === Base ? 'starbase' : id.ObjTyp === Gate ? 'gate' : id.ObjTyp === Con ? 'construction' : 'planet',
    name: ObjectName(Player, id, LongFormat),
    shortName: ObjectName(Player, id, ShortFormat),
    coord: GetCoordName(GetCoord(id)),
    xy: GetCoord(id),
    owner: known ? emp : -1,
    ownerName: known ? EmpireName(emp) : '(unknown)',
    mine: emp === Player,
    scouted,
    known,
  };
  if (id.ObjTyp === Gate) {
    v.gateType = GetGateType(id);
    v.gateName = GateName[v.gateType];
    v.frequency = GetWarpLinkFreq(Player, id);
    return v;
  }
  if (id.ObjTyp === Con) {
    v.constrType = GetConstrType(id);
    if (emp === Player) v.yearsLeft = GetConstrTimeLeft(id);
    return v;
  }
  if (id.ObjTyp === Base) { v.baseType = GetBaseType(id); v.baseName = StarbaseName[v.baseType]; }
  v.type = GetType(id);
  v.typeName = TypeName[v.type];
  v.typeLetter = TypeStr[v.type];
  if (scouted) {
    v.cls = GetClass(id);
    v.className = ClassName[v.cls];
    v.tech = GetTech(id);
    v.techName = TechN[v.tech];
    v.pop = GetPopulation(id);
    v.popText = popString(v.pop);
    v.eff = GetEfficiency(id);
    v.addicted = (GetSpecial(id) & (1 << AmbAddict)) !== 0;
    v.rev = HiLo(GetRevIndex(id));
    v.revIndex = emp === Player ? GetRevIndex(id) : null;
  }
  const ships = GetShipsKnown(Player, id), cargo = GetCargo(id), defns = GetDefns(id);
  const level = (n) => (emp === Player ? String(n) : scouted ? YesNo(n).trim() : '????');
  v.military = {};
  for (let r = fgt; r <= trn; r++) v.military[ShortRes[r]] = level(ships[r]);
  v.military.men = level(cargo[men]);
  v.military.nnj = level(cargo[nnj]);
  for (let r = LAM; r <= ion; r++) v.military[ShortRes[r]] = level(defns[r]);
  v.cargo = {};
  for (let r = amb; r <= tri; r++) v.cargo[ShortRes[r]] = emp === Player ? String(cargo[r]) : '????';
  if (emp === Player) {
    v.raw = { ships, cargo, defns };
    v.issp = [GetISSP(id, 1), GetISSP(id, 2), GetISSP(id, 7), GetISSP(id, 8)];
  }
  return v;
}

export function productionView(Player, Obj) {
  const Cls = GetClass(Obj), Typ = GetType(Obj), Tech = GetTech(Obj), Pop = GetPopulation(Obj), Eff = GetEfficiency(Obj);
  const Special = GetSpecial(Obj);
  let ATIP = TotalProd(Pop, Tech);
  if (Special & (1 << AmbAddict)) ATIP = Round(ATIP * AmbrosiaAdj);
  if (ATIP > 999) ATIP = 999;
  let ISSPIndex, ClsAdj, IndDist, OptInd, Indus;
  if (Obj.ObjTyp === Base && GetBaseType(Obj) !== cmp) {
    ISSPIndex = new Array(9).fill(5); ClsAdj = new Array(9).fill(0); IndDist = new Array(9).fill(0);
    OptInd = new Array(9).fill(0); Indus = new Array(9).fill(0);
  } else {
    IndDist = GetIndustrialDistribution(Obj);
    Indus = GetIndus(Obj);
    ISSPIndex = []; ClsAdj = []; OptInd = [];
    for (let i = BioInd; i <= TriInd; i++) {
      ISSPIndex[i] = ISSP[GetISSP(Obj, i)];
      ClsAdj[i] = ClassIndAdj[Cls][i];
      OptInd[i] = Round(ATIP * IndDist[i] * ClsAdj[i] / 10000);
      if (OptInd[i] === 0 && IndDist[i] !== 0) OptInd[i] = 1;
    }
  }
  // production
  const TriRes = TrillumReserves(Obj);
  const IP = (TechAdj2[Tech] / 100) * ((Eff + 250) / 100) / K6;
  const Technology = GetEmpireTechnology(Player).TechSet & TechDev[Tech];
  const CCons = ResArr(), CProd = ResArr(), SProd = ResArr();
  for (let i = BioInd; i <= TriInd; i++) {
    if (Indus[i] <= 0) continue;
    const ProdAdj = IP * Sqr(Indus[i] + K4);
    for (let t = fgt; t <= tri; t++) {
      if (ThgAdj[i][t] !== 0 && (Technology & (1 << t))) {
        if (t <= trn) SProd[t] = ThgLmt(ProdAdj * ThgAdj[i][t]);
        else {
          CProd[t] = IntLmt(ProdAdj * ThgAdj[i][t]);
          if (t === nnj && Typ !== NnjTyp) CProd[nnj] = 0;
          else if (t === amb && Typ !== AmbTyp) CProd[amb] = 0;
          else if (t === amb && !(Cls === AmbCls || Cls === ParCls)) CProd[amb] = 0;
        }
      }
    }
  }
  for (let t = fgt; t <= trn; t++) for (let r = amb; r <= tri; r++) CCons[r] += ThgLmt(SProd[t] * (RawM[t][r] / 100));
  for (let t = amb; t <= tri; t++) for (let r = amb; r <= tri; r++) CCons[r] += ThgLmt(CProd[t] * (RawM[t][r] / 100));
  CCons[sup] = ThgLmt((Pop / 100) * SuppliesPerBillion);
  if (Special & (1 << AmbAddict)) CCons[amb] += ThgLmt((Pop / 100) * DrugsPerBillion);
  // defenses
  const Ships = GetShips(Obj), Cargo = GetCargo(Obj), Defns = GetDefns(Obj);
  const DOpt = ResArr(), DProd = ResArr();
  const Men = Cargo[men];
  let BuildRate = (Men / 2000) * (1 + ((Eff - 50) / 100));
  let Optimum = Men / 100;
  let BTyp = null;
  if (Obj.ObjTyp === Pln) BuildRate *= Pop / 2000;
  else if (Obj.ObjTyp === Base) {
    BTyp = GetBaseType(Obj);
    if (BTyp === out) Optimum /= 4;
    else if (BTyp === cmm || BTyp === frt) { Optimum *= 4; BuildRate *= 4; }
  }
  for (let d = LAM; d <= ion; d++) {
    if (Technology & (1 << d)) {
      DOpt[d] = ThgLmt(Optimum * DefAdj[d]);
      DProd[d] = GreaterInt(ThgLmt(BuildRate * DefBuildRate[d]), 1);
      if ((Obj.ObjTyp === Base && BTyp === out && d === 2) || (d === LAM && !(Typ === BseTyp || Typ === CapTyp))) {
        DOpt[d] = 0; DProd[d] = 0;
      }
    }
  }
  return {
    name: ObjectName(Player, Obj, LongFormat), className: ClassName[Cls], typeName: TypeName[Typ],
    techName: TechN[Tech], popText: popString(Pop), eff: Eff,
    shipyard: ShipYardInd(Indus), ISSPIndex, ClsAdj, IndDist, OptInd, Indus,
    Ships, Cargo, SProd, CProd, CCons, TriRes, Defns, DOpt, DProd,
    trillumReserves: 10 * Round(TriRes / 100),
  };
}

// ---- fleets ----------------------------------------------------------------------------

export function fleetView(Player, id) {
  const f = Universe.Fleet[id.Index];
  const emp = f.Emp;
  const scouted = Scouted(Player, id) || emp === Player;
  const own = emp === Player;
  const v = {
    id: cpID(id), kind: 'fleet', own,
    name: ObjectName(Player, id, LongFormat),
    shortName: ObjectName(Player, id, ShortFormat),
    owner: scouted ? emp : -1,
    ownerName: scouted ? EmpireName(emp) : '(unknown)',
    xy: cpXY(f.XY),
    position: GetName(emp === Player ? Player : Player, { XY: f.XY, ID: { ObjTyp: Void, Index: 0 } }, ShortFormat),
    scouted,
  };
  if (scouted) v.fleetType = FleetTypeName[TypeOfFleet(id)];
  const st = GetFleetStatus(id);
  if (own) {
    v.status = st === FInTrans ? 'in transit (' + EstimatedDateOfArrival(id) + ')' : FleetStatusName[st];
    v.statusCode = st;
    v.eta = EstimatedDateOfArrival(id);
    v.dest = GetFleetDestination(id);
    v.destination = GetName(Player, { XY: v.dest, ID: { ObjTyp: Void, Index: 0 } }, ShortFormat);
    v.range = EstimatedRange(id);
    v.fuel = GetFleetFuel(id);
    v.fuelCapacity = FuelCapacity(f.Ships);
    v.cargoSpace = FleetCargoSpace(f.Ships, f.Cargo);
    v.hasOrders = FleetNextStatement(id) !== 0;
    v.orders = DeCompileOrders(Player, GetFleetCode(id));
    v.ships = f.Ships.slice();
    v.cargo = f.Cargo.slice();
  } else {
    v.status = scouted ? FleetStatusName[st] : '(unknown)';
    v.destination = st === FReady && scouted ? v.position : '(unknown)';
  }
  v.contents = {};
  for (let r = fgt; r <= tri; r++) {
    const n = r <= trn ? f.Ships[r] : f.Cargo[r];
    v.contents[ShortRes[r]] = own ? String(n) : (scouted && r <= trn ? YesNo(n).trim() : '????');
  }
  return v;
}

// Fleets window list (FLTWIND order): own fleets, own mobile starbases, scouted enemy fleets,
// then known-but-unscouted enemy fleets.
export function fleetList(Player) {
  const out = [];
  const own = G.SetOfFleetsOf[Player] & G.SetOfActiveFleets;
  for (let i = 1; i <= MaxNoOfFleets; i++) if (bIn(i, own)) out.push({ group: 'own', ...fleetView(Player, { ObjTyp: Flt, Index: i }) });
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfStarbasesOf[Player])) continue;
    const id = { ObjTyp: Base, Index: i };
    const t = GetBaseType(id);
    if (t === cmm || t === frt) {
      const b = Universe.Starbase[i];
      const eda = EstimatedDateOfArrival(id);
      out.push({
        group: 'base', id, kind: 'starbase', own: true,
        name: ObjectName(Player, id, LongFormat), shortName: ObjectName(Player, id, ShortFormat),
        position: GetCoordName(b.XY), destination: GetCoordName(b.Dest), xy: cpXY(b.XY), dest: cpXY(b.Dest),
        status: b.Status === FInTrans ? 'in transit (' + eda + ')' : FleetStatusName[b.Status],
        range: EstimatedRange(id), owner: Player, ownerName: EmpireName(Player),
      });
    }
  }
  const enemy = G.SetOfActiveFleets & ~G.SetOfFleetsOf[Player];
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    const id = { ObjTyp: Flt, Index: i };
    if (bIn(i, enemy) && Scouted(Player, id)) out.push({ group: 'enemy', ...fleetView(Player, id) });
  }
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    const id = { ObjTyp: Flt, Index: i };
    if (bIn(i, enemy) && !Scouted(Player, id) && Known(Player, id)) out.push({ group: 'enemy-unscouted', ...fleetView(Player, id), status: '(out of range)' });
  }
  return out;
}

// ---- world status list ---------------------------------------------------------------

function importExport(ID) {
  const IndN = 'BCM----ST';
  let E = '', I = '';
  for (const ind of [1, 2, 7, 8]) {
    const i = GetISSP(ID, ind);
    if (i === 5) { E += '-'; I += '-'; }
    else if (i > 5) { E += IndN[ind]; I += '-'; }
    else { E += '-'; I += IndN[ind]; }
  }
  return { imports: I, exports: E };
}

// Status window list: capital, own worlds (sorted), then scouted foreign worlds (sorted).
export function worldList(Player) {
  const CapID = GetCapital(Player);
  const sortKey = (id) => GetTech(id) * 256 + (GetPopulation(id) >> 8);
  const own = [], other = [];
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    const id = { ObjTyp: Pln, Index: i };
    if (bIn(i, G.SetOfPlanetsOf[Player])) { if (!(CapID.ObjTyp === Pln && CapID.Index === i)) own.push(id); }
  }
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    const id = { ObjTyp: Base, Index: i };
    if (bIn(i, G.SetOfStarbasesOf[Player]) && !(CapID.ObjTyp === Base && CapID.Index === i)) own.push(id);
  }
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    const id = { ObjTyp: Pln, Index: i };
    if (!bIn(i, G.SetOfPlanetsOf[Player]) && Scouted(Player, id)) other.push(id);
  }
  const ws = G.SetOfActiveStarbases & ~G.SetOfStarbasesOf[Player];
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    const id = { ObjTyp: Base, Index: i };
    if (bIn(i, ws) && Scouted(Player, id)) other.push(id);
  }
  own.sort((a, b) => sortKey(b) - sortKey(a));
  other.sort((a, b) => sortKey(b) - sortKey(a));
  const ids = [];
  if (CapID.ObjTyp !== Void) ids.push(CapID);
  ids.push(...own, ...other);
  return ids.map((id) => worldRow(Player, id));
}

export function worldRow(Player, id) {
  const emp = GetStatus(id);
  const own = emp === Player;
  const shp = GetShipsKnown(Player, id), car = GetCargo(id), def = GetDefns(id);
  const ie = importExport(id);
  const pop = GetPopulation(id);
  const lvl = (n) => (own ? n : YesNo(n).trim());
  return {
    id: cpID(id), own, owner: emp,
    name: ObjectName(Player, id, ShortFormat),
    emp: EmpireName(emp),
    cls: ClassStr[GetClass(id)], className: ClassName[GetClass(id)],
    type: TypeStr[GetType(id)], typeName: TypeName[GetType(id)],
    tech: TechStr[GetTech(id)].trim(), techLevel: GetTech(id),
    pop: pop > 9 ? (pop / 100).toFixed(1) : '<0.1', popRaw: pop,
    eff: GetEfficiency(id),
    addict: (GetSpecial(id) & (1 << AmbAddict)) ? 'y' : '-',
    imports: ie.imports, exports: ie.exports,
    rev: HiLo(GetRevIndex(id)).trim(),
    jtn: lvl(shp[8]), trn: lvl(shp[11]),
    amb: own ? car[amb] : '--', che: own ? car[che] : '--', met: own ? car[16] : '--', sup: own ? car[sup] : '--', tri: own ? car[tri] : '--',
    men: lvl(car[men]), nnj: lvl(car[nnj]),
    fgt: lvl(shp[5]), hkr: lvl(shp[6]), jmp: lvl(shp[7]), pen: lvl(shp[9]), str: lvl(shp[10]),
    LAM: lvl(def[1]), def: lvl(def[2]), GDM: lvl(def[3]), ion: lvl(def[4]),
  };
}

// ---- empires -------------------------------------------------------------------------------

export function empireList(Player) {
  const rows = [];
  const line = (e, full) => {
    const st = GetEmpireStatus(e);
    const r = {
      emp: e, name: EmpireName(e), tech: TechStr[GetTech(GetCapital(e))].trim(),
      planets: st.Planets, sind: (st.SInd / 10).toFixed(1), pop: (st.TotalPop / 100).toFixed(1),
      player: EmpirePlayer(e), own: e === Player,
    };
    for (let s = fgt; s <= trn; s++) r[ShortRes[s]] = full ? st.TotalShips[s] : '----';
    return r;
  };
  rows.push(line(Player, true));
  for (let e = Empire1; e <= Empire8; e++) {
    if (!EmpireActive(e) || e === Player) continue;
    const CapID = GetCapital(e);
    if (CapID.ObjTyp !== Void && Known(Player, CapID)) rows.push(line(e, Scouted(Player, CapID)));
  }
  return rows;
}

// ---- news / names / messages ----------------------------------------------------------------

export function newsList(Player) {
  const list = GetNewsList(Player);
  const out = [];
  for (const n of list) if (!LocalNews.has(n.Headline)) out.push({ text: GetNewsLine(Player, n), local: false, loc: n.Loc1 });
  for (const n of list) if (LocalNews.has(n.Headline)) out.push({ text: GetNewsLine(Player, n), local: true, loc: n.Loc1 });
  return out;
}

export function namesList(Player) {
  return Universe.EmpireData[Player].Names.map((n) => {
    let xy = n.Coord.XY;
    if (n.Coord.ID.ObjTyp !== Void && n.Coord.ID.ObjTyp !== 9 /* DestFlt */) {
      if (n.Coord.ID.ObjTyp !== Flt || bIn(n.Coord.ID.Index, G.SetOfActiveFleets)) xy = GetCoord(n.Coord.ID);
    }
    return { name: n.Name, kind: ObjName[n.Coord.ID.ObjTyp] || 'sector', coord: (xy.x || xy.y) ? GetCoordName(xy) : '', xy: cpXY(xy) };
  });
}

export function messagesFor(Player) {
  return GetMessages(Player).map((m) => ({
    ref: m,
    from: m.Intercepted ? 'Intercepted message from ' + EmpireName(m.Sender)
      : m.Sender !== Player ? 'Message from ' + EmpireName(m.Sender) : 'Time capsule from the past',
    lines: m.MesText,
  }));
}

export function constructionList(Player) {
  const rows = [];
  for (let i = 1; i <= MaxNoOfConstrSites; i++) {
    if (!bIn(i, G.SetOfConstructionSitesOf[Player])) continue;
    const id = { ObjTyp: Con, Index: i };
    const XY = GetCoord(id);
    const avail = ResArr();
    const fl = GetFleets(XY) & G.SetOfFleetsOf[Player];
    for (let j = 1; j <= MaxNoOfFleets; j++) {
      if (bIn(j, fl)) {
        const c = GetCargo({ ObjTyp: Flt, Index: j });
        for (let r = che; r <= tri; r++) avail[r] = ThgLmt(avail[r] + c[r]);
      }
    }
    const t = GetConstrType(id);
    const need = {};
    for (const r of [che, 16, tri]) need[ShortRes[r]] = GreaterInt(0, ConsCargoNeeded[t][r] - avail[r]);
    rows.push({ id, name: ObjectName(Player, id, ShortFormat), type: t, typeName: ConsName[t], completion: env.Year + GetConstrTimeLeft(id), need, xy: XY });
  }
  return rows;
}

export const ConsName = { 19: 'SRM field', 20: 'command base', 21: 'fortress', 22: 'industrial complex', 23: 'outpost', 24: 'stargate', 25: 'warp link', 26: 'jumpspace disrupter' };

// ---- empire report (EmpireStatus in PROLOG) ------------------------------------------------

export function empireReport(Player) {
  let worlds = 0, pop = 0, eff = 0, ind = 0;
  const ships = ResArr();
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Player])) continue;
    const id = { ObjTyp: Pln, Index: i };
    worlds++; pop += GetPopulation(id); eff += GetEfficiency(id); ind += TotalProd(GetPopulation(id), GetTech(id));
    const s = GetShips(id); for (let k = fgt; k <= trn; k++) ships[k] += s[k];
  }
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfStarbasesOf[Player])) continue;
    const id = { ObjTyp: Base, Index: i };
    worlds++; pop += GetPopulation(id); eff += GetEfficiency(id); ind += TotalProd(GetPopulation(id), GetTech(id));
    const s = GetShips(id); for (let k = fgt; k <= trn; k++) ships[k] += s[k];
  }
  const fl = G.SetOfFleetsOf[Player] & G.SetOfActiveFleets;
  for (let i = 1; i <= MaxNoOfFleets; i++) if (bIn(i, fl)) { const s = GetShips({ ObjTyp: Flt, Index: i }); for (let k = fgt; k <= trn; k++) ships[k] += s[k]; }
  const { Tech, TechSet } = GetEmpireTechnology(Player);
  const mastered = TechSet & ~TechDev[Math.max(0, Tech - 1)];
  const techs = [];
  for (let t = 1; t <= 27; t++) if (mastered & (1 << t)) techs.push(TechnologyName[t]);
  const age = EmpireAge(Player) + 1;
  return {
    name: EmpireName(Player), year: env.Year, reignYear: age, worlds,
    population: (pop / 100).toFixed(1), avgInd: worlds ? Round(ind / worlds) : 0,
    avgEff: worlds ? Round(eff / worlds) : 0, techLevel: TechN[Tech], techs,
    ships: [5, 6, 7, 8, 9, 10, 11].map((k) => ({ name: ThingNames[k], n: ships[k] })),
  };
}

export function probesLeft(Player) {
  let n = 0;
  const P = Universe.EmpireData[Player].Probe;
  for (let i = 1; i <= NoOfProbesPerEmpire; i++) if (P[i].Status === PReady) n++;
  return n;
}

export function relCoord(xy) { return { x: RelativeX(xy.x), y: RelativeY(xy.y) }; }
export { IndusNames, ThingNames, TechnologyName, YearsToBuild };
