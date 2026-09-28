// UPDATE.PAS: the yearly universe update.
import { bIn, bDel, Round, Trunc, Sqr } from '../runtime/pascal.js';
import {
  Universe, G, gal, MaxNoOfFleets, MaxNoOfStarbases, MaxNoOfConstrSites, MaxResources,
  Empire1, Empire8, Indep, Con, Pln, Base, Flt, Gate, SRM, cmm, frt, cmp, out, gte, lnk, dis,
  PreTchLvl, GteTchLvl, CapTyp, RsrTyp, BseTyp, OutTyp, IndTyp, AgrTyp, CheTyp, MinTyp, RawTyp,
  TriTyp, NnjTyp, AmbTyp, TerCls, HLfCls, RnsCls, ArtCls, AmbCls, ParCls, AmbAddict,
  BioInd, CheInd, SYTInd, TriInd, SupInd, No, Nw, fgt, trn, amb, che, tri, men, nnj, met, sup,
  LAM, ion, def, EmptyQuadrant, Limbo, cpXY, cpID,
} from './types.js';
import {
  TechDev, TechIncCap, TechIncUnv, TechIncUnvRns, TechIncRns, TechAdj2, K4, K6, ThgAdj, RawM,
  AmbrosiaAdj, ClassIndAdj, NewIndRawN, TechLvlInc, BasePop, SuppliesPerBillion,
  DrugsPerBillion, AddictDeathCoeff, AddictEffCoeff, AddictRevICoeff, ChanceToAddict,
  OptMilitary, DefAdj, DefBuildRate, ConsCargoNeeded, DirX, DirY,
} from './datacnst.js';
import {
  ThgLmt, Rnd, RndVar, GreaterInt, LesserInt, InGalaxy, TotalProd, MoveThings,
} from './misc.js';
import {
  GetFleets, GetCargo, PutCargo, GetCoord, GetStatus, GetObject, GetType, GetClass, GetTech,
  GetEfficiency, GetPopulation, SetPopulation, SetEfficiency, SetStatus, SetType, SetClass,
  SetTech, ChangeRevIndex, GetRevIndex, InitializeISSP, TotalRevIndex, TrillumReserves,
  PutTrillumReserves, GetEmpireTechnology, SetEmpireTechnology, SetTotalRevIndex, GetCapital,
  EmpireActive, PutMine, Location2Index, GetDefinedName, DeleteName, AddName,
  GetTerraformTarget, TroopStrength, GetBaseType, PutIndus, GetSpecial,
} from './primintr.js';
import {
  NextStarbaseSlot, CreateStarbase, NextStargateSlot, CreateStargate, GetOptimumIndus,
  GetIndustrialDistribution,
} from './intrface.js';
import { AddNews, AddGlobalNews, N } from './news.js';
import { DeleteReadMessages } from './mess.js';
import { env } from './env.js';

const NewTotalRevIndex = new Array(9).fill(0);
const LL = (id) => ({ ID: cpID(id), XY: cpXY(Limbo) });

function ReportPlanetLack(Sta, ID, Headline, P1, OtherReports) {
  if (!(OtherReports.v & (1 << P1)) && Sta !== Indep) {
    AddNews(Sta, Headline, LL(ID), P1, 0, 0);
    OtherReports.v |= 1 << P1;
    ChangeRevIndex(ID, 1);
  }
}

function ConstructStarbase(Emp, STyp, XY) {
  const ID = { ObjTyp: Base, Index: NextStarbaseSlot() };
  if (ID.Index > 0) {
    CreateStarbase(ID, Emp, XY, STyp);
    SetEfficiency(ID, Rnd(10, 20));
    SetTech(ID, GetEmpireTechnology(Emp).Tech);
    if (STyp === out) {
      SetPopulation(ID, 1);
      SetType(ID, OutTyp);
    } else if (STyp === cmp) {
      SetPopulation(ID, Rnd(400, 700));
      SetType(ID, BseTyp);
      PutIndus(ID, GetOptimumIndus(ID));
    } else {
      SetPopulation(ID, Rnd(10, 20));
      SetType(ID, BseTyp);
    }
  }
  return ID;
}

function ConstructStargate(Emp, GTyp, XY) {
  const ID = { ObjTyp: Gate, Index: NextStargateSlot() };
  if (ID.Index > 0) CreateStargate(ID, Emp, GTyp, XY);
  return ID;
}

