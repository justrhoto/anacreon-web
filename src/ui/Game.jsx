import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as views from '../engine/views.js';
import * as cmd from '../engine/commands.js';
import * as game from '../engine/game.js';
import { env } from '../engine/env.js';
import { EmpireName, EmpireAge, GetCoordName, GetCapital, GetCoord, MyLord } from '../engine/primintr.js';
import { Pln, Base, Gate, Con, Flt, cmm, frt, cmp } from '../engine/types.js';
import { refresh, useVersion } from './store.js';
import { Modal, Confirm, Dot, empColor } from './common.jsx';
import { MapView } from './MapView.jsx';
import { HelpViewer } from './Help.jsx';
import { SaveManager } from './SaveManager.jsx';
import { AttackFlow } from './Battle.jsx';
import * as D from './Dialogs.jsx';

const P = () => env.Player;
const sameId = (a, b) => a && b && a.ObjTyp === b.ObjTyp && a.Index === b.Index;

function fmtClock(s) {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

export function Game({ onEndTurn, onQuit }) {
  const version = useVersion();
  const player = P();
  const [sel, setSel] = useState(() => {
    const c = GetCapital(player);
    return c.ObjTyp ? { ...GetCoord(c) } : null;
  });
  const [status, setStatus] = useState({ text: 'Your orders, ' + lordText() + '?', err: false });
  const [dialog, setDialog] = useState(null);
  const [menu, setMenu] = useState(null);
  const [tab, setTab] = useState('worlds');
  const [pick, setPick] = useState(null); // { prompt, cb }
  const [focus, setFocus] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const elapsedRef = useRef(0);
  const endingRef = useRef(false);

  const limited = env.TimePerTurn > 0;
  const left = game.timeLeft(elapsed);

  // turn clock
  useEffect(() => {
    const t = setInterval(() => {
      if (paused) return;
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    if (limited && left <= 0 && !endingRef.current) {
      endingRef.current = true;
      setDialog({ kind: 'timeup' });
    }
  }, [limited, left]);

  const map = useMemo(() => views.mapView(player), [player, version]);
  const fleets = useMemo(() => views.fleetList(player), [player, version]);

  const report = useCallback((r) => {
    setDialog(null);
    if (r) setStatus({ text: r.message || '', err: !r.ok });
    refresh();
  }, []);

  const pickSector = useCallback((prompt, cb) => setPick({ prompt, cb }), []);
  const cancelPick = () => { const p = pick; setPick(null); if (p) p.cb(null); };

  useEffect(() => {
    if (!pick) return undefined;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cancelPick(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  });

  const onMapSelect = (xy) => {
    if (pick) { const p = pick; setPick(null); p.cb(xy); return; }
    setSel(xy);
  };

  const goTo = (xy) => { setSel({ x: xy.x, y: xy.y }); setFocus({ x: xy.x, y: xy.y, t: Date.now() }); };

  const endTurn = () => { setDialog(null); onEndTurn(elapsedRef.current); };
  const quit = () => { setDialog(null); onQuit(elapsedRef.current); };

  const unread = views.messagesFor(player).length;
  const probes = views.probesLeft(player);

  // ---- dialogs ----------------------------------------------------------------------------
  const open = (kind, props = {}) => { setMenu(null); setDialog({ kind, ...props }); };
  const close = () => setDialog(null);
  const common = { onClose: close, onDone: report };

  const changeDest = (id) => {
    pickSector('Click the new destination for ' + (id.ObjTyp === Flt ? 'the fleet' : 'the starbase'), (xy) => {
      if (xy) report(cmd.changeDestination(id, xy));
    });
  };
  const probe = () => {
    setMenu(null);
    if (probes === 0) { setStatus({ text: "I'm sorry, " + lordText() + ' there are no more probes available.', err: true }); return; }
    pickSector('Click the sector to send a probe to', (xy) => { if (xy) report(cmd.launchProbe(xy)); });
  };

  const actions = {
    changeDest, probe, open, goTo,
    cancelOrders: (id) => report(cmd.cancelOrders(id)),
    srmSweep: (id) => report(cmd.srmSweep(id)),
    abortConstruction: (id) => open('confirm', {
      title: 'Abort construction', text: 'Abort ' + views.worldView(P(), id).name + '? All progress will be lost.',
      onYes: () => report(cmd.abortConstruction(id)), danger: true,
    }),
    deleteName: (name) => report(cmd.deleteNameCommand(name)),
  };

  let dlg = null;
  if (dialog) {
    const k = dialog.kind;
    if (k === 'production') dlg = <D.ProductionDialog id={dialog.id} onClose={close} />;
    else if (k === 'designate') dlg = <D.DesignateDialog id={dialog.id} {...common} />;
    else if (k === 'issp') dlg = <D.ISSPDialog id={dialog.id} {...common} />;
    else if (k === 'terraform') dlg = <D.TerraformDialog id={dialog.id} {...common} />;
    else if (k === 'liberate') dlg = <D.LiberateDialog id={dialog.id} {...common} />;
    else if (k === 'selfDestruct') dlg = <D.SelfDestructDialog id={dialog.id} {...common} />;
    else if (k === 'name') dlg = <D.NameDialog id={dialog.id} xy={dialog.xy} {...common} />;
    else if (k === 'launch') dlg = <D.LaunchDialog from={dialog.id} initialDest={dialog.dest} pickSector={pickSector} {...common} />;
    else if (k === 'transfer') dlg = <D.TransferDialog fleet={dialog.id} {...common} />;
    else if (k === 'abort') dlg = <D.AbortDialog fleet={dialog.id} {...common} />;
    else if (k === 'refuel') dlg = <D.RefuelDialog fleet={dialog.id} {...common} />;
    else if (k === 'orders') dlg = <D.OrdersDialog fleet={dialog.id} {...common} />;
    else if (k === 'lam') dlg = <D.LAMDialog base={dialog.id} {...common} />;
    else if (k === 'construct') dlg = <D.ConstructDialog xy={dialog.xy} {...common} />;
    else if (k === 'constructionStatus') dlg = <D.ConstructionStatusDialog onClose={close} onSelect={(xy) => { close(); goTo(xy); }} />;
    else if (k === 'defenses') dlg = <D.DefensesDialog {...common} />;
    else if (k === 'readMessages') dlg = <D.ReadMessagesDialog onClose={() => { close(); refresh(); }} />;
    else if (k === 'sendMessage') dlg = <D.SendMessageDialog {...common} />;
    else if (k === 'techTrade') dlg = <D.TechTradeDialog {...common} />;
    else if (k === 'frequency') dlg = <D.FrequencyDialog {...common} />;
    else if (k === 'autoAttack') dlg = <D.AutoAttackDialog fleet={dialog.id} {...common} />;
    else if (k === 'attack') dlg = <AttackFlow fleet={dialog.id} {...common} />;
    else if (k === 'save') dlg = <SaveManager mode="save" asDialog onCancel={close} onSaved={(n) => report({ ok: true, message: 'Game saved as ' + n + '.' })} />;
    else if (k === 'help') dlg = <Modal title="Help" wide onClose={close}><HelpViewer /></Modal>;
    else if (k === 'confirm') dlg = <Confirm title={dialog.title} text={dialog.text} danger={dialog.danger} yes={dialog.yes || 'Yes'} onYes={dialog.onYes} onNo={close} />;
    else if (k === 'endTurn') dlg = <Confirm title="End of year" text={'Are you ready to end the year ' + env.Year + ', ' + lordText() + '?'} yes="End the year" onYes={endTurn} onNo={close} />;
    else if (k === 'quit') dlg = <Confirm title="Leave the game" text="Leave the game now? You can come back later and continue this year from the main menu; the time you have spent is kept." yes="Leave to main menu" onYes={quit} onNo={close} />;
    else if (k === 'timeup') dlg = <Confirm title="Time is up" text={'Your time for this year has run out, ' + lordText() + '.'} yes="End the year" no="End the year" onYes={endTurn} onNo={endTurn} />;
  }

  const clockLow = limited && left < 60;

  return (
    <div className="game" onClick={() => menu && setMenu(null)}>
      <div className="topbar">
        <span className="empire" style={{ color: empColor(player) }}>{EmpireName(player)}</span>
        <span className="year">{env.Year} · year {EmpireAge(player) + 1} of your reign</span>
        <div className="menubar">
          <Menu name="Game" open={menu === 'game'} setOpen={(o) => setMenu(o ? 'game' : null)} items={[
            { label: 'End the year', kbd: 'N', onClick: () => open('endTurn') },
            { label: 'Save game…', onClick: () => open('save') },
            { label: (paused ? 'Resume' : 'Pause') + ' clock', disabled: !env.PauseActive || !limited, onClick: () => { setMenu(null); setPaused(!paused); } },
            { label: 'Leave to main menu', onClick: () => open('quit') },
          ]} />
          <Menu name="Empire" open={menu === 'empire'} setOpen={(o) => setMenu(o ? 'empire' : null)} items={[
            { label: 'Read messages', badge: unread || null, onClick: () => open('readMessages') },
            { label: 'Send message…', onClick: () => open('sendMessage') },
            { label: 'Trade technology…', onClick: () => open('techTrade') },
            { label: 'Warp link frequencies…', onClick: () => open('frequency') },
            { label: 'Defense settings…', onClick: () => open('defenses') },
            { label: 'Construction status', onClick: () => open('constructionStatus') },
            { label: 'Launch probe (' + probes + ' left)', disabled: probes === 0, onClick: probe },
          ]} />
          <button className="btn small" onClick={() => open('help')}>Help</button>
        </div>
        <span className="spacer" />
        {unread > 0 && <button className="btn small" onClick={() => open('readMessages')}>✉ Messages<span className="badge">{unread}</span></button>}
        {limited && <span className={'clock' + (clockLow ? ' low' : '')} title="Time left this year">{paused ? '⏸ ' : ''}{fmtClock(left)}</span>}
        <button className="btn primary small" onClick={() => open('endTurn')}>End year ▸</button>
      </div>

      <div className="main">
        <MapView view={map} player={player} selected={sel} onSelect={onMapSelect}
          pickPrompt={pick && pick.prompt} onCancelPick={cancelPick}
          fleets={fleets.filter((f) => f.own && f.dest)} focus={focus} />
        <div className="side">
          <div className="selection">
            {sel ? <Selection xy={sel} actions={actions} /> : <p className="dim">Select a sector on the map.</p>}
          </div>
          <div className="tabs">
            <div className="tabbar">
              {[['worlds', 'Worlds'], ['fleets', 'Fleets'], ['empires', 'Empires'], ['news', 'News'], ['names', 'Names']].map(([k, n]) => (
                <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>
              ))}
            </div>
            <div className="tabbody">
              {tab === 'worlds' && <WorldsTab onPick={goTo} />}
              {tab === 'fleets' && <FleetsTab list={fleets} onPick={goTo} />}
              {tab === 'empires' && <EmpiresTab />}
              {tab === 'news' && <NewsTab onPick={goTo} />}
              {tab === 'names' && <NamesTab onPick={goTo} onDelete={actions.deleteName} />}
            </div>
          </div>
        </div>
      </div>

      <div className="statusline">
        <span className={'msg' + (status.err ? ' err' : '')}>{status.text}</span>
        {sel && <span className="dim mono">{GetCoordName(sel)}</span>}
      </div>
      {dlg}
      <Keys onEnd={() => !dialog && open('endTurn')} />
    </div>
  );
}

function lordText() {
  return MyLord(P());
}

function Keys({ onEnd }) {
  useEffect(() => {
    const h = (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (document.querySelector('.modal-back')) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); onEnd(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onEnd]);
  return null;
}

function Menu({ name, open, setOpen, items }) {
  return (
    <div className="menuwrap" onClick={(e) => e.stopPropagation()}>
      <button className={'btn small' + (open ? ' active' : '')} onClick={() => setOpen(!open)}>{name} ▾</button>
      {open && (
        <div className="dropdown">
          {items.map((it) => (
            <button key={it.label} disabled={it.disabled} onClick={it.onClick}>
              <span>{it.label}{it.badge ? <span className="badge">{it.badge}</span> : null}</span>
              {it.kbd && <span className="kbd">{it.kbd}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- selection panel ---------------------------------------------------------------------------

function Act({ label, cond, id, onClick, danger }) {
  const err = cond ? cmd.checkObject(id, cmd.CommandConds[cond] || []) : null;
  return <button className={'btn small' + (danger ? ' danger' : '')} disabled={!!err} title={err || ''} onClick={onClick}>{label}</button>;
}

function Selection({ xy, actions }) {
  const Player = P();
  const s = views.sectorView(Player, xy);
  const { open } = actions;
  const sectorActs = [];
  if (!s.object && !s.unknownPlanet) {
    sectorActs.push(<button key="c" className="btn small" onClick={() => open('construct', { xy })}>Construct…</button>);
  }
  if (!s.object) sectorActs.push(<button key="n" className="btn small" onClick={() => open('name', { xy })}>Name sector…</button>);
  sectorActs.push(<button key="p" className="btn small" onClick={() => { actions.probe(); }}>Send probe…</button>);
  return (
    <>
      <div className="btnrow" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span><b>Sector {s.coord}</b>{s.name && s.name !== s.coord ? <span className="dim"> · {s.name}</span> : null}</span>
        <span className="dim" style={{ fontSize: 12 }}>
          {s.nebula ? ['', 'nebula', 'dark nebula', 'nebula'][s.nebula] || 'nebula' : ''}
          {s.mine ? (s.nebula ? ' · ' : '') + 'SRM field (' + s.mine.ownerName + ')' : ''}
        </span>
      </div>
      {s.object && <ObjectCard id={s.object} actions={actions} />}
      {s.unknownPlanet && <div className="obj"><div className="head"><span className="name">Unexplored world</span></div><div className="body dim">Send a fleet or probe to learn more.</div></div>}
      {s.fleets.map((f) => <FleetCard key={f.Index} id={f} actions={actions} />)}
      {!s.object && !s.fleets.length && !s.unknownPlanet && <p className="dim" style={{ fontSize: 13 }}>Empty space.</p>}
      <div className="btnrow" style={{ marginTop: 6 }}>{sectorActs}</div>
    </>
  );
}

function Chips({ data }) {
  return (
    <div className="chips">
      {Object.entries(data).map(([k, v]) => <span key={k} className="chip"><b>{k}</b>{v}</span>)}
    </div>
  );
}

function ObjectCard({ id, actions }) {
  const Player = P();
  const v = views.worldView(Player, id);
  const { open } = actions;
  const own = v.mine;
  const acts = [];
  if (id.ObjTyp === Pln || id.ObjTyp === Base) {
    if (own) {
      acts.push(<Act key="pr" label="Production" cond="production" id={id} onClick={() => open('production', { id })} />);
      acts.push(<Act key="de" label="Designate" cond="designate" id={id} onClick={() => open('designate', { id })} />);
      acts.push(<Act key="is" label="ISSP" cond="issp" id={id} onClick={() => open('issp', { id })} />);
      acts.push(<Act key="la" label="Deploy fleet" cond="launchFrom" id={id} onClick={() => open('launch', { id })} />);
      acts.push(<Act key="lm" label="Launch LAMs" cond="launchLAMs" id={id} onClick={() => open('lam', { id })} />);
      if (id.ObjTyp === Pln) acts.push(<Act key="tf" label="Terraform" cond="terraform" id={id} onClick={() => open('terraform', { id })} />);
      if (id.ObjTyp === Base && (v.baseType === cmm || v.baseType === frt))
        acts.push(<Act key="cd" label="Move base" cond="changeDestination" id={id} onClick={() => actions.changeDest(id)} />);
      acts.push(<Act key="li" label="Liberate" cond="liberate" id={id} onClick={() => open('liberate', { id })} />);
      if (id.ObjTyp === Base && v.baseType !== cmp) acts.push(<Act key="sd" label="Self-destruct" id={id} danger onClick={() => open('selfDestruct', { id })} />);
    }
  }
  if (id.ObjTyp === Gate && own) acts.push(<button key="sd" className="btn small danger" onClick={() => open('selfDestruct', { id })}>Self-destruct</button>);
  if (id.ObjTyp === Gate) acts.push(<button key="fq" className="btn small" onClick={() => open('frequency')}>Frequency…</button>);
  if (id.ObjTyp === Con && own) acts.push(<Act key="ab" label="Abort construction" cond="abortConstruction" id={id} danger onClick={() => actions.abortConstruction(id)} />);
  acts.push(<button key="nm" className="btn small" onClick={() => open('name', { id })}>Name…</button>);

  return (
    <div className="obj">
      <div className="head">
        <Dot emp={v.owner} />
        <span className="name">{cap(v.name)}</span>
        <span className="dim" style={{ fontSize: 12 }}>{v.ownerName}</span>
      </div>
      <div className="body">
        {v.kind === 'gate' && <div className="kv"><span>Type</span><span>{v.gateName}</span><span>Our frequency</span><span>{v.frequency}</span></div>}
        {v.kind === 'construction' && <div className="kv"><span>Building</span><span>{views.ConsName[v.constrType]}</span><span>Years left</span><span>{v.yearsLeft ?? '?'}</span></div>}
        {(v.kind === 'planet' || v.kind === 'starbase') && (
          <>
            <div className="kv">
              <span>Designation</span><span>{v.typeName}{v.baseName ? ' (' + v.baseName + ')' : ''}</span>
              {v.scouted ? <><span>Class</span><span>{v.className}</span></> : <><span></span><span></span></>}
              {v.scouted && (<>
                <span>Technology</span><span>{v.techName}</span>
                <span>Population</span><span>{v.popText}</span>
                <span>Efficiency</span><span>{v.eff}%</span>
                <span>Unrest</span><span>{v.revIndex !== null && v.revIndex !== undefined ? v.revIndex : v.rev}</span>
              </>)}
              {v.addicted && <><span>Note</span><span className="warn">ambrosia addicts</span></>}
            </div>
            {v.scouted ? <Chips data={{ ...v.military, ...(own ? v.cargo : {}) }} /> : <p className="dim" style={{ fontSize: 12 }}>No detailed information — this world has not been scouted.</p>}
          </>
        )}
      </div>
      <div className="actions">{acts}</div>
    </div>
  );
}

function FleetCard({ id, actions }) {
  const Player = P();
  const v = views.fleetView(Player, id);
  const { open } = actions;
  const acts = [];
  if (v.own) {
    acts.push(<Act key="cd" label="Destination" cond="changeDestination" id={id} onClick={() => actions.changeDest(id)} />);
    acts.push(<Act key="tr" label="Transfer" cond="transfer" id={id} onClick={() => open('transfer', { id })} />);
    acts.push(<Act key="at" label="Attack" cond="attack" id={id} danger onClick={() => open('attack', { id })} />);
    acts.push(<Act key="aa" label="Auto attack" cond="attack" id={id} onClick={() => open('autoAttack', { id })} />);
    acts.push(<Act key="rf" label="Refuel" cond="refuel" id={id} onClick={() => open('refuel', { id })} />);
    acts.push(<Act key="or" label="Orders" cond="orders" id={id} onClick={() => open('orders', { id })} />);
    if (v.hasOrders) acts.push(<Act key="co" label="Cancel orders" cond="cancelOrders" id={id} onClick={() => actions.cancelOrders(id)} />);
    acts.push(<Act key="ab" label="Abort / join" cond="abortFleet" id={id} onClick={() => open('abort', { id })} />);
    if (v.ships[10] >= 100) acts.push(<Act key="sw" label="SRM sweep" cond="srmSweep" id={id} onClick={() => actions.srmSweep(id)} />);
  }
  return (
    <div className="obj">
      <div className="head">
        <Dot emp={v.owner} />
        <span className="name">{cap(v.name)}</span>
        <span className="dim" style={{ fontSize: 12 }}>{v.fleetType || 'fleet'} · {v.ownerName}</span>
      </div>
      <div className="body">
        <div className="kv">
          <span>Status</span><span>{v.status}</span>
          <span>Destination</span><span>{v.destination}</span>
          {v.own && (<>
            <span>Fuel</span><span>{Math.round(v.fuel)} / {Math.round(v.fuelCapacity)}</span>
            <span>Range</span><span>{v.range}</span>
            <span>Cargo space</span><span>{v.cargoSpace}</span>
            <span>Orders</span><span>{v.hasOrders ? v.orders.length + ' lines' : 'none'}</span>
          </>)}
        </div>
        <Chips data={Object.fromEntries(Object.entries(v.contents).filter(([, n]) => v.own ? n !== '0' : true))} />
      </div>
      <div className="actions">{acts}</div>
    </div>
  );
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---- tabs ------------------------------------------------------------------------------------

function WorldsTab({ onPick }) {
  const rows = views.worldList(P());
  const [mode, setMode] = useState('industry');
  const cols = mode === 'industry'
    ? [['cls', 'Cls'], ['type', 'Typ'], ['tech', 'Tech'], ['pop', 'Pop'], ['eff', 'Eff'], ['rev', 'Rev'], ['imports', 'Imp'], ['exports', 'Exp']]
    : mode === 'military'
      ? [['fgt', 'fgt'], ['hkr', 'hkr'], ['jmp', 'jmp'], ['jtn', 'jtn'], ['pen', 'pen'], ['str', 'str'], ['trn', 'trn'], ['men', 'men'], ['nnj', 'nnj']]
      : mode === 'defense'
        ? [['LAM', 'LAM'], ['def', 'def'], ['GDM', 'GDM'], ['ion', 'ion']]
        : [['amb', 'amb'], ['che', 'che'], ['met', 'met'], ['sup', 'sup'], ['tri', 'tri']];
  return (
    <>
      <div className="btnrow pad" style={{ paddingBottom: 4 }}>
        {['industry', 'military', 'defense', 'stockpiles'].map((m) => <button key={m} className={'btn small' + (mode === m ? ' active' : '')} onClick={() => setMode(m)}>{cap(m)}</button>)}
      </div>
      <table className="grid list-compact">
        <thead><tr><th className="l">World</th>{cols.map(([, n]) => <th key={n}>{n}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id.ObjTyp + ':' + r.id.Index} className="clickable" onClick={() => onPick(views.worldView(P(), r.id).xy)} title={r.emp + ' · ' + r.className + ' · ' + r.typeName}>
              <td className="l"><Dot emp={r.owner} />{r.name}</td>
              {cols.map(([k]) => <td key={k}>{r[k]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function FleetsTab({ list, onPick }) {
  if (!list.length) return <p className="pad dim">No fleets.</p>;
  return (
    <table className="grid list-compact">
      <thead><tr><th className="l">Fleet</th><th className="l">Position</th><th className="l">Destination</th><th className="l">Status</th></tr></thead>
      <tbody>
        {list.map((f) => (
          <tr key={f.group + (f.id.ObjTyp + ':' + f.id.Index)} className="clickable" onClick={() => onPick(f.xy)}>
            <td className="l"><Dot emp={f.owner} />{f.shortName}</td>
            <td className="l">{f.position}</td>
            <td className="l">{f.destination}</td>
            <td className="l">{f.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmpiresTab() {
  const rows = views.empireList(P());
  const S = ['fgt', 'hkr', 'jmp', 'jtn', 'pen', 'str', 'trn'];
  return (
    <table className="grid list-compact">
      <thead><tr><th className="l">Empire</th><th>Tech</th><th>Worlds</th><th>Pop</th><th>Ind</th>{S.map((s) => <th key={s}>{s}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.emp}>
            <td className="l"><Dot emp={r.emp} />{r.name}{r.player ? '' : <span className="dim"> (AI)</span>}</td>
            <td>{r.tech}</td><td>{r.planets}</td><td>{r.pop}</td><td>{r.sind}</td>
            {S.map((s) => <td key={s}>{r[s]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NewsTab({ onPick }) {
  const list = views.newsList(P());
  if (!list.length) return <p className="pad dim">No news this year.</p>;
  return (
    <div>
      {list.map((n, i) => {
        const xy = n.loc && n.loc.XY && (n.loc.XY.x || n.loc.XY.y) ? n.loc.XY : null;
        return <div key={i} className={'newsline' + (n.local ? ' local' : '')} onClick={() => xy && onPick(xy)}>{n.text}</div>;
      })}
    </div>
  );
}

function NamesTab({ onPick, onDelete }) {
  const list = views.namesList(P());
  if (!list.length) return <p className="pad dim">No names defined.</p>;
  return (
    <table className="grid list-compact">
      <thead><tr><th className="l">Name</th><th className="l">What</th><th className="l">Where</th><th></th></tr></thead>
      <tbody>
        {list.map((n) => (
          <tr key={n.name} className="clickable" onClick={() => n.coord && onPick(n.xy)}>
            <td className="l">{n.name}</td><td className="l">{n.kind}</td><td className="l">{n.coord}</td>
            <td><button className="btn small" onClick={(e) => { e.stopPropagation(); onDelete(n.name); }}>Remove</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
