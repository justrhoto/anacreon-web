import React, { useState } from 'react';
import { helpPages } from './boot.js';
import { Modal } from './common.jsx';

// Index from HLPWIND.PAS
const INDEX = [
  ['Combat', 11], ['Construction', 10], ['Defenses', 6], ['Fleet Orders', 12], ['Function Keys', 2],
  ['ISSP', 13], ['Materials', 7], ['Raw Materials', 7], ['Ships', 6], ['Technology Levels', 5],
  ['Windows', 2], ['   Map', 8], ['   World Status', 9], ['World Classes', 4], ['World Types', 3],
];

export function HelpViewer({ initial = 1 }) {
  const [page, setPage] = useState(initial);
  if (!helpPages.length) return <p className="dim">The Anacreon help file is not available.</p>;
  const last = helpPages.length - 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14 }}>
      <div className="list">
        {INDEX.map(([n, p]) => (
          <div key={n} className={'listitem' + (page === p ? ' sel' : '')} style={{ padding: '3px 8px', fontSize: 12, whiteSpace: 'pre' }} onClick={() => setPage(p)}>{n}</div>
        ))}
      </div>
      <div>
        <div className="btnrow" style={{ marginBottom: 8 }}>
          <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button>
          <span className="dim">Page {page} of {last}</span>
          <button className="btn small" disabled={page >= last} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
        <div className="textblock helppage">{(helpPages[page] || []).join('\n')}</div>
      </div>
    </div>
  );
}

export function About({ onClose }) {
  return (
    <Modal title="About Anacreon" wide onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <p><b className="accent">ANACREON: Reconstruction 4021</b> — version 2.0, originally released October 2, 2003.</p>
      <p>
        After thirteen years, Anacreon was resurrected. Thanks to George Moromisato for releasing the source code,
        and for his genius in creating the game in the first place. Version 2.0 added:
      </p>
      <ul>
        <li>Disrupters make your warp fleets go jumpspeed</li>
        <li>Warp Link Frequencies allow you to share gates</li>
        <li>Fleets can now be ordered to do an SRMSweep</li>
        <li>Player empire order in scenarios can be random</li>
        <li>Scenario flavor text routines are more flexible</li>
        <li>Terraforming as a gate-level technology</li>
      </ul>
      <p className="dim">
        Based in part on Anacreon: Reconstruction 4021, copyright (c) 1988-2003 George Moromisato. All rights reserved.
        Version 2.0 by Adam Luker. This browser edition is a port of the original Turbo Pascal source: the game rules,
        scenarios and computer empires are the originals; the interface has been rebuilt for the web.
      </p>
      <p className="dim" style={{ fontSize: 12 }}>
        THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
        INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
      </p>
    </Modal>
  );
}