function UseUpRawMaterial(Typ, Sta, ConID, ConstrFleets) {
  const Cargo = [];
  for (let i = 1; i <= MaxNoOfFleets; i++)
    if (bIn(i, ConstrFleets)) Cargo[i] = GetCargo({ ObjTyp: Flt, Index: i });
  for (let t = amb; t <= tri; t++) {
    let RawNeeded = ConsCargoNeeded[Typ][t];
    for (let i = 1; i <= MaxNoOfFleets; i++) {
      if (bIn(i, ConstrFleets)) {
        const use = LesserInt(RawNeeded, Cargo[i][t]);
        Cargo[i][t] -= use;
        RawNeeded -= use;
      }
    }
    if (RawNeeded > 0) {
      AddNews(Sta, N.ConsLack, LL(ConID), t, 0, 0);
      return false;
    }
  }
  for (let i = 1; i <= MaxNoOfFleets; i++)
    if (bIn(i, ConstrFleets)) PutCargo({ ObjTyp: Flt, Index: i }, Cargo[i]);
  return true;
}

function UpdateConstruction(i) {
  const c = Universe.Constr[i];
  const ConstrFleets = GetFleets(c.XY) & G.SetOfFleetsOf[c.Emp];
  const ID = { ObjTyp: Con, Index: i };
  if (!UseUpRawMaterial(c.CTyp, c.Emp, ID, ConstrFleets)) return;
  c.TimeToCompletion = (c.TimeToCompletion - 1) & 0xFF;
  if (c.TimeToCompletion !== 0) return;

  G.SetOfActiveConstructionSites = bDel(G.SetOfActiveConstructionSites, i);
  G.SetOfConstructionSitesOf[c.Emp] = bDel(G.SetOfConstructionSitesOf[c.Emp], i);

  let ConName = '';
  const np = Location2Index(c.Emp, LL(ID));
  if (np !== null) {
    ConName = GetDefinedName(c.Emp, np).Name;
    DeleteName(c.Emp, ConName);
  }
  gal.Sector[c.XY.x][c.XY.y].Obj = cpID(EmptyQuadrant);

  const Loc = { XY: cpXY(Limbo), ID: cpID(EmptyQuadrant) };
  if (c.CTyp === SRM) PutMine(c.XY, c.Emp);
  else if (c.CTyp >= cmm && c.CTyp <= out) {
    Loc.ID = ConstructStarbase(c.Emp, c.CTyp, c.XY);
    if (ConName !== '') AddName(c.Emp, Loc, ConName);
  } else if (c.CTyp >= gte && c.CTyp <= dis) {
    Loc.ID = ConstructStargate(c.Emp, c.CTyp, c.XY);
    if (ConName !== '') AddName(c.Emp, Loc, ConName);
  }
  AddNews(c.Emp, N.ConsDone, { ID: cpID(EmptyQuadrant), XY: cpXY(c.XY) }, c.CTyp, 0, 0);
}

// ---- empire -----------------------------------------------------------------------------

function GetChanceForNewTech(Emp, EmpTech) {
  const Lab = [];
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Emp]) || Lab.length >= 20) continue;
    const id = { ObjTyp: Pln, Index: i };
    const Typ = GetType(id), Cls = GetClass(id), Eff = GetEfficiency(id), Tch = GetTech(id);
    if (Typ === CapTyp) Lab.push({ id, c: Trunc(TechIncCap * Eff / 100) });
    else if (Typ === RsrTyp && Tch === EmpTech)
      Lab.push({ id, c: Trunc((Cls === RnsCls ? TechIncUnvRns : TechIncUnv) * Eff / 100) });
    else if (Tch > EmpTech) Lab.push({ id, c: Trunc(TechIncUnv * Eff / 100) });
    else if (Cls === RnsCls) Lab.push({ id, c: Trunc(TechIncRns * Eff / 100) });
  }
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfStarbasesOf[Emp]) || Lab.length >= 20) continue;
    const id = { ObjTyp: Base, Index: i };
    const Typ = GetType(id), Eff = GetEfficiency(id), Tch = GetTech(id);
    if (Typ === CapTyp) Lab.push({ id, c: Trunc(TechIncCap * Eff / 100) });
    else if (Typ === RsrTyp && Tch === EmpTech) Lab.push({ id, c: Trunc(TechIncUnv * Eff / 100) });
  }
  let Total = 0;
  for (const l of Lab) Total += l.c;
  Total &= 0xFF; // Index (byte)
  let Roll = Rnd(1, Total);
  for (const l of Lab) {
    if (Roll <= l.c) return { Chance: Total, LabID: l.id };
    Roll -= l.c;
  }
  return { Chance: Total, LabID: GetCapital(Emp) };
}

