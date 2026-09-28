// SCENA.PAS: scenario flavour text (WorldBackgroundIndex) and TEXT sections.
import { Val, UpCaseStr } from '../runtime/pascal.js';
import { vfs, TextFile } from '../runtime/vfs.js';
import { Void, Empire1, Indep, EmptyQuadrant, Limbo } from './types.js';
import { SameID, SameXY } from './misc.js';
import { GetCoord, GetCoordName, GetStatus, ObjectName, LongFormat } from './primintr.js';
import { env } from './env.js';

function scenarioFile() {
  const data = vfs.read(env.ScenaFilename);
  return data === null ? null : new TextFile(data);
}

function FindLine(f, find) {
  find = UpCaseStr(find);
  while (!f.eof()) {
    if (UpCaseStr(f.readLn(80)).indexOf(find) >= 0) return true;
  }
  return false;
}

function SplitLine(Line) {
  const Parm = ['', '', '', '', '', '', '', '', '', '', ''];
  let n = 1;
  let Finish = Line.length;
  const c = Line.indexOf(';') + 1;
  if (c > 0) Finish = c - 1;
  const ws = (ch) => ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
  let Start = 1;
  while (Start <= Line.length && ws(Line[Start - 1])) Start++;
  while (Finish >= 1 && ws(Line[Finish - 1])) Finish--;
  let ready = false;
  for (let i = Start; i <= Finish; i++) {
    const ch = Line[i - 1];
    if (ws(ch)) { if (ready) { n++; ready = false; } }
    else { if (n <= 10) Parm[n] += ch; ready = true; }
  }
  return { n, Parm };
}

function IDMatch(s) {
  const ColPos = s.indexOf(':') + 1;
  const a = Val(s.slice(0, ColPos - 1));
  if (a.code !== 0) return { ...EmptyQuadrant };
  const b = Val(s.substr(ColPos, 32));
  if (b.code !== 0) return { ...EmptyQuadrant };
  return { ObjTyp: a.value, Index: b.value };
}

function InterpretSet(Parm) {
  const nums = new Set();
  for (const part of Parm.split(',')) {
    if (part === '') continue;
    const v = Val(part);
    if (v.code === 0 && v.value >= 0 && v.value <= 255) nums.add(v.value);
  }
  return nums;
}

function Satisfies(Player, Conquer, ID, Parm, First, Last) {
  let ok = true;
  const emps = (p) => {
    let q = p.slice(2);
    if (UpCaseStr(q) === 'ALL') return new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    return InterpretSet(q);
  };
  for (let i = First; i <= Last; i++) {
    const c = Parm[i][0];
    if (c === 'E') { if (Conquer || !emps(Parm[i]).has(GetStatus(ID))) ok = false; }
    else if (c === 'A') { if (!Conquer || !emps(Parm[i]).has(GetStatus(ID))) ok = false; }
    else if (c === 'O') { if (Conquer || Player !== GetStatus(ID)) ok = false; }
  }
  return ok;
}

function ParseLine(Player, Line) {
  let OpenB = Line.indexOf('[') + 1, CloseB = Line.indexOf(']') + 1;
  let guard = 0;
  while (OpenB + CloseB > 0 && guard++ < 100) {
    const Old = Line.substr(OpenB - 1, CloseB - OpenB + 1);
    Line = Line.slice(0, OpenB - 1) + Line.slice(OpenB - 1 + Old.length);
    if (Old[1] === 'C' || Old[1] === 'N') {
      const ID = IDMatch(Old.slice(2, Old.length - 1));
      const XY = GetCoord(ID);
      let ins = '     ';
      if (!SameXY(XY, Limbo)) ins = Old[1] === 'C' ? GetCoordName(XY) : ObjectName(Player, ID, LongFormat);
      Line = Line.slice(0, OpenB - 1) + ins + Line.slice(OpenB - 1);
    }
    OpenB = Line.indexOf('[') + 1;
    CloseB = Line.indexOf(']') + 1;
    if (OpenB === 0 || CloseB === 0) break;
  }
  return Line;
}

// Returns an array of text lines or null if no background text applies
export function DisplayBackground(Player, WorldID, Conquer) {
  const f = scenarioFile();
  if (!f) return null;
  if (!FindLine(f, 'WORLDBACKGROUNDINDEX')) return null;
  let entry;
  do {
    if (f.eof()) return null;
    entry = UpCaseStr(f.readLn(80));
    const { n, Parm } = SplitLine(entry);
    const id = IDMatch(Parm[1]);
    if (SameID(id, WorldID) && Satisfies(Player, Conquer, WorldID, Parm, 2, n - 1)) {
      const t = Val(Parm[n]);
      if (t.code === 0) {
        if (!FindLine(f, 'TEXT ' + t.value)) return null;
        const lines = [];
        let Line = f.readLn(80);
        let guard = 0;
        do {
          lines.push(ParseLine(Player, Line));
          if (f.eof()) break;
          Line = f.readLn(80);
        } while (Line.indexOf('ENDTEXT') < 0 && guard++ < 200);
        return lines;
      }
    }
  } while (entry.indexOf('ENDINDEX') < 0);
  return null;
}

export { Void, Empire1, Indep };
