import React, { useEffect, useRef } from 'react';

export const EMPIRE_COLORS = ['#4fc3f7', '#ef5350', '#7bd66f', '#ffca28', '#c07ce0', '#ff8a4c', '#2fd2c4', '#f06292', '#8a93a6'];
export const UNKNOWN_COLOR = '#d7dde8';
export function empColor(e) { return e >= 0 && e <= 8 ? EMPIRE_COLORS[e] : UNKNOWN_COLOR; }

export function Dot({ emp }) {
  return <span className="dot" style={{ background: empColor(emp) }} />;
}

export function Modal({ title, children, footer, onClose, wide, error, note }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && onClose) { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="mhead">
          <h2>{title}</h2>
          {onClose && <button className="btn ghost small" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className="mbody">{children}</div>
        {(footer || error || note) && (
          <div className="mfoot">
            {error ? <span className="error">{error}</span> : note ? <span className="note">{note}</span> : null}
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Selectable option list
export function Options({ items, value, onChange, onPick, render }) {
  return (
    <div className="options">
      {items.map((it, i) => (
        <div
          key={i}
          className={'option' + (value === i ? ' sel' : '')}
          onClick={() => onChange && onChange(i)}
          onDoubleClick={() => onPick && onPick(i)}
        >
          {render ? render(it) : <span>{String(it)}</span>}
        </div>
      ))}
    </div>
  );
}

export function Starfield({ density = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    let raf;
    let stars = [];
    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      const n = Math.floor((c.width * c.height) / 3500 * density);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * c.width, y: Math.random() * c.height,
        z: Math.random() * 0.9 + 0.1, t: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = (now) => {
      ctx.fillStyle = '#03050b';
      ctx.fillRect(0, 0, c.width, c.height);
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(s.t + now / (900 + s.z * 1400));
        ctx.fillStyle = `rgba(${200 + s.z * 55},${210 + s.z * 40},255,${tw * s.z})`;
        const r = s.z * 1.6;
        ctx.fillRect(s.x, s.y, r, r);
        s.x -= s.z * 0.05;
        if (s.x < 0) s.x = c.width;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [density]);
  return <canvas className="starfield" ref={ref} />;
}

export function useKey(key, fn, deps = []) {
  useEffect(() => {
    const h = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (e.key === key) { e.preventDefault(); fn(e); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function Confirm({ title, text, onYes, onNo, yes = 'Yes', no = 'Cancel', danger }) {
  return (
    <Modal
      title={title}
      onClose={onNo}
      footer={<>
        <button className="btn" onClick={onNo}>{no}</button>
        <button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={onYes} autoFocus>{yes}</button>
      </>}
    >
      {Array.isArray(text) ? text.map((t, i) => <p key={i}>{t}</p>) : <p>{text}</p>}
    </Modal>
  );
}