function NewTechLevel(Emp) {
  let { Tech, TechSet } = GetEmpireTechnology(Emp);
  if (TechSet === TechDev[GteTchLvl]) return;
  if (TechSet !== TechDev[Tech]) {
    const { Chance, LabID } = GetChanceForNewTech(Emp, Tech);
    if (Rnd(1, 100) <= Chance) {
      const Possible = TechDev[Tech] & ~TechSet;
      const list = [];
      for (let t = 1; t <= 27; t++) if (Possible & (1 << t)) list.push(t);
      const NewTech = list[Rnd(1, list.length) - 1];
      if (NewTech === undefined) return;
      TechSet |= 1 << NewTech;
      SetEmpireTechnology(Emp, Tech, TechSet);
      AddNews(Emp, N.NCapTech, LL(LabID), NewTech, 0, 0);
    }
  } else {
    const { Chance, LabID } = GetChanceForNewTech(Emp, Tech);
    if (Rnd(1, 100) <= Chance) {
      Tech++;
      SetEmpireTechnology(Emp, Tech, TechSet);
      SetTech(LabID, Tech);
      for (let i = 1; i <= G.NoOfPlanets; i++) {
        if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
        const id = { ObjTyp: Pln, Index: i };
        const t = GetType(id);
        if ((t === RsrTyp || t === CapTyp) && GetTech(id) === Tech - 1) SetTech(id, Tech);
      }
      AddNews(Emp, N.NCapLvl, LL(LabID), Tech, 0, 0);
    }
  }
}

function UpdateEmpire(Emp) {
  SetTotalRevIndex(Emp, NewTotalRevIndex[Emp]);
  NewTechLevel(Emp);
}

// ---- world helpers ----------------------------------------------------------------------

function HostileLife(WorldID) {
  const Eff = GetEfficiency(WorldID);
  let Pop = GetPopulation(WorldID);
  const Cargo = GetCargo(WorldID);
  const MenAdj = (Eff + 50) * ((Cargo[men] + 5 * Cargo[nnj]) / 100);
  const Chance = GreaterInt(0, 25 - Round((MenAdj - 2000) / 100));
  const Emp = GetStatus(WorldID);
  const Loc = LL(WorldID);
  if (Rnd(1, 100) <= Chance) {
    if (Rnd(1, 100) <= 25) {
      const PopKilled = LesserInt(Pop, Rnd(10, 50));
      Pop -= PopKilled;
      ChangeRevIndex(WorldID, Rnd(5, 15));
      SetPopulation(WorldID, Pop);
      AddNews(Emp, N.HLPopKill, Loc, PopKilled, 0, 0);
    } else {
      const MenKilled = LesserInt(Cargo[men], Rnd(200, 300));
      const NnjKilled = LesserInt(Cargo[nnj], Rnd(20, 50));
      Cargo[men] -= MenKilled;
      Cargo[nnj] -= NnjKilled;
      PutCargo(WorldID, Cargo);
      AddNews(Emp, N.HLMenKill, Loc, MenKilled, NnjKilled, 0);
    }
  } else if (Emp !== Indep && Rnd(1, 100) <= 20) {
    const Aliens = Rnd(50, 150);
    Cargo[nnj] = (Cargo[nnj] + Aliens) & 0xFFFF;
    PutCargo(WorldID, Cargo);
    AddNews(Emp, N.HLJoin, Loc, Aliens, 0, 0);
  }
}

const RawSupplierTypes = [AgrTyp, CheTyp, MinTyp, RawTyp, TriTyp];

function SupplyLink(BaseID, TempCargo) {
  const BaseXY = GetCoord(BaseID);
  const Emp = GetStatus(BaseID);
  for (let d = No; d <= Nw; d++) {
    const x = BaseXY.x + DirX[d], y = BaseXY.y + DirY[d];
    if (!InGalaxy(x, y)) continue;
    const id = GetObject({ x, y });
    if (id.ObjTyp === Pln && GetStatus(id) === Emp && RawSupplierTypes.includes(GetType(id))) {
      const Cargo = GetCargo(id);
      for (let r = che; r <= tri; r++) {
        const t = Cargo[r] > 250 ? Cargo[r] - Rnd(200, 250) : 0;
        Cargo[r] -= t;
        TempCargo[r] += t;
      }
      PutCargo(id, Cargo);
    }
  }
}

function SurplusLink(BaseID, TempCargo) {
  const BaseXY = GetCoord(BaseID);
  const Emp = GetStatus(BaseID);
  for (let d = No; d <= Nw; d++) {
    const x = BaseXY.x + DirX[d], y = BaseXY.y + DirY[d];
    if (!InGalaxy(x, y)) continue;
    const id = GetObject({ x, y });
    if (id.ObjTyp === Pln && GetStatus(id) === Emp && RawSupplierTypes.includes(GetType(id))) {
      const Cargo = GetCargo(id);
      for (let r = che; r <= tri; r++) {
        if (TempCargo[r] > MaxResources) {
          const t = LesserInt(MaxResources - Cargo[r], TempCargo[r] - MaxResources);
          Cargo[r] += t;
          TempCargo[r] -= t;
        }
      }
      PutCargo(id, Cargo);
    }
  }
}

// returns new MPop
function UpdateMilitary(Typ, Pop, MPop) {
  const Opt = ThgLmt(RndVar(Round((Pop / 150) * OptMilitary[Typ]), 10));
  if (Opt > MPop) MPop = ThgLmt(MPop + (Pop / 10) * (OptMilitary[Typ] / 100));
  return MPop;
}

