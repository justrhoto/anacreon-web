// NPE03.PAS: guardian empires (stationary; LAM strikes on nearby fleets).
import { bIn, MaxInt } from '../runtime/pascal.js';
import { G, MaxNoOfFleets, MaxNoOfStarbases, Flt, Pln, Base, LAM, ResArr } from './types.js';
import { LesserInt, GreaterInt, Distance, MilitaryPower, Rnd } from './misc.js';
import { GetDefns, PutDefns, GetCoord, Known, GetStatus, GetShips } from './primintr.js';
import { LAMAttack } from './attack.js';
import { SetEmpireDefenses } from './npeintr.js';
import { newFleetDataArray } from './npetypes.js';

function GRDNLAMAttack(Emp, BaseID) {
  const Defns = GetDefns(BaseID);
  let NoOfLAMs = Defns[LAM];
  const BaseXY = GetCoord(BaseID);
  const Priority = new Array(MaxNoOfFleets + 1).fill(0);
  for (let i = 1; i <= MaxNoOfFleets; i++) {
    if (!bIn(i, G.SetOfActiveFleets)) continue;
    const F = { ObjTyp: Flt, Index: i };
    if (Known(Emp, F) && Distance(GetCoord(F), BaseXY) <= 5 && GetStatus(F) !== Emp)
      Priority[i] = LesserInt(MaxInt, GreaterInt(1, Math.trunc(MilitaryPower(GetShips(F), ResArr()) / 1000)));
  }
  let BestPriority;
  do {
    BestPriority = 0;
    let BestTarget = 0;
    for (let i = 1; i <= MaxNoOfFleets; i++)
      if (Priority[i] > BestPriority) { BestPriority = Priority[i]; BestTarget = i; }
    if (BestPriority > 0) {
      const LAMsToUse = LesserInt(NoOfLAMs, Rnd(75, 150) * BestPriority);
      if (bIn(BestTarget, G.SetOfActiveFleets)) LAMAttack(Emp, LAMsToUse, { ObjTyp: Flt, Index: BestTarget });
      Priority[BestTarget] = 0;
      NoOfLAMs -= LAMsToUse;
    }
  } while (!(BestPriority === 0 || NoOfLAMs === 0));
  const D2 = GetDefns(BaseID);
  D2[LAM] = NoOfLAMs;
  PutDefns(BaseID, D2);
}

export function ImplementGuardianNPE(Emp) {
  for (let i = 1; i <= G.NoOfPlanets; i++) {
    if (!bIn(i, G.SetOfPlanetsOf[Emp])) continue;
    const id = { ObjTyp: Pln, Index: i };
    if (GetDefns(id)[LAM] > 0) GRDNLAMAttack(Emp, id);
  }
  for (let i = 1; i <= MaxNoOfStarbases; i++) {
    if (!bIn(i, G.SetOfStarbasesOf[Emp])) continue;
    const id = { ObjTyp: Base, Index: i };
    if (GetDefns(id)[LAM] > 0) GRDNLAMAttack(Emp, id);
  }
}

export function InitializeGuardianNPE(Emp) {
  SetEmpireDefenses(Emp);
  return { FleetData: newFleetDataArray() };
}
