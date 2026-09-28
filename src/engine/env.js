// Global variables of ENVIRON.PAS (kept in an object so every module can mutate them).
export const HelpFilename = 'ANACREON.HLP';
export const ConfFilename = 'ANACREON.CNF';

export const env = {
  CurrentGame: 'ANACREON.SAV',
  ConfigModified: false,
  HelpLoaded: false,
  AutoSave: true,
  PauseActive: true,
  AsyncTurns: false,
  ReEnterGame: false,

  Year: 0,
  Player: 0,
  EmpiresToMove: 0,        // EmpireSet bitmask
  ScenaFilename: '',
  TimePerTurn: 300,

  HlpDirect: '',
  SceDirect: '',
  SavDirect: '',
  UseColor: true,
};