function Rebellion(WorldID, RevIndex, Military) {
  let Pop = GetPopulation(WorldID);
  let Eff = GetEfficiency(WorldID);
  const Emp = GetStatus(WorldID);
  const Cargo = GetCargo(WorldID);
  const Loc = LL(WorldID);
  const Rebels = GreaterInt(1, ThgLmt(Math.sqrt(Pop) * 65));
  let MenLost = Math.floor(Rebels / 5);
  const ChanceToEnd = (Military / Math.sqrt(Rebels)) * 1.414213;
  let Lost = LesserInt(Cargo[men], MenLost);
  Cargo[men] -= Lost;
  MenLost -= Lost;
  Lost = LesserInt(Cargo[nnj], Math.floor(MenLost / 5));
  Cargo[nnj] -= Lost;
  if (Rnd(1, 100) < ChanceToEnd) {
    ChangeRevIndex(WorldID, Rnd(-15, 5));
    AddNews(Emp, N.URebel, Loc, MenLost, 0, 0);
    NewTotalRevIndex[Emp] -= Rnd(1, 5);
  } else {
    SetStatus(WorldID, Indep);
    SetType(WorldID, IndTyp);
    InitializeISSP(WorldID);
    ChangeRevIndex(WorldID, -Rnd(40, 50));
    AddGlobalNews(1 << Emp, WorldID, N.GLBRev, Loc, Emp, 0, 0);
    AddNews(Emp, N.Rebel, Loc, 0, 0, 0);
    Cargo[men] = ThgLmt(Rebels);
    NewTotalRevIndex[Emp] += Rnd(5, 10);
  }
  PutCargo(WorldID, Cargo);
  Pop = ThgLmt(Pop - Military / 1000);
  SetPopulation(WorldID, Pop);
  Eff = GreaterInt(0, Eff - Rnd(5, 15));
  SetEfficiency(WorldID, Eff);
}

function UpdateRevolution(WorldID) {
  const Emp = GetStatus(WorldID);
  const Pop = GetPopulation(WorldID);
  const Typ = GetType(WorldID);
  const EmpRevAdj = RndVar(TotalRevIndex(Emp), 50);
  if (Typ === CapTyp) ChangeRevIndex(WorldID, -Rnd(20, 30));
  else ChangeRevIndex(WorldID, EmpRevAdj + Rnd(-5, 2));
  if (Emp === Indep) return;

  let RevIndex = GetRevIndex(WorldID);
  const Cargo = GetCargo(WorldID);
  const Loc = LL(WorldID);
  const Opt = ThgLmt(RndVar(Round((Pop / 150) * OptMilitary[Typ]), 10));
  const Military = ThgLmt(Cargo[men] + 5.0 * Cargo[nnj]);
  if (Military > Opt) {
    if (RevIndex > 30) {
      const Factor = Rnd(1, Math.trunc((Military - Opt) / 100));
      ChangeRevIndex(WorldID, -Factor);
      if (Factor > 5) AddNews(Emp, N.RevControl, Loc, 0, 0, 0);
    } else if (Typ !== CapTyp && Typ !== BseTyp) {
      if (Rnd(1, 5) === 1) {
        ChangeRevIndex(WorldID, Rnd(5, 15));
        AddNews(Emp, N.MilitRev, Loc, 0, 0, 0);
      }
    }
  }
  RevIndex = GetRevIndex(WorldID);
  if (RevIndex > 75) {
    if (Rnd(1, 100) < RevIndex && Typ !== CapTyp) Rebellion(WorldID, RevIndex, Military);
    else AddNews(Emp, N.RebelW4, Loc, 0, 0, 0);
  } else if (RevIndex > 70) AddNews(Emp, N.RebelW4, Loc, 0, 0, 0);
  else if (RevIndex > 66) AddNews(Emp, N.RebelW3, Loc, 0, 0, 0);
  else if (RevIndex > 43) AddNews(Emp, N.RebelW2, Loc, 0, 0, 0);
  else if (RevIndex > 30) AddNews(Emp, N.RebelW1, Loc, 0, 0, 0);
}

