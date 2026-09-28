import React, { useMemo, useState } from 'react';
import * as game from '../engine/game.js';
import { GetRandomEmpireName } from '../engine/newgame.js';
import { Universe } from '../engine/types.js';
import { Rnd } from '../engine/misc.js';
import { Modal, Confirm } from './common.jsx';

export function AddEmpire({ onClose }) {
  const slot = useMemo(() => game.newPlayerEmpireSlot(), []);
  const suggestion = useMemo(() => GetRandomEmpireName(Universe.EmpireData.map((e) => (e.InUse ? e.EmpireName : ''))), []);
  const [name, setName] = useState('');
  const [sex, setSex] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState(null);
  if (slot.error) return <Confirm title="New player empire" text={slot.error} yes="OK" onYes={onClose} onNo={onClose} />;
  const create = () => {
    if (pw !== pw2) { setErr('Please enter your password again.'); return; }
    let n = (name.trim() || suggestion).slice(0, 32);
    n = n[0].toUpperCase() + n.slice(1);
    const isEmpress = sex === 'f' ? true : sex === 'm' ? false : Rnd(0, 1) === 1;
    game.addPlayerEmpire(n, pw.toUpperCase().slice(0, 8), isEmpress);
    onClose();
  };
  return (
    <Modal title="New player empire" onClose={onClose} error={err}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={create}>Found empire</button></>}>
      <div className="advisor">
        You are a dwarf among giants.  You have fewer ships, fewer people, and a smaller industrial capacity than any
        other empire in the galaxy.  With one world and your Imperial Starfleet you must carve an empire out of the scraps
        and remnants of others.  But that is your greatest strength:  With luck, and a great deal of diplomatic skill,
        you'll perhaps be ignored for just long enough...  By the time the giants realize their mistake, your flag will
        be flying over a dozen worlds.
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <label className="field">Name of player empire
          <input type="text" value={name} placeholder={suggestion} maxLength={32} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="btnrow">
          <button className={'btn' + (sex === 'm' ? ' active' : '')} onClick={() => setSex('m')}>Emperor</button>
          <button className={'btn' + (sex === 'f' ? ' active' : '')} onClick={() => setSex('f')}>Empress</button>
          <button className={'btn' + (sex === '' ? ' active' : '')} onClick={() => setSex('')}>Surprise me</button>
        </div>
        <div className="btnrow">
          <label className="field">Password<input type="password" value={pw} maxLength={8} onChange={(e) => setPw(e.target.value)} /></label>
          <label className="field">Again<input type="password" value={pw2} maxLength={8} onChange={(e) => setPw2(e.target.value)} /></label>
        </div>
      </div>
    </Modal>
  );
}
