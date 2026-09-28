// NEWGAME.PAS / DFA.PAS: scenario parsing and universe creation (UI-free).
import { rng, Randomize, Val, UpCaseStr, Round, sN } from '../runtime/pascal.js';
import { TextFile } from '../runtime/vfs.js';
import {
  Empire1, Empire8, Indep, Void, Pln, Base, Gate, IndTyp, CapTyp, OutTyp, BseTyp, TerCls,
  PreTchLvl, GteTchLvl, AmbCls, VlcCls, EthCls, cmm, frt, out, CentralEMD, Nebula, EmptyQuadrant,
  Limbo, ArtCls, gal, ResArr, fgt, hkr, jmp, jtn, pen, ssp, trn, men, nnj, amb, che, met, sup, tri,
  LAM, def, GDM, ion, cpXY,
} from './types.js';
import { TechDev, MinTechForClass, TriResByClass, BasePop } from './datacnst.js';
import { ThgLmt, Rnd, RndVar, InGalaxy, GreaterInt } from './misc.js';
import {
  GetObject, EnemyMine, GetNebula, PutNebula, PutMine, SetClass, SetTech, SetType, SetStatus,
  SetPopulation, SetEfficiency, SetSpecial, GetCoord, PutIndus, PutShips, PutCargo, PutDefns,
  PutTrillumReserves, SetCapital, CreateEmpire, EmpireActive, SetTerraformTarget,
} from './primintr.js';
import {
  Scout, GetOptimumIndus, CreatePlanet, CreateStarbase, NextStargateSlot, CreateStargate,
} from './intrface.js';
import { InitializeNPE } from './npe.js';
import { InitializeUniverse } from './loadsave.js';
import { env } from './env.js';

export const RndEmpireName = ['Aaraavon', 'Antramis', 'Azores', 'Bok', 'Brekandi', 'Byzantium',
  "Cal'Dulmas", 'Cerberon', 'Chulron', 'Dol Parem', 'Doramis', 'Drii', 'Earon', 'Entares',
  'Esperance', 'Fahron', 'First Sun', 'Freberon', 'Geldtried', 'Gen-Tarem', 'Ghaza', 'Haar',
  'Hasarem', 'Highguard', 'Horace', 'Iileron', 'Illissia', 'Jamin', 'Jasper', 'Jool Den',
  'Kandii', 'Kendrezani', 'Lazarus', 'Lililth', 'Moorline', 'Mu', 'Mutara', 'Ny', "N'zares",
  'Occem', 'Ovaris', 'Palanhoth', 'Pell', 'Pharo', 'Quezelquan', 'Rho Kandii', 'Rosseri',
  'Sarlok', 'Sol-Terra', 'Terminus', 'Terra', 'Trantor', 'Ultarion', 'Vex', 'Vlandis', 'Whorl',
  'Xi', 'Yew', 'Yolandis'];

const MaxNoOfXYPoints = 25;

export function GetRandomEmpireName(EmpireName) {
  for (;;) {
    const n = RndEmpireName[Rnd(1, RndEmpireName.length) - 1];
    let ok = true;
    for (let e = Empire1; e <= Empire8; e++) if (EmpireName[e] === n) ok = false;
    if (ok) return n;
  }
}

// ---- DFA tokenizer ---------------------------------------------------------------

const EoFCh = '\x1a', CR = '\r', LF = '\n', TAB = '\t';
const isWS = (c) => c === EoFCh || c === CR || c === LF || c === TAB || c === ' ';