// returns adjusted TriProd
function ProduceTrillum(WorldID, TriProd, TriAvail) {
  let TriReserves = TrillumReserves(WorldID);
  const Loc = LL(WorldID);
  const Emp = GetStatus(WorldID);
  TriAvail = LesserInt(TriAvail, MaxResources);
  TriProd = LesserInt(TriProd, MaxResources - TriAvail);
  if (TriReserves === 0) {
    TriProd = 0;
    AddNews(Emp, N.NoTriRes, Loc, 0, 0, 0);
    ChangeRevIndex(WorldID, Rnd(10, 20));
  } else if (TriReserves * 20 < TriProd) {
    AddNews(Emp, N.TriResWarn1, Loc, 0, 0, 0);
    ChangeRevIndex(WorldID, Rnd(5, 10));
  } else if (TriReserves * 10 < TriProd && Rnd(1, 2) === 1) {
    AddNews(Emp, N.TriResWarn2, Loc, 0, 0, 0);
    ChangeRevIndex(WorldID, Rnd(3, 5));
  }
  TriReserves = GreaterInt(0, TriReserves - Round(TriProd / 100));
  PutTrillumReserves(WorldID, TriReserves);
  return TriProd;
}

function ProduceRawMaterial(ObjID, Indus, Technology, IP, TempCargo) {
  for (let i = CheInd; i <= TriInd; i++) {
    if (Indus[i] <= 0) continue;
    const ProdAdj = IP * Sqr(Indus[i] + K4);
    for (let t = che; t <= tri; t++) {
      if (ThgAdj[i][t] !== 0 && (Technology & (1 << t))) {
        let Prod = GreaterInt(1, ThgLmt(ProdAdj * ThgAdj[i][t]));
        if (t === tri) Prod = ProduceTrillum(ObjID, Prod, TempCargo[tri]);
        TempCargo[t] += Prod;
      }
    }
  }
}

function Production(ID, Typ, Indus, Technology, IP, Ships, Cargo, OtherReports) {
  for (let i = BioInd; i <= SYTInd; i++) {
    if (Indus[i] <= 0) continue;
    const ProdAdj = IP * Sqr(Indus[i] + K4);
    for (let t = fgt; t <= amb; t++) {
      if (!(ThgAdj[i][t] !== 0 && (Technology & (1 << t)))) continue;
      let Prod = ThgLmt(ProdAdj * ThgAdj[i][t]);
      if (t === nnj && Typ !== NnjTyp) Prod = 0;
      else if (t === amb && Typ !== AmbTyp) Prod = 0;
      else if (t === amb && !(GetClass(ID) === AmbCls || GetClass(ID) === ParCls)) Prod = 0;
      else if (Prod <= 0) Prod = 1;

      if (t >= fgt && t <= trn) Prod = LesserInt(Prod, MaxResources - Ships[t]);
      else Prod = LesserInt(Prod, MaxResources - LesserInt(Cargo[t], MaxResources));

      const RawNeeded = new Array(19).fill(0);
      for (let r = amb; r <= tri; r++) {
        if (RawM[t][r] > 0) {
          RawNeeded[r] = ThgLmt(Prod * (RawM[t][r] / 100));
          if (RawNeeded[r] > Cargo[r]) {
            Prod = ThgLmt((Cargo[r] / RawM[t][r]) * 100);
            RawNeeded[r] = ThgLmt(Prod * (RawM[t][r] / 100));
            if (ID.ObjTyp !== Base) ReportPlanetLack(GetStatus(ID), ID, N.Lack, r, OtherReports);
          }
        } else RawNeeded[r] = 0;
      }
      for (let r = che; r <= tri; r++) {
        RawNeeded[r] = LesserInt(Cargo[r], RawNeeded[r]);
        Cargo[r] -= RawNeeded[r];
      }
      if (t >= fgt && t <= trn) Ships[t] = LesserInt(MaxResources, Ships[t] + Prod);
      else Cargo[t] += Prod;
    }
  }
}

const ProbabilityOfChange = [14, 20, 0, 20, 17, 17, 17, 16, 13, 20, 21, 13, 0, 22, 21, 18, 10, 16, 0, 22, 0, 17];
const ProbabilityOfChaos = [3, 1, 100, 1, 1, 1, 1, 1, 2, 2, 3, 1, 100, 1, 3, 3, 4, 3, 100, 2, 100, 4];
const TargetOfChaos = [1, 3, 3, 13, 1, 13, 1, 8, 13, 13, 8, 13, 13, 19, 17, 13, 15, 3, 13, 3, 13, 3];

function UpdateTerraforming(ID) {
  if (GetClass(ID) !== TerCls) return;
  const Loc = { ID: cpID(ID), XY: GetCoord(ID) };
  const Target = GetTerraformTarget(ID);
  if (Rnd(1, 100) <= ProbabilityOfChaos[Target]) {
    SetType(ID, IndTyp);
    SetClass(ID, TargetOfChaos[Target]);
    AddNews(env.Player, N.TerChaos, Loc, 0, 0, 0);
  } else if (Rnd(1, 100) <= ProbabilityOfChange[Target]) {
    SetType(ID, IndTyp);
    SetClass(ID, Target);
    AddNews(env.Player, N.TerSuccess, Loc, 0, 0, 0);
  } else {
    SetPopulation(ID, Round(GetPopulation(ID) / 100 * Rnd(97, 99)));
  }
}

