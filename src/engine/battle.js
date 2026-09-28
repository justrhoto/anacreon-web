// Interactive battles (ATTCOMM.PAS) as a UI-free session object.
import { bIn, Round } from '../runtime/pascal.js';
import {
  G, Indep, Empire1, Empire8, Pln, Base, Flt, Con, Gate, NoRes, fgt, jtn, trn, men, nnj, LAM, ion,
  def, GDM, DpSpc, HiOrb, Orbit, SbOrb, Grnd, CapTyp, cpID, ResArr,
} from './types.js';
import { CargoSpace, TrnAdj, ThingNames, TechDev, ObjName } from './datacnst.js';
import { LesserInt, Rnd, NoShips, ThgLmt } from './misc.js';
import {
  GetShips, GetCargo, GetStatus, GetTech, GetType, GetRevIndex, ObjectName, ShortFormat,
  LongFormat, MyLord, EmpireName, EmpireActive, Empress,
} from './primintr.js';
import {
  MaxNoOfGroups, GReady, GAdvc, GRtrt, GDst, NoART, AttDestroyedART, AttRetreatsART,
  DefConqueredART, AttackArray, DetailArray, GroupArray, AdvanceGroups, AllGroupsDestroyed,
  EnemySurrenders, Battle, CalculateCombatData, DefaultDistribution, GetEnemy, RestoreCombatant,
  ResolveAttack, ForcesUnknown, newGroup,
} from './attack.js';
import { DisplayBackground } from './scena.js';
import { env } from './env.js';

export const ATSymb = '-LDGIFHJTPSRMN';
export const TypN = ['', '', '', '', '', 'fgt sq', 'hk', 'jmpshp', 'jmptrn', 'pentr', 'strshp', 'trnspt', 'GAT', 'ninja'];
export const PosN = ['Deep space', 'High orbit', 'Orbit', 'Sub-orbit', 'Surface'];
export { GReady, GAdvc, GRtrt, GDst };

// Custom configuration (GetGroups). slots: array (up to 9) of { typ, num, gatTyp, gat }.
// Returns { NoOfGroups, Gp } assembled like the original (warships first, then transports,
// then automatic troop loading of empty transports).
export function buildCustomGroups(FltID, slots) {
  const Sh = GetShips(FltID), Cr = GetCargo(FltID);
  const tmp = [];
  for (const s of slots.slice(0, MaxNoOfGroups)) {
    const g = newGroup();
    g.Typ = s.typ;
    g.Num = Math.max(0, Math.min(s.num | 0, Sh[s.typ]));
    Sh[s.typ] -= g.Num;
    if ((s.typ === jtn || s.typ === trn) && s.gatTyp && g.Num > 0) {
      const cap = ThgLmt(Round(TrnAdj[s.typ] * g.Num * CargoSpace[s.gatTyp]));
      g.GAT = LesserInt(Cr[s.gatTyp], LesserInt(cap, s.gat === undefined ? cap : s.gat));
      g.GATTyp = s.gatTyp;
      Cr[s.gatTyp] -= g.GAT;
    }
    tmp.push(g);
  }
  const Gp = GroupArray();
  let n = 0;
  for (const g of tmp) if (g.Num > 0 && !(g.Typ === trn || g.Typ === jtn)) Gp[++n] = g;
  for (const g of tmp) if (g.Num > 0 && (g.Typ === trn || g.Typ === jtn)) Gp[++n] = g;
  for (let i = 1; i <= n; i++) {
    const g = Gp[i];
    if (!(g.Typ === trn || g.Typ === jtn) || g.GAT !== 0) continue;
    if (Cr[men] > 0) {
      const t = LesserInt(Cr[men], Round(CargoSpace[men] * TrnAdj[g.Typ] * g.Num));
      g.GAT = t; g.GATTyp = men; Cr[men] -= t;
    } else if (Cr[nnj] > 0) {
      const t = LesserInt(Cr[nnj], Round(CargoSpace[nnj] * TrnAdj[g.Typ] * g.Num));
      g.GAT = t; g.GATTyp = nnj; Cr[nnj] -= t;
    }
  }
  return { NoOfGroups: n, Gp };
}

export class BattleSession {
  constructor(FltID, Target, groups) {
    this.Player = env.Player;
    this.FltID = cpID(FltID);
    this.Target = cpID(Target);
    this.HKSurprise = ForcesUnknown(FltID, Target);
    const g = groups || DefaultDistribution(FltID);
    this.n = g.NoOfGroups;
    this.Gp = g.Gp;
    this.CD = CalculateCombatData(this.Player, FltID, Target);
    this.En = GetEnemy(Target);
    this.Killed = AttackArray();
    this.Casualties = AttackArray();
    this.Details = DetailArray();
    this.Result = NoART;
    this.ended = false;
    this.events = [];
    const intro = ['Fleet entering real space...', 'Fleet now coming out of hyperspace...', 'Fleet in combat status...'];
    this.events.push({ type: 'report', text: intro[Rnd(1, 3) - 1] });
    this.fleetName = ObjectName(this.Player, FltID, LongFormat);
    this.targetName = ObjectName(this.Player, Target, LongFormat);
  }

