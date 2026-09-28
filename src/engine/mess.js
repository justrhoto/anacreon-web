// MESS.PAS: messages between empires. Message text is an array of lines.
import { Empire1, Empire8, Pln, EmptyQuadrant, Limbo, G } from './types.js';
import { bIn } from '../runtime/pascal.js';
import { Rnd, LesserInt, Distance } from './misc.js';
import { GetCapital, GetCoord } from './primintr.js';
import { AddNews, N } from './news.js';
import { Round } from '../runtime/pascal.js';

// MessageList: newest first (NewMessage inserts at head)
export const msg = { MessageList: [] };

function NewMessage(m) { msg.MessageList.unshift(m); }

export function GetMessages(Emp) {
  return msg.MessageList.filter((m) => m.Recipient & (1 << Emp));
}

export function DeleteReadMessages() {
  msg.MessageList = msg.MessageList.filter((m) => !m.Read);
}
export function DeleteAllMessages() { msg.MessageList = []; }

function InterceptMessage(Emp, Interceptor, Obj, lines) {
  const garbled = [lines[0] || ''];
  for (let k = 1; k < lines.length; k++) {
    const t = lines[k].split('');
    if (t.length > 5) {
      const n = Rnd(0, 7);
      for (let i = 1; i <= n; i++) {
        const StartGarb = Rnd(1, t.length - 5);
        const MaxLen = LesserInt(1 + t.length - StartGarb, 10);
        const end = StartGarb + Rnd(1, MaxLen);
        for (let j = StartGarb; j <= end; j++) if (j <= t.length) t[j - 1] = '.';
      }
    }
    garbled.push(t.join(''));
  }
  NewMessage({
    Sender: Emp, Recipient: 1 << Interceptor, ReadBy: 0, Read: false, Intercepted: true,
    MesText: garbled,
  });
  AddNews(Interceptor, N.MessI, { ID: { ...Obj }, XY: { ...Limbo } }, Emp, 0, 0);
}

// Empires: bitmask of recipients. lines: array of strings.
export function SendMessage(Emp, Empires, lines) {
  NewMessage({ Sender: Emp, Recipient: Empires, ReadBy: 0, Read: false, Intercepted: false, MesText: lines.slice() });

  let TargetEmp = Empire1;
  for (let e = Empire1; e <= Empire8; e++) if (Empires & (1 << e)) TargetEmp = e;

  const SendXY = GetCoord(GetCapital(TargetEmp));
  let NoOfIntercepts = 0;
  const Loc = { ID: { ...EmptyQuadrant }, XY: { ...Limbo } };
  for (let e = Empire1; e <= Empire8; e++) {
    if (Empires & (1 << e)) {
      AddNews(e, N.MessR, Loc, Emp, 0, 0);
    } else if (e !== Emp && NoOfIntercepts <= 5 && Empires !== (1 << Emp)) {
      for (let j = 1; j <= G.NoOfPlanets; j++) {
        if (bIn(j, G.SetOfPlanetsOf[e])) {
          const Obj = { ObjTyp: Pln, Index: j };
          const IntXY = GetCoord(Obj);
          const d = Distance(SendXY, IntXY);
          const Chance = d === 0 ? 150 : Round((1 / (d * d)) * 150);
          if (Rnd(1, 100) <= Chance) {
            InterceptMessage(Emp, e, Obj, lines);
            NoOfIntercepts++;
          }
        }
      }
    }
  }
}

export function SetMessageRead(Emp, m) {
  m.ReadBy |= 1 << Emp;
  if ((m.Recipient & ~m.ReadBy) === 0) m.Read = true;
}