export function DFA1NextToken(f) {
  let token = '';
  let state = 'Start';
  let error = false;
  for (;;) {
    const ch = f.readChar();
    switch (state) {
      case 'Start':
        if (ch === ';') state = 'Comment';
        else if (ch === '"') state = 'Quote';
        else if (ch === '\\') state = 'Slash2';
        else if (ch === EoFCh) { error = true; token = 'ERROR: Unexpected end of file.'; }
        else if (!isWS(ch)) { state = 'Token2'; token += ch; }
        break;
      case 'Comment':
        if (ch === CR || ch === LF) state = 'Start';
        else if (ch === EoFCh) { error = true; token = 'ERROR: Unexpected end of file.'; }
        break;
      case 'Quote':
        if (ch === '"') state = 'Start';
        else if (ch === '\\') state = 'Slash1';
        else if (ch === EoFCh || ch === CR || ch === LF) { error = true; token = 'ERROR: Unexpected line break.'; }
        else { state = 'Token1'; token += ch; }
        break;
      case 'Slash1':
        if (ch === EoFCh || ch === LF || ch === CR) { error = true; token = 'ERROR: Unexpected line break.'; }
        else { state = 'Token1'; token += ch; }
        break;
      case 'Slash2':
        if (ch === EoFCh || ch === LF || ch === CR) { error = true; token = 'ERROR: Unexpected line break.'; }
        else { state = 'Token2'; token += ch; }
        break;
      case 'Token1':
        if (ch === '"' || ch === LF || ch === CR || ch === EoFCh) state = 'Final';
        else if (ch === '\\') state = 'Slash1';
        else token += ch;
        break;
      case 'Token2':
        if (isWS(ch)) state = 'Final';
        else if (ch === '\\') state = 'Slash2';
        else token += ch;
        break;
    }
    if (state === 'Final' || error) break;
  }
  return { token: sN(token, 80), error };
}

// ---- scenario context ------------------------------------------------------------

class Ctx {
  constructor(text) {
    this.f = new TextFile(text);
    this.error = false;
    this.log = [];
    this.version = 0;
  }
  err(line) { this.log.push(line); this.error = true; }
  tok() {
    const t = DFA1NextToken(this.f);
    return t;
  }
  int() {
    const t = this.tok();
    if (t.error) { this.err('ERROR: Bad token "' + t.token + '"'); return 0; }
    const v = Val(t.token);
    if (v.code === 0 && v.value >= -32768 && v.value <= 32767) return v.value;
    this.err('ERROR: Illegal number format "' + t.token + '"');
    return 0;
  }
}

// Parse only the header (used to list scenarios and show intro text)
export function ParseScenarioHeader(text) {
  const c = new Ctx(text);
  const Vers = c.f.readLn(64);
  if (Vers.slice(0, 8).toUpperCase() !== 'ANACREON') return null;
  const version = Val(Vers.substr(9, 2)).value || 0;
  const Title = c.tok().token;
  const h = {
    version,
    title: Title,
    seed: c.int(),
    minPlay: c.int(),
    maxPlay: c.int(),
    size: c.int(),
    planets: c.int(),
    difficulty: c.int(),
    minLen: c.int(),
    maxLen: c.int(),
    firstYear: c.int(),
  };
  // Intro text pages
  let t;
  let guard = 0;
  do { t = c.tok(); } while (UpCaseStr(t.token) !== 'BEGINTEXT' && !t.error && guard++ < 10000);
  const pages = [];
  if (!t.error) {
    c.f.readLn();
    let page = [];
    for (;;) {
      if (c.f.eof()) { pages.push(page); break; }
      const line = c.f.readLn(80);
      if (line.indexOf('ENDTEXT') >= 0) { pages.push(page); break; }
      if (line.indexOf('NEWPAGE') >= 0) { pages.push(page); page = []; continue; }
      page.push(line);
    }
  }
  h.pages = pages;
  h.bodyOffset = c.f.p;
  return h;
}

function GetRandomXY(c, x1, y1, x2, y2, CheckWorld) {
  let Count = 0;
  let XY;
  for (;;) {
    XY = { x: Rnd(x1, x2), y: Rnd(y1, y2) };
    const obj = InGalaxy(XY.x, XY.y) || (XY.x >= 0 && XY.y >= 0 && XY.x <= gal.SizeOfGalaxy && XY.y <= gal.SizeOfGalaxy)
      ? GetObject(XY) : { ObjTyp: Void };
    Count++;
    if (!CheckWorld || Count > 100 ||
        (obj.ObjTyp === Void && EnemyMine(XY) === Indep && GetNebula(XY) !== 3)) break;
  }
  if (Count > 100) {
    c.err('ERROR: No room for random world in zone.');
    return cpXY(Limbo);
  }
  return XY;
}

