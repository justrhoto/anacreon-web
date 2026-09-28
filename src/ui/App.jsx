import React, { useState, useCallback } from 'react';
import * as game from '../engine/game.js';
import { env } from '../engine/env.js';
import { refresh } from './store.js';
import { Starfield, Modal, Confirm } from './common.jsx';
import { NewGame } from './NewGame.jsx';
import { SaveManager } from './SaveManager.jsx';
import { Password, Briefing, CapitalLost, Processing, GameOver, ChoosePlayer } from './TurnScreens.jsx';
import { Game } from './Game.jsx';
import { About, HelpViewer } from './Help.jsx';
import { AddEmpire } from './AddEmpire.jsx';

const nextFrame = () => new Promise((r) => setTimeout(r, 30));

export function App() {
  const [screen, setScreen] = useState({ name: 'title' });
  const [dialog, setDialog] = useState(null);

  const runProcessing = useCallback(async (label, work) => {
    setScreen({ name: 'processing', label });
    await nextFrame();
    const onProgress = (l) => { /* progress labels are shown statically */ };
    const r = work(onProgress);
    refresh();
    return r;
  }, []);

  const handleBegin = useCallback(async () => {
    const r = await runProcessing('Preparing the year…', (p) => game.beginTurn(p));
    if (r.kind === 'turn') setScreen({ name: 'briefing' });
    else if (r.kind === 'capitalLost') setScreen({ name: 'capitalLost', info: r });
    else setScreen({ name: 'gameover' });
  }, [runProcessing]);

  const startPlayerTurn = useCallback(() => {
    if (game.needsPassword()) setScreen({ name: 'password' });
    else handleBegin();
  }, [handleBegin]);

  const enterGame = useCallback(() => {
    if (env.AsyncTurns) setScreen({ name: 'choosePlayer' });
    else startPlayerTurn();
  }, [startPlayerTurn]);

  const endTurn = useCallback(async (elapsed) => {
    const r = await runProcessing('The year draws to a close…', (p) => game.endTurn(elapsed, p));
    if (r.kind === 'gameOver') { setScreen({ name: 'gameover' }); return; }
    if (env.AsyncTurns) { setScreen({ name: 'title' }); return; }
    startPlayerTurn();
  }, [runProcessing, startPlayerTurn]);

  const quitTurn = useCallback((elapsed) => {
    game.exitTurn(elapsed);
    refresh();
    setScreen({ name: 'title' });
  }, []);

  const afterCapitalLost = useCallback(async () => {
    const r = await runProcessing('The galaxy moves on…', (p) => game.afterEmpireDestroyed(p));
    if (r.kind === 'gameOver') setScreen({ name: 'gameover' });
    else startPlayerTurn();
  }, [runProcessing, startPlayerTurn]);

  // Guard against losing an unsaved game (GameNotSaved)
  const guardUnsaved = (then) => {
    if (game.session.loaded && game.session.modified) {
      setDialog({ kind: 'unsaved', then });
    } else then();
  };

  switch (screen.name) {
    case 'newgame':
      return <NewGame onCancel={() => setScreen({ name: 'title' })} onStarted={() => { refresh(); enterGame(); }} />;
    case 'load':
      return <SaveManager mode="load" onCancel={() => setScreen({ name: 'title' })} onLoaded={() => { refresh(); setScreen({ name: 'title' }); }} />;
    case 'password':
      return <Password onOk={handleBegin} onCancel={() => setScreen({ name: 'title' })} />;
    case 'briefing':
      return <Briefing onContinue={() => setScreen({ name: 'game' })} />;
    case 'capitalLost':
      return <CapitalLost info={screen.info} onContinue={afterCapitalLost} />;
    case 'processing':
      return <Processing label={screen.label} />;
    case 'gameover':
      return <GameOver onContinue={() => { game.session.loaded = false; setScreen({ name: 'title' }); }} />;
    case 'choosePlayer':
      return <ChoosePlayer onPick={(e) => { env.Player = e; startPlayerTurn(); }} onCancel={() => setScreen({ name: 'title' })} />;
    case 'game':
      return <Game onEndTurn={endTurn} onQuit={quitTurn} />;
    default:
      return (
        <Title
          onBegin={enterGame}
          onNew={() => guardUnsaved(() => setScreen({ name: 'newgame' }))}
          onLoad={() => guardUnsaved(() => setScreen({ name: 'load' }))}
          dialog={dialog}
          setDialog={setDialog}
        />
      );
  }
}

