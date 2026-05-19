#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here  = dirname(fileURLToPath(import.meta.url));
const SRC   = resolve(here, '..', 'FS-MD.js');
const DST   = resolve(here, '..', 'public', 'missions.json');
const NAMES = resolve(here, '..', 'mission-names.json');

const raw = readFileSync(SRC, 'utf8');
const m = raw.match(/const\s+MDUMMJSON\s*=\s*(\{[\s\S]*?\});/);
if (!m) throw new Error('Could not find MDUMMJSON literal in ' + SRC);

const data = JSON.parse(m[1]);

// Optional override map: { "<order>": "<display name>" }
const overrides = existsSync(NAMES) ? JSON.parse(readFileSync(NAMES, 'utf8')) : {};

const normalized = {
  setName: data.missionSetName,
  setDescription: data.missionSetDescription,
  bannerLength: data.plannedBannerLength,
  fileFormatVersion: data.fileFormatVersion,
  generatedAt: new Date().toISOString(),
  missions: data.missions.map((mi, idx) => ({
    order: idx + 1,
    title: mi.missionTitle,
    description: mi.missionDescription,
    firstPortal: mi.portals[0]?.title ?? null,
    displayName: overrides[String(idx + 1)] ?? mi.portals[0]?.title ?? mi.missionTitle,
    portals: mi.portals.map((p, pi) => ({
      order: pi + 1,
      guid: p.guid,
      title: p.title,
      lat: p.location.latitude,
      lng: p.location.longitude,
      imageUrl: p.imageUrl,
      isStartPoint: !!p.isStartPoint,
      isOrnamented: !!p.isOrnamented,
      objective: p.objective?.type ?? null,
    })),
  })),
};

let minLat=Infinity, maxLat=-Infinity, minLng=Infinity, maxLng=-Infinity;
for (const mi of normalized.missions) {
  for (const p of mi.portals) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
}
normalized.bounds = { minLat, maxLat, minLng, maxLng };
normalized.center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };

writeFileSync(DST, JSON.stringify(normalized, null, 2));
const totalPortals = normalized.missions.reduce((n,mi) => n + mi.portals.length, 0);
console.log(`wrote ${DST}`);
console.log(`  missions: ${normalized.missions.length}, portals: ${totalPortals}`);
console.log(`  center: ${normalized.center.lat.toFixed(5)}, ${normalized.center.lng.toFixed(5)}`);
