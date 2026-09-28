// NPE.PAS: dispatch to the non-player empire implementations.
import {
  NPEData, PirateNPE, Kingdom1NPE, Kingdom2NPE, BerserkerNPE, GuardianNPE, NoNPE,
} from './npetypes.js';
import { InitializePirateNPE, ImplementPirateNPE } from './npe01.js';
import { InitializeKingdom1NPE, InitializeKingdom2NPE, ImplementKingdom1NPE } from './npe02.js';
import { InitializeGuardianNPE, ImplementGuardianNPE } from './npe03.js';
import { InitializeBerserkerNPE, ImplementBerserkerNPE } from './npe04.js';

export function CleanUpNPE(Emp) {
  NPEData[Emp] = { Typ: NoNPE, Data: null };
}

export function InitializeNPE(Emp, ETyp) {
  let Data;
  switch (ETyp) {
    case Kingdom1NPE: Data = InitializeKingdom1NPE(Emp); break;
    case Kingdom2NPE: Data = InitializeKingdom2NPE(Emp); break;
    case BerserkerNPE: Data = InitializeBerserkerNPE(Emp); break;
    case GuardianNPE: Data = InitializeGuardianNPE(Emp); break;
    default: Data = InitializePirateNPE(Emp);
  }
  NPEData[Emp] = { Typ: ETyp, Data };
}

export function ImplementNPE(Emp) {
  const { Typ, Data } = NPEData[Emp];
  if (!Data) return;
  switch (Typ) {
    case Kingdom1NPE: case Kingdom2NPE: ImplementKingdom1NPE(Emp, Data); break;
    case BerserkerNPE: ImplementBerserkerNPE(Emp, Data); break;
    case GuardianNPE: ImplementGuardianNPE(Emp, Data); break;
    default: ImplementPirateNPE(Emp, Data);
  }
}

export { PirateNPE };