function GetRandomRange(Line) {
  const DashPos = Line.indexOf('..') + 1;
  if (DashPos === 0) {
    const v = Val(Line);
    return v.code !== 0 ? [0, 0] : [v.value, v.value];
  }
  const a = Val(Line.slice(0, DashPos - 1));
  if (a.code !== 0) return [0, 0];
  const b = Val(Line.substr(DashPos + 1, 10));
  if (b.code !== 0) return [0, 0];
  return [a.value, b.value];
}

function GetNextXY(c, XYPoint, Zone, CheckWorlds) {
  const t = c.tok();
  if (t.error) { c.err('ERROR: Bad token "' + t.token + '"'); return cpXY(Limbo); }
  let Token = t.token;
  const CommaPos = Token.indexOf(',') + 1;
  const ColonPos = Token.indexOf(':') + 1;
  const Header = Token.slice(0, 2).toUpperCase();
  if (Header === 'Z:') {
    const v = Val(Token.substr(2, 5));
    if (v.code !== 0 || !Zone[v.value]) { c.err('ERROR: Illegal zone coordinate "' + Token + '"'); return cpXY(Limbo); }
    const z = Zone[v.value];
    return GetRandomXY(c, z.x1, z.y1, z.x2, z.y2, CheckWorlds);
  }
  if (Header === 'R:') {
    const [x1, x2] = GetRandomRange(Token.substr(2, CommaPos - 3));
    const [y1, y2] = GetRandomRange(Token.substr(CommaPos, 10));
    if (InGalaxy(x1, y1) && InGalaxy(x2, y2)) return GetRandomXY(c, x1, y1, x2, y2, CheckWorlds);
    c.err('ERROR: Illegal random coordinates "' + Token + '"');
    return cpXY(Limbo);
  }
  if (ColonPos !== 0) {
    let [x1, x2] = GetRandomRange(Token.substr(ColonPos, CommaPos - ColonPos - 1));
    let [y1, y2] = GetRandomRange(Token.substr(CommaPos, 10));
    const name = UpCaseStr(Token.slice(0, ColonPos - 1));
    let i = MaxNoOfXYPoints;
    while (i > 0 && name !== XYPoint[i].Name) i--;
    if (i !== 0) {
      x1 += XYPoint[i].XY.x; x2 += XYPoint[i].XY.x;
      y1 += XYPoint[i].XY.y; y2 += XYPoint[i].XY.y;
      if (InGalaxy(x1, y1) && InGalaxy(x2, y2)) return GetRandomXY(c, x1, y1, x2, y2, CheckWorlds);
      c.err('ERROR: Relative coordinates outside of galaxy.');
      return cpXY(Limbo);
    }
    c.err('ERROR: XYPoint not found "' + name + '"');
    return cpXY(Limbo);
  }
  if (CommaPos !== 0) {
    const xs = Val(Token.slice(0, CommaPos - 1));
    const ys = Val(Token.substr(CommaPos, 5));
    if (xs.code !== 0 || ys.code !== 0) { c.err('ERROR: Illegal coordinate "' + Token + '"'); return cpXY(Limbo); }
    if (InGalaxy(xs.value, ys.value)) return { x: xs.value, y: ys.value };
    c.err('ERROR: Absolute coordinates outside of galaxy.');
    return cpXY(Limbo);
  }
  c.err('ERROR: Illegal coordinate "' + Token + '"');
  return cpXY(Limbo);
}

function RandomTrillumReserves(Cls, RegionReserves) {
  const Temp = GreaterInt(RegionReserves + Rnd(-25, 25), 0);
  return Round(Temp * (TriResByClass[Cls] / 100) + Rnd(1, 100));
}

