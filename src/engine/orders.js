// ORDERS.PAS: fleet orders. Code is an array of CommandRecords stored on the fleet.
import { UpCaseStr, Val } from '../runtime/pascal.js';
import { Universe, fgt, tri, EmptyQuadrant, Limbo } from './types.js';
import { SameID, SameXY } from './misc.js';
import { GetLocation, GetName, ShortFormat } from './primintr.js';

export const NoOER = 0, BadCommandOER = 1, BadDestOER = 2, BadResourceOER = 3, BadTransferOER = 4;

export const NoCOM = 0, DestCOM = 1, TransCOM = 2, RepeatCOM = 3, AbortCOM = 4, SweepCOM = 5,
  StopCOM = 6, WaitCOM = 7;

const MaxNoOfParms = 4;
export const ResourceName = { 5: 'FGT', 6: 'HKR', 7: 'JMP', 8: 'JTN', 9: 'PEN', 10: 'STR', 11: 'TRN',
  12: 'MEN', 13: 'NNJ', 14: 'AMB', 15: 'CHE', 16: 'MET', 17: 'SUP', 18: 'TRI' };

export function NumberOfCommands(Code) { return Code.length; }
export function GetCommandRecord(Code, CNum) { return Code[CNum - 1]; }
export function AddOrders(Code, c) { Code.push(c); }

function SplitLine(Line) {
  const Parm = ['', '', '', '', ''];
  let PNum = 1, Skip = true;
  for (const c of Line) {
    if (c === ' ') {
      if (!Skip) {
        if (PNum < MaxNoOfParms) { PNum++; Parm[PNum] = ''; }
        Skip = true;
      }
    } else {
      Skip = false;
      Parm[PNum] += c;
    }
  }
  return Parm;
}

function ParseLine(Emp, Line) {
  let Error = 0;
  const Parm = SplitLine(UpCaseStr(Line));
  const c = { Typ: NoCOM };
  const p1 = Parm[1].slice(0, 4);
  if (p1 === 'TRAN') {
    c.Typ = TransCOM;
    const r3 = (Parm[3] || '').slice(0, 3);
    let Res = fgt;
    while (Res <= tri && ResourceName[Res] !== r3) Res++;
    if (Res > tri) Error = BadResourceOER;
    c.Res = Res;
    const v = Val(Parm[2] || '');
    if (v.code !== 0 || v.value > 32767 || v.value < -32768) Error = BadTransferOER;
    c.Trns = v.code === 0 ? v.value : 0;
  } else if (p1 === 'SRMS') {
    c.Typ = SweepCOM;
  } else if (p1 === 'DEST') {
    c.Typ = DestCOM;
    c.Loc = GetLocation(Emp, Parm[2] || '');
    if (SameID(c.Loc.ID, EmptyQuadrant) && SameXY(c.Loc.XY, Limbo)) Error = BadDestOER;
  } else if (p1 === 'REPE') {
    c.Typ = RepeatCOM;
  } else if (p1 === 'WAIT') {
    c.Typ = WaitCOM;
  } else if (p1 === '') {
    c.Typ = NoCOM;
  } else {
    Error = BadCommandOER;
    c.Typ = NoCOM;
  }
  return { c, Error };
}

// lines: array of strings. Returns { Code, Error, LineNo }
export function CompileOrders(Emp, lines) {
  const Code = [];
  let Error = 0, i = 0;
  while (i < lines.length && Error === NoOER) {
    const r = ParseLine(Emp, lines[i]);
    Error = r.Error;
    if (r.c.Typ !== NoCOM) Code.push(r.c);
    i++;
  }
  return { Code, Error, LineNo: Error !== NoOER ? i : 0 };
}

export function DeCompileOrders(Emp, Code) {
  const lines = [];
  for (const c of Code) {
    let Line = '';
    switch (c.Typ) {
      case SweepCOM: Line = 'SRMSweep'; break;
      case DestCOM: Line = 'DESTination ' + GetName(Emp, c.Loc, ShortFormat); break;
      case TransCOM: Line = 'TRANsfer ' + c.Trns + ' ' + ResourceName[c.Res]; break;
      case RepeatCOM: Line = 'REPEat'; break;
      case WaitCOM: Line = 'WAIT'; break;
    }
    lines.push(Line);
  }
  return lines;
}

export function FleetNextStatement(FltID) { return Universe.Fleet[FltID.Index].NextOrder; }
export function SetFleetNextStatement(FltID, Com) { Universe.Fleet[FltID.Index].NextOrder = Com & 0xFF; }
export function GetFleetCode(FltID) { return Universe.Fleet[FltID.Index].Orders; }
export function SetFleetCode(FltID, Code) { Universe.Fleet[FltID.Index].Orders = Code; }
