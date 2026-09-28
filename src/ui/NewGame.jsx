import React, { useMemo, useState } from 'react';
import * as game from '../engine/game.js';
import { RndEmpireName, GetRandomEmpireName } from '../engine/newgame.js';
import { Rnd } from '../engine/misc.js';
import { Starfield } from './common.jsx';

const Difficulty = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

export function NewGame({ onCancel, onStarted }) {
  const scenarios = useMemo(() => game.listScenarios(), []);
  const [step, setStep] = useState('pick');
  const [sel, setSel] = useState(Math.max(0, scenarios.findIndex((s) => s.file === 'INTRO.SCN')));
  const [page, setPage] = useState(0);
  const [nPlayers, setNPlayers] = useState(1);
  const [players, setPlayers] = useState([]);
  const [cur, setCur] = useState(0);
  const [result, setResult] = useState(null);
  const sc = scenarios[sel];

  const startSetup = () => {
    setPage(0);
    setNPlayers(sc.minPlay);
    setStep('intro');
  };

  const beginPlayers = () => {
    setPlayers([]);
    setCur(0);
    setStep('player');
  };

  const addPlayer = (p) => {
    const list = [...players, p];
    setPlayers(list);
    if (list.length < nPlayers) setCur(list.length);
    else create(list);
  };

  const create = (list) => {
    setStep('creating');
    setTimeout(() => {
      const r = game.startNewGame(sc.file, game.scenarioHeader(sc.file), list);
      if (!r.ok) { setResult(r); setStep('error'); }
      else onStarted();
    }, 30);
  };

  return (
    <div className="screen">
      <Starfield density={0.6} />
      <div className="page">
        {step === 'pick' && (
          <>
            <header><h2>Select a scenario</h2><button className="btn" onClick={onCancel}>Back</button></header>
            <table className="grid">
              <thead><tr><th className="l">Name</th><th className="l">Difficulty</th><th>Players</th><th>Duration</th><th>Galaxy</th><th>Worlds</th></tr></thead>
              <tbody>
                {scenarios.map((s, i) => (
                  <tr key={s.file} className={'clickable' + (i === sel ? ' sel' : '')} onClick={() => setSel(i)} onDoubleClick={() => { setSel(i); setTimeout(startSetup); }}>
                    <td className="l" style={{ fontFamily: 'var(--sans)' }}>{s.title}</td>
                    <td className="l">{Difficulty[s.difficulty] || s.difficulty}</td>
                    <td>{s.minPlay === s.maxPlay ? s.minPlay : s.minPlay + '–' + s.maxPlay}</td>
                    <td>{s.maxLen === 0 ? s.minLen + '+ years' : s.minLen + '–' + s.maxLen + ' years'}</td>
                    <td>{s.size}×{s.size}</td>
                    <td>{s.planets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="btnrow" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={startSetup}>Read the briefing →</button>
            </div>
          </>
        )}

        {step === 'intro' && (
          <>
            <header>
              <h2>{sc.title}</h2>
              <span className="dim">{sc.pages.length > 1 ? `Page ${page + 1} of ${sc.pages.length}` : ''}</span>
            </header>
            <div className="textblock">{(sc.pages[page] || []).join('\n')}</div>
            <div className="btnrow" style={{ marginTop: 14, justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setStep('pick')}>Back</button>
              {page < sc.pages.length - 1
                ? <button className="btn primary" onClick={() => setPage(page + 1)}>Continue →</button>
                : <PlayerCount sc={sc} n={nPlayers} setN={setNPlayers} onGo={beginPlayers} />}
            </div>
          </>
        )}

        {step === 'player' && (
          <PlayerSetup
            key={cur}
            index={cur}
            taken={players.map((p) => p.name)}
            onCancel={() => setStep('intro')}
            onDone={addPlayer}
          />
        )}

        {step === 'creating' && <div className="boot" style={{ height: 200 }}>Please wait while the universe is created…</div>}

        {step === 'error' && (
          <>
            <header><h2>Scenario error</h2></header>
            <div className="textblock">{(result.log || []).join('\n') || 'The scenario could not be created.'}</div>
            <div className="btnrow" style={{ marginTop: 14 }}><button className="btn" onClick={() => setStep('pick')}>Back</button></div>
          </>
        )}
      </div>
    </div>
  );
}

function PlayerCount({ sc, n, setN, onGo }) {
  if (sc.minPlay >= sc.maxPlay) {
    return (
      <div className="btnrow">
        <span className="dim">This is a scenario for {sc.minPlay} player{sc.minPlay > 1 ? 's' : ''}.</span>
        <button className="btn primary" onClick={onGo} autoFocus>Begin →</button>
      </div>
    );
  }
  const opts = [];
  for (let i = sc.minPlay; i <= sc.maxPlay; i++) opts.push(i);
  return (
    <div className="btnrow">
      <span className="dim">How many players?</span>
      {opts.map((i) => <button key={i} className={'btn' + (n === i ? ' active' : '')} onClick={() => setN(i)}>{i}</button>)}
      <button className="btn primary" onClick={onGo}>Begin →</button>
    </div>
  );
}

function PlayerSetup({ index, taken, onCancel, onDone }) {
  const suggestion = useMemo(() => {
    const names = new Array(9).fill('');
    taken.forEach((t, i) => { names[i] = t; });
    return GetRandomEmpireName(names);
  }, [taken]);
  const [name, setName] = useState('');
  const [sex, setSex] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const [err, setErr] = useState(null);

  const done = () => {
    let n = name.trim() || suggestion;
    n = n.slice(0, 32);
    n = n[0].toUpperCase() + n.slice(1);
    if (pw !== pw2) { setErr('The passwords do not match. Please enter your password again.'); return; }
    const isEmpress = sex === 'f' ? true : sex === 'm' ? false : Rnd(0, 1) === 1;
    onDone({ name: n, password: pw.slice(0, 8).toUpperCase(), isEmpress });
  };

  return (
    <>
      <header><h2>Player empire #{index + 1}</h2><button className="btn" onClick={onCancel}>Back</button></header>
      <div style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
        <label className="field">Name of your empire
          <div className="btnrow">
            <input type="text" value={name} maxLength={32} placeholder={suggestion} onChange={(e) => setName(e.target.value)} autoFocus style={{ flex: 1 }} />
            <button className="btn" onClick={() => setShowSugg(!showSugg)}>Suggestions</button>
          </div>
        </label>
        {showSugg && (
          <div className="chips" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))' }}>
            {RndEmpireName.map((s) => (
              <button key={s} className="btn small" onClick={() => { setName(s); setShowSugg(false); }}>{s}</button>
            ))}
          </div>
        )}
        <div className="field" style={{ fontSize: 12, color: 'var(--dim)' }}>Are you male or female?
          <div className="btnrow" style={{ marginTop: 4 }}>
            <button className={'btn' + (sex === 'm' ? ' active' : '')} onClick={() => setSex('m')}>Emperor</button>
            <button className={'btn' + (sex === 'f' ? ' active' : '')} onClick={() => setSex('f')}>Empress</button>
            <button className={'btn' + (sex === '' ? ' active' : '')} onClick={() => setSex('')}>Surprise me</button>
          </div>
        </div>
        <div className="btnrow" style={{ alignItems: 'flex-end' }}>
          <label className="field">Password (optional, up to 8 characters)
            <input type="password" value={pw} maxLength={8} onChange={(e) => setPw(e.target.value)} />
          </label>
          <label className="field">Type it again
            <input type="password" value={pw2} maxLength={8} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && done()} />
          </label>
        </div>
        <p className="dim" style={{ fontSize: 12, margin: 0 }}>
          In a hot-seat game the password keeps other players out of your empire's affairs. Leave it blank to skip the prompt.
        </p>
        {err && <div className="bad">{err}</div>}
        <div className="btnrow"><button className="btn primary" onClick={done}>Found the empire →</button></div>
      </div>
    </>
  );
}