function UpdateIndustry(ID, Cls, Tech, Eff, Pop, AmbAdd, IndDist, Indus, Cargo, OtherReports) {
  let TIP = TotalProd(Pop, Tech);
  if (AmbAdd) TIP = Round(TIP * AmbrosiaAdj);
  if (TIP > 999) TIP = 999;
  const Temp = TIP / 10000;
  for (let i = BioInd; i <= TriInd; i++) {
    let Opt = Round(Temp * IndDist[i] * ClassIndAdj[Cls][i]);
    if (IndDist[i] > 0 && Opt === 0) Opt = 1;
    let ConsRate, RawNeeded;
    if (Indus[i] < Opt) {
      ConsRate = Round(Opt * (Eff / 500));
      if (ConsRate < 1) ConsRate = 1;
      ConsRate = LesserInt(ConsRate, Opt - Indus[i]);
      RawNeeded = ThgLmt((ConsRate / 100) * NewIndRawN[i]);
      if (RawNeeded > Cargo[met]) {
        ConsRate = Trunc(100 * (Cargo[met] / NewIndRawN[i]));
        RawNeeded = Cargo[met];
        ReportPlanetLack(GetStatus(ID), ID, N.IndLack, met, OtherReports);
      }
    } else if (Indus[i] > Opt) {
      ConsRate = -Round(Eff / 2);
      if (ConsRate > -1) ConsRate = -1;
      if (Indus[i] + ConsRate < Opt) ConsRate = Opt - Indus[i];
      RawNeeded = 0;
    } else {
      ConsRate = 0;
      RawNeeded = 0;
    }
    if (Indus[i] + ConsRate > 999) {
      ConsRate = 999 - Indus[i];
      RawNeeded = ThgLmt((ConsRate / 100) * NewIndRawN[i]);
    } else if (Indus[i] + ConsRate < 0) {
      ConsRate = -Indus[i];
      RawNeeded = 0;
    }
    Indus[i] += ConsRate;
    RawNeeded = LesserInt(Cargo[met], RawNeeded);
    Cargo[met] -= RawNeeded;
  }
}

function UpdateEfficiency(Emp, Eff) {
  let Inc;
  if (Emp === Indep) Inc = Rnd(0, 1);
  else if (Eff <= 25) Inc = Rnd(5, 12);
  else if (Eff <= 50) Inc = Rnd(3, 8);
  else if (Eff <= 75) Inc = Rnd(2, 5);
  else if (Eff <= 90) Inc = Rnd(0, 3);
  else if (Eff <= 99) Inc = Rnd(0, 1);
  else Inc = 0;
  return LesserInt(100, Eff + Inc);
}

function UpdateTechLevel(ID, Emp, Tech) {
  if (Tech === GteTchLvl) return Tech;
  if (Emp === Indep) {
    if (Rnd(1, 50) === 1) Tech++;
  } else {
    const CapitalTech = GetTech(GetCapital(Emp));
    if (CapitalTech > Tech) {
      if (Rnd(1, 100) <= TechLvlInc) {
        Tech++;
        AddNews(Emp, N.NTech, LL(ID), Tech, 0, 0);
      }
    } else if (CapitalTech < Tech) {
      if (Rnd(1, 15) === 1) {
        Tech--;
        AddNews(Emp, N.RTech, LL(ID), Tech, 0, 0);
      }
    }
  }
  return Tech;
}

const MaxPop = [4830, 4100, 3100, 2340, 4610, 4600, 4220, 4800, 3580, 4500, 4710, 2010, 4010,
  1920, 4720, 3520, 5000, 2100, 4590, 4500, 100, 3950];

function UpdatePopulation(Cls, Tech, Pop) {
  let Increase;
  if (Pop >= MaxPop[Cls]) Increase = Rnd(-10, 10);
  else if (Pop < 75) Increase = Rnd(2, 5);
  else if (Pop > BasePop[Tech]) Increase = BasePop[Tech] / 100;
  else Increase = 128.0 * Pop / MaxPop[Cls];
  return (Pop + Round(Increase)) & 0xFFFF;
}

const StarveTechAdj = [100, 100, 30, 20, 15, 13, 12, 13, 14, 14, 15];

// rec: object with Pop and Cargo (Food = Cargo[sup])
function UseUpFood(WorldID, rec) {
  const FoodNeeded = ThgLmt((rec.Pop / 100) * SuppliesPerBillion);
  if (FoodNeeded > rec.Cargo[sup]) {
    const Lack = FoodNeeded - rec.Cargo[sup];
    rec.Cargo[sup] = 0;
    let Starve = Math.floor(Lack / 6);
    if (Starve > Math.floor(rec.Pop / 10)) Starve = Math.floor(rec.Pop / 10);
    rec.Pop -= Starve;
    if (Starve > 0) {
      const Tech = GetTech(WorldID);
      AddNews(GetStatus(WorldID), N.Starv, LL(WorldID), Starve, 0, 0);
      ChangeRevIndex(WorldID, LesserInt(Trunc(StarveTechAdj[Tech] * (Starve / 10)), 45));
    }
  } else rec.Cargo[sup] -= FoodNeeded;
}