  groups() {
    const out = [];
    for (let i = 1; i <= this.n; i++) {
      const g = this.Gp[i];
      out.push({
        index: i, typ: g.Typ, typeName: TypN[g.Typ], num: g.Num, pos: g.Pos, posName: PosN[g.Pos],
        target: g.Trg, targetSymbol: ATSymb[g.Trg], status: g.Sta,
        gat: g.GAT, gatTyp: g.GATTyp, cloaked: g.Typ === 6 && !g.Flg,
      });
    }
    return out;
  }

  enemy() { return this.En.map((a) => a.slice()); }

  // GroupEngage: one round of combat in all orbits
  engage() {
    this.Details = DetailArray();
    const events = [];
    for (let p = DpSpc; p <= Grnd; p++) {
      const dead = Battle(this.n, this.Gp, this.En, p, this.CD, this.Details, this.Casualties, this.Killed);
      for (const i of [...dead].sort((a, b) => a - b)) events.push({ type: 'destroyed', group: i, pos: p, text: 'Group ' + i + ' destroyed.' });
    }
    for (let i = 1; i <= this.n; i++) {
      const g = this.Gp[i];
      if (g.Sta === GAdvc) events.push({ type: 'advance', group: i, from: g.Pos, to: g.Pos + 1 });
      else if (g.Sta === GRtrt) events.push({ type: 'retreat', group: i, from: g.Pos, to: g.Pos - 1 });
    }
    AdvanceGroups(this.n, this.Gp);
    if (AllGroupsDestroyed(this.n, this.Gp)) {
      events.push({ type: 'report', text: 'ALL GROUPS DESTROYED' });
      this.ended = true;
      this.Result = AttDestroyedART;
    } else if (this.Result !== AttRetreatsART &&
               EnemySurrenders(this.n, this.Gp, this.En, this.Casualties, this.Killed, this.CD)) {
      events.push({ type: 'report', text: 'THE ENEMY HAS SURRENDERED' });
      this.ended = true;
      this.Result = DefConqueredART;
    }
    this.events.push(...events);
    return events;
  }

  // Which moves each group may make (GroupMove)
  moveOptions(i) {
    const g = this.Gp[i];
    if (g.Sta === GDst) return { advance: false, retreat: false };
    const advance = (g.Pos !== Grnd && (this.CD.DTyp !== Flt || g.Pos !== Orbit)) &&
      (g.Pos !== SbOrb || g.Typ === fgt || g.Typ === trn || g.Typ === jtn);
    const retreat = !((g.Pos === Grnd && g.Typ !== fgt) || g.Pos === DpSpc);
    return { advance, retreat };
  }

  // orders: { [groupIndex]: 'A' | 'R' | 'S' }. Maneuver then engage. Returns events or null.
  maneuver(orders) {
    let any = false;
    for (let i = 1; i <= this.n; i++) {
      const o = orders[i];
      const opt = this.moveOptions(i);
      if (o === 'A' && opt.advance) { this.Gp[i].Sta = GAdvc; any = true; }
      else if (o === 'R' && opt.retreat) { this.Gp[i].Sta = GRtrt; any = true; }
    }
    if (!any) return null;
    return this.engage();
  }

  setTarget(i, trg) {
    const g = this.Gp[i];
    if (g && g.Sta !== GDst) g.Trg = trg;
  }

  retreat() {
    this.events.push({ type: 'report', text: 'ALL GROUPS RETREATING' });
    this.Result = AttRetreatsART;
    const ev = this.engage();
    this.ended = true;
    return ev;
  }

  details() {
    const rows = [];
    for (let s = LAM; s <= nnj; s++) {
      if (this.Details[s][0] === 0) continue;
      rows.push({ name: ThingNames[s], perGroup: this.Details[s].slice(1, this.n + 1) });
    }
    return rows;
  }

  // Step 1 of CleanUp: apply casualties and gather what the player must be told/asked.
  prepareFinish() {
    RestoreCombatant(this.FltID, this.Casualties);
    RestoreCombatant(this.Target, this.Killed);
    const Player = this.Player;
    const out = { result: this.Result, lines: [], captured: null, oldShips: null };
    const lord = () => MyLord(Player);
    if (this.Result === AttDestroyedART) {
      out.lines = battleLostMessage(Player, this.Target);
    } else if (this.Result === AttRetreatsART) {
      out.lines = ['The attacking force has retreated, ' + lord() + '.'];
    } else if (this.Result === DefConqueredART) {
      // OldShipsFound
      if (this.Target.ObjTyp === Pln && GetStatus(this.Target) === Indep) {
        const Ships = GetShips(this.Target), Tech = GetTech(this.Target);
        const found = [];
        for (let s = fgt; s <= trn; s++) if (!(TechDev[Tech] & (1 << s)) && Ships[s] > 0) found.push(Ships[s] + ' ' + ThingNames[s]);
        if (found.length) out.oldShips = { intro: lord() + ', we have found the following ships in orbit:', list: found };
      }
      if (this.Target.ObjTyp === Flt) {
        const Sh2 = GetShips(this.Target);
        if (!NoShips(Sh2)) {
          const list = [];
          for (let s = fgt; s <= trn; s++) if (Sh2[s] > 0) list.push(Sh2[s] + ' ' + ThingNames[s]);
          const plea = [
            'The commander of the enemy fleet begs Your Majesty to spare his life.',
            'Message from enemy commander: "...' + lord() + ', please allow me the honor of death in battle.  Destroy this fleet..."',
            'Death in space is the only honorable way for a vanquished enemy.',
          ][Rnd(1, 3) - 1];
          out.captured = { list, plea };
        }
      }
    }
    this.prepared = out;
    return out;
  }

