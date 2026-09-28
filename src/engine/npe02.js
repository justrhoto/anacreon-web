// NPE02.PAS: kingdom empires (passive Kingdom1 and aggressive Kingdom2).
import { bIn } from '../runtime/pascal.js';
import { G, NoOfFleetsPerEmpire, Flt, FReady, Empire1, Empire8 } from './types.js';
import { Rnd } from './misc.js';
import { GetStatus, GetFleetStatus } from './primintr.js';
import { AbortFleet, DestroyFleet } from './fleet.js';
import { DefConqueredART, NoART } from './attack.js';
import {
  ReturnMSN, RefuelMSN, GuardMSN, StackMSN, RaidTrnMSN, SupplyMSN, SupplyTrnMSN, ConquerMSN,
  SlowAttackMSN, JumpAttackMSN, NeutralPLT, HarassPLT, newFleetDataArray, newStateDeptArray,
  newPersona,
} from './npetypes.js';
import {
  MidCourseCorrection, GetRegionalCapital, ImplementReturnMSN, ImplementRefuelMSN,
  ImplementGuardMSN, ImplementStackMSN, ImplementRaidTrnMSN, ImplementSupplyMSN,
  ImplementConquerMSN, ImplementJumpAttackMSN, SetRaidingFleetNewTarget, SetFleetReturn,
  EnforceNPEDataLinks, StateDeptReport, CreateRegionArray, StateDepartment, ReDesignateEmpire,
  SetEmpireDefenses,
} from './npeintr.js';
import {
  ReviewNews, WarCabinet, DefendEmpire, ImperialExpansion, ExplorationAndProbing, NPEConquest,
} from './npe00.js';

function initKingdom(Emp, policy, persona) {
  const Data = { FleetData: newFleetDataArray(), State: newStateDeptArray(), Persona: newPersona() };
  for (let e = Empire1; e <= Empire8; e++) {
    const s = Data.State[e];
    s.Policy = policy;
    s.AttackChance = 50;
    s.Aggressiveness = 0;
    s.Balance = 0;
  }
  Object.assign(Data.Persona, persona());
  SetEmpireDefenses(Emp);
  return Data;
}

export function InitializeKingdom1NPE(Emp) {
  return initKingdom(Emp, NeutralPLT, () => {
    const ImpGene = Rnd(1, 5), DefGene = Rnd(50, 75), OffGene = Rnd(1, 2);
    return {
      ImpGene, DefGene, OffGene, FactorGene: 15, RandomGene: 50,
      Defensive: DefGene, Offensive: OffGene, Techno: 50, Provoke: 75, Imperialist: ImpGene,
      WorldPower: Rnd(25, 75), Honorable: 50, SphereX: Rnd(25, 75), Clock: 0, Offset: Rnd(1, 10),
    };
  });
}

export function InitializeKingdom2NPE(Emp) {
  return initKingdom(Emp, HarassPLT, () => {
    const ImpGene = Rnd(50, 100), DefGene = Rnd(5, 10), OffGene = Rnd(50, 100);
    return {
      ImpGene, DefGene, OffGene, FactorGene: 25, RandomGene: 50,
      Defensive: DefGene, Offensive: OffGene, Techno: 50, Provoke: Rnd(50, 100), Imperialist: ImpGene,
      WorldPower: Rnd(25, 75), Honorable: 50, SphereX: Rnd(25, 100), Clock: 0, Offset: Rnd(1, 10),
    };
  });
}

function UpdateFleets(Emp, RCap, Persona, Data) {
  const { FleetData, State } = Data;
  for (let i = 1; i <= NoOfFleetsPerEmpire; i++) {
    const idx = FleetData[i].Index;
    const FltID = { ObjTyp: Flt, Index: idx };
    if (!(idx > 0 && bIn(idx, G.SetOfActiveFleets))) continue;
    MidCourseCorrection(Emp, FltID, RCap, FleetData);
    if (GetFleetStatus(FltID) !== FReady) continue;
    const BaseID = GetRegionalCapital(FltID, RCap);
    const Mission = FleetData[i].Mission;
    const TargID = { ...FleetData[i].TargetID };
    switch (Mission) {
      case ReturnMSN: ImplementReturnMSN(FltID, TargID); break;
      case RefuelMSN: ImplementRefuelMSN(FltID, TargID); break;
      case GuardMSN: ImplementGuardMSN(FltID, TargID); break;
      case StackMSN: ImplementStackMSN(FltID, FleetData); break;
      case RaidTrnMSN: ImplementRaidTrnMSN(Emp, FltID, TargID, BaseID, FleetData); break;
      case SupplyMSN: ImplementSupplyMSN(Emp, FltID, TargID, BaseID, FleetData); break;
      case SupplyTrnMSN: ImplementReturnMSN(FltID, TargID); break;
      case ConquerMSN: {
        const EnemyEmp = GetStatus(TargID);
        const Result = ImplementConquerMSN(Emp, FltID, TargID, BaseID, FleetData);
        if (Result === DefConqueredART) {
          NPEConquest(Emp, TargID, Result, RCap, Persona);
          State[EnemyEmp].Balance++;
        }
        break;
      }
      case SlowAttackMSN:
      case JumpAttackMSN: {
        const EnemyEmp = GetStatus(TargID);
        const Result = ImplementJumpAttackMSN(Emp, FltID, TargID, BaseID, FleetData);
        const alive = bIn(FltID.Index, G.SetOfActiveFleets);
        if (Result === DefConqueredART) {
          NPEConquest(Emp, TargID, Result, RCap, Persona);
          State[EnemyEmp].Balance++;
          if (alive) {
            AbortFleet(FltID, TargID, true);
            DestroyFleet(FltID);
          }
        } else if (!alive) {
          // fleet was destroyed in battle
        } else if (Result === NoART) {
          SetRaidingFleetNewTarget(Emp, FltID, TargID, BaseID, FleetData, Persona);
        } else SetFleetReturn(Emp, FltID, BaseID, FleetData);
        break;
      }
      default: DestroyFleet(FltID);
    }
  }
}

export function ImplementKingdom1NPE(Emp, Data) {
  const { FleetData, State, Persona } = Data;
  EnforceNPEDataLinks(Emp, FleetData);
  if (Persona.Clock === 0) StateDeptReport(Emp, State);
  const RCap = CreateRegionArray(Emp);
  UpdateFleets(Emp, RCap, Persona, Data);
  ReviewNews(Emp, FleetData, RCap, Persona, State);
  StateDepartment(Emp, Persona, State);
  WarCabinet(Emp, RCap, FleetData, Persona, State);
  DefendEmpire(Emp, RCap, FleetData, Persona);
  ImperialExpansion(Emp, RCap, FleetData, Persona);
  if ((Persona.Clock + Persona.Offset) % 7 === 0) {
    StateDeptReport(Emp, State);
    ReDesignateEmpire(Emp, RCap, Persona);
  }
  ExplorationAndProbing(Emp, RCap, Persona);
  Persona.Clock = (Persona.Clock + 1) & 0xFFFF;
}
