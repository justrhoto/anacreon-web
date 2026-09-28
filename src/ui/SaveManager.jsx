import React, { useRef, useState } from 'react';
import * as game from '../engine/game.js';
import { vfs } from '../runtime/vfs.js';
import { decodeCP437 } from '../runtime/cp437.js';
import { env } from '../engine/env.js';
import { Modal, Starfield, Confirm } from './common.jsx';

function fmtDate(t) {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SaveManager({ mode, onCancel, onLoaded, onSaved, asDialog }) {
  const [, force] = useState(0);
  const files = vfs.list('*.*').filter((f) => vfs.isUser(f.name) && /\.(SAV|BAK)$/.test(f.name));
  const scenarios = vfs.list('*.SCN').filter((f) => vfs.isUser(f.name));
  const [sel, setSel] = useState(null);
  const [name, setName] = useState(mode === 'save' ? env.CurrentGame : '');
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const fileRef = useRef(null);

  const doLoad = (f) => {
    const e = game.loadGame(f);
    if (e) setErr(e);
    else onLoaded && onLoaded();
  };

  const doSave = (force) => {
    let n = name.trim().toUpperCase();
    if (!n) { setErr('Please enter a filename.'); return; }
    if (!/^[A-Z0-9_\-]{1,8}(\.[A-Z0-9]{1,3})?$/.test(n)) { setErr('Use a DOS-style name: up to 8 letters/digits, optional extension.'); return; }
    if (n.indexOf('.') < 0) n += '.SAV';
    if (!force && vfs.exists(n) && n !== env.CurrentGame) { setConfirmOverwrite(true); return; }
    game.saveGame(n);
    onSaved && onSaved(n);
  };

  const onImport = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const up = f.name.toUpperCase().replace(/[^A-Z0-9_.\-]/g, '');
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (/\.SCN$/.test(up)) {
      vfs.write(up, decodeCP437(bytes));
      setMsg('Scenario ' + up + ' imported. It is now listed under New game.');
    } else {
      const text = new TextDecoder().decode(bytes);
      let n = up;
      if (!/\.(SAV|BAK)$/.test(n)) n = n.replace(/\..*$/, '') + '.SAV';
      vfs.write(n, text);
      setMsg('Imported ' + n + '.');
    }
    force((x) => x + 1);
  };

  const body = (
    <>
      {mode === 'save' && (
        <div className="btnrow" style={{ marginBottom: 12 }}>
          <label className="field" style={{ flex: 1 }}>Filename to save to
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && doSave(false)} />
          </label>
        </div>
      )}
      <table className="grid">
        <thead><tr><th className="l">Saved game</th><th className="l">Saved</th><th>Size</th><th></th></tr></thead>
        <tbody>
          {files.length === 0 && <tr><td className="l dim" colSpan={4}>No saved games yet.</td></tr>}
          {files.map((f) => (
            <tr key={f.name} className={'clickable' + (sel === f.name ? ' sel' : '')}
              onClick={() => { setSel(f.name); if (mode === 'save') setName(f.name); }}
              onDoubleClick={() => (mode === 'load' ? doLoad(f.name) : null)}>
              <td className="l">{f.name}</td>
              <td className="l">{fmtDate(f.time)}</td>
              <td>{Math.round(f.size / 1024)} KB</td>
              <td className="act">
                <button className="btn small" onClick={(e) => { e.stopPropagation(); download(f.name, vfs.read(f.name)); }}>Export</button>{' '}
                <button className="btn small danger" onClick={(e) => { e.stopPropagation(); setConfirmDel(f.name); }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {scenarios.length > 0 && (
        <>
          <h3 style={{ margin: '14px 0 6px' }}>Imported scenarios</h3>
          <div className="btnrow">
            {scenarios.map((s) => (
              <span key={s.name} className="chip">{s.name} <button className="btn small danger" onClick={() => setConfirmDel(s.name)}>✕</button></span>
            ))}
          </div>
        </>
      )}
      <p className="dim" style={{ fontSize: 12 }}>
        Games are stored in this browser. Use Export to keep a copy as a file, and Import to bring a save or a custom .SCN scenario back in.
      </p>
      {msg && <p className="good">{msg}</p>}
      <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={onImport} accept=".sav,.bak,.scn,.SAV,.BAK,.SCN" />
      {confirmDel && (
        <Confirm danger title="Delete file" text={'Delete ' + confirmDel + '? This cannot be undone.'} yes="Delete"
          onYes={() => { vfs.erase(confirmDel); setConfirmDel(null); setSel(null); force((x) => x + 1); }}
          onNo={() => setConfirmDel(null)} />
      )}
      {confirmOverwrite && (
        <Confirm title="Overwrite" text={'Replace the existing ' + name.toUpperCase() + '?'} yes="Replace"
          onYes={() => { setConfirmOverwrite(false); doSave(true); }} onNo={() => setConfirmOverwrite(false)} />
      )}
    </>
  );

  const footer = (
    <>
      <button className="btn" onClick={() => fileRef.current.click()}>Import file…</button>
      <button className="btn" onClick={onCancel}>Cancel</button>
      {mode === 'load'
        ? <button className="btn primary" disabled={!sel} onClick={() => doLoad(sel)}>Load</button>
        : <button className="btn primary" onClick={() => doSave(false)}>Save</button>}
    </>
  );

  if (asDialog) {
    return <Modal title={mode === 'load' ? 'Load game' : 'Save game'} wide onClose={onCancel} footer={footer} error={err}>{body}</Modal>;
  }
  return (
    <div className="screen">
      <Starfield density={0.6} />
      <div className="page">
        <header><h2>{mode === 'load' ? 'Load game' : 'Save game'}</h2></header>
        {body}
        {err && <p className="bad">{err}</p>}
        <div className="btnrow" style={{ justifyContent: 'flex-end', marginTop: 12 }}>{footer}</div>
      </div>
    </div>
  );
}