function UseUpAmbrosia(WorldID, Emp, rec) {
  let AmbNeeded = ThgLmt((rec.Pop / 100) * DrugsPerBillion);
  const Loc = LL(WorldID);
  if (rec.Special & (1 << AmbAddict)) {
    if (AmbNeeded <= rec.Cargo[amb]) rec.Cargo[amb] -= AmbNeeded;
    else {
      const Lack = AmbNeeded - rec.Cargo[amb];
      rec.Cargo[amb] = 0;
      let Die = ThgLmt(AddictDeathCoeff * Lack);
      if (Die > Math.floor(rec.Pop / 7)) Die = Math.floor(rec.Pop / 7);
      rec.Pop -= Die;
      if (Die > 0) AddNews(Emp, N.AddictDie, Loc, Die, 0, 0);
      let EffChange = Trunc(AddictEffCoeff * Die);
      EffChange = LesserInt(EffChange, rec.Eff);
      rec.Eff -= EffChange;
      ChangeRevIndex(WorldID, Trunc(AddictRevICoeff * Die));
      const r = Rnd(1, 10);
      if (r >= 5 && r <= 7) {
        Die = ThgLmt((Rnd(50, 120) / 100) * Die);
        if (Die > 0) {
          rec.Pop = (rec.Pop - Die) & 0xFFFF;
          AddNews(Emp, N.RiotsDie, Loc, Die, 0, 0);
        }
      } else if (r >= 8 && r <= 9) {
        for (let i = BioInd; i <= TriInd; i++) {
          const IndDest = Trunc(rec.Indus[i] * Rnd(0, 20) / 100);
          rec.Indus[i] -= IndDest;
          if (IndDest > 0) AddNews(Emp, N.IndDs, Loc, IndDest, i, 0);
        }
      } else if (r === 10) {
        if (rec.Tech > PreTchLvl) rec.Tech--;
        AddNews(Emp, N.RTech, Loc, rec.Tech, 0, 0);
      }
      if (Rnd(1, 100) <= ChanceToAddict) {
        rec.Special &= ~(1 << AmbAddict);
        AddNews(Emp, N.UAddict, Loc, 0, 0, 0);
      }
    }
  } else if (rec.Cargo[amb] > 0) {
    if (AmbNeeded <= rec.Cargo[amb]) {
      if (Rnd(1, 100) < ChanceToAddict) {
        rec.Special |= 1 << AmbAddict;
        AddNews(Emp, N.WAddict, Loc, 0, 0, 0);
      }
    }
    AmbNeeded = Math.floor(AmbNeeded / 2);
    if (AmbNeeded <= rec.Cargo[amb]) rec.Cargo[amb] -= AmbNeeded;
    else rec.Cargo[amb] = 0;
  }
}

function UpdateDefenses(WorldID, rec, Technology, OtherReports) {
  const { Pop, Typ, Eff } = rec;
  const MPop = TroopStrength(WorldID);
  let BuildRate = (MPop / 2000) * (1 + ((Eff - 50) / 100));
  let Optimum = MPop / 100;
  let BTyp = null;
  if (WorldID.ObjTyp === Pln) BuildRate *= Pop / 2000;
  else if (WorldID.ObjTyp === Base) {
    BTyp = GetBaseType(WorldID);
    if (BTyp === out) Optimum /= 4;
    else if (BTyp === cmm || BTyp === frt) { Optimum *= 4; BuildRate *= 4; }
  }
  for (let d = LAM; d <= ion; d++) {
    if (!(Technology & (1 << d))) continue;
    let OptimumDef = ThgLmt(Optimum * DefAdj[d]);
    if (WorldID.ObjTyp === Base && BTyp === out && d === def) OptimumDef = 0;
    if (d === LAM && !(Typ === BseTyp || Typ === CapTyp)) OptimumDef = 0;
    if (rec.Defns[d] < OptimumDef) {
      const MaxBuild = GreaterInt(ThgLmt(BuildRate * DefBuildRate[d]), 1);
      let Build = LesserInt(OptimumDef - rec.Defns[d], MaxBuild);
      for (let c = che; c <= tri; c++) {
        const RawNeeded = ThgLmt((RawM[d][c] / 100) * Build);
        if (RawNeeded > rec.Cargo[c]) {
          Build = ThgLmt((rec.Cargo[c] / RawM[d][c]) * 100);
          ReportPlanetLack(GetStatus(WorldID), WorldID, N.DefLack, c, OtherReports);
        }
      }
      for (let c = che; c <= tri; c++) {
        const RawNeeded = ThgLmt(Build * (RawM[d][c] / 100));
        rec.Cargo[c] = MoveThings(RawNeeded, rec.Cargo[c], 0)[0];
      }
      rec.Defns[d] = MoveThings(Build, MaxResources, rec.Defns[d])[1];
    }
  }
}