function Title({ onBegin, onNew, onLoad, dialog, setDialog }) {
  const loaded = game.session.loaded;
  const [, force] = useState(0);
  const rerender = () => force((x) => x + 1);

  const toggle = (what) => {
    if (what === 'autosave') env.AutoSave = !env.AutoSave;
    if (what === 'pause') env.PauseActive = !env.PauseActive;
    if (what === 'seq') game.setAsyncTurns(!env.AsyncTurns);
    if (loaded) game.session.modified = true;
    rerender();
  };

  return (
    <div className="screen">
      <Starfield />
      <div className="title-wrap">
        <div className="logo">ANACREON</div>
        <div className="subtitle">Reconstruction 4021</div>
        <div className="menu">
          {loaded && <button className="btn primary" onClick={onBegin}>{env.AsyncTurns ? 'Begin a turn…' : 'Continue: ' + game.EmpireName(env.Player) + ', ' + env.Year}</button>}
          <button className="btn" onClick={onNew}>New game</button>
          <button className="btn" onClick={onLoad}>Load game</button>
          {loaded && <button className="btn" onClick={() => setDialog({ kind: 'save' })}>Save game</button>}
          <button className="btn" onClick={() => setDialog({ kind: 'options' })}>Options</button>
          <button className="btn" onClick={() => setDialog({ kind: 'help' })}>Help</button>
          <button className="btn" onClick={() => setDialog({ kind: 'about' })}>About Anacreon</button>
        </div>
        <div className="footer-note">
          Original game © 1988–2003 George Moromisato / TMA. Version 2.0 by Adam Luker. Browser port.
        </div>
      </div>

      {dialog && dialog.kind === 'about' && <About onClose={() => setDialog(null)} />}
      {dialog && dialog.kind === 'help' && <Modal title="Help" wide onClose={() => setDialog(null)}><HelpViewer /></Modal>}
      {dialog && dialog.kind === 'save' && (
        <SaveManager mode="save" asDialog onCancel={() => setDialog(null)} onSaved={() => { const t = dialog.then; setDialog(null); if (t) t(); }} />
      )}
      {dialog && dialog.kind === 'unsaved' && (
        <Confirm
          title="Game not saved"
          text="This game is not saved. Do you want to save it first?"
          yes="Save first"
          no="Discard changes"
          onYes={() => setDialog({ kind: 'save', then: dialog.then })}
          onNo={() => { game.session.modified = false; setDialog(null); dialog.then(); }}
        />
      )}
      {dialog && dialog.kind === 'options' && (
        <Options
          loaded={loaded}
          toggle={toggle}
          onClose={() => setDialog(null)}
          open={(k) => setDialog({ kind: k })}
        />
      )}
      {dialog && dialog.kind === 'timelimit' && <TimeLimit onClose={() => setDialog({ kind: 'options' })} />}
      {dialog && dialog.kind === 'addempire' && <AddEmpire onClose={() => { refresh(); setDialog({ kind: 'options' }); }} />}
      {dialog && dialog.kind === 'delempire' && <DeleteEmpire onClose={() => { refresh(); setDialog({ kind: 'options' }); }} />}
    </div>
  );
}

function Options({ loaded, toggle, onClose, open }) {
  const row = (label, value, onClick, disabled) => (
    <div className="option" onClick={disabled ? undefined : onClick} style={disabled ? { opacity: 0.4, cursor: 'default' } : undefined}>
      <span>{label}</span><span className="accent">{value}</span>
    </div>
  );
  return (
    <Modal title="Options" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="options">
        {row('Auto backup (saves a .BAK every turn)', env.AutoSave ? 'ON' : 'OFF', () => toggle('autosave'))}
        {row('Pause (stops the turn clock)', env.PauseActive ? 'Active' : 'Inactive', () => toggle('pause'))}
        {row('Sequential play', env.AsyncTurns ? 'OFF' : 'ON', () => toggle('seq'), !loaded)}
        {row('Time added per turn', Math.floor(env.TimePerTurn / 60) + ' min', () => open('timelimit'), !loaded)}
        {row('New player empire…', '', () => open('addempire'), !loaded)}
        {row('Delete player empire…', '', () => open('delempire'), !loaded)}
      </div>
      <p className="dim" style={{ fontSize: 12 }}>
        In sequential play, players take their turns in order and the universe is updated after the last one.
        With sequential play off, each human player picks when to move and the universe updates once everyone has moved.
      </p>
    </Modal>
  );
}

function TimeLimit({ onClose }) {
  const [v, setV] = useState(String(Math.floor(env.TimePerTurn / 60)));
  const [err, setErr] = useState(null);
  const save = () => {
    const n = parseInt(v, 10);
    if (!(n > 0) || String(n) !== v.trim()) { setErr('Please enter a positive integer.'); return; }
    if (n > 120) { setErr('Please limit yourself to 2 hours per turn!'); return; }
    game.setTimeLimit(n);
    onClose();
  };
  return (
    <Modal title="Time limit" onClose={onClose} error={err}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
      <p>This variable controls the amount of time that is added to a player's turn each year.</p>
      <label className="field">Time added per turn (minutes)
        <input type="number" min="1" max="120" value={v} onChange={(e) => setV(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
      </label>
    </Modal>
  );
}

function DeleteEmpire({ onClose }) {
  const emps = game.playerEmpires();
  const [sel, setSel] = useState(null);
  const [confirm, setConfirm] = useState(false);
  if (emps.length === 1) {
    return <Confirm title="Delete player empire" text={["But that's the last empire!", 'How can you play with no empires?']} yes="OK" onYes={onClose} onNo={onClose} />;
  }
  if (confirm) {
    return (
      <Confirm danger title="Delete player empire" yes="Delete"
        text={'Do you really want to delete the ' + emps[sel].name + ' Empire?'}
        onYes={() => { game.deletePlayerEmpire(emps[sel].emp); onClose(); }}
        onNo={() => setConfirm(false)} />
    );
  }
  return (
    <Modal title="Delete player empire" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={sel === null} onClick={() => setConfirm(true)}>Delete…</button></>}>
      <p>Which empire do you want to delete?</p>
      <div className="options">
        {emps.map((e, i) => <div key={e.emp} className={'option' + (sel === i ? ' sel' : '')} onClick={() => setSel(i)}>{e.name}</div>)}
      </div>
    </Modal>
  );
}
