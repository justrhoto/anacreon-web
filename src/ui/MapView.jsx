import React, { useEffect, useRef, useState, useCallback } from 'react';
import { empColor, UNKNOWN_COLOR } from './common.jsx';

const NEB_FILL = [null, 'rgba(120, 70, 170, 0.28)', 'rgba(20, 10, 40, 0.85)', 'rgba(150, 90, 210, 0.55)'];

// view: result of mapView(); fleets: own fleet list (for destination lines)
export function MapView({ view, player, selected, onSelect, pickPrompt, onCancelPick, fleets, focus }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [cam, setCam] = useState(null); // { cx, cy, scale } in sector units
  const [hover, setHover] = useState(null);
  const drag = useRef(null);

  // initial camera centred on the capital
  useEffect(() => {
    if (!cam && view) {
      const w = wrapRef.current.clientWidth, h = wrapRef.current.clientHeight;
      const fit = Math.min(w, h) / (view.size + 2);
      const scale = Math.max(14, Math.min(42, fit < 14 ? 26 : fit));
      setCam({ cx: view.capital.x || view.size / 2, cy: view.capital.y || view.size / 2, scale });
    }
  }, [view, cam]);

  useEffect(() => {
    if (focus && cam) setCam((c) => ({ ...c, cx: focus.x, cy: focus.y }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const toSector = useCallback((px, py) => {
    const c = canvasRef.current;
    const w = c.clientWidth, h = c.clientHeight;
    const x = Math.floor((px - w / 2) / cam.scale + cam.cx + 0.5);
    const y = Math.floor((py - h / 2) / cam.scale + cam.cy + 0.5);
    return { x, y };
  }, [cam]);

  // drawing
  useEffect(() => {
    if (!cam || !view) return;
    const c = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = cam.scale;
    const sx = (x) => (x - cam.cx) * s + w / 2;
    const sy = (y) => (y - cam.cy) * s + h / 2;
    const S = view.size;
    const x0 = Math.max(1, Math.floor(cam.cx - w / 2 / s) - 1), x1 = Math.min(S, Math.ceil(cam.cx + w / 2 / s) + 1);
    const y0 = Math.max(1, Math.floor(cam.cy - h / 2 / s) - 1), y1 = Math.min(S, Math.ceil(cam.cy + h / 2 / s) + 1);

    // galaxy boundary
    ctx.strokeStyle = '#1d2a48';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx(0.5), sy(0.5), S * s, S * s);

    // grid every 5 sectors relative to the capital (as in the original map window)
    const cap = view.capital;
    ctx.strokeStyle = 'rgba(80, 110, 170, 0.14)';
    ctx.beginPath();
    for (let x = 1; x <= S; x++) {
      if ((x - cap.x) % 5 === 0) { ctx.moveTo(sx(x), sy(0.5)); ctx.lineTo(sx(x), sy(S + 0.5)); }
    }
    for (let y = 1; y <= S; y++) {
      if ((y - cap.y) % 5 === 0) { ctx.moveTo(sx(0.5), sy(y)); ctx.lineTo(sx(S + 0.5), sy(y)); }
    }
    ctx.stroke();
    // axes through the capital
    ctx.strokeStyle = 'rgba(242, 180, 90, 0.18)';
    ctx.beginPath();
    ctx.moveTo(sx(cap.x), sy(0.5)); ctx.lineTo(sx(cap.x), sy(S + 0.5));
    ctx.moveTo(sx(0.5), sy(cap.y)); ctx.lineTo(sx(S + 0.5), sy(cap.y));
    ctx.stroke();

    // nebulae & mines
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const cell = view.cells[x][y];
        if (cell.nebula) {
          ctx.fillStyle = NEB_FILL[cell.nebula];
          ctx.fillRect(sx(x - 0.5), sy(y - 0.5), s + 0.5, s + 0.5);
        }
      }
    }
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const cell = view.cells[x][y];
        if (cell.mine) {
          ctx.strokeStyle = cell.mine.own ? empColor(player) : '#ff6b6b';
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 1;
          const r = s * 0.42;
          ctx.beginPath();
          ctx.moveTo(sx(x) - r, sy(y)); ctx.lineTo(sx(x) + r, sy(y));
          ctx.moveTo(sx(x), sy(y) - r); ctx.lineTo(sx(x), sy(y) + r);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    // own fleet destination lines
    if (fleets) {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      for (const f of fleets) {
        if (!f.dest || (f.dest.x === f.xy.x && f.dest.y === f.xy.y)) continue;
        ctx.strokeStyle = 'rgba(95, 212, 232, 0.55)';
        ctx.beginPath();
        ctx.moveTo(sx(f.xy.x), sy(f.xy.y));
        ctx.lineTo(sx(f.dest.x), sy(f.dest.y));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // objects
    const font = Math.max(9, Math.round(s * 0.5));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const cell = view.cells[x][y];
        const o = cell.obj;
        const px = sx(x), py = sy(y);
        if (o) {
          const col = o.owner === -1 ? UNKNOWN_COLOR : empColor(o.owner);
          if (o.kind === 'unknown') {
            ctx.fillStyle = 'rgba(200, 80, 80, 0.55)';
            ctx.beginPath(); ctx.arc(px, py, s * 0.14, 0, Math.PI * 2); ctx.fill();
          } else if (o.kind === 'planet') {
            const r = s * 0.34;
            ctx.fillStyle = o.mine ? col : '#0b1221';
            ctx.strokeStyle = col;
            ctx.lineWidth = o.mine ? 1 : 1.6;
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            if (s >= 14) {
              ctx.fillStyle = o.mine ? '#07101f' : col;
              ctx.font = `600 ${font}px ui-monospace, Consolas, monospace`;
              ctx.fillText(o.glyph, px, py + 0.5);
            }
            if (o.glyph === 'C') {
              ctx.strokeStyle = col;
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.arc(px, py, r + 3, 0, Math.PI * 2); ctx.stroke();
            }
          } else if (o.kind === 'starbase') {
            const r = s * 0.32;
            ctx.save();
            ctx.translate(px, py); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = o.mine ? col : '#0b1221';
            ctx.strokeStyle = col; ctx.lineWidth = 1.5;
            ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.strokeRect(-r, -r, 2 * r, 2 * r);
            ctx.restore();
            if (s >= 14) {
              ctx.fillStyle = o.mine ? '#07101f' : col;
              ctx.font = `600 ${font}px ui-monospace, Consolas, monospace`;
              ctx.fillText(o.glyph, px, py + 0.5);
            }
          } else if (o.kind === 'gate') {
            ctx.strokeStyle = col; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(px, py, s * 0.36, s * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
            if (s >= 14) {
              ctx.fillStyle = col;
              ctx.font = `600 ${Math.round(font * 0.9)}px ui-monospace, Consolas, monospace`;
              ctx.fillText(o.glyph, px, py + 0.5);
            }
          } else if (o.kind === 'construction') {
            ctx.strokeStyle = col; ctx.lineWidth = 1.2;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(px - s * 0.3, py - s * 0.3, s * 0.6, s * 0.6);
            ctx.setLineDash([]);
            if (s >= 14) {
              ctx.fillStyle = col;
              ctx.font = `600 ${font}px ui-monospace, Consolas, monospace`;
              ctx.fillText('#', px, py + 0.5);
            }
          }
        }
        // fleets: own at upper-left (►), enemy at upper-right (▼) as in the original map
        if (cell.ownFleets.length) {
          const fx = px - s * 0.42, fy = py - s * 0.36, r = Math.max(3, s * 0.16);
          ctx.fillStyle = empColor(player);
          ctx.beginPath(); ctx.moveTo(fx - r * 0.6, fy - r); ctx.lineTo(fx + r, fy); ctx.lineTo(fx - r * 0.6, fy + r); ctx.closePath(); ctx.fill();
          if (cell.ownFleets.length > 1 && s >= 18) { ctx.fillStyle = '#fff'; ctx.font = `${Math.round(font * 0.7)}px sans-serif`; ctx.fillText(String(cell.ownFleets.length), fx, fy + r + 5); }
        }
        if (cell.enemyFleets.length) {
          const fx = px + s * 0.42, fy = py - s * 0.36, r = Math.max(3, s * 0.16);
          const owner = cell.enemyFleets[0].owner;
          ctx.fillStyle = owner === -1 ? '#ff6b6b' : empColor(owner);
          ctx.beginPath(); ctx.moveTo(fx - r, fy - r * 0.6); ctx.lineTo(fx + r, fy - r * 0.6); ctx.lineTo(fx, fy + r); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5; ctx.stroke();
        }
        if (cell.name && s >= 16) {
          ctx.fillStyle = '#e8d6ad';
          ctx.font = `${Math.max(9, Math.round(s * 0.36))}px system-ui, sans-serif`;
          ctx.fillText(cell.name, px, py + s * 0.62);
        }
      }
    }

    // selection & hover
    const box = (p, color, width) => {
      if (!p) return;
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.strokeRect(sx(p.x - 0.5) + 1, sy(p.y - 0.5) + 1, s - 2, s - 2);
    };
    if (hover && hover.x >= 1 && hover.y >= 1 && hover.x <= S && hover.y <= S) box(hover, pickPrompt ? 'rgba(242,180,90,0.9)' : 'rgba(255,255,255,0.35)', 1);
    box(selected, '#f2b45a', 2);
  }, [view, cam, selected, hover, player, fleets, pickPrompt]);

  // resize observer
  useEffect(() => {
    const ro = new ResizeObserver(() => setCam((c) => (c ? { ...c } : c)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const onWheel = (e) => {
    e.preventDefault();
    if (!cam) return;
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const w = rect.width, h = rect.height;
    const wx = (mx - w / 2) / cam.scale + cam.cx, wy = (my - h / 2) / cam.scale + cam.cy;
    const scale = Math.max(6, Math.min(80, cam.scale * f));
    setCam({ scale, cx: wx - (mx - w / 2) / scale, cy: wy - (my - h / 2) / scale });
  };

  useEffect(() => {
    const c = canvasRef.current;
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  });

  const onMouseDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, cx: cam.cx, cy: cam.cy, moved: false };
  };
  const onMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (drag.current && (e.buttons & 1)) {
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      if (drag.current.moved) setCam({ ...cam, cx: drag.current.cx - dx / cam.scale, cy: drag.current.cy - dy / cam.scale });
    }
    setHover({ ...toSector(e.clientX - rect.left, e.clientY - rect.top), px: e.clientX - rect.left, py: e.clientY - rect.top });
  };
  const onMouseUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const rect = canvasRef.current.getBoundingClientRect();
      const p = toSector(e.clientX - rect.left, e.clientY - rect.top);
      if (p.x >= 1 && p.y >= 1 && p.x <= view.size && p.y <= view.size) onSelect(p);
    }
  };

  const zoom = (f) => setCam((c) => ({ ...c, scale: Math.max(6, Math.min(80, c.scale * f)) }));
  const home = () => setCam((c) => ({ ...c, cx: view.capital.x, cy: view.capital.y }));

  let tip = null;
  if (hover && view && hover.x >= 1 && hover.y >= 1 && hover.x <= view.size && hover.y <= view.size) {
    const cell = view.cells[hover.x][hover.y];
    const rx = hover.x - view.capital.x, ry = view.capital.y - hover.y;
    const parts = [rx + ',' + ry];
    if (cell.name) parts.push(cell.name);
    if (cell.obj && cell.obj.kind !== 'unknown') parts.push(cell.obj.kind);
    else if (cell.obj) parts.push('unexplored star system');
    if (cell.nebula) parts.push(['', 'nebula', 'dark nebula', 'dense nebula'][cell.nebula]);
    if (cell.mine) parts.push('SRM field');
    if (cell.ownFleets.length) parts.push(cell.ownFleets.length + ' fleet' + (cell.ownFleets.length > 1 ? 's' : ''));
    if (cell.enemyFleets.length) parts.push(cell.enemyFleets.length + ' foreign fleet' + (cell.enemyFleets.length > 1 ? 's' : ''));
    tip = <div className="maptip" style={{ left: hover.px + 14, top: hover.py + 14 }}>{parts.join(' · ')}</div>;
  }

  return (
    <div className="mapwrap" ref={wrapRef}>
      <canvas ref={canvasRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => { setHover(null); drag.current = null; }} />
      <div className="maptools">
        <button className="btn small" onClick={() => zoom(1.25)} title="Zoom in">＋</button>
        <button className="btn small" onClick={() => zoom(0.8)} title="Zoom out">－</button>
        <button className="btn small" onClick={home} title="Centre on capital">⌂</button>
      </div>
      {pickPrompt && (
        <div className="maphint">{pickPrompt}<button className="btn small" onClick={onCancelPick}>Cancel</button></div>
      )}
      {tip}
      <div className="legend">Coordinates are relative to your capital (x → east, y ↑ north). Drag to pan, wheel to zoom.</div>
    </div>
  );
}
