import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { boot } from './boot.js';
import './styles.css';

const root = createRoot(document.getElementById('root'));
root.render(<div className="boot">Loading Anacreon…</div>);
boot().then(() => root.render(<App />)).catch((e) => {
  root.render(<div className="boot error">Failed to load game data: {String(e.message || e)}</div>);
});
