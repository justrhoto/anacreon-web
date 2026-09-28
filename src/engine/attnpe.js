// ATTNPE.PAS: automatic (non-interactive) combat, used by NPEs and auto-attack.
import { Pln, Base, Flt, Con, Gate, LAM, nnj, fgt, jmp, pen, ssp, jtn, trn, men, DpSpc, SbOrb, Grnd } from './types.js';
import { CombatTable } from './datacnst.js';
import { IntLmt } from './misc.js';
import { GetStatus } from './primintr.js';
import {
  CombatPower, CaptTrnAIT, DestTrnAIT, NoART, AttDestroyedART, AttRetreatsART, DefConqueredART,
  GDst, GAdvc, AdvanceGroups, AllGroupsDestroyed, EnemySurrenders, Battle, CalculateCombatData,
  DefaultDistribution, GetEnemy, RestoreCombatant, ResolveAttack, DestroyConstructionOrGate,
  ForcesUnknown, AttackArray, DetailArray,
} from './attack.js';

function GetTargets(Pos, En) {
  const t = [];
  for (let a = LAM; a <= nnj; a++) if (En[Pos][a] > 0) t.push({ TargTyp: a, TargNum: En[Pos][a], Priority: 0 });
  return t;
}

function Prioritize(AttTyp, Intent, Target) {
  for (const t of Target) {
    let Total = (t.TargNum / 1000) * (CombatTable[AttTyp][t.TargTyp] / 100) * CombatPower[t.TargTyp];
    if (Total < 2) Total = 2;
    const isTrn = t.TargTyp === trn || t.TargTyp === jtn;
    if (Intent === CaptTrnAIT && isTrn) Total = 1;
    else if (Intent === DestTrnAIT && !isTrn) Total = 1;
    t.Priority = IntLmt(Total);
  }
}

function BestTarget(Target, current) {
  let hp = 0, best = current;
  for (const t of Target) if (t.Priority >= hp) { hp = t.Priority; best = t.TargTyp; }
  return best;
}

function AllAdvance(n, Gp) {
  for (let i = 1; i <= n; i++) {
    const g = Gp[i];
    if (g.Sta !== GDst && g.Pos < SbOrb && (g.Typ <= jmp || g.Typ === pen || g.Typ === ssp)) g.Sta = GAdvc;
  }
}

function TrnAdvance(n, Gp) {
  for (let i = 1; i <= n; i++) {
    const g = Gp[i];
    if (g.Sta !== GDst && g.Pos < Grnd && (g.Typ === fgt || g.Typ === jtn || g.Typ === trn)) g.Sta = GAdvc;
  }
}

function GroupEngage(n, Gp, En, CD, Killed, Casualties, Result) {
  const Details = DetailArray();
  for (let p = DpSpc; p <= Grnd; p++) Battle(n, Gp, En, p, CD, Details, Casualties, Killed);
  AdvanceGroups(n, Gp);
  if (AllGroupsDestroyed(n, Gp)) return AttDestroyedART;
  if (Result !== AttRetreatsART && EnemySurrenders(n, Gp, En, Casualties, Killed, CD)) return DefConqueredART;
  return Result;
}

function NoMenLeft(n, Gp) {
  let i = n;
  while (i > 0 && (Gp[i].Sta === GDst || (Gp[i].Typ >= fgt && Gp[i].Typ <= trn))) i--;
  return i === 0;
}

function TransportsLeft(n, Gp) {
  let i = n;
  while (i > 0 && (Gp[i].Sta === GDst || Gp[i].Typ === jtn || Gp[i].Typ === trn)) i--;
  return i === 0;
}

const MAX_ROUNDS = 5000; // safety net against pathological endless battles

function Engage(isFleet, n, Gp, En, CD, Intent, Casualties, Killed) {
  let Result = NoART;
  let round = 0;
  do {
    round++;
    if (round > 30 && NoMenLeft(n, Gp)) Result = AttRetreatsART;

    let TargetAvailable = false, Check = false, GeneralPos = DpSpc, LowestPos = DpSpc;
    for (let i = 1; i <= n; i++) {
      const g = Gp[i];
      if (g.Sta === GDst) continue;
      if (Check) { if (g.Pos > LowestPos) LowestPos = g.Pos; }
      else { GeneralPos = g.Pos; LowestPos = g.Pos; Check = true; }
      const T = GetTargets(g.Pos, En);
      if (T.length > 0) {
        TargetAvailable = true;
        Prioritize(g.Typ, Intent, T);
        g.Trg = BestTarget(T, g.Trg);
      }
      if (!isFleet && g.Pos === Grnd) g.Trg = men;
    }
    if (!TargetAvailable) {
      if (isFleet) { if (GeneralPos !== SbOrb) AllAdvance(n, Gp); }
      else if (LowestPos === SbOrb || TransportsLeft(n, Gp)) TrnAdvance(n, Gp);
      else AllAdvance(n, Gp);
    }
    Result = GroupEngage(n, Gp, En, CD, Killed, Casualties, Result);
    if (round >= MAX_ROUNDS && Result === NoART) Result = AttRetreatsART;
  } while (Result === NoART);
  return Result;
}

export function NPEAttack(FltID, Target, Intent, RetrIndex) {
  let Result = NoART;
  const HKSurprise = ForcesUnknown(FltID, Target);
  const AttEmp = GetStatus(FltID);
  if (Target.ObjTyp === Pln || Target.ObjTyp === Base || Target.ObjTyp === Flt) {
    const CD = CalculateCombatData(AttEmp, FltID, Target);
    const { NoOfGroups, Gp } = DefaultDistribution(FltID);
    const En = GetEnemy(Target);
    const Killed = AttackArray(), Casualties = AttackArray();
    Result = Engage(Target.ObjTyp === Flt, NoOfGroups, Gp, En, CD, Intent, Casualties, Killed);
    RestoreCombatant(FltID, Casualties);
    RestoreCombatant(Target, Killed);
    ResolveAttack(Result, FltID, Target, HKSurprise, Intent !== DestTrnAIT, Casualties, Killed);
  } else if (Target.ObjTyp === Con || Target.ObjTyp === Gate) {
    DestroyConstructionOrGate(AttEmp, HKSurprise, Target);
    Result = DefConqueredART;
  }
  return Result;
}
