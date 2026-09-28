import React, { useMemo, useState } from 'react';
import * as cmd from '../engine/commands.js';
import { BattleSession, buildCustomGroups, ATSymb, TypN, PosN, GDst } from '../engine/battle.js';
import { env } from '../engine/env.js';
import { ObjectName, LongFormat, ShortFormat, GetShips, GetCargo, EmpireName } from '../engine/primintr.js';
import { ThingNames } from '../engine/datacnst.js';
import { Con, Gate, Flt, Pln, Base, jtn, trn, men, nnj } from '../engine/types.js';
import { Modal, Options, Dot, Confirm } from './common.jsx';

const P = () => env.Player;
const TARGET_NAMES = ['(none)', 'LAMs', 'defense satellites', 'GDMs', 'ion cannons', 'fighters', 'hunter-killers',
  'jumpships', 'jumptransports', 'penetrators', 'starships', 'transports', 'men', 'ninjas'];
const WARSHIPS = [5, 6, 7, 9, 10];

// Entry point: pick target -> choose configuration -> fight -> results
export function AttackFlow({ fleet, onClose, onDone }) {
  const targets = useMemo(() => cmd.attackTargets(fleet), [fleet]);
  const [ti, setTi] = useState(targets.length === 1 ? 0 : null);
  const [stage, setStage] = useState(targets.length === 1 ? 'config' : 'target');
  const [session, setSession] = useState(null);
  const target = ti !== null ? targets[ti] : null;

  if (!targets.length) return <Confirm title="Attack" text="There is nothing to attack here." yes="OK" onYes={onClose} onNo={onClose} />;

  if (stage === 'target') {
    return (
      <Modal title={'Attack with ' + ObjectName(P(), fleet, ShortFormat)} onClose={onClose}
        footer={<><button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={ti === null} onClick={() => setStage('config')}>Continue</button></>}>
        <p>What is the target of the attack?</p>
        <Options items={targets} value={ti} onChange={setTi} onPick={(i) => { setTi(i); setStage('config'); }}
          render={(t) => <span><Dot emp={t.owner} />{t.label}</span>} />
      </Modal>
    );
  }

  if (stage === 'config') {
    if (target.id.ObjTyp === Con || target.id.ObjTyp === Gate) {
      return (
        <Confirm danger title="Attack" yes="Destroy it"
          text={'Shall we destroy ' + ObjectName(P(), target.id, LongFormat) + '? It is defenseless against our fleet.'}
          onYes={() => onDone(cmd.destroyConstructionOrGate(fleet, target.id, false))} onNo={onClose} />
      );
    }
    return <ConfigDialog fleet={fleet} target={target} onClose={onClose}
      onStandard={() => { setSession(new BattleSession(fleet, target.id)); setStage('battle'); }}
      onCustom={(groups) => { setSession(new BattleSession(fleet, target.id, groups)); setStage('battle'); }} />;
  }

  return <BattleScreen session={session} onFinished={onDone} />;
}