function rndArr(start, vals, Tech, CheckTech) {
  const a = ResArr();
  vals.forEach((v, i) => {
    const k = start + i;
    a[k] = ThgLmt(RndVar(v, 20));
    if (CheckTech && !(TechDev[Tech] & (1 << k))) a[k] = 0;
  });
  return a;
}

function SetUpWorld(WorldID, Cls, Tech, Typ, Emp, Pop, Eff, Special, S, C, D, CheckTech) {
  SetClass(WorldID, Cls);
  SetTech(WorldID, Tech);
  SetType(WorldID, Typ);
  SetStatus(WorldID, Emp);
  SetPopulation(WorldID, Pop);
  SetEfficiency(WorldID, Eff);
  SetSpecial(WorldID, Special);
  Scout(Emp, GetCoord(WorldID));
  PutIndus(WorldID, GetOptimumIndus(WorldID));
  PutShips(WorldID, rndArr(fgt, S, Tech, CheckTech));
  PutCargo(WorldID, rndArr(men, C, Tech, CheckTech));
  PutDefns(WorldID, rndArr(LAM, D, Tech, CheckTech));
}

const RndMilTechAdj = [0.01, 0.02, 0.04, 0.05, 0.10, 0.30, 0.35, 0.60, 0.75, 0.95, 1.00];

function CreateRndPlanet(ID, Coord, Cls, T) {
  CreatePlanet(ID, Coord);
  if (Cls === TerCls) SetTerraformTarget(ID, EthCls);
  const Eff = Rnd(40, 60);
  const Pop = RndVar(Math.trunc((1 + (Eff - 50) / 500) * BasePop[T]), 10);
  let MI = Rnd(1, 33) + Rnd(1, 34) + Rnd(1, 33);
  MI = Round(MI * RndMilTechAdj[T]);
  SetUpWorld(ID, Cls, T, IndTyp, Indep, Pop, Eff, 0,
    [80 * MI, 7 * MI, 10 * MI, 6 * MI, 4 * MI, MI, 30 * MI],
    [40 * MI, 0, 0, 30 * MI, 50 * MI, 25 * MI, 10 * MI],
    [0, 30 * MI, 50 * MI, 40 * MI], true);
  if (Cls === TerCls) SetTerraformTarget(ID, EthCls);
}

function readNums(c, n) { const a = []; for (let i = 0; i < n; i++) a.push(c.int()); return a; }

function ReadModifierList(c) {
  let Mods = 0;
  if (c.version >= 12) {
    const n = c.int();
    for (let i = 1; i <= n; i++) if (UpCaseStr(c.tok().token) === 'CENTRAL') Mods |= 1 << CentralEMD;
  }
  return Mods;
}

