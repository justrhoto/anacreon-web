import React, { useMemo, useState } from 'react';
import * as cmd from '../engine/commands.js';
import * as views from '../engine/views.js';
import { env } from '../engine/env.js';
import { EmpireName, ObjectName, LongFormat, ShortFormat, GetCoordName, GetStatus } from '../engine/primintr.js';
import { ThingNames, TechnologyName, IndusNames, CargoSpace, ConsCargoNeeded, YearsToBuild, TypeStr } from '../engine/datacnst.js';
import { fgt, trn, men, tri, Flt, Base, Pln, Gate, Con, DpSpc, Grnd } from '../engine/types.js';
import { Modal, Options, Confirm, empColor, Dot } from './common.jsx';

const P = () => env.Player;
const RES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const SHIPS = [5, 6, 7, 8, 9, 10, 11];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Footer({ onCancel, onOk, okLabel = 'OK', okDisabled, danger }) {
  return (
    <>
      <button className="btn" onClick={onCancel}>Cancel</button>
      {onOk && <button className={'btn ' + (danger ? 'danger' : 'primary')} disabled={okDisabled} onClick={onOk}>{okLabel}</button>}
    </>
  );
}

// ---- production -------------------------------------------------------------------------

export function ProductionDialog({ id, onClose }) {
  const v = useMemo(() => views.productionView(P(), id), [id]);
  const inds = [0, 1, 2, v.shipyard, 7, 8];
  const indN = ['Bio', 'Che', 'Min', 'SY-' + 'GJST'[v.shipyard - 3], 'Sup', 'Tri'];
  return (
    <Modal title={'Production: ' + v.name} wide onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="kv" style={{ marginBottom: 12 }}>
        <span>Class</span><span>{v.className}</span><span>Population</span><span>{v.popText}</span>
        <span>Type</span><span>{v.typeName}</span><span>Efficiency</span><span>{v.eff}%</span>
        <span>Technology</span><span>{v.techName}</span><span>Trillum reserves</span><span>{v.trillumReserves} thousand kilotons</span>
      </div>
      <h3>Industry</h3>
      <table className="grid" style={{ marginBottom: 12 }}>
        <thead><tr><th className="l"></th>{indN.map((n) => <th key={n}>{n}</th>)}</tr></thead>
        <tbody>
          <tr><td className="l">ISSP</td>{inds.map((i, k) => <td key={k}>{i === 0 || (i >= 3 && i <= 6) ? '---' : Math.round(v.ISSPIndex[i] * 100)}</td>)}</tr>
          <tr><td className="l">Class adj.</td>{inds.map((i, k) => <td key={k}>{Math.round(v.ClsAdj[i])}</td>)}</tr>
          <tr><td className="l">Distribution</td>{inds.map((i, k) => <td key={k}>{Math.round(v.IndDist[i])}</td>)}</tr>
          <tr><td className="l">Optimum</td>{inds.map((i, k) => <td key={k}>{v.OptInd[i]}</td>)}</tr>
          <tr><td className="l">Industry</td>{inds.map((i, k) => <td key={k}>{v.Indus[i]}</td>)}</tr>
        </tbody>
      </table>
      <h3>Ships and materials</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="grid" style={{ marginBottom: 12 }}>
          <thead><tr><th className="l"></th>{RES.map((r) => <th key={r}>{views.ShortRes[r]}</th>)}</tr></thead>
          <tbody>
            <tr><td className="l">Available</td>{RES.map((r) => <td key={r}>{r <= trn ? v.Ships[r] : v.Cargo[r]}</td>)}</tr>
            <tr><td className="l">Production</td>{RES.map((r) => <td key={r}>{r <= trn ? v.SProd[r] : v.CProd[r] > 9999 ? Math.round(v.CProd[r] / 1000) + 'K' : v.CProd[r]}</td>)}</tr>
            <tr><td className="l">Consumption</td>{RES.map((r) => <td key={r}>{r <= trn ? '' : v.CCons[r] > 9999 ? Math.round(v.CCons[r] / 1000) + 'K' : v.CCons[r]}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <h3>Defenses</h3>
      <table className="grid" style={{ maxWidth: 360 }}>
        <thead><tr><th className="l"></th><th>LAM</th><th>def</th><th>GDM</th><th>ion</th></tr></thead>
        <tbody>
          <tr><td className="l">Available</td>{[1, 2, 3, 4].map((d) => <td key={d}>{v.Defns[d]}</td>)}</tr>
          <tr><td className="l">Optimum</td>{[1, 2, 3, 4].map((d) => <td key={d}>{v.DOpt[d]}</td>)}</tr>
          <tr><td className="l">Production</td>{[1, 2, 3, 4].map((d) => <td key={d}>{v.DProd[d]}</td>)}</tr>
        </tbody>
      </table>
    </Modal>
  );
}

// ---- designate ---------------------------------------------------------------------------

export function DesignateDialog({ id, onClose, onDone }) {
  const opts = useMemo(() => cmd.designationOptions(id), [id]);
  const cur = views.worldView(P(), id);
  const [sel, setSel] = useState(Math.max(0, opts.findIndex((o) => o.type === cur.type)));
  const [warn, setWarn] = useState(null);
  const go = (force) => {
    const t = opts[sel].type;
    const w = cmd.designationWarning(id, t);
    if (w && !force) { setWarn(w); return; }
    onDone(cmd.designate(id, t));
  };
  if (warn) return <Confirm title="Designate" text={[warn, 'Are you sure about this order?']} yes="Yes, proceed" onYes={() => go(true)} onNo={() => setWarn(null)} />;
  return (
    <Modal title={'Designate: ' + cur.name} onClose={onClose} note={cap(cur.name) + ' is currently ' + cmd.DesignationText[cur.type] + '.'}
      footer={<Footer onCancel={onClose} onOk={() => go(false)} okLabel="Designate" />}>
      <Options items={opts} value={sel} onChange={setSel} onPick={(i) => { setSel(i); }}
        render={(o) => <><span>{o.name}</span><span className="dim">{o.industry}</span></>} />
    </Modal>
  );
}

// ---- ISSP --------------------------------------------------------------------------------

export function ISSPDialog({ id, onClose, onDone }) {
  const [vals, setVals] = useState(() => cmd.getISSP(id));
  return (
    <Modal title={'ISSP: ' + ObjectName(P(), id, LongFormat)} onClose={onClose}
      footer={<Footer onCancel={onClose} onOk={() => onDone(cmd.setISSP(id, vals))} okLabel="Apply" />}>
      <p className="dim" style={{ fontSize: 13 }}>
        The Industrial Self-Sufficiency Percentage of a given industry is defined for all raw material industries as the percent of
        total raw materials needed by a given world that are actually produced on that world. For example, if a world produces 50%
        of the metals that it needs, its ISSP for the mining industry is said to be 50.
      </p>
      {cmd.ISSPIndustries.map((ind, i) => (
        <div key={ind.ind} className="btnrow" style={{ marginBottom: 8 }}>
          <span style={{ width: 150 }}>{ind.name}</span>
          <button className="btn small" disabled={vals[i] <= 0} onClick={() => setVals(vals.map((v, k) => (k === i ? v - 1 : v)))}>◀</button>
          <span className="mono" style={{ width: 290 }}>{cmd.ISSPText[vals[i]]}</span>
          <button className="btn small" disabled={vals[i] >= 10} onClick={() => setVals(vals.map((v, k) => (k === i ? v + 1 : v)))}>▶</button>
        </div>
      ))}
    </Modal>
  );
}

// ---- terraform ------------------------------------------------------------------------------

export function TerraformDialog({ id, onClose, onDone }) {
  const opts = useMemo(() => cmd.terraformOptions(id), [id]);
  const [sel, setSel] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const v = views.worldView(P(), id);
  if (!opts.length) return <Confirm title="Terraform" text="There are no suitable target classes for this world." yes="OK" onYes={onClose} onNo={onClose} />;
  if (confirm) {
    return (
      <Confirm title="Terraform" yes="Begin terraforming" danger
        text={[views.ClassName[opts[sel]] + ' — ' + v.name,
          'Terraforming will not be complete for several years and industry will stop completely during the process. Additionally, our dramatic changes to the biosphere could backfire, leaving the planet a desolate wasteland.',
          'Billions of people will likely emigrate from the planet. I would ask you to consider the lives you will be displacing.']}
        onYes={() => onDone(cmd.terraform(id, opts[sel]))} onNo={() => setConfirm(false)} />
    );
  }
  return (
    <Modal title={'Terraform: ' + v.name} onClose={onClose} note={'Current class: ' + v.className}
      footer={<Footer onCancel={onClose} onOk={() => setConfirm(true)} okLabel="Terraform…" />}>
      <p>To what class shall we terraform it?</p>
      <Options items={opts} value={sel} onChange={setSel} render={(c) => <span>{views.ClassName[c]}</span>} />
    </Modal>
  );
}

// ---- liberate -------------------------------------------------------------------------------

export function LiberateDialog({ id, onClose, onDone }) {
  const opts = useMemo(() => cmd.liberateOptions(id), [id]);
  const [sel, setSel] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const name = ObjectName(P(), id, LongFormat);
  if (confirm) {
    const e = opts[sel];
    return <Confirm danger title="Liberate" yes="Yes"
      text={e.emp === 8 ? 'Do you really want to grant independence to ' + name + '?' : 'Do you really want to give ' + name + ' to ' + e.name + '?'}
      onYes={() => onDone(cmd.liberate(id, e.emp))} onNo={() => setConfirm(false)} />;
  }
  return (
    <Modal title={'Liberate: ' + name} onClose={onClose} footer={<Footer onCancel={onClose} onOk={() => setConfirm(true)} okLabel="Continue…" />}>
      <p>Which empire do you wish to give this world to?</p>
      <Options items={opts} value={sel} onChange={setSel} render={(o) => <span><Dot emp={o.emp} />{o.name}</span>} />
    </Modal>
  );
}

// ---- self destruct ----------------------------------------------------------------------------

export function SelfDestructDialog({ id, onClose, onDone }) {
  const err = cmd.selfDestructCheck(id);
  if (err) return <Confirm title="Self-destruct" text={err} yes="OK" onYes={onClose} onNo={onClose} />;
  return <Confirm danger title="Self-destruct" text={cmd.selfDestructWarning(id)} yes="Give destruct confirmation"
    onYes={() => onDone(cmd.selfDestruct(id))} onNo={onClose} />;
}

// ---- names -----------------------------------------------------------------------------------------

export function NameDialog({ id, xy, onClose, onDone }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const target = id ? ObjectName(P(), id, LongFormat) : 'sector ' + GetCoordName(xy);
  const save = () => {
    const r = cmd.addNameCommand(id || { ObjTyp: 0, Index: 0 }, id ? { x: 0, y: 0 } : xy, name.trim());
    if (!r.ok) setErr(r.message); else onDone(r);
  };
  return (
    <Modal title={'Name ' + target} onClose={onClose} error={err} footer={<Footer onCancel={onClose} onOk={save} okLabel="Name" />}>
      <label className="field">What shall its new name be? (up to 8 characters)
        <input type="text" value={name} maxLength={8} autoFocus onChange={(e) => { setName(e.target.value); setErr(null); }} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </label>
      <p className="dim" style={{ fontSize: 12 }}>Names can be typed anywhere a location is asked for, and appear on the map.</p>
    </Modal>
  );
}

// ---- transfer table (FLTCOMM InputNewDistribution) --------------------------------------------------

function TransferTable({ session, onChange, fleetLabel, groundLabel }) {
  const [amounts, setAmounts] = useState({});
  const [err, setErr] = useState(null);
  const groundOwn = session.groundIsPlayers();
  const apply = (r, sign) => {
    const raw = (amounts[r] || '').trim();
    let n = raw === '' ? 0 : parseInt(raw, 10);
    if (!Number.isFinite(n)) { setErr('Please, numbers from -9999 to 9999.'); return; }
    n = sign * Math.abs(n);
    if (n === 0) return;
    const e = session.change(r, n);
    setErr(e);
    if (!e) { setAmounts({ ...amounts, [r]: '' }); onChange(); }
  };
  const act = (fn, r) => { const e = fn.call(session, r); setErr(e); onChange(); };
  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="grid transfer">
          <thead><tr><th className="l">Resource</th><th>{fleetLabel}</th><th>{groundLabel}</th><th className="l">Transfer</th><th className="l">Space/transport</th></tr></thead>
          <tbody>
            {RES.map((r) => (
              <tr key={r}>
                <td className="l" style={{ fontFamily: 'var(--sans)' }}>{ThingNames[r]}</td>
                <td>{session.get(r, true)}</td>
                <td>{groundOwn ? session.get(r, false) : '????'}</td>
                <td className="act l">
                  <button className="btn small" title="Load everything possible" disabled={!groundOwn} onClick={() => act(session.fill, r)}>⇧ all</button>{' '}
                  <input type="number" min="0" max="9999" value={amounts[r] || ''} onChange={(e) => setAmounts({ ...amounts, [r]: e.target.value })} />{' '}
                  <button className="btn small" title="Load onto fleet" disabled={!groundOwn} onClick={() => apply(r, 1)}>⇧</button>{' '}
                  <button className="btn small" title="Unload from fleet" onClick={() => apply(r, -1)}>⇩</button>{' '}
                  <button className="btn small" title="Unload everything" onClick={() => act(session.empty, r)}>⇩ all</button>
                </td>
                <td className="l dim">{r >= men ? CargoSpace[r] + ' per trn' : ''}</td>
              </tr>
            ))}
            <tr className="sep"><td className="l">Free cargo space (transports)</td><td className={session.fleetCargoSpace() < 0 ? 'bad' : ''}>{session.fleetCargoSpace()}</td><td>{groundOwn && session.GrndID.ObjTyp === Flt ? session.groundCargoSpace() : ''}</td><td></td><td></td></tr>
          </tbody>
        </table>
      </div>
      {err && <p className="bad">{err}</p>}
    </>
  );
}

// ---- deploy fleet --------------------------------------------------------------------------------------

export function LaunchDialog({ from, onClose, onDone, pickSector, initialDest }) {
  const [session] = useState(() => cmd.launchSession(from));
  const [, force] = useState(0);
  const [name, setName] = useState(() => suggestFleetName());
  const [dest, setDest] = useState(initialDest || null);
  const [destText, setDestText] = useState(initialDest ? GetCoordName(initialDest) : '');
  const [err, setErr] = useState(null);
  const [hidden, setHidden] = useState(false);
  const fromName = ObjectName(P(), from, LongFormat);
  if (cmd.fleetLimitReached()) {
    return <Confirm title="Deploy fleet" text={"I'm sorry, there are too many fleets in space already."} yes="OK" onYes={onClose} onNo={onClose} />;
  }
  const typed = (t) => {
    setDestText(t);
    const r = cmd.interpretLocation(t);
    setDest(r.error ? null : r.xy);
  };
  const pick = () => {
    setHidden(true);
    pickSector('Click the destination for the new fleet', (xy) => {
      setHidden(false);
      if (xy) { setDest(xy); setDestText(GetCoordName(xy)); }
    });
  };
  const deploy = () => {
    if (!dest) { setErr('Please choose a destination.'); return; }
    const r = cmd.launchFleet(name.trim(), from, dest, session);
    if (!r.ok) setErr(r.message); else onDone(r);
  };
  if (hidden) return null;
  return (
    <Modal title={'Deploy fleet from ' + fromName} wide onClose={onClose} error={err}
      footer={<Footer onCancel={onClose} onOk={deploy} okLabel="Deploy fleet" />}>
      <div className="btnrow" style={{ marginBottom: 10, alignItems: 'flex-end' }}>
        <label className="field">Fleet name
          <input type="text" value={name} maxLength={8} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">Destination (coordinates or name)
          <input type="text" value={destText} onChange={(e) => typed(e.target.value)} placeholder="x,y" />
        </label>
        <button className="btn" onClick={pick}>Pick on map</button>
        <span className="dim">{dest ? '→ ' + views.sectorView(P(), dest).name : ''}</span>
      </div>
      <TransferTable session={session} onChange={() => force((x) => x + 1)} fleetLabel="Fleet" groundLabel={views.worldView(P(), from).shortName} />
    </Modal>
  );
}

function suggestFleetName() {
  const used = new Set(views.namesList(P()).map((n) => n.name.toUpperCase()));
  for (let i = 1; i < 100; i++) { const n = 'Fleet' + i; if (!used.has(n.toUpperCase())) return n.length <= 8 ? n : 'F' + i; }
  return 'Fleet';
}

// ---- choose "ground" in the fleet's sector --------------------------------------------------------------

function GroundChooser({ options, value, onChange }) {
  return <Options items={options} value={value} onChange={onChange} render={(o) => <span><Dot emp={o.owner} />{o.label}</span>} />;
}

export function TransferDialog({ fleet, onClose, onDone }) {
  const opts = useMemo(() => cmd.groundOptions(fleet, false, false), [fleet]);
  const [gi, setGi] = useState(null);
  const [session, setSession] = useState(null);
  const [, force] = useState(0);
  const [err, setErr] = useState(null);
  const fname = ObjectName(P(), fleet, ShortFormat);
  if (!session) {
    return (
      <Modal title={'Transfer: ' + fname} onClose={onClose}
        footer={<Footer onCancel={onClose} okDisabled={gi === null} okLabel="Continue" onOk={() => setSession(cmd.transferSession(fleet, opts[gi].id))} />}>
        <p>What shall I use as the target of the transfer?</p>
        <GroundChooser options={opts} value={gi} onChange={setGi} />
      </Modal>
    );
  }
  const g = opts[gi].id;
  return (
    <Modal title={fname + ' ⇄ ' + ObjectName(P(), g, LongFormat)} wide onClose={onClose} error={err}
      footer={<Footer onCancel={onClose} okLabel="Complete transfer" onOk={() => { const r = cmd.commitTransfer(fleet, g, session); if (!r.ok) setErr(r.message); else onDone(r); }} />}>
      <TransferTable session={session} onChange={() => { setErr(null); force((x) => x + 1); }} fleetLabel={fname} groundLabel={ObjectName(P(), g, ShortFormat)} />
    </Modal>
  );
}

export function AbortDialog({ fleet, onClose, onDone }) {
  const opts = useMemo(() => cmd.groundOptions(fleet, false, false), [fleet]);
  const [gi, setGi] = useState(null);
  const [warn, setWarn] = useState(null);
  const go = () => {
    const w = cmd.abortFleetWarnings(fleet, opts[gi].id);
    if (w.length) setWarn(w);
    else onDone(cmd.abortFleet(fleet, opts[gi].id));
  };
  if (warn) return <Confirm title="Abort fleet" text={warn} yes="Abort the fleet" danger onYes={() => onDone(cmd.abortFleet(fleet, opts[gi].id))} onNo={() => setWarn(null)} />;
  return (
    <Modal title={'Abort / join: ' + ObjectName(P(), fleet, ShortFormat)} onClose={onClose}
      footer={<Footer onCancel={onClose} okDisabled={gi === null} okLabel="Abort / join" onOk={go} />}>
      <p>What do you wish to join the fleet with? All ships, cargo and remaining fuel will be transferred.</p>
      <GroundChooser options={opts} value={gi} onChange={setGi} />
    </Modal>
  );
}

export function RefuelDialog({ fleet, onClose, onDone }) {
  const opts = useMemo(() => cmd.groundOptions(fleet, true, true), [fleet]);
  const [gi, setGi] = useState(opts.length === 1 ? 0 : null);
  const [tons, setTons] = useState('');
  const [err, setErr] = useState(null);
  const info = gi !== null ? cmd.refuelInfo(fleet, opts[gi].id) : null;
  const go = () => {
    const n = tons.trim() === '' ? 0 : parseInt(tons, 10);
    const r = cmd.refuel(fleet, opts[gi].id, n);
    if (!r.ok) setErr(r.message); else onDone(r);
  };
  return (
    <Modal title={'Refuel: ' + ObjectName(P(), fleet, ShortFormat)} onClose={onClose} error={err}
      footer={<Footer onCancel={onClose} okDisabled={gi === null} okLabel="Refuel" onOk={go} />}>
      <p>Where shall I refuel from?</p>
      <GroundChooser options={opts} value={gi} onChange={(i) => { setGi(i); setErr(null); }} />
      {info && (
        <label className="field" style={{ marginTop: 10 }}>Tons of trillum (max: {info.max} tons; blank uses the maximum)
          <input type="number" min="0" max={info.max} value={tons} onChange={(e) => setTons(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        </label>
      )}
    </Modal>
  );
}

// ---- orders ---------------------------------------------------------------------------------------------

export function OrdersDialog({ fleet, onClose, onDone }) {
  const v = views.fleetView(P(), fleet);
  const [text, setText] = useState(v.orders.join('\n'));
  const [err, setErr] = useState(null);
  const save = () => {
    const r = cmd.setOrders(fleet, text.split('\n'));
    if (!r.ok) setErr(r.message); else onDone(r);
  };
  return (
    <Modal title={'Orders: ' + v.name} wide onClose={onClose} error={err} footer={<Footer onCancel={onClose} onOk={save} okLabel="Give orders" />}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
        <textarea rows={14} value={text} onChange={(e) => { setText(e.target.value); setErr(null); }} spellCheck={false} autoFocus />
        <div className="dim" style={{ fontSize: 12 }}>
          <p>One command per line (only the first four letters matter):</p>
          <p><span className="mono accent">DESTination</span> <i>place</i> — set course to a name or x,y</p>
          <p><span className="mono accent">TRANsfer</span> <i>n res</i> — load (+) or unload (−) n units at an own world, e.g. <span className="mono">TRAN 500 MET</span>, <span className="mono">TRAN -500 MET</span></p>
          <p><span className="mono accent">WAIT</span> — wait here until next year</p>
          <p><span className="mono accent">SRMSweep</span> — sweep an SRM field (100+ starships)</p>
          <p><span className="mono accent">REPEat</span> — start again from the top</p>
          <p>Resources: FGT HKR JMP JTN PEN STR TRN MEN NNJ AMB CHE MET SUP TRI</p>
          <p>An empty order list cancels all orders.</p>
        </div>
      </div>
    </Modal>
  );
}

// ---- LAMs --------------------------------------------------------------------------------------------------

export function LAMDialog({ base, onClose, onDone }) {
  const opts = useMemo(() => cmd.lamTargets(base), [base]);
  const w = views.worldView(P(), base);
  const avail = w.raw ? w.raw.defns[1] : 0;
  const [ti, setTi] = useState(null);
  const [n, setN] = useState(String(avail));
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);
  if (!opts.length) return <Confirm title="Launch LAMs" text={'No targets can be reached from ' + w.name + '.'} yes="OK" onYes={onClose} onNo={onClose} />;
  if (result) return <Confirm title="Launch LAMs" text={result.lines} yes="OK" onYes={() => onDone(result)} onNo={() => onDone(result)} />;
  const go = () => {
    const c = parseInt(n, 10);
    if (!Number.isFinite(c)) { setErr('You must use a positive number.'); return; }
    const r = cmd.launchLAMs(base, opts[ti].id, c);
    if (!r.ok) setErr(r.message); else setResult(r);
  };
  return (
    <Modal title={'Launch LAMs from ' + w.name} onClose={onClose} error={err}
      footer={<Footer onCancel={onClose} okDisabled={ti === null} okLabel="Launch" danger onOk={go} />}>
      <p>What target shall we hit? (range 5 sectors)</p>
      <Options items={opts} value={ti} onChange={setTi} render={(o) => <span>{o.label}</span>} />
      <label className="field" style={{ marginTop: 10 }}>There are {avail} LAMs at {w.name}. Launch how many?
        <input type="number" min="0" max={avail} value={n} onChange={(e) => setN(e.target.value)} />
      </label>
    </Modal>
  );
}

// ---- construction -----------------------------------------------------------------------------------------

export function ConstructDialog({ xy, onClose, onDone }) {
  const opts = cmd.constructionOptions();
  const [sel, setSel] = useState(0);
  const [err, setErr] = useState(null);
  if (!opts.length) return <Confirm title="Construction" text="You don't have the technology to build anything!" yes="OK" onYes={onClose} onNo={onClose} />;
  const t = opts[sel];
  return (
    <Modal title={'New construction at ' + GetCoordName(xy)} onClose={onClose} error={err}
      footer={<Footer onCancel={onClose} okLabel="Begin construction" onOk={() => { const r = cmd.construct(t, xy); if (!r.ok) setErr(r.message); else onDone(r); }} />}>
      <p>What kind of construction do you wish to start?</p>
      <Options items={opts} value={sel} onChange={setSel} render={(c) => <><span>{cap(views.ConsName[c])}</span><span className="dim">{YearsToBuild[c]} years</span></>} />
      <p className="dim" style={{ fontSize: 13, marginTop: 10 }}>
        Construction will take approximately {YearsToBuild[t]} years and requires, each year, delivered by fleets in the sector:
        {' '}{ConsCargoNeeded[t][15]} megatons of chemicals, {ConsCargoNeeded[t][16]} megatons of metals and {ConsCargoNeeded[t][18]} kilotons of trillum.
      </p>
    </Modal>
  );
}

export function ConstructionStatusDialog({ onClose, onSelect }) {
  const rows = views.constructionList(P());
  return (
    <Modal title="Construction status" wide onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      {rows.length === 0 ? <p>There are no active construction sites.</p> : (
        <table className="grid">
          <thead><tr><th className="l">Site</th><th className="l">Type</th><th>Completion</th><th colSpan={3}>Materials still needed this year (che / met / tri)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id.Index} className="clickable" onClick={() => onSelect(r.xy)}>
                <td className="l">{r.name}</td><td className="l">{r.typeName}</td><td>{r.completion}</td>
                <td>{r.need.che}</td><td>{r.need.met}</td><td>{r.need.tri}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

// ---- defenses -----------------------------------------------------------------------------------------------

export function DefensesDialog({ onClose, onDone }) {
  const [dist, setDist] = useState(() => cmd.getDefenseSettings());
  const [warn, setWarn] = useState(null);
  const orbits = ['Deep space', 'High orbit', 'Orbit', 'Sub-orbit', 'Ground'];
  const set = (o, s, v) => {
    const n = parseInt(v, 10);
    const d = dist.map((a) => a.slice());
    d[o][s] = Number.isFinite(n) && n >= 0 && n <= 100 ? n : 0;
    setDist(d);
  };
  const total = (s) => dist.reduce((t, a) => t + a[s], 0);
  const save = () => {
    const r = cmd.normalizeDefenses(dist);
    if (r.warning && !warn) { setWarn(r.warning); setDist(r.dist); return; }
    onDone(cmd.setDefenseSettings(r.dist));
  };
  return (
    <Modal title="Defenses" wide onClose={onClose} note={warn || 'Percent of each ship type stationed in each orbital shell of your worlds.'}
      footer={<Footer onCancel={onClose} onOk={save} okLabel={warn ? 'Accept normalized' : 'Save'} />}>
      <table className="grid">
        <thead><tr><th className="l">Ship</th>{orbits.map((o) => <th key={o}>{o}</th>)}<th>Total</th></tr></thead>
        <tbody>
          {SHIPS.map((s) => (
            <tr key={s}>
              <td className="l" style={{ fontFamily: 'var(--sans)' }}>{ThingNames[s]}</td>
              {orbits.map((o, oi) => (
                <td key={o}>
                  <input type="number" min="0" max="100" style={{ width: 60, textAlign: 'right' }} value={dist[oi][s]}
                    disabled={oi === Grnd && !(s === 5 || s === 8 || s === 11)}
                    onChange={(e) => { setWarn(null); set(oi, s, e.target.value); }} />
                </td>
              ))}
              <td className={total(s) !== 100 ? 'warn' : ''}>{total(s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dim" style={{ fontSize: 12 }}>Each row must total 100. Only fighters, jumptransports and transports can be on the ground.</p>
    </Modal>
  );
}

// ---- messages -------------------------------------------------------------------------------------------------

export function ReadMessagesDialog({ onClose }) {
  const msgs = useMemo(() => views.messagesFor(P()), []);
  const [i, setI] = useState(0);
  React.useEffect(() => { if (msgs[i]) cmd.markMessageRead(msgs[i].ref); }, [i, msgs]);
  if (!msgs.length) return <Confirm title="Messages" text="You have not received any messages this year." yes="OK" onYes={onClose} onNo={onClose} />;
  const m = msgs[i];
  return (
    <Modal title={(msgs.length > 1 ? `(${i + 1} of ${msgs.length}) ` : '') + m.from} wide onClose={onClose}
      footer={<>
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
        <button className="btn" disabled={i >= msgs.length - 1} onClick={() => setI(i + 1)}>Next →</button>
        <button className="btn primary" onClick={onClose}>Close</button>
      </>}>
      <div className="textblock">{m.lines.join('\n')}</div>
    </Modal>
  );
}

export function SendMessageDialog({ onClose, onDone }) {
  const recips = cmd.messageRecipients();
  const [sel, setSel] = useState(new Set());
  const [text, setText] = useState('');
  const [err, setErr] = useState(null);
  const toggle = (e) => { const s = new Set(sel); if (s.has(e)) s.delete(e); else s.add(e); setSel(s); };
  const send = () => {
    const lines = [];
    for (const l of text.split('\n')) { let s = l; do { lines.push(s.slice(0, 78)); s = s.slice(78); } while (s.length); }
    const r = cmd.sendMessage([...sel], lines);
    if (!r.ok) setErr(r.message); else onDone(r);
  };
  return (
    <Modal title="Send message" wide onClose={onClose} error={err} footer={<Footer onCancel={onClose} onOk={send} okLabel="Send message" okDisabled={!sel.size} />}>
      <p>Which empire(s) do you wish to send a message to?</p>
      <div className="btnrow" style={{ marginBottom: 10 }}>
        {recips.map((r) => <button key={r.emp} className={'btn' + (sel.has(r.emp) ? ' active' : '')} onClick={() => toggle(r.emp)}><Dot emp={r.emp} />{r.name}</button>)}
      </div>
      <textarea rows={10} style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your message…" />
      <p className="dim" style={{ fontSize: 12 }}>Messages may be intercepted by other empires with worlds near the recipient's capital.</p>
    </Modal>
  );
}

// ---- technology trade ----------------------------------------------------------------------------------------

export function TechTradeDialog({ onClose, onDone }) {
  const emps = cmd.techTradeEmpires();
  const [ei, setEi] = useState(null);
  const [ti, setTi] = useState(null);
  if (!emps.length) return <Confirm title="Trade technology" text="Unfortunately, you have nothing that others would want." yes="OK" onYes={onClose} onNo={onClose} />;
  const techs = ei !== null ? cmd.techTradeOptions(emps[ei].emp) : [];
  return (
    <Modal title="Trade technology" onClose={onClose}
      footer={<Footer onCancel={onClose} okDisabled={ti === null} okLabel="Transfer technology" onOk={() => onDone(cmd.tradeTechnology(emps[ei].emp, techs[ti].tech))} />}>
      <p>Which empire do you wish to transfer technology to?</p>
      <Options items={emps} value={ei} onChange={(i) => { setEi(i); setTi(null); }} render={(e) => <span><Dot emp={e.emp} />{e.name}</span>} />
      {ei !== null && (
        <>
          <p>Which technology do you wish to transfer?</p>
          <Options items={techs} value={ti} onChange={setTi} render={(t) => <span>{cap(t.name)}</span>} />
        </>
      )}
    </Modal>
  );
}

// ---- warp link frequencies ------------------------------------------------------------------------------------

export function FrequencyDialog({ onClose, onDone }) {
  const gates = cmd.knownGates();
  const [gi, setGi] = useState(null);
  const [f, setF] = useState('');
  const [err, setErr] = useState(null);
  if (!gates.length) return <Confirm title="Link frequencies" text="There are no known stargates in the galaxy." yes="OK" onYes={onClose} onNo={onClose} />;
  const g = gi !== null ? gates[gi] : null;
  return (
    <Modal title="Warp link frequencies" onClose={onClose} error={err}
      footer={<Footer onCancel={onClose} okDisabled={!g} okLabel="Set frequency" onOk={() => {
        const n = parseInt(f, 10);
        const r = cmd.setFrequency(g.id, Number.isFinite(n) ? n : -1);
        if (!r.ok) setErr(r.message); else onDone(r);
      }} />}>
      <p className="dim" style={{ fontSize: 13 }}>
        A gate, link or disrupter can be used by any empire whose frequency for it matches the owner's frequency.
      </p>
      <Options items={gates} value={gi} onChange={(i) => { setGi(i); setF(String(gates[i].freq)); setErr(null); }}
        render={(x) => <><span><Dot emp={x.owner} />{x.label}</span><span className="mono">{x.freq}</span></>} />
      {g && (
        <>
          <label className="field" style={{ marginTop: 10 }}>New frequency (0–9999)
            <input type="number" min="0" max="9999" value={f} onChange={(e) => setF(e.target.value)} />
          </label>
          <p className="dim" style={{ fontSize: 12 }}>
            {g.owner === P()
              ? 'Please be careful how you divulge this frequency, as other empires who know or guess it will have access to our device.'
              : 'If this is not the same frequency that ' + EmpireName(g.owner) + ' has configured, we will still not be able to use this device.'}
          </p>
        </>
      )}
    </Modal>
  );
}

// ---- auto attack ---------------------------------------------------------------------------------------------

export function AutoAttackDialog({ fleet, onClose, onDone }) {
  const targets = useMemo(() => cmd.attackTargets(fleet), [fleet]);
  const [ti, setTi] = useState(targets.length === 1 ? 0 : null);
  const [res, setRes] = useState(null);
  if (res) {
    const lines = [];
    const tgt = targets[ti];
    if (res.message) lines.push(res.message);
    else if (res.result === 1) lines.push("I'm sorry, the entire attack force has been destroyed.");
    else if (res.result === 2) lines.push("I'm sorry, the fleet was forced to retreat.");
    else if (res.result === 3) lines.push(tgt.id.ObjTyp === Flt ? 'The enemy fleet has been destroyed.' : 'The ' + tgt.label.split('  (')[0] + ' is now under the sovereign jurisdiction of ' + EmpireName(P()) + '.');
    return (
      <Modal title="Auto attack" onClose={() => onDone({ ok: true, message: lines[0] })} footer={<button className="btn primary" onClick={() => onDone({ ok: true, message: lines[0] })}>OK</button>}>
        {lines.map((l, i) => <p key={i}>{l}</p>)}
        {res.casualties.length > 0 && (
          <table className="grid" style={{ maxWidth: 320 }}>
            <thead><tr><th className="l">Casualties</th><th></th></tr></thead>
            <tbody>{res.casualties.map((c) => <tr key={c.name}><td className="l">{c.name}</td><td>{c.n}</td></tr>)}</tbody>
          </table>
        )}
      </Modal>
    );
  }
  return (
    <Modal title={'Auto attack: ' + ObjectName(P(), fleet, LongFormat)} onClose={onClose}
      footer={<Footer onCancel={onClose} okDisabled={ti === null} danger okLabel="Give confirmation order" onOk={() => setRes(cmd.autoAttack(fleet, targets[ti].id))} />}>
      <p>The fleet commander will conduct the attack. Choose the target:</p>
      <Options items={targets} value={ti} onChange={setTi} render={(t) => <span><Dot emp={t.owner} />{t.label}</span>} />
    </Modal>
  );
}

export { TypeStr, Base, Pln, Gate, Con, DpSpc, fgt, tri, GetStatus, IndusNames, TechnologyName, empColor };