function ConfigDialog({ fleet, target, onClose, onStandard, onCustom }) {
  const [custom, setCustom] = useState(false);
  const sh = GetShips(fleet), cr = GetCargo(fleet);
  const avail = [5, 6, 7, 8, 9, 10, 11].filter((s) => sh[s] > 0);
  const [slots, setSlots] = useState(() => avail.map((s) => ({ typ: s, num: sh[s], gatTyp: 0, gat: 0 })));
  const [err, setErr] = useState(null);
  const upd = (i, patch) => setSlots(slots.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const fight = () => {
    const used = {};
    for (const s of slots) used[s.typ] = (used[s.typ] || 0) + (s.num | 0);
    for (const t in used) if (used[t] > sh[t]) { setErr('There are only ' + sh[t] + ' ' + ThingNames[t] + ' in the fleet.'); return; }
    const g = buildCustomGroups(fleet, slots.filter((s) => s.num > 0));
    if (g.NoOfGroups === 0) { setErr('No groups were formed.'); return; }
    onCustom(g);
  };
  return (
    <Modal title={'Attack ' + target.label} wide onClose={onClose} error={err}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        {custom ? <button className="btn danger" onClick={fight}>Attack</button>
          : <><button className="btn" onClick={() => setCustom(true)}>Custom configuration…</button>
            <button className="btn danger" onClick={onStandard} autoFocus>Attack (standard configuration)</button></>}</>}>
      {!custom ? (
        <>
          <p>The fleet will be divided into attack groups, one per ship type, with transports carrying the fleet's troops.</p>
          <table className="grid" style={{ maxWidth: 420 }}>
            <tbody>
              {avail.map((s) => <tr key={s}><td className="l" style={{ fontFamily: 'var(--sans)' }}>{ThingNames[s]}</td><td>{sh[s]}</td></tr>)}
              {cr[men] > 0 && <tr><td className="l" style={{ fontFamily: 'var(--sans)' }}>men</td><td>{cr[men]}</td></tr>}
              {cr[nnj] > 0 && <tr><td className="l" style={{ fontFamily: 'var(--sans)' }}>ninjas</td><td>{cr[nnj]}</td></tr>}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <p>Define up to 9 attack groups. Transport groups may carry men or ninjas as ground assault troops.</p>
          <table className="grid">
            <thead><tr><th className="l">#</th><th className="l">Ship type</th><th>Ships</th><th className="l">Troops</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {slots.map((s, i) => (
                <tr key={i}>
                  <td className="l">{i + 1}</td>
                  <td className="l">
                    <select value={s.typ} onChange={(e) => upd(i, { typ: +e.target.value, gatTyp: 0 })}>
                      {avail.map((t) => <option key={t} value={t}>{ThingNames[t]} ({sh[t]})</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="0" max={sh[s.typ]} style={{ width: 80 }} value={s.num} onChange={(e) => upd(i, { num: Math.max(0, parseInt(e.target.value, 10) || 0) })} /></td>
                  <td className="l">
                    {(s.typ === jtn || s.typ === trn) ? (
                      <select value={s.gatTyp} onChange={(e) => upd(i, { gatTyp: +e.target.value })}>
                        <option value={0}>automatic</option>
                        {cr[men] > 0 && <option value={men}>men ({cr[men]})</option>}
                        {cr[nnj] > 0 && <option value={nnj}>ninjas ({cr[nnj]})</option>}
                      </select>
                    ) : <span className="dim">—</span>}
                  </td>
                  <td>{(s.typ === jtn || s.typ === trn) && s.gatTyp ? <input type="number" min="0" style={{ width: 80 }} value={s.gat} onChange={(e) => upd(i, { gat: Math.max(0, parseInt(e.target.value, 10) || 0) })} /> : ''}</td>
                  <td><button className="btn small" onClick={() => setSlots(slots.filter((_, k) => k !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button className="btn small" disabled={slots.length >= 9 || !avail.length} onClick={() => setSlots([...slots, { typ: avail[0], num: 0, gatTyp: 0, gat: 0 }])}>+ Add group</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function BattleScreen({ session, onFinished }) {
  const [, force] = useState(0);
  const [orders, setOrders] = useState({});
  const [log, setLog] = useState(() => session.events.map((e) => e.text).filter(Boolean));
  const [showDetails, setShowDetails] = useState(false);
  const [finish, setFinish] = useState(null); // prepared
  const [result, setResult] = useState(null); // resolved
  const [confirmRetreat, setConfirmRetreat] = useState(false);
  const groups = session.groups();
  const En = session.enemy();

  const push = (events) => {
    if (!events) return;
    const lines = events.map((e) => {
      if (e.type === 'advance') return 'Group ' + e.group + ' advances to ' + PosN[e.to] + '.';
      if (e.type === 'retreat') return 'Group ' + e.group + ' retreats to ' + PosN[e.to] + '.';
      return e.text;
    });
    setLog((l) => [...l, '— round —', ...lines].slice(-200));
    setOrders({});
    force((x) => x + 1);
  };
  const engage = () => push(session.engage());
  const move = () => {
    const ev = session.maneuver(orders);
    if (!ev) { setLog((l) => [...l, 'No moves were ordered.']); return; }
    push(ev);
  };
  const retreat = () => { setConfirmRetreat(false); push(session.retreat()); };
  const resolveWith = (f, capture) => {
    const r = session.resolve(capture);
    const summary = session.Result === 3 ? 'Victory against ' + session.targetName + '.'
      : session.Result === 2 ? 'The attacking force retreated.' : 'The attack force was destroyed.';
    setResult({ lines: [...f.lines, ...(f.oldShips ? [f.oldShips.intro, f.oldShips.list.join(', ')] : []), ...r.lines], booty: r.booty, summary });
  };
  const end = () => {
    const f = session.prepareFinish();
    if (f.captured) setFinish(f); else resolveWith(f, true);
  };

  if (result) {
    return (
      <Modal title="Battle report" wide onClose={() => onFinished({ ok: true, message: result.summary })}
        footer={<button className="btn primary" onClick={() => onFinished({ ok: true, message: result.summary })}>Continue</button>}>
        {result.lines.map((l, i) => <p key={i}>{l}</p>)}
        {result.booty.length > 0 && (
          <>
            <p>The following worlds have surrendered to our might:</p>
            <ul>{result.booty.map((b) => <li key={b}>{b}</li>)}</ul>
          </>
        )}
      </Modal>
    );
  }

  if (finish) {
    const doResolve = (capture) => resolveWith(finish, capture);
    if (finish.captured) {
      return (
        <Modal title="Enemy fleet captured" onClose={() => doResolve(true)}
          footer={<><button className="btn danger" onClick={() => doResolve(false)}>Destroy the fleet</button>
            <button className="btn primary" onClick={() => doResolve(true)}>Capture the ships</button></>}>
          <p>{finish.captured.plea}</p>
          <p>The remaining enemy ships: {finish.captured.list.join(', ')}.</p>
        </Modal>
      );
    }
  }

  const shownTypes = [];
  for (let t = 1; t <= 13; t++) if (En.some((row) => row[t] > 0)) shownTypes.push(t);

  return (
    <div className="modal-back">
      <div className="modal battle" role="dialog" aria-label="Battle">
        <div className="mhead">
          <h2>{session.fleetName} <span className="dim">attacking</span> {session.targetName}</h2>
        </div>
        <div className="mbody battle-body">
          <div className="battle-field">
            <table className="grid">
              <thead>
                <tr><th className="l">Orbit</th><th className="l">Our groups</th><th className="l">Enemy forces</th></tr>
              </thead>
              <tbody>
                {PosN.map((pn, p) => (
                  <tr key={p}>
                    <td className="l">{pn}</td>
                    <td className="l">
                      {groups.filter((g) => g.pos === p && g.status !== GDst).map((g) => (
                        <span key={g.index} className="chip">#{g.index} {g.num} {g.typeName}{g.gat ? ' +' + g.gat + ' ' + (g.gatTyp === nnj ? 'nnj' : 'men') : ''}</span>
                      ))}
                    </td>
                    <td className="l">
                      {shownTypes.filter((t) => En[p][t] > 0).map((t) => <span key={t} className="chip enemy">{En[p][t]} {TARGET_NAMES[t]}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Group orders</h3>
            <table className="grid">
              <thead><tr><th className="l">#</th><th className="l">Group</th><th className="l">Position</th><th className="l">Target</th><th className="l">Move</th></tr></thead>
              <tbody>
                {groups.map((g) => {
                  const opt = session.moveOptions(g.index);
                  const dead = g.status === GDst;
                  return (
                    <tr key={g.index} className={dead ? 'dim' : ''}>
                      <td className="l">{g.index}</td>
                      <td className="l">{dead ? 'destroyed' : g.num + ' ' + g.typeName}{g.cloaked ? ' (cloaked)' : ''}</td>
                      <td className="l">{g.posName}</td>
                      <td className="l">
                        {!dead && (
                          <select value={g.target} disabled={session.ended} onChange={(e) => { session.setTarget(g.index, +e.target.value); force((x) => x + 1); }}>
                            {TARGET_NAMES.map((n, t) => <option key={t} value={t}>{ATSymb[t]} {n}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="l">
                        {!dead && !session.ended && (
                          <div className="btnrow">
                            <button className={'btn small' + (orders[g.index] === 'A' ? ' active' : '')} disabled={!opt.advance} onClick={() => setOrders({ ...orders, [g.index]: orders[g.index] === 'A' ? undefined : 'A' })}>Advance</button>
                            <button className={'btn small' + (orders[g.index] === 'R' ? ' active' : '')} disabled={!opt.retreat} onClick={() => setOrders({ ...orders, [g.index]: orders[g.index] === 'R' ? undefined : 'R' })}>Retreat</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {showDetails && (
              <>
                <h3>Destroyed last round (by group)</h3>
                <table className="grid">
                  <thead><tr><th className="l">Enemy</th>{groups.map((g) => <th key={g.index}>#{g.index}</th>)}</tr></thead>
                  <tbody>
                    {session.details().map((r) => <tr key={r.name}><td className="l">{r.name}</td>{r.perGroup.map((n, i) => <td key={i}>{n}</td>)}</tr>)}
                  </tbody>
                </table>
              </>
            )}
          </div>
          <div className="battle-log">
            {log.map((l, i) => <div key={i} className={l.startsWith('—') ? 'dim' : /DESTROYED|SURRENDER|RETREAT/.test(l) ? 'accent' : ''}>{l}</div>)}
          </div>
        </div>
        <div className="mfoot">
          {session.ended ? (
            <button className="btn primary" onClick={end}>Battle over — continue</button>
          ) : (
            <>
              <button className="btn" onClick={() => setShowDetails(!showDetails)}>{showDetails ? 'Hide details' : 'Details'}</button>
              <button className="btn" onClick={() => setConfirmRetreat(true)}>Retreat all</button>
              <button className="btn" disabled={!Object.values(orders).some(Boolean)} onClick={move}>Move &amp; engage</button>
              <button className="btn danger" onClick={engage} autoFocus>Engage</button>
            </>
          )}
        </div>
      </div>
      {confirmRetreat && <Confirm title="Retreat" text="Order all groups to retreat from the battle?" yes="Retreat" onYes={retreat} onNo={() => setConfirmRetreat(false)} />}
    </div>
  );
}