function totalCargo(rec) { return rec.Cargo.slice(); }
function putTotalCargo(rec, TempCargo) {
  for (let c = men; c <= tri; c++) rec.Cargo[c] = ThgLmt(TempCargo[c]);
}

export function UpdateWorld(World) {
  const OtherReports = { v: 0 };
  if (World.ObjTyp === Pln) {
    const p = Universe.Planet[World.Index];
    let Technology;
    if (p.Emp === Indep) Technology = p.Tech > PreTchLvl ? TechDev[p.Tech - 1] : TechDev[p.Tech];
    else Technology = GetEmpireTechnology(p.Emp).TechSet & TechDev[p.Tech];

    UpdateTerraforming(World);

    const IP = (TechAdj2[p.Tech] / 100) * ((p.Eff + 250) / 100) / K6;
    const TempCargo = totalCargo(p);
    ProduceRawMaterial(World, p.Indus, Technology, IP, TempCargo);
    const IndDist = GetIndustrialDistribution(World);
    UpdateIndustry(World, p.Cls, p.Tech, p.Eff, p.Pop, (p.Special & (1 << AmbAddict)) !== 0, IndDist, p.Indus, TempCargo, OtherReports);
    Production(World, p.Typ, p.Indus, Technology, IP, p.Ships, TempCargo, OtherReports);
    putTotalCargo(p, TempCargo);

    if (p.Cls !== TerCls) p.Eff = UpdateEfficiency(p.Emp, p.Eff);
    p.Tech = UpdateTechLevel(World, p.Emp, p.Tech);
    p.Pop = UpdatePopulation(p.Cls, p.Tech, p.Pop);
    UseUpFood(World, p);
    UseUpAmbrosia(World, p.Emp, p);
    p.Cargo[men] = UpdateMilitary(p.Typ, p.Pop, p.Cargo[men]);
    UpdateDefenses(World, p, Technology, OtherReports);
    UpdateRevolution(World);
    if (p.Cls === HLfCls) HostileLife(World);
  } else if (World.ObjTyp === Base) {
    const b = Universe.Starbase[World.Index];
    let Technology;
    if (b.Emp === Indep) Technology = TechDev[Math.max(0, b.Tech - 1)];
    else Technology = GetEmpireTechnology(b.Emp).TechSet & TechDev[b.Tech];

    if (b.STyp === cmp) {
      const IP = (TechAdj2[b.Tech] / 100) * ((b.Eff + 250) / 100) / K6;
      const TempCargo = totalCargo(b);
      SupplyLink(World, TempCargo);
      ProduceRawMaterial(World, b.Indus, Technology, IP, TempCargo);
      const IndDist = GetIndustrialDistribution(World);
      UpdateIndustry(World, ArtCls, b.Tech, b.Eff, b.Pop, (b.Special & (1 << AmbAddict)) !== 0, IndDist, b.Indus, TempCargo, OtherReports);
      Production(World, b.Typ, b.Indus, Technology, IP, b.Ships, TempCargo, OtherReports);
      SurplusLink(World, TempCargo);
      putTotalCargo(b, TempCargo);
    }
    b.Eff = UpdateEfficiency(b.Emp, b.Eff);
    b.Tech = UpdateTechLevel(World, b.Emp, b.Tech);
    if (b.STyp === cmp) {
      b.Pop = UpdatePopulation(ArtCls, b.Tech, b.Pop);
      UseUpFood(World, b);
      UseUpAmbrosia(World, b.Emp, b);
      b.Cargo[men] = UpdateMilitary(b.Typ, b.Pop, b.Cargo[men]);
      UpdateRevolution(World);
    }
    UpdateDefenses(World, b, Technology, OtherReports);
  }
}

// onProgress(label) is optional for UI feedback
export function UpdateUniverse(onProgress) {
  NewTotalRevIndex.fill(0);
  env.Year++;
  for (let i = 1; i <= G.NoOfPlanets; i++) UpdateWorld({ ObjTyp: Pln, Index: i });
  for (let i = 1; i <= MaxNoOfStarbases; i++)
    if (bIn(i, G.SetOfActiveStarbases)) UpdateWorld({ ObjTyp: Base, Index: i });
  for (let i = 1; i <= MaxNoOfConstrSites; i++)
    if (bIn(i, G.SetOfActiveConstructionSites)) UpdateConstruction(i);
  for (let e = Empire1; e <= Empire8; e++) if (EmpireActive(e)) UpdateEmpire(e);
  DeleteReadMessages();
}
