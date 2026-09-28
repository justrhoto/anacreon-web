import React, { useMemo, useState } from 'react';
import * as game from '../engine/game.js';
import { env } from '../engine/env.js';
import { EmpireName, MyLord } from '../engine/primintr.js';
import { empireReport } from '../engine/views.js';
import { Rnd } from '../engine/misc.js';
import { Starfield, empColor } from './common.jsx';

export function Password({ onOk, onCancel }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const submit = () => {
    if (game.checkPassword(pw.toUpperCase())) onOk();
    else { setErr(true); setPw(''); }
  };
  return (
    <div className="screen">
      <Starfield density={0.5} />
      <div className="page" style={{ width: 'min(460px, 94vw)' }}>
        <header><h2 style={{ color: empColor(env.Player) }}>{EmpireName(env.Player)}</h2><span className="dim">{env.Year}</span></header>
        <p>The ruler of {EmpireName(env.Player)} is summoned. Identify yourself.</p>
        <label className="field">Password
          <input type="password" value={pw} maxLength={8} autoFocus onChange={(e) => { setPw(e.target.value); setErr(false); }} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </label>
        {err && <p className="bad">No, that's not it.  Try again.</p>}
        <div className="btnrow" style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <button className="btn" onClick={onCancel}>Menu</button>
          <button className="btn primary" onClick={submit}>Enter</button>
        </div>
      </div>
    </div>
  );
}

export function Briefing({ onContinue }) {
  const P = env.Player;
  const r = useMemo(() => empireReport(P), [P]);
  const welcome = useMemo(() => {
    switch (Rnd(1, 3)) {
      case 1: return 'Welcome, ' + MyLord(P) + ', I trust your sleep was peaceful and untroubled by the events of the year.';
      case 2: return 'Welcome, ' + MyLord(P) + ', Your humble servant awaits your instructions.';
      default: return 'Greetings, ' + MyLord(P) + ', I hope your sleep was pleasant and peaceful.';
    }
  }, [P]);
  return (
    <div className="screen">
      <Starfield density={0.5} />
      <div className="page" style={{ width: 'min(760px, 94vw)' }}>
        <header>
          <h2 style={{ color: empColor(P) }}>{r.name} Empire Status Report</h2>
          <span className="dim">{r.year}</span>
        </header>
        <div className="advisor">{welcome}</div>
        <p>
          In the year of our Lord {r.year}, the {r.reignYear}{ord(r.reignYear)} year of your reign, the empire of {r.name} consists
          of {r.worlds} world{r.worlds === 1 ? '' : 's'} with a total population of {r.population} billion.
          The average industrial production is {r.avgInd} and the average efficiency is {r.avgEff}%.
        </p>
        {r.techs.length === 0
          ? <p>None of the potential technologies of the {r.techLevel} level have been developed.</p>
          : <p>The empire has mastered the following technologies: <span className="accent">{r.techs.join(', ')}</span>.</p>}
        <h3 style={{ margin: '12px 0 6px' }}>The military force of the empire</h3>
        <table className="grid" style={{ maxWidth: 360 }}>
          <tbody>
            {r.ships.map((s) => <tr key={s.name}><td className="l" style={{ fontFamily: 'var(--sans)' }}>{s.name}</td><td>{s.n}</td></tr>)}
          </tbody>
        </table>
        <div className="btnrow" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn primary" autoFocus onClick={onContinue}>Take command →</button>
        </div>
      </div>
    </div>
  );
}

function ord(n) {
  const u = n % 10, t = Math.floor((n % 100) / 10);
  if (t === 1 || u > 3 || u === 0) return 'th';
  return u === 1 ? 'st' : u === 2 ? 'nd' : 'rd';
}

export function CapitalLost({ info, onContinue }) {
  return (
    <div className="screen">
      <Starfield density={0.3} />
      <div className="page" style={{ width: 'min(720px, 94vw)' }}>
        <div className="textblock" style={{ fontSize: 14 }}>
{`${info.lord},

I regret that I must communicate the dreadful news in this impersonal way,
but by the time you read this I will most likely be either dead or
imprisoned.  While you slept peacefully, our capital was attacked by the
${info.conquerorName} Empire.  Though our men and women fought bravely,
the strength of our adversary overwhelmed us and we were forced to surrender.

I have arranged an honorable course of action for Your Majesty; you will find
necessary materials by your bedside.  Good luck, ${info.lord2}.

                                       - Your Loyal Servant`}
        </div>
        <div className="btnrow" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn" onClick={onContinue}>Continue…</button>
        </div>
      </div>
    </div>
  );
}

export function Processing({ label }) {
  return (
    <div className="screen">
      <Starfield density={0.8} />
      <div style={{ textAlign: 'center' }}>
        <div className="subtitle" style={{ fontSize: 15 }}>{label}</div>
      </div>
    </div>
  );
}

export function GameOver({ onContinue }) {
  return (
    <div className="screen">
      <Starfield density={0.4} />
      <div className="page" style={{ width: 'min(520px, 94vw)', textAlign: 'center' }}>
        <h2>The game is over</h2>
        <p>No player empires remain in the galaxy.</p>
        <button className="btn primary" onClick={onContinue}>Return to the main menu</button>
      </div>
    </div>
  );
}

export function ChoosePlayer({ onPick, onCancel }) {
  const list = game.playersToMove();
  return (
    <div className="screen">
      <Starfield density={0.5} />
      <div className="page" style={{ width: 'min(480px, 94vw)' }}>
        <header><h2>Who are you?</h2><button className="btn" onClick={onCancel}>Back</button></header>
        <div className="options">
          {list.map((p) => (
            <div key={p.emp} className="option" onClick={() => onPick(p.emp)}>
              <span style={{ color: empColor(p.emp) }}>{p.name}</span><span className="dim">has not moved</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
