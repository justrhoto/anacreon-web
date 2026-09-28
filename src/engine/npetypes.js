// NPETYPES.PAS: non-player empire data types.
import { MaxSizeOfGalaxy, NoOfFleetsPerEmpire, MaxNoOfStarbases, ID } from './types.js';

export const MaxNoOfBlocks = Math.floor(MaxSizeOfGalaxy / 5);

// NPEmpireTypes
export const NoNPE = 0, PirateNPE = 1, Kingdom1NPE = 2, Kingdom2NPE = 3, BerserkerNPE = 4,
  GuardianNPE = 5, TraderNPE = 6;

// MissionTypes
export const NoMSN = 0, ReturnMSN = 1, HKMSN = 2, WaitForTrnMSN = 3, AttackTrnMSN = 4,
  AttackWrldMSN = 5, BSRKAttackMSN = 6, BSRKReturnMSN = 7, StackMSN = 8, GuardMSN = 9,
  ConquerMSN = 10, JumpAttackMSN = 11, RefuelMSN = 12, SlowAttackMSN = 13, RaidTrnMSN = 14,
  SupplyMSN = 15, SupplyTrnMSN = 16;

// BaseMissionTypes
export const NoBMS = 0, DefendBMS = 1, AttackBMS = 2, FindHomeBMS = 3, RefuelBMS = 4,
  WaitForAttackBMS = 5, WanderAroundBMS = 6;

// PolicyTypes
export const NoPLT = 0, NeutralPLT = 1, DefendPLT = 2, HarassPLT = 3, PreemptPLT = 4,
  ConflictPLT = 5, WarPLT = 6;

export function newFleetData() {
  return {
    Mission: NoMSN, TargetID: ID(), HomeBaseID: ID(), Midway: ID(), Waiting: 0,
    BlockX: 0, BlockY: 0, Index: 0,
  };
}
// FleetDataArray: 1-based array of NoOfFleetsPerEmpire records
export function newFleetDataArray() {
  const a = [null];
  for (let i = 1; i <= NoOfFleetsPerEmpire; i++) a.push(newFleetData());
  return a;
}
export function newBaseDataArray() {
  const a = [null];
  for (let i = 1; i <= MaxNoOfStarbases; i++) a.push({ Mission: NoBMS, TargetID: ID(), Count: 0 });
  return a;
}
export function newStateDeptArray() {
  const a = [];
  for (let e = 0; e <= 8; e++) {
    a.push({ Policy: NoPLT, AttackChance: 0, TotalMilitary: 0, Worlds: 0, ThreatAssess: 0, Aggressiveness: 0, Balance: 0 });
  }
  return a;
}
export function newPersona() {
  return {
    ImpGene: 0, DefGene: 0, OffGene: 0, FactorGene: 0, RandomGene: 0,
    Defensive: 0, Offensive: 0, Techno: 0, Provoke: 0, Imperialist: 0, WorldPower: 0,
    Honorable: 0, SphereX: 0, Clock: 0, Offset: 0,
  };
}

// NPEData[Emp] = { Typ, Data }
export const NPEData = [];
for (let e = 0; e <= 8; e++) NPEData.push({ Typ: NoNPE, Data: null });
