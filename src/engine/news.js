// NEWS.PAS: news module.
import { Indep, Empire1, Empire8, cpXY, cpID } from './types.js';
import { EmpireActive, Scouted } from './primintr.js';

const NEWS_NAMES = [
  'NoNews', 'Lack', 'Starv', 'NTech', 'RTech', 'ConsLack', 'ConsDone', 'Rebel', 'URebel',
  'RebelW1', 'RebelW2', 'RebelW3', 'RebelW4', 'POk', 'NCapTech', 'NCapLvl', 'BattleL',
  'BattleW1', 'BattleW2', 'WAddict', 'UAddict', 'AddictDie', 'RiotsDie', 'IndDs', 'DInd',
  'Join', 'NewCap', 'EndEmp', 'NoFuel', 'FltDet', 'Mines', 'MinesDm', 'MinesDs', 'ConDs',
  'GteDs', 'LAMDm', 'LAMDs', 'TrnsShp', 'Trns2', 'NSellTech', 'GInd', 'NewPlEmp', 'DefLack',
  'IndLack', 'PCap', 'PDest', 'MessR', 'MessI', 'ConDsUNK', 'GteDsUNK', 'BattleW2UNK',
  'BattleLUNK', 'HLPopKill', 'HLMenKill', 'HLJoin', 'LAMDef', 'DestDetail', 'BseFuel',
  'BseBlocked', 'FltBlocked', 'NebGate', 'SRMClear', 'BseSD', 'FltSD', 'WHolo', 'DthHolo',
  'Disrupt', 'NoTriRes', 'TriResWarn1', 'TriResWarn2', 'MilitRev', 'RevControl', 'GLBDest',
  'GLBConq', 'GLBCapConq', 'GLBLAMStrk', 'GLBRev', 'OutProbe', 'OrdersSRMClear',
  'OrdersNoSRMs', 'OrdersNoSSP', 'TerChaos', 'TerSuccess',
  'GTech', 'CLost', 'LostP', 'SMnR', 'JumpDm', 'JumpDs', 'ELost', 'TriAcc', 'LostF',
];
export const N = Object.fromEntries(NEWS_NAMES.map((n, i) => [n, i]));
export const NewsNames = NEWS_NAMES;

export const LocalNews = new Set([N.Lack, N.RebelW1, N.RebelW2, N.RebelW3, N.RebelW4, N.POk,
  N.NoFuel, N.FltDet, N.DefLack, N.IndLack, N.PCap, N.PDest, N.BseFuel, N.BseBlocked,
  N.FltBlocked, N.NebGate, N.SRMClear, N.NoTriRes, N.TriResWarn1, N.TriResWarn2, N.MilitRev,
  N.RevControl, N.OutProbe, N.OrdersSRMClear, N.OrdersNoSRMs, N.OrdersNoSSP, N.TerChaos,
  N.TerSuccess]);

// NewsData[emp] = array of { Headline, Loc1, Parm1, Parm2, Parm3 }
export const NewsData = [[], [], [], [], [], [], [], []];

export function GetNewsList(Emp) { return NewsData[Emp]; }

export function AddNews(Player, Head, Loc, P1, P2, P3) {
  if (Player !== Indep && EmpireActive(Player)) {
    NewsData[Player].push({
      Headline: Head,
      Loc1: { XY: cpXY(Loc.XY), ID: cpID(Loc.ID) },
      Parm1: P1 | 0, Parm2: P2 | 0, Parm3: P3 | 0,
    });
  }
}

export function AddGlobalNews(Exclude, Source, Head, Loc, P1, P2, P3) {
  for (let Emp = Empire1; Emp <= Empire8; Emp++)
    if (!(Exclude & (1 << Emp)) && EmpireActive(Emp) && Scouted(Emp, Source))
      AddNews(Emp, Head, Loc, P1, P2, P3);
}

export function EraseNews(Player) {
  if (Player >= Empire1 && Player <= Empire8) NewsData[Player] = [];
}

export function saveNews() { return NewsData.map((l) => l.map((n) => ({ ...n }))); }
export function loadNews(data) {
  for (let e = 0; e < 8; e++) NewsData[e] = (data && data[e]) ? data[e] : [];
}
