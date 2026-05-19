#!/usr/bin/env node
// Emits two local reference artefacts derived from public/missions.json:
//   checklist.md   — markdown, one section per mission with tappable Apple
//                    Maps deeplinks per portal
//   checklist.csv  — flat table, one row per portal, for spreadsheet use
//
// Neither file is deployed to the website — they're meant to live in the repo
// as your offline reference while building Apple Maps Guides on iPhone.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC  = resolve(here, '..', 'public', 'missions.json');
const MD   = resolve(here, '..', 'checklist.md');
const CSV  = resolve(here, '..', 'checklist.csv');

const data = JSON.parse(readFileSync(SRC, 'utf8'));

function pinUrl(p) {
  const q = encodeURIComponent(p.title || `${p.lat},${p.lng}`);
  return `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${q}`;
}

// -------- markdown --------
{
  const lines = [];
  lines.push(`# ${data.setName} — Checklist`);
  lines.push('');
  lines.push(`${data.missions.length} missions · ${data.missions.reduce((n,m)=>n+m.portals.length,0)} portals · banner ${data.bannerLength}`);
  lines.push('');
  lines.push('Tap any portal link on iPhone to open Apple Maps; from there, ' +
    'tap **···** → **Add to Guide** to build each mission guide. When the ' +
    'guide is complete, tap **Share** and paste the `maps.apple/ug/...` URL ' +
    'into `public/guides.json`.');
  lines.push('');
  for (const m of data.missions) {
    lines.push(`## #${m.order} · ${(m.displayName ?? m.firstPortal ?? m.title)}`);
    lines.push('');
    lines.push(`*${m.portals.length} portals*`);
    lines.push('');
    m.portals.forEach((p) => {
      lines.push(`${p.order}. [${p.title}](${pinUrl(p)}) — \`${p.lat},${p.lng}\``);
    });
    lines.push('');
  }
  writeFileSync(MD, lines.join('\n'));
  console.log(`wrote ${MD}`);
}

// -------- csv --------
{
  // RFC 4180-style quoting: wrap fields containing comma/quote/newline, double
  // any embedded quotes.
  const q = v => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = [
    ['mission_order','mission_name','portal_order','portal_title','lat','lng','apple_maps_url'],
  ];
  for (const m of data.missions) {
    for (const p of m.portals) {
      rows.push([m.order, m.displayName ?? m.firstPortal ?? '', p.order, p.title, p.lat, p.lng, pinUrl(p)]);
    }
  }
  // Prepend a UTF-8 BOM so Excel on macOS/Windows detects encoding correctly.
  const csv = '﻿' + rows.map(r => r.map(q).join(',')).join('\n') + '\n';
  writeFileSync(CSV, csv);
  console.log(`wrote ${CSV}`);
}
