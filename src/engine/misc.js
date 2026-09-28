// INT.PAS, STRG.PAS, REAL1.PAS, MISC.PAS
import { Random, Trunc, Round, MaxInt, IntStr } from '../runtime/pascal.js';
import {
  MaxResources, LAM, ion, fgt, trn, men, tri, jtn, SYGInd, SYTInd, gal,
} from './types.js';
import {
  MPower, FuelCap, FuelCons, TrnAdj, CargoSpace, K1, K2, K3, TechAdj,
} from './datacnst.js';

// ---- INT ---------------------------------------------------------------------------
export function GreaterInt(a, b) { return a > b ? a : b; }
export function LesserInt(a, b) { return a < b ? a : b; }
export function IntLmt(x) { return x > MaxInt ? MaxInt : x < -MaxInt ? -MaxInt : Trunc(x); }
export function ISqrt(X) {
  let OddSeq = -1, Square = 0;
  do { OddSeq += 2; Square += OddSeq; } while (!(X < Square));
  let Root = (OddSeq >> 1) + 1;
  if (X <= Square - Root) Root--;
  return Root;
}
export function Rnd(Min, Max) {
  if (Max <= Min) return Min;
  return Random((Max - Min) + 1) + Min;
}
export function RndVar(Value, Variation) {
  const temp1 = Trunc(Value * (Variation / 100));
  return Rnd(Value - temp1, Value + temp1);
}

// ---- STRG --------------------------------------------------------------------------
export function AdjustString(w, len) {
  return w.length >= len ? w.slice(0, len) : w + ' '.repeat(len - w.length);
}
export const Int2Str = (n) => String(Math.trunc(n));
export function OrdinalString(Num) {
  const Ultim = Num % 10, Penultim = Math.floor((Num % 100) / 10);
  if (Penultim === 1 || Ultim > 3 || Ultim === 0) return 'th';
  if (Ultim === 3) return 'rd';
  if (Ultim === 2) return 'nd';
  if (Ultim === 1) return 'st';
  return 'th';
}
export function Noun(Line) {
  return 'AEIOUY'.includes(Line[0].toUpperCase()) ? 'an ' + Line : 'a ' + Line;
}
export function Seconds2Str(Time) {
  const a = Math.abs(Time);
  const Hours = Math.floor(a / 3600), Minutes = Math.floor(a / 60) % 60, Seconds = a % 60;
  let Strg = (Seconds < 10 ? '0' : '') + Seconds;
  Strg = (Minutes < 10 ? '0' : '') + Minutes + ':' + Strg;
  if (Hours > 0) Strg = Hours + ':' + Strg;
  if (Time < 0) Strg = '-' + Strg;
  return Strg;
}
export function StringReplace(Line, Find, Replace) {
  // replaces all occurrences (loop semantics of the original)
  if (Find === '') return Line;
  let guard = 0;
  while (Line.indexOf(Find) >= 0 && guard++ < 1000) {
    const p = Line.indexOf(Find);
    Line = Line.slice(0, p) + Replace + Line.slice(p + Find.length);
  }
  return Line;
}
export function DateString(d) {
  const p = (n) => (n < 10 ? '0' : '') + n;
  return p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + d.getFullYear();
}

// ---- REAL1 -------------------------------------------------------------------------
export function Expnt(Base, Exponent) { return Math.exp(Exponent * Math.log(Base)); }

// ---- MISC --------------------------------------------------------------------------
export function MilitaryPower(Ship, Defns) {
  let Temp = 0;
  for (let r = LAM; r <= ion; r++) Temp += Defns[r] * MPower[r];
  for (let r = fgt; r <= trn; r++) Temp += Ship[r] * MPower[r];
  return Temp;
}

export function HiLo(Ind) {
  if (Ind >= 0 && Ind <= 10) return 'no ';
  if (Ind >= 11 && Ind <= 25) return 'Lo-';
  if (Ind >= 26 && Ind <= 50) return 'Lo+';
  if (Ind >= 51 && Ind <= 75) return 'Hi-';
  if (Ind >= 76 && Ind <= 100) return 'Hi+';
  return '---';
}

export function YesNo(Ind) {
  if (Ind === 0) return '   no';
  if (Ind >= 1 && Ind <= 500) return ' yes-';
  if (Ind >= 501 && Ind <= 9500) return ' yes' + Math.floor((Ind + 499) / 1000);
  if (Ind >= 9501 && Ind <= 9999) return ' yes+';
  return ' ----';
}

export function ThgLmt(X) {
  if (X > MaxResources) return MaxResources;
  if (X < 0) return 0;
  return Trunc(X);
}

export function InGalaxy(x, y) {
  return x > 0 && y > 0 && x <= gal.SizeOfGalaxy && y <= gal.SizeOfGalaxy;
}

export function Distance(a, b) {
  return GreaterInt(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
export function SameXY(a, b) { return a.x === b.x && a.y === b.y; }
export function SameID(a, b) { return a.ObjTyp === b.ObjTyp && a.Index === b.Index; }
export function SameLocation(a, b) { return SameXY(a.XY, b.XY) && SameID(a.ID, b.ID); }

export function NoShips(Sh) {
  for (let s = fgt; s <= trn; s++) if (Sh[s] !== 0) return false;
  return true;
}

export function FuelCapacity(Sh) {
  let t = 1;
  for (let s = fgt; s <= trn; s++) t += (FuelCap[s] / 100) * Sh[s];
  return t;
}

export function FuelConsumption(Sh, Cr) {
  let t = 1;
  for (let s = fgt; s <= trn; s++) t += (FuelCons[s] / 1000) * Sh[s];
  for (let c = men; c <= tri; c++) t += (FuelCons[c] / 1000) * Cr[c];
  return t;
}

export function FleetCargoSpace(Sh, Cr) {
  let FreeSpace = Sh[trn] + Sh[jtn] * TrnAdj[jtn];
  for (let c = men; c <= tri; c++) FreeSpace -= Cr[c] / CargoSpace[c];
  return Round(FreeSpace);
}

export function ShipYardInd(Ind) {
  let temp = SYGInd, Greatest = Ind[SYGInd];
  for (let i = SYGInd; i <= SYTInd; i++)
    if (Ind[i] > Greatest) { temp = i; Greatest = Ind[i]; }
  return temp;
}

export function TotalProd(Pop, Tech) {
  if (Pop <= 0) Pop = 1;
  let t = K1 * Expnt(Pop + K2, K3) * TechAdj[Tech] / 100;
  if (t > 999) t = 999; else if (t < 0) t = 0;
  return Round(t);
}

// AddThings/SubThings mutate Sh and Cr in place (VAR params)
export function AddThings(Sh, Cr, Sh2, Cr2) {
  for (let a = fgt; a <= trn; a++) Sh[a] = ThgLmt(Sh[a] + Sh2[a]);
  for (let a = men; a <= tri; a++) Cr[a] = ThgLmt(Cr[a] + Cr2[a]);
}
export function SubThings(Sh, Cr, Sh2, Cr2) {
  for (let a = fgt; a <= trn; a++) Sh[a] = ThgLmt(Sh[a] - Sh2[a]);
  for (let a = men; a <= tri; a++) Cr[a] = ThgLmt(Cr[a] - Cr2[a]);
}

// MoveThings(n, Source, Dest): returns [newSource, newDest]
export function MoveThings(NoOfThg, Source, Dest) {
  if (Source > NoOfThg) return [ThgLmt(Source - NoOfThg), ThgLmt(Dest + NoOfThg)];
  return [0, ThgLmt(Dest + Source)];
}

export { IntStr };