  // Step 2: resolve (capture = keep the captured ships). Returns { lines, booty }
  resolve(capture = true) {
    const Player = this.Player;
    const out = { lines: [], booty: [] };
    if (this.Result === DefConqueredART) {
      const bg = DisplayBackground(Indep, this.Target, true);
      if (bg) out.lines = bg;
      else {
        const EmpN = EmpireName(Player);
        const m1 = [(Empress(Player) ? 'In the name of Her Imperial Majesty, Lady of ' : 'In the name of His Imperial Majesty, Lord of ') + EmpN + ', I hereby declare',
          'this ' + ObjName[this.Target.ObjTyp] + ' to be under the sovereign jurisdiction of the', EmpN + ' Empire.'];
        if (GetType(this.Target) !== CapTyp) {
          const r = Rnd(1, 3);
          if (r === 1) out.lines = m1;
          else if (r === 2) out.lines = ['Congratulations ' + MyLord(Player) + ', ' + this.fleetName + ' has succeeded in its attack against',
            ObjectName(Player, this.Target, LongFormat) + '.  No doubt some of your enemies will in the future ', 'be more careful when challenging this empire.'];
          else out.lines = ['Congratulations on your victory, ' + MyLord(Player) + ', but remember that not', 'all battles will be this easy.'];
        } else out.lines = m1;
      }
    }
    const Booty = ResolveAttack(this.Result, this.FltID, this.Target, this.HKSurprise, capture, this.Casualties, this.Killed);
    for (let i = 1; i <= G.NoOfPlanets; i++) {
      if (bIn(i, Booty)) out.booty.push(ObjectName(Player, { ObjTyp: Pln, Index: i }, LongFormat));
    }
    return out;
  }
}

function battleLostMessage(Player, Target) {
  const lord = () => MyLord(Player);
  const m1 = () => {
    const l = ["I'm sorry, " + lord() + ', the entire attack force has been destroyed.',
      'I hope I do not have to remind you about the repercussion that this',
      'loss will have.  Cetain factions within the Empire are already counting',
      'on fear to incite rebellion.'];
    let MaxRev = 0, MaxID = null;
    for (let i = 1; i <= G.NoOfPlanets; i++) {
      if (!bIn(i, G.SetOfPlanetsOf[Player])) continue;
      const id = { ObjTyp: Pln, Index: i };
      if (GetRevIndex(id) > MaxRev) { MaxRev = GetRevIndex(id); MaxID = id; }
    }
    if (MaxRev > 20 && MaxID) {
      l.push('Do not forget that ' + ObjectName(Player, MaxID, ShortFormat) + " is quickly growing doubtful of the Empire's");
      l.push('ability to defend itself.');
    }
    return l;
  };
  const m2 = () => [lord() + ", I'm sorry to report that the entire attack force was lost",
    'in the battle.  At the risk of offending Your Highness, I would like to',
    'point out that an option to retreat was open at all times.  Although',
    'sacrifice is something that all your troops know, it is often best to',
    'allow them the luxury of living to fight another day.'];
  const m3 = () => {
    let E, guard = 0;
    do { E = Rnd(Empire1, Empire8); } while (!(E !== Player && EmpireActive(E)) && guard++ < 1000);
    return [lord() + ', the entire attack force was destroyed in battle.',
      'Although I certainly do not question the orders and decision of Your',
      'Highness, I should like to mention that this defeat will not go',
      'unnoticed in the Galaxy.  Already ' + EmpireName(E) + ' is starting to',
      'believe that this Empire would not be an overly costly target.'];
  };
  const m4 = () => [lord() + ', the attack force has been totally destroyed by the enemy.',
    ['You must be careful, Your Highness, or greater battles will be lost.',
      'Do not think that this defeat will go unnoticed in the Galaxy.',
      'You must be careful, other star systems grow suspicious of your defenses.'][Rnd(1, 3) - 1]];
  if (GetStatus(Target) === Indep) {
    const r = Rnd(1, 12);
    return r === 1 ? m1() : r === 2 ? m2() : m4();
  }
  const r = Rnd(1, 4);
  return r === 1 ? m1() : r === 2 ? m2() : r === 3 ? m3() : m4();
}