// players: array (index = empire) of { name, password, isEmpress } for human empires.
// Returns { ok, log }
export function CreateUniverseFromScenario(text, header, players, noOfPlayers) {
  const c = new Ctx(text);
  c.version = header.version;
  c.f.p = header.bodyOffset;

  InitializeUniverse(header.firstYear, header.size, header.planets);

  const EmpireName = new Array(9).fill('');
  const Password = new Array(9).fill('');
  const Sex = new Array(9).fill(false);
  for (let e = 0; e < noOfPlayers; e++) {
    EmpireName[e] = players[e].name;
    Password[e] = players[e].password;
    Sex[e] = players[e].isEmpress;
  }
  const Zone = [];
  for (let i = 0; i <= 20; i++) Zone.push({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const XYPoint = [];
  for (let i = 0; i <= MaxNoOfXYPoints; i++) XYPoint.push({ Name: '', XY: cpXY(Limbo) });
  let FirstWorld = 1, FirstBase = 1, NextEmpToCreate = 0;
  Zone[1] = { x1: 1, y1: 1, x2: header.size, y2: header.size };
  let TriRes = 100;
  const ClassTable = new Array(101).fill(0);
  const TechTable = new Array(101).fill(0);

  if (header.seed === 0) Randomize();
  else rng.seed = header.seed;

  let Line;
  do {
    const t = c.tok();
    Line = UpCaseStr(t.token);
    if (t.error) { c.err('ERROR: Bad command token "' + t.token + '"'); break; }
    switch (Line) {
      case 'DEBUGSCENARIO': case 'PAUSE': break;
      case 'BEGINDESCRIPTION': {
        let l;
        do { l = UpCaseStr(c.f.readLn()); } while (l.indexOf('ENDDESCRIPTION') < 0 && !c.f.eof());
        if (c.f.eof()) c.err('ERROR: EndDescription not found.');
        break;
      }
      case 'CLASSTABLE': {
        let Index = 1;
        for (let cls = AmbCls; cls <= VlcCls; cls++) {
          if (c.version > 13 || cls !== TerCls) {
            const p = c.int();
            for (let i = Index; i <= Index + p - 1; i++) ClassTable[i] = cls;
            Index += p;
          }
        }
        if (Index !== 101) c.err('ERROR: Class table probabilities do not add up to 100.');
        break;
      }
      case 'TECHTABLE': {
        let Index = 1;
        for (let t2 = PreTchLvl; t2 <= GteTchLvl; t2++) {
          const p = c.int();
          for (let i = Index; i <= Index + p - 1; i++) TechTable[i] = t2;
          Index += p;
        }
        if (Index !== 101) c.err('ERROR: Tech table probabilities do not add up to 100.');
        break;
      }
      case 'CREATENEBULA': {
        const NTyp = c.int();
        const UL = GetNextXY(c, XYPoint, Zone, false), LR = GetNextXY(c, XYPoint, Zone, false);
        for (let x = UL.x; x <= LR.x; x++)
          for (let y = UL.y; y <= LR.y; y++) if (InGalaxy(x, y)) PutNebula({ x, y }, NTyp);
        break;
      }
      case 'CREATERANDOMNEBULA': {
        const Typ = c.int(), Min = c.int(), Max = c.int();
        if (Typ === 1) NebulaeBand();
        else if (Typ === 2) NebulaePatches(Rnd(Min, Max));
        break;
      }
      case 'RANDOMIZEPLAYERS':
        RandomizePlayers(NextEmpToCreate, header.maxPlay - 1, EmpireName, Password, Sex);
        break;
      case 'CREATESRMS': {
        const E = c.int();
        const UL = GetNextXY(c, XYPoint, Zone, false), LR = GetNextXY(c, XYPoint, Zone, false);
        for (let x = UL.x; x <= LR.x; x++)
          for (let y = UL.y; y <= LR.y; y++)
            if (InGalaxy(x, y) && GetObject({ x, y }).ObjTyp === Void) PutMine({ x, y }, E);
        break;
      }
      case 'CREATEPLAYEREMPIRE': {
        const Pl = c.int(), RevFactor = c.int(), Tl = c.int();
        let Known = TechDev[Math.max(0, Tl - 1)];
        const n = c.int();
        for (let i = 1; i <= n; i++) Known |= 1 << c.int();
        Known &= TechDev[Tl];
        const Mods = ReadModifierList(c);
        if (EmpireName[Pl] !== '') {
          CreateEmpire(Pl, true, Sex[Pl], EmpireName[Pl], Password[Pl], EmptyQuadrant, Tl, Known, RevFactor, Mods, env.Year);
          NextEmpToCreate++;
        }
        break;
      }
      case 'CREATENPEMPIRE': {
        const E = c.int(), ET = c.int();
        let Name = c.tok().token;
        const RevFactor = c.int(), Tl = c.int();
        const n = c.int();
        let Known = TechDev[Math.max(0, Tl - 1)];
        for (let i = 1; i <= n; i++) Known |= 1 << c.int();
        Known &= TechDev[Tl];
        const Mods = ReadModifierList(c);
        if (!EmpireActive(E)) {
          if (Name === 'RndName') Name = GetRandomEmpireName(EmpireName);
          CreateEmpire(E, false, Rnd(0, 1) === 1, Name, '', EmptyQuadrant, Tl, Known, RevFactor, Mods, env.Year);
          InitializeNPE(E, ET);
          NextEmpToCreate++;
        }
        break;
      }
      case 'CREATERANDOMWORLDS': {
        const NoOfWorlds = c.int(), ZNumber = c.int();
        const z = Zone[ZNumber] || Zone[1];
        for (let i = FirstWorld; i <= FirstWorld + NoOfWorlds - 1; i++) {
          const ID = { ObjTyp: Pln, Index: i };
          const Coord = GetRandomXY(c, z.x1, z.y1, z.x2, z.y2, true);
          let Safety = 0, Cls, Tech;
          do {
            Cls = ClassTable[Rnd(1, 100)];
            Tech = TechTable[Rnd(1, 100)];
            Safety++;
          } while (!(Safety > 100 || Tech >= MinTechForClass[Cls]));
          if (Safety > 100) c.err('ERROR: Incompatible class and tech tables.');
          if (i <= 200 && !(Coord.x === 0 && Coord.y === 0)) {
            CreateRndPlanet(ID, Coord, Cls, Tech);
            PutTrillumReserves(ID, RandomTrillumReserves(Cls, TriRes));
          }
        }
        FirstWorld += NoOfWorlds;
        break;
      }
      case 'CREATEWORLD': {
        c.int(); // n
        const XY = GetNextXY(c, XYPoint, Zone, true);
        let C = c.int();
        if (c.version < 14 && C >= 20) C++;
        const Tl = c.int(), T = c.int(), E = c.int(), Pp = c.int(), Ef = c.int();
        const TR = c.version >= 12 ? c.int() : 100;
        const [NLAM, Ndef, NGDM, Nion] = readNums(c, 4);
        const S = readNums(c, 7), Cr = readNums(c, 7);
        const ObjID = { ObjTyp: Pln, Index: FirstWorld };
        FirstWorld++;
        let Emp = E, Typ = T;
        if (Emp !== Indep && !EmpireActive(Emp)) { Emp = Indep; Typ = IndTyp; }
        if (ObjID.Index <= 200 && !(XY.x === 0 && XY.y === 0)) {
          CreatePlanet(ObjID, XY);
          SetUpWorld(ObjID, C, Tl, Typ, Emp, RndVar(Pp, 15), Ef, 0, S, Cr, [NLAM, Ndef, NGDM, Nion], false);
          PutTrillumReserves(ObjID, RandomTrillumReserves(C, TR));
          if (Typ === CapTyp) SetCapital(Emp, ObjID);
        }
        break;
      }
      case 'CREATESTARBASE': {
        c.int(); // n
        const XY = GetNextXY(c, XYPoint, Zone, true);
        const STyp = c.int();
        // Pre-v12 scenarios (e.g. PRINCES.SCN) have a reserved field here that v2.0 no
        // longer reads, which made that scenario fail to load. Skip it for compatibility.
        if (c.version < 12) c.int();
        const Tl = c.int(), T = c.int(), E = c.int(), Pp = c.int(), Ef = c.int();
        const [NLAM, Ndef, NGDM, Nion] = readNums(c, 4);
        const S = readNums(c, 7), Cr = readNums(c, 7);
        const ObjID = { ObjTyp: Base, Index: FirstBase };
        let Typ;
        if (STyp === out) Typ = OutTyp;
        else if (STyp === cmm || STyp === frt) Typ = BseTyp;
        else Typ = T;
        if ((E === Indep || EmpireActive(E)) && !(XY.x === 0 && XY.y === 0)) {
          FirstBase++;
          CreateStarbase(ObjID, E, XY, STyp);
          SetUpWorld(ObjID, ArtCls, Tl, Typ, E, RndVar(Pp, 15), Ef, 0, S, Cr, [NLAM, Ndef, NGDM, Nion], false);
          if (Typ === CapTyp) SetCapital(E, ObjID);
        }
        break;
      }
      case 'CREATESTARGATE': {
        const XY = GetNextXY(c, XYPoint, Zone, true);
        const GTyp = c.int(), Emp = c.int();
        const ID = { ObjTyp: Gate, Index: NextStargateSlot() };
        if (ID.Index > 0) { if (!(XY.x === 0 && XY.y === 0)) CreateStargate(ID, Emp, GTyp, XY); }
        else c.err('ERROR: Too many stargates created.');
        break;
      }
      case 'DEFINEZONE': {
        const Z = c.int();
        const a = GetNextXY(c, XYPoint, Zone, false), b = GetNextXY(c, XYPoint, Zone, false);
        if (Z >= 1 && Z <= 20) Zone[Z] = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        break;
      }
      case 'DEFINEXY': {
        let i = MaxNoOfXYPoints;
        while (i > 0 && XYPoint[i].Name !== '') i--;
        const t2 = c.tok();
        if (t2.error) { c.err('ERROR: Bad token "' + t2.token + '"'); break; }
        const XY = GetNextXY(c, XYPoint, Zone, false);
        if (i === 0) c.err('ERROR: Too many XYPoints defined.');
        else XYPoint[i] = { Name: UpCaseStr(sN(t2.token, 8)), XY };
        break;
      }
      case 'REPORT': c.log.push(c.tok().token); break;
      case 'SETTRILLUMRESERVES':
        TriRes = c.int();
        if (TriRes < 0 || TriRes > 100) c.err('ERROR: Illegal trillum reserve setting.');
        break;
      case 'ENDSCENARIO': break;
      default: c.err('ERROR: Unknown command "' + Line + '"');
    }
  } while (!(Line === 'ENDSCENARIO' || c.f.eof() || c.error));

  env.Player = Empire1;
  return { ok: !c.error, log: c.log };
}

function NebulaeBand() {
  const S = gal.SizeOfGalaxy;
  const InitX = Rnd(1, S);
  let XDisp;
  if (InitX <= Math.floor(S / 4)) XDisp = Rnd(0, 3);
  else if (InitX >= Math.floor(S * 3 / 4)) XDisp = Rnd(-3, 0);
  else XDisp = Rnd(-3, 3);
  let StartX = InitX;
  for (let y = 1; y <= S; y++) {
    const a = StartX - Rnd(1, 5), b = StartX + Rnd(1, 5);
    for (let x = a; x <= b; x++) if (InGalaxy(x, y)) PutNebula({ x, y }, Nebula);
    StartX += XDisp;
  }
}

function NebulaePatches(n) {
  const S = gal.SizeOfGalaxy;
  for (let p = 1; p <= (n & 0xFF); p++) {
    const InitX = Rnd(1, S), InitY = Rnd(1, S);
    const ya = InitY - Rnd(1, 3), yb = InitY + Rnd(1, 3);
    for (let y = ya; y <= yb; y++) {
      const xa = InitX - Rnd(1, 4 - Math.abs(y - InitY)), xb = InitX + Rnd(1, 4 - Math.abs(y - InitY));
      for (let x = xa; x <= xb; x++) if (InGalaxy(x, y)) PutNebula({ x, y }, Nebula);
    }
  }
}

function RandomizePlayers(Next, Max, Names, Passes, Sexes) {
  if (Next >= Max) return;
  const Order = [];
  Order[Next] = Rnd(Next, Max);
  for (let i = Next + 1; i <= Max; i++) {
    let ok;
    do {
      ok = true;
      Order[i] = Rnd(Next, Max);
      for (let j = Next; j <= i - 1; j++) if (Order[j] === Order[i]) ok = false;
    } while (!ok);
  }
  const tn = [], tp = [], ts = [];
  for (let i = Next; i <= Max; i++) { tn[i] = Names[Order[i]]; tp[i] = Passes[Order[i]]; ts[i] = Sexes[Order[i]]; }
  for (let i = Next; i <= Max; i++) { Names[i] = tn[i]; Passes[i] = tp[i]; Sexes[i] = ts[i]; }
}
