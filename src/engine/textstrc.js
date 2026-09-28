// TEXTSTRC.PAS: doubly-linked text structure.
import { vfs, TextFile } from '../runtime/vfs.js';

export const RMargin = 77;
export const ParaChar = '¶'; // #020

export function newLine() { return { Line: '', Para: false, Prev: null, Next: null }; }

export function TXTSetParagraph(l) { l.Para = true; }
export function TXTSetLine(l, s) { l.Line = s.length > 80 ? s.slice(0, 80) : s; }
export function TXTNumberOfLines(t) { return t.NoOfLines; }
export function TXTFirstLine(t) { return t.FirstLine; }
export function TXTNextLine(l) { return l.Next; }
export function TXTLine(l) { return l.Line; }

export function InitializeText(Txt) {
  Txt.NoOfLines = 1;
  Txt.FirstLine = newLine();
  Txt.FirstLine.Para = true;
  Txt.LastLine = Txt.FirstLine;
  return Txt;
}
export function newText() { return InitializeText({}); }

export function DeleteLine(Txt, Cur) {
  if (Cur === Txt.FirstLine && Cur.Next === null) {
    Cur.Line = '';
  } else {
    if (Cur.Prev !== null) {
      Cur.Prev.Next = Cur.Next;
      if (Cur.Next !== null) Cur.Next.Prev = Cur.Prev;
    }
    if (Cur === Txt.FirstLine) Txt.FirstLine = Cur.Next;
    if (Cur === Txt.LastLine) Txt.LastLine = Cur.Prev;
    Txt.NoOfLines--;
  }
}

export function DisposeText(Txt) { /* garbage collected */ }

export function InsertLine(Txt, Cur) {
  const n = newLine();
  if (Cur.Next !== null) Cur.Next.Prev = n;
  n.Prev = Cur;
  n.Next = Cur.Next;
  Cur.Next = n;
  if (Cur === Txt.LastLine) Txt.LastLine = n;
  Txt.NoOfLines++;
}

// LoadText / SaveText (used by message/order editors)
export function LoadText(Txt, Filename) {
  const data = vfs.read(Filename);
  if (data === null) return 2;
  const f = new TextFile(data);
  let CurLine = Txt.FirstLine;
  let ParaPos = 0;
  while (!f.eof()) {
    let Tmp = f.readLn(255);
    if (Tmp === ParaChar) {
      CurLine.Line = '';
      CurLine.Para = true;
      InsertLine(Txt, CurLine);
      CurLine = CurLine.Next;
    } else {
      while (Tmp.length > 0) {
        ParaPos = Tmp.indexOf(ParaChar) + 1;
        if (ParaPos !== 0) Tmp = Tmp.slice(0, ParaPos - 1) + Tmp.slice(ParaPos);
        CurLine.Line = Tmp.slice(0, RMargin + 1);
        Tmp = Tmp.slice(RMargin + 1);
        InsertLine(Txt, CurLine);
        CurLine = CurLine.Next;
      }
      if (CurLine.Prev) CurLine.Prev.Para = ParaPos !== 0;
    }
  }
  return 0;
}

export function SaveText(Txt, Filename) {
  let out = '';
  let c = Txt.FirstLine;
  while (c !== null) {
    out += c.Line + (c.Para ? ParaChar : '') + '\r\n';
    c = c.Next;
  }
  vfs.write(Filename, out);
  return 0;
}

// Convenience: array of line strings
export function textLines(Txt) {
  const r = [];
  for (let c = Txt.FirstLine; c; c = c.Next) r.push(c.Line);
  return r;
}
