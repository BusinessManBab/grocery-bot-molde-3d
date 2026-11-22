// Oslo's famous buildings for the 3D view, from data/landmarks.json (tools/bake_landmarks.py).
// Most are their real OpenStreetMap building parts, each extruded from its own floor to its own
// roof height in its mapped colour (the City Hall's towers, the Royal Palace, the cathedral, the
// 100 m+ towers by Oslo S, Barcode), with a facade that suits it and a few details OSM cannot hold
// (clock faces, the palace portico, castle roofs, the cathedral spire, the museum's light hall).
// Shapes OSM cannot describe are modelled by hand on each building's measured footprint frame:
// the Opera House's marble roof sloping into the fjord, MUNCH's bent top, the Astrup Fearnley
// Museum's sail roofs, the Fram Museum's A-frames and the Vigeland Monolith.
// Everything is merged into one mesh per material: about ten draw calls for all of it.
//
// Other towns use the same file (tools/bake_landmarks.mjs writes their data/landmarks.json from
// tools/landmarks.spec.json). Their sites pick a model by `site.model`: the generic ones below
// (church, outline, rapids) are parametrised by the spec (colours, heights, which way a tower
// faces), and a town's own signature shapes are added to MODELS under their own names.
// Moving water (rapids, waterfalls) is the only animation: one texture offset per frame.
import * as THREE from 'three';
import { Bucket, linear, quad, tri } from './building-geometry.js?v=31';
import { Earcut } from './vendor/earcut.js';

// facade tile: [bay width m, storey height m]
const TILE = { glass: [3, 3.6], tower: [1.8, 3.6], brick: [3.6, 4.2], classic: [4.6, 5.2], castle: [7, 6], slate: [9, 8],
  alabaster: [3, 3], munch: [1.4, 4], aluminium: [2.4, 3], timber: [.6, 4], dark: [3, 3.6], stripes: [2, 3.6], church: [5.5, 11] };
const NAMED = { white: '#f4f2ec', grey: '#9a9894', gray: '#9a9894', lightgrey: '#c9c7c2', black: '#3a3a3c', yellow: '#e8cf72' };

function facadeTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#dedede';
  g.fillRect(0, 0, 128, 128);
  const pane = (x, y, w, h, glass = '#6f8a9c', frame = '#ffffff', f = 5) => {
    g.fillStyle = frame; g.fillRect(x, y, w, h);
    g.fillStyle = glass; g.fillRect(x + f, y + f, w - 2 * f, h - 2 * f);
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.beginPath(); g.moveTo(x + f + 2, y + h - f - 4); g.lineTo(x + f + 10, y + f + 2); g.lineTo(x + f + 15, y + f + 2); g.lineTo(x + f + 7, y + h - f - 4); g.fill();
  };
  if (kind === 'glass' || kind === 'dark') {
    g.fillStyle = kind === 'dark' ? '#3b4650' : '#7f9aab'; g.fillRect(0, 0, 128, 128);      // curtain wall
    g.fillStyle = kind === 'dark' ? '#5b6670' : '#a9bcc8'; g.fillRect(0, 0, 128, 6); g.fillRect(0, 0, 5, 128);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(14, 120); g.lineTo(60, 10); g.lineTo(84, 10); g.lineTo(38, 120); g.fill();
  } else if (kind === 'tower' || kind === 'stripes') {
    g.fillStyle = kind === 'stripes' ? '#2f3337' : '#c9cbcc';
    g.fillRect(64, 0, 64, 128);                                                           // vertical bands
    g.fillStyle = '#7d93a1'; g.fillRect(70, 8, 52, 100);
  } else if (kind === 'brick') {
    g.fillStyle = '#cfcfcf'; for (let y = 4; y < 128; y += 8) g.fillRect(0, y, 128, 1.5);   // brick courses
    pane(34, 22, 60, 76, '#5d6f7a', '#e9e9e9', 6);
  } else if (kind === 'classic') {
    g.fillStyle = '#c9c9c9'; g.fillRect(0, 114, 128, 14); g.fillRect(0, 0, 128, 7);         // cornice and plinth band
    pane(36, 24, 56, 78, '#5f7380', '#f2f2f2', 7);
    g.fillStyle = '#efefef'; g.fillRect(30, 18, 68, 6);                                    // window head
  } else if (kind === 'castle') {
    g.fillStyle = '#cdcdcd'; for (let y = 10; y < 128; y += 22) for (let x = (y / 22 % 2) * 20; x < 128; x += 40) g.fillRect(x, y, 34, 2);
    g.fillStyle = '#4b555b'; g.beginPath(); g.roundRect(52, 40, 24, 40, [12, 12, 0, 0]); g.fill();   // small arched window
  } else if (kind === 'church') {
    g.fillStyle = '#cfcfcf'; for (let y = 4; y < 128; y += 8) g.fillRect(0, y, 128, 1.5);   // brick courses
    g.fillStyle = '#ececec'; g.beginPath(); g.roundRect(46, 18, 36, 96, [18, 18, 0, 0]); g.fill();
    g.fillStyle = '#4c5a63'; g.beginPath(); g.roundRect(51, 23, 26, 86, [13, 13, 0, 0]); g.fill();   // tall arched window
    g.fillStyle = '#ececec'; g.fillRect(63, 23, 2, 86);
  } else if (kind === 'slate') {
    g.fillStyle = '#d2d2d2'; for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 2);
    for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 2, 128);
  } else if (kind === 'alabaster') {
    g.fillStyle = '#e8e8e8'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 3, 128);
  } else if (kind === 'munch') {
    for (let x = 0; x < 128; x += 16) { g.fillStyle = '#e6e6e6'; g.fillRect(x, 0, 9, 128); g.fillStyle = '#cfcfcf'; g.fillRect(x + 9, 0, 7, 128); }
    g.fillStyle = 'rgba(80,90,100,.25)'; for (let y = 6; y < 128; y += 12) for (let x = 2; x < 128; x += 8) g.fillRect(x, y, 3, 3);   // perforation
  } else if (kind === 'aluminium') {
    g.fillStyle = '#cdcdcd'; for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 2, 128); for (let y = 0; y < 128; y += 42) g.fillRect(0, y, 128, 2);
    g.fillStyle = '#7f909a'; g.fillRect(8, 60, 112, 14);                                   // window band
  } else if (kind === 'timber') {
    for (let x = 0; x < 128; x += 16) { g.fillStyle = '#d6d6d6'; g.fillRect(x, 0, 12, 128); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const colourOf = (value, fallback) => (value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : NAMED[value] || fallback);
const shade = (hex, k) => { const c = linear(hex); return [c[0] * k, c[1] * k, c[2] * k]; };
const shadeHex = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function buildLandmarks({ data, heightAt, wx, wy, M, LIFT, scene, wallTint, cartoon }) {
  const K = M * LIFT;                                     // world units per metre of height
  const buckets = new Map();                              // facade kind -> walls; 'plain' -> roofs and details
  const bucket = kind => { if (!buckets.has(kind)) buckets.set(kind, new Bucket(true)); return buckets.get(kind); };
  const plain = bucket('plain');
  const stats = { sites: 0, parts: 0, names: [] };
  const extraMeshes = [];                                 // meshes outside the per-material buckets (moving water)

  // ---- small geometry toolkit (world units; pts are [x, z]) -------------------------------------
  // walls of a ring from y0 to y1, facade uv in metres / tile
  function walls(kind, pts, y0, y1, rgb) {
    const [bay, storey] = TILE[kind] || [3, 3.5], b = bucket(kind);
    let run = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const u0 = run / (bay * M), u1 = (run + len) / (bay * M), v0 = 0, v1 = (y1 - y0) / (storey * K);
      quad(b, [[a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [a[0], y1, a[1]]], rgb, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
      run += len;
    }
  }
  // a flat cap over a ring with holes, facing up (or down)
  function cap(rings, y, rgb, down = false) {
    const flat = [], holes = [], all = [];
    for (const r of rings) { if (all.length) holes.push(all.length); for (const p of r) { flat.push(p[0], p[1]); all.push(p); } }
    const t = Earcut.triangulate(flat, holes);
    for (let i = 0; i < t.length; i += 3) {
      const A = all[t[i]], B = all[t[i + 1]], C = all[t[i + 2]];
      const order = down ? [A, B, C] : [A, C, B];
      tri(plain, order.map(p => [p[0], y, p[1]]), rgb);
    }
  }
  const area = pts => { let a = 0; for (let p = pts.length - 1, q = 0; q < pts.length; p = q++) a += pts[p][0] * pts[q][1] - pts[q][0] * pts[p][1]; return a / 2; };
  const ccw = pts => (area(pts) < 0 ? pts.slice().reverse() : pts);
  const ringPts = flat => { const out = []; for (let i = 0; i < flat.length; i += 2) out.push([wx(flat[i]), wy(flat[i + 1])]); return out; };
  // prism: walls + roof (+ floor when it floats), from metres above `base`
  function prism(kind, rings, base, h0, h1, wallHex, roofHex) {
    const y0 = h0 > 0 ? base + h0 * K : base - 1.5, y1 = base + h1 * K;
    rings = rings.map((r, i) => (i === 0 ? ccw(r) : ccw(r).reverse()));
    for (const r of rings) walls(kind, r, y0, y1, linear(wallHex));
    cap(rings, y1, roofHex ? linear(roofHex) : shade(wallHex, .82));
    if (h0 > 0) cap(rings, y0, shade(wallHex, .6), true);
  }
  // oriented box in a local frame: f(u, v) -> [x, z]
  function box(kind, f, u0, u1, v0, v1, base, h0, h1, wallHex, roofHex) {
    prism(kind, [[f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)]], base, h0, h1, wallHex, roofHex);
  }
  // longest-edge frame of a footprint: centre, axis, extents (world units)
  function axes(pts) {
    let best = 0, dx = 1, dz = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez);
      if (l > best) { best = l; dx = ex / l; dz = ez / l; }
    }
    let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const [x, z] of pts) { const s = x * dx + z * dz, t = -x * dz + z * dx; s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
    const at = (s, t) => [dx * s - dz * t, dz * s + dx * t];
    return { dx, dz, s0, s1, t0, t1, at };
  }
  // pitched roofs on a footprint's rectangle: 'gabled' (ridge along the long side), 'hipped', 'pyramid'
  function roof(shape, pts, y, rise, hex) {
    const { s0, s1, t0, t1, at } = axes(pts), tm = (t0 + t1) / 2, sm = (s0 + s1) / 2, half = (t1 - t0) / 2, c = linear(hex);
    const P = (s, t, h) => { const [x, z] = at(s, t); return [x, h, z]; };
    const E = [P(s0, t0, y), P(s1, t0, y), P(s1, t1, y), P(s0, t1, y)], top = y + rise;
    if (shape === 'pyramid') {
      const apex = P(sm, tm, top);
      for (let i = 0; i < 4; i++) tri(plain, [E[i], E[(i + 1) % 4], apex], c);
      return;
    }
    const inset = shape === 'hipped' ? Math.min(half, (s1 - s0) / 2) : 0;
    const R1 = P(s0 + inset, tm, top), R2 = P(s1 - inset, tm, top);
    quad(plain, [E[0], E[1], R2, R1], c);
    quad(plain, [E[2], E[3], R1, R2], c);
    tri(plain, [E[3], E[0], R1], c);
    tri(plain, [E[1], E[2], R2], c);
  }
  // a vertical disc on a wall (clock face): centre, outward normal, radius
  function disc(x, y, z, nx, nz, r, hex, n = 16) {
    const c = linear(hex), tx = -nz, tz = nx, ring = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ring.push([x + nx * .25 + tx * Math.cos(a) * r, y + Math.sin(a) * r, z + nz * .25 + tz * Math.cos(a) * r]); }
    const mid = [x + nx * .25, y, z + nz * .25];
    for (let i = 0; i < n; i++) tri(plain, [mid, ring[i], ring[(i + 1) % n]], c);
  }
  // cone / spire / column around (x, z): radius r0 at y0 to r1 at y1
  function cone(x, z, y0, y1, r0, r1, hex, n = 8) {
    const c = linear(hex);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
      const p = (ang, r, y) => [x + Math.cos(ang) * r, y, z + Math.sin(ang) * r];
      if (r1 > 0) quad(plain, [p(a, r0, y0), p(b, r0, y0), p(b, r1, y1), p(a, r1, y1)], c);
      else tri(plain, [p(a, r0, y0), p(b, r0, y0), [x, y1, z]], c);
    }
    if (r1 > 0) { const top = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; top.push([x + Math.cos(a) * r1, z + Math.sin(a) * r1]); } cap([top], y1, c.map(v => v * .9)); }
  }
  // a site's measured frame: (u along the long axis, v to its left), metres -> world [x, z]
  function frameOf(site) {
    const f = site.frame, a = f.angle * Math.PI / 180, cx = wx(f.center[0]), cz = wy(f.center[1]);
    return (u, v) => [cx + (u * Math.cos(a) - v * Math.sin(a)) * M, cz + (-u * Math.sin(a) - v * Math.cos(a)) * M];
  }
  function baseOf(points) { let lo = Infinity; for (const [x, z] of points) lo = Math.min(lo, heightAt(x, z)); return lo; }

  // ---- hand models -----------------------------------------------------------------------------
  const animated = [];                                    // textures whose offset moves with time
  const siteRings = site => (site.outline || []).map(ringPts);
  // outer rings of an outline (a relation may list several outers and inners)
  const outerRings = (site, all = siteRings(site)) => all.filter((r, i) => i === 0 || Math.abs(area(r)) > Math.abs(area(all[0])) * .02 && !all.slice(0, i).some(o => insideRing(r[0], o)));
  function insideRing([x, z], pts) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[j];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c;
    }
    return c;
  }
  // gabled roof over the rectangle [s0, s1] x [t0, t1] of an axes() frame, with gables in the wall's facade
  function gableRoof(frame, s0, s1, t0, t1, y, rise, roofHex, wallKind, wallHex, overhang = .6 * M) {
    const { at } = frame, tm = (t0 + t1) / 2, c = linear(roofHex), w = linear(wallHex);
    const P = (s, t, h) => { const [x, z] = at(s, t); return [x, h, z]; };
    const o = overhang, e = y - .2 * K;
    quad(plain, [P(s0 - o, t0 - o, e), P(s1 + o, t0 - o, e), P(s1 + o, tm, y + rise), P(s0 - o, tm, y + rise)], c);
    quad(plain, [P(s1 + o, t1 + o, e), P(s0 - o, t1 + o, e), P(s0 - o, tm, y + rise), P(s1 + o, tm, y + rise)], c);
    const [bay, storey] = TILE[wallKind] || [3, 3.5], b = bucket(wallKind);
    for (const s of [s0, s1]) tri(b, [P(s, t0, y), P(s, t1, y), P(s, tm, y + rise)], w,
      [[0, 0], [(t1 - t0) / (bay * M), 0], [(t1 - t0) / (bay * M) / 2, rise / (storey * K)]]);
  }

  const MODELS = {
    // A big brick church on its real outline (a cross or a plain hall): walls with tall arched
    // windows, a steep gabled roof over each arm of the cross, and a tower with a tiered cap and a
    // spire on one arm's end. Spec: wall, roof, height (m), tower: "north" | "east" | "south" |
    // "west" (the arm it stands on), towerTop (m, top of the masonry), spire (m, tip), cap.
    church(site) {
      const rings = outerRings(site), pts = ccw(rings[0]), base = baseOf(pts);
      const wallHex = site.wall || '#9b4c3c', roofHex = site.roof || '#474a4d', H = site.height || 15;
      walls('church', pts, base - 1.5, base + H * K, linear(wallHex));
      const fr = axes(pts), { s0, s1, t0, t1, at } = fr;
      // the arms: the cross section along the long axis is the width of its ends, and the other way round
      const sOf = ([x, z]) => x * fr.dx + z * fr.dz, tOf = ([x, z]) => -x * fr.dz + z * fr.dx, eps = 1.5 * M;
      const endT = pts.filter(p => Math.abs(sOf(p) - s0) < eps || Math.abs(sOf(p) - s1) < eps).map(tOf);
      const endS = pts.filter(p => Math.abs(tOf(p) - t0) < eps || Math.abs(tOf(p) - t1) < eps).map(sOf);
      const ta0 = endT.length ? Math.min(...endT) : t0, ta1 = endT.length ? Math.max(...endT) : t1;
      const sb0 = endS.length ? Math.min(...endS) : s0, sb1 = endS.length ? Math.max(...endS) : s1;
      const top = base + H * K, steep = 1.05;
      gableRoof(fr, s0, s1, ta0, ta1, top, (ta1 - ta0) / 2 * steep, roofHex, 'church', wallHex);
      const cross = (sb1 - sb0) < (s1 - s0) * .9 || (ta1 - ta0) < (t1 - t0) * .9;
      if (cross) {
        // the transverse arm: its own frame, with s and t swapped
        const swapped = { at: (s, t) => at(t, s) };
        gableRoof(swapped, t0, t1, sb0, sb1, top, (sb1 - sb0) / 2 * steep, roofHex, 'church', wallHex);
      }
      // the tower: on the end of the arm facing site.tower, half inside the outline
      const dirs = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }, [ex, ez] = dirs[site.tower] || dirs.east;
      const ends = [[(sb0 + sb1) / 2, t0], [(sb0 + sb1) / 2, t1], [s0, (ta0 + ta1) / 2], [s1, (ta0 + ta1) / 2]].map(([s, t]) => ({ s, t, p: at(s, t) }));
      let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length;
      const end = ends.reduce((m, e) => ((e.p[0] - cx) * ex + (e.p[1] - cz) * ez > (m.p[0] - cx) * ex + (m.p[1] - cz) * ez ? e : m), ends[0]);
      const side = Math.min(9 * M, (cross ? Math.min(ta1 - ta0, sb1 - sb0) : t1 - t0) * .45), inward = side * .45;
      const len = Math.hypot(end.p[0] - cx, end.p[1] - cz) || 1, ux = (cx - end.p[0]) / len, uz = (cz - end.p[1]) / len;
      const tx = end.p[0] + ux * inward, tz = end.p[1] + uz * inward, vx = -uz, vz = ux, h = side / 2;
      const sq = r => [[tx + (ux + vx) * r, tz + (uz + vz) * r], [tx + (-ux + vx) * r, tz + (-uz + vz) * r], [tx + (-ux - vx) * r, tz + (-uz - vz) * r], [tx + (ux - vx) * r, tz + (uz - vz) * r]];
      const towerTop = base + (site.towerTop || H * 2) * K, spire = base + (site.spire || (site.towerTop || H * 2) + 16) * K, capHex = site.cap || roofHex;
      prism('church', [ccw(sq(h))], base, 0, (towerTop - base) / K, wallHex, wallHex);
      prism('brick', [ccw(sq(h * 1.08))], base, (towerTop - base) / K - 1.2, (towerTop - base) / K, '#e9e2d6', '#e9e2d6');   // cornice
      // baroque cap: a flared bell, a small open lantern and the spire with a ball
      const capH = (spire - towerTop) * .32;
      cone(tx, tz, towerTop, towerTop + capH * .55, h * 1.12, h * .62, capHex, 8);
      cone(tx, tz, towerTop + capH * .55, towerTop + capH, h * .62, h * .3, capHex, 8);
      cone(tx, tz, towerTop + capH, towerTop + capH * 1.45, h * .32, h * .32, '#e9e2d6', 8);
      cone(tx, tz, towerTop + capH * 1.45, spire, h * .36, 0, capHex, 8);
      cone(tx, tz, spire - .2 * K, spire + .9 * K, .7 * M, .7 * M, '#d9b45a', 6);
      // clock faces under the cornice, on the tower's four sides
      for (const [nx, nz] of [[ux, uz], [-ux, -uz], [vx, vz], [-vx, -vz]]) {
        disc(tx + nx * h, towerTop - 3 * K, tz + nz * h, nx, nz, 1.6 * K, '#f3ead2', 12);
      }
    },
    // A building the plain data lacks, on its real outline (courtyards included): walls in the
    // spec's facade and colour, a flat roof with a parapet. Spec: facade, wall, roof, height (m).
    outline(site) {
      const all = siteRings(site), outers = outerRings(site, all), base = baseOf(outers.flat());
      const H = site.height || 10, wallHex = site.wall || '#d8d4cc';
      const holes = all.filter(r => !outers.includes(r));
      for (const outer of outers) {
        const mine = holes.filter(r => Math.abs(area(r)) > 1 && insideRing(r[0], outer));
        prism(site.facade || 'classic', [outer, ...mine], base, 0, H, wallHex, site.roof || shadeHex(wallHex, .7));
        for (const r of [outer, ...mine]) walls(site.facade || 'classic', r.map(([x, z]) => [x, z]), base + H * K, base + (H + .8) * K, shade(wallHex, .9));
      }
    },
    // Rapids and waterfalls on a river: white water streaming down the river (faster where it is
    // steeper), a foaming step across the river at each fall, and boulders breaking the surface.
    // From the bake: line = [[lon, lat, left m, right m], ...] downstream; falls = [[lon, lat], ...].
    rapids(site) {
      const line = site.line.map(([lon, lat, l, r]) => ({ x: wx(lon), z: wy(lat), l: l * M * .94, r: r * M * .94 }));
      const n = line.length;
      for (let i = 0; i < n; i++) {
        const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)], len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        line[i].dx = (b.x - a.x) / len; line[i].dz = (b.z - a.z) / len;
      }
      const falls = (site.falls || []).map(([lon, lat]) => [wx(lon * 1e5), wy(lat * 1e5)]);
      const nearFall = (x, z) => falls.reduce((m, [fx, fz]) => Math.min(m, Math.hypot(x - fx, z - fz)), Infinity);
      const ACROSS = 6, position = [], colour = [], uv = [], index = [];
      let v = 0;
      line.forEach((p, i) => {
        if (i) {
          const q = line[i - 1], ds = Math.hypot(p.x - q.x, p.z - q.z), slope = Math.max(0, heightAt(q.x, q.z) - heightAt(p.x, p.z)) / (ds || 1);
          v += ds / (18 * M) / (1 + slope * 8);                // steeper: the streaks race
        }
        const fall = clamp(1 - nearFall(p.x, p.z) / (30 * M), 0, 1), ends = Math.min(i, n - 1 - i) / 3;
        for (let k = 0; k <= ACROSS; k++) {
          const f = k / ACROSS, off = -p.l + (p.l + p.r) * f;          // left bank to right bank
          const x = p.x - p.dz * off, z = p.z + p.dx * off;
          position.push(x, heightAt(x, z) + .7, z);
          const edge = Math.min(f, 1 - f) * ACROSS / 2;
          colour.push(1, 1, 1, clamp(.62 + fall * .38, 0, 1) * clamp(edge, .35, 1) * clamp(ends, 0, 1));
          uv.push(off / (14 * M), v);
        }
        if (i) for (let k = 0; k < ACROSS; k++) {
          const a = (i - 1) * (ACROSS + 1) + k, b = a + 1, c = a + ACROSS + 1, d = c + 1;
          index.push(a, c, b, b, c, d);
        }
      });
      const foam = foamTexture(), geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colour, 4));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(index);
      const material = new THREE.MeshBasicMaterial({ map: foam, vertexColors: true, transparent: true, depthWrite: false, forceSinglePass: true, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
      const mesh = new THREE.Mesh(geo, material);
      mesh.renderOrder = 8;
      scene.add(mesh); extraMeshes.push(mesh);
      animated.push({ texture: foam, speed: .55 });
      // each fall: a white step across the river, over its full width, racing faster
      const fallFoam = foamTexture(true), fallMat = material.clone();
      fallMat.map = fallFoam;
      animated.push({ texture: fallFoam, speed: 1.6 });
      const fp = [], fc = [], fu = [], fi = [];
      for (const [fx, fz] of falls) {
        const p = line.reduce((m, q) => (Math.hypot(q.x - fx, q.z - fz) < Math.hypot(m.x - fx, m.z - fz) ? q : m), line[0]);
        // soft-edged: the churn is brightest on the lip and fades upstream, downstream and at the banks
        const ROWS = 4, half = 6 * M, base0 = fp.length / 3, lip = [.15, 1, .8, .45, 0];
        for (let j = 0; j <= ROWS; j++) {
          const along = -half + j * 2 * half / ROWS, cx = fx + p.dx * along, cz = fz + p.dz * along;
          for (let k = 0; k <= ACROSS; k++) {
            const f = k / ACROSS, off = -p.l + (p.l + p.r) * f, x = cx - p.dz * off, z = cz + p.dx * off;
            fp.push(x, heightAt(x, z) + 1 - j * .06, z);
            fc.push(1, 1, 1, lip[j] * clamp(Math.min(f, 1 - f) * ACROSS, .3, 1));
            fu.push(off / (10 * M), j * .18);
          }
        }
        for (let j = 0; j < ROWS; j++) for (let k = 0; k < ACROSS; k++) {
          const a = base0 + j * (ACROSS + 1) + k, b = a + 1, c = a + ACROSS + 1, d = c + 1;
          fi.push(a, c, b, b, c, d);
        }
        // boulders breaking the surface around the fall (seeded, the same every visit)
        let seed = Math.round(fx * 13 + fz * 7) >>> 0 || 1;
        const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let r = 0; r < 9; r++) {
          const along = (rand() - .5) * 24 * M, off = -p.l + (p.l + p.r) * rand(), x = fx + p.dx * along - p.dz * off, z = fz + p.dz * along + p.dx * off;
          const size = (1.4 + rand() * 1.8) * M, y = heightAt(x, z);
          cone(x, z, y - .5, y + 1.2 + size * 1.1, size, size * .35, rand() < .5 ? '#8d8b86' : '#76746f', 5);
        }
      }
      if (fp.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(fc, 4));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
        g.setIndex(fi);
        const m = new THREE.Mesh(g, fallMat);
        m.renderOrder = 9;
        scene.add(m); extraMeshes.push(m);
      }
    },
    // Oslo Opera House (Snøhetta, 2008): white marble roof rising from the fjord to a plateau, the
    // glazed main hall above it, the stage towers (35 m and 25 m) and the aluminium-clad workshops.
    // Dimensions from its OSM outline and parts (u east along the building, v north).
    opera(site) {
      const f = frameOf(site), corners = [f(-114, -65), f(112, -65), f(112, 57), f(-114, 57)], base = baseOf(corners);
      const marble = '#f5f3ee', H = 16;
      const height = (u, v) => Math.max(.4, Math.min(H, H * (u + 112) / 67, H * (v + 66) / 26));
      // the marble landscape as a height field (4 m cells) with vertical edges where it meets the land
      const U0 = -112, U1 = 40, V0 = -66, V1 = 24, S = 4, nu = Math.round((U1 - U0) / S), nv = Math.round((V1 - V0) / S);
      const P = (i, j) => { const u = U0 + (U1 - U0) * i / nu, v = V0 + (V1 - V0) * j / nv, [x, z] = f(u, v); return [x, base + height(u, v) * K, z]; };
      const m = linear(marble);
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
        tri(plain, [a, c, b], m); tri(plain, [a, d, c], m);
      }
      const edge = [];
      for (let i = 0; i <= nu; i++) edge.push(P(i, 0));
      for (let j = 1; j <= nv; j++) edge.push(P(nu, j));
      for (let i = nu - 1; i >= 0; i--) edge.push(P(i, nv));
      for (let j = nv - 1; j > 0; j--) edge.push(P(0, j));
      for (let i = 0; i < edge.length; i++) {
        const a = edge[i], b = edge[(i + 1) % edge.length];
        quad(plain, [[a[0], base - 1.5, a[2]], [b[0], base - 1.5, b[2]], b, a], shade(marble, .9));
      }
      box('glass', f, -45, 0, -38, 22, base, 0, 23, '#5a81a0', marble);           // main hall, glazed
      box('aluminium', f, 0, 86, -40, 56, base, 0, 20, '#d4d6d3', '#bfc2c0');    // workshops
      box('aluminium', f, 55, 109, 3, 57, base, 0, 15, '#d4d6d3', '#bfc2c0');
      box('aluminium', f, -72, -3, 24, 57, base, 0, 11, '#dcdcd8', '#c6c6c2');
      box('aluminium', f, 0, 27, -30, 3, base, 0, 35, '#e7e4dd', '#cfccc5');     // main stage tower, white aluminium
      box('aluminium', f, 27, 50, 14, 39, base, 0, 25, '#e7e4dd', '#cfccc5');    // second stage tower
    },
    // MUNCH (Estudio Herreros, 2021): a 60 m tower in perforated aluminium on a wider base, its top
    // bending over towards the city (the sideways step the OSM parts record, made a smooth bend).
    munch(site) {
      const f = frameOf(site);
      const base = baseOf(site.parts.flatMap(p => ringPts(p.rings[0])));
      for (const p of site.parts.filter(q => q.max <= 15)) prism('glass', p.rings.map(ringPts), base, 0, p.max, '#9fb0b8', '#c8ccce');
      const v0 = -4.3, v1 = 19.3, u0 = -33.9, u1 = 32.8, colour = linear('#d5d8d9');
      // the OSM parts step 5 m sideways at 37 m and 7.5 m at 50 m: a bend at 37 m, leaning ~21°
      const levels = [0, 37, 60];
      const lean = h => (h <= 37 ? 0 : -9 * (h - 37) / 23);
      const ring = h => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => { const [x, z] = f(u, v + lean(h)); return [x, h ? base + h * K : base - 1.5, z]; });
      const b = bucket('munch'), [bay, storey] = TILE.munch;
      for (let k = 0; k < levels.length - 1; k++) {
        const lo = ring(levels[k]), hi = ring(levels[k + 1]);
        let run = 0;
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4, len = Math.hypot(lo[j][0] - lo[i][0], lo[j][2] - lo[i][2]);
          const ua = run / (bay * M), ub = (run + len) / (bay * M), va = levels[k] / storey, vb = levels[k + 1] / storey;
          quad(b, [lo[i], lo[j], hi[j], hi[i]], colour, [[ua, va], [ub, va], [ub, vb], [ua, vb]]);
          run += len;
        }
      }
      const top = ring(60);
      quad(plain, [top[0], top[3], top[2], top[1]], linear('#b9bdbf'));
    },
    // Astrup Fearnley Museet (Renzo Piano, 2012): two timber-clad halls under sweeping glass sail
    // roofs that fall towards the tip of Tjuvholmen.
    astrup(site) {
      const f = frameOf(site), a = site.frame.angle * Math.PI / 180;
      const base = baseOf(site.outline.flatMap(ringPts));
      const toLocal = ([x, z]) => { const cx = wx(site.frame.center[0]), cz = wy(site.frame.center[1]), dx = (x - cx) / M, dz = (z - cz) / M; return [dx * Math.cos(a) - dz * Math.sin(a), -dx * Math.sin(a) - dz * Math.cos(a)]; };
      for (const flat of site.outline) {
        const pts = ccw(ringPts(flat)), local = pts.map(toLocal);
        const us = local.map(p => p[0]), vs = local.map(p => p[1]);
        const ua = Math.min(...us), ub = Math.max(...us), va = Math.min(...vs), vb = Math.max(...vs);
        const big = ub - ua > 60 || (ua + ub) / 2 > 0;                // the hall to the north is the taller one
        const wallTop = big ? 12 : 6, hiRoof = big ? 22 : 12, loRoof = big ? 12 : 4;
        prism('timber', [pts], base, 0, wallTop, '#c9a678', '#b8956a');
        // the sail: a curved glass sheet over the hall, overhanging by 3 m, highest at the north end
        const n = 10, m = 4, glass = linear('#c3d6de'), rib = linear('#f2f2ee');
        const U = i => ua - 3 + (ub - ua + 6) * i / n, V = j => va - 3 + (vb - va + 6) * j / m;
        const hAt = (i, j) => { const t = i / n; return loRoof + (hiRoof - loRoof) * t * t * (3 - 2 * t) + Math.sin(Math.PI * j / m) * 1.2; };
        const Q = (i, j) => { const [x, z] = f(U(i), V(j)); return [x, base + hAt(i, j) * K, z]; };
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) quad(plain, [Q(i, j), Q(i + 1, j), Q(i + 1, j + 1), Q(i, j + 1)], (i + j) % 2 ? glass : glass.map(v => v * .96));
        for (let i = 0; i <= n; i += 2) for (let j = 0; j < m; j++) { const p = Q(i, j), q = Q(i, j + 1); quad(plain, [p, q, [q[0], q[1] + .5, q[2]], [p[0], p[1] + .5, p[2]]], rib); }
      }
    },
    // Frammuseet: the two tent-like A-frame halls on Bygdøynes (the polar ships Fram and Gjøa).
    fram(site) {
      const base = baseOf(site.parts.flatMap(p => ringPts(p.rings[0])));
      for (const p of site.parts.filter(q => q.max >= 15)) {
        const pts = ccw(ringPts(p.rings[0])), { s0, s1, t0, t1, at } = axes(pts), tm = (t0 + t1) / 2;
        const eave = base + 2 * K, top = base + p.max * K, roofC = linear('#4f565e'), wall = linear('#ebe6dc');
        const Pt = (s, t, y) => { const [x, z] = at(s, t); return [x, y, z]; };
        quad(plain, [Pt(s0, t0, eave), Pt(s1, t0, eave), Pt(s1, tm, top), Pt(s0, tm, top)], roofC);
        quad(plain, [Pt(s1, t1, eave), Pt(s0, t1, eave), Pt(s0, tm, top), Pt(s1, tm, top)], roofC);
        for (const s of [s0, s1]) {
          tri(bucket('glass'), [Pt(s, t0, eave), Pt(s, t1, eave), Pt(s, tm, top)], wall, [[0, 0], [(t1 - t0) / (3 * M), 0], [(t1 - t0) / (6 * M), (top - eave) / (3.6 * K)]]);
        }
        walls('timber', [[...at(s0, t0)], [...at(s1, t0)], [...at(s1, t1)], [...at(s0, t1)]], base - 1.5, eave, wall);
      }
    },
    // Monolitten in Vigelandsparken: a 14 m granite column on a stepped plinth ringed by 36 figure groups.
    monolitten(site) {
      const x = wx(site.frame.center[0]), z = wy(site.frame.center[1]), base = heightAt(x, z), granite = '#c2bdb3';
      let y = base - 1.5, top = base;
      for (const r of [24, 18, 12]) { top += 1.2 * K; cone(x, z, y, top, r * M, r * M, granite, 16); y = top; }
      cone(x, z, y, y + 14.1 * K, 1.7 * M, 1.3 * M, '#bab4a8', 12);
      cone(x, z, y + 14.1 * K, y + 14.9 * K, 1.3 * M, 0, '#bab4a8', 12);
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * Math.PI * 2, gx = x + Math.cos(a) * 15 * M, gz = z + Math.sin(a) * 15 * M, gy = base + 1.2 * K;
        cone(gx, gz, gy, gy + 2.4 * K, 1.3 * M, .7 * M, '#b3ada2', 5);
      }
    },
    // ---- Molde ----------------------------------------------------------------------------------
    // Aker Stadion (Kjell Kosberg, 1998): one continuous two-tier bowl with rounded corners on the
    // real OSM ring (outer = facade, inner = pitch edge), granite-and-glass facade, blue seats, and
    // the dark grey roof curving up from the facade top and out over the stands. Sampled by rays
    // from the pitch centre, so both rings line up; heights in metres above the pitch.
    stadium(site) {
      const all = siteRings(site), outer = ccw(all[0]), inner = ccw(all[1] || all[0]);
      let cx = 0, cz = 0; for (const p of inner) { cx += p[0]; cz += p[1]; } cx /= inner.length; cz /= inner.length;
      const hit = (ring, a) => {                          // farthest crossing of the ray from the centre
        const dx = Math.cos(a), dz = Math.sin(a); let best = 0;
        for (let i = 0; i < ring.length; i++) {
          const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], ex = bx - ax, ez = bz - az;
          const den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
          const t = ((ax - cx) * ez - (az - cz) * ex) / den, s = ((ax - cx) * dz - (az - cz) * dx) / den;
          if (t > 0 && s >= 0 && s <= 1) best = Math.max(best, t);
        }
        return best;
      };
      const N = 96, rays = [];
      for (let i = 0; i < N; i++) { const a = -i / N * Math.PI * 2; rays.push([a, hit(inner, a), hit(outer, a)]); }
      let ground = Infinity, pitchTop = -Infinity;
      for (const p of outer) ground = Math.min(ground, heightAt(p[0], p[1]));
      for (const p of inner) pitchTop = Math.max(pitchTop, heightAt(p[0], p[1]));
      const pitch = pitchTop + .3 * K;
      const at = (i, f, h) => { const [a, ri, ro] = rays[i % N], r = ri + (ro - ri) * f; return [cx + Math.cos(a) * r, pitch + h * K, cz + Math.sin(a) * r]; };
      const band = (f0, h0, f1, h1, hex) => { const c = linear(hex); for (let i = 0; i < N; i++) quad(plain, [at(i, f0, h0), at(i + 1, f0, h0), at(i + 1, f1, h1), at(i, f1, h1)], c); };
      const ST = site.standTop || 13.5, FT = site.facadeTop || 10, RT = site.roofTop || 18, seats = site.seats || '#2f62ad', grey = '#a9aaa6';
      // pitch: a flat green cap on the inner ring, with the markings 0.3 m above it
      cap([inner], pitch, linear('#3e8a43'));
      const pf = axes(inner), pu = (pf.s0 + pf.s1) / 2, pv = (pf.t0 + pf.t1) / 2, white = linear('#f4f4ef'), ly = pitch + .3 * K, lw = .5 * M;
      const P = (s, t) => { const [x, z] = pf.at(pu + s * M, pv + t * M); return [x, ly, z]; };
      const line = (s0, t0, s1, t1) => { const l = Math.hypot(s1 - s0, t1 - t0) || 1, ns = -(t1 - t0) / l * lw / M, nt = (s1 - s0) / l * lw / M;
        quad(plain, [P(s0 - ns, t0 - nt), P(s0 + ns, t0 + nt), P(s1 + ns, t1 + nt), P(s1 - ns, t1 - nt)], white); };
      const L = 52.5, W = 34;
      line(-L, -W, L, -W); line(L, -W, L, W); line(L, W, -L, W); line(-L, W, -L, -W); line(0, -W, 0, W);
      for (const e of [-1, 1]) { line(e * L, -20.15, e * (L - 16.5), -20.15); line(e * (L - 16.5), -20.15, e * (L - 16.5), 20.15); line(e * (L - 16.5), 20.15, e * L, 20.15); }
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, b = (i + 1) / 24 * Math.PI * 2; line(Math.cos(a) * 9.15, Math.sin(a) * 9.15, Math.cos(b) * 9.15, Math.sin(b) * 9.15); }
      // pitch wall, lower tier, walkway, upper tier
      for (let i = 0; i < N; i++) quad(plain, [at(i, 0, -2), at(i + 1, 0, -2), at(i + 1, 0, 1.2), at(i, 0, 1.2)], linear('#e6e6e2'));
      band(0, 1.2, .03, 1.2, grey);
      band(.03, 1.2, .42, 7, seats);
      band(.42, 7, .47, 7, grey);
      band(.47, 7.6, .8, ST, seats);
      for (let i = 0; i < N; i++) quad(plain, [at(i, .47, 7), at(i + 1, .47, 7), at(i + 1, .47, 7.6), at(i, .47, 7.6)], linear('#d9d9d4'));
      band(.8, ST, 1, ST, grey);
      // facade on the outer ring, from the ground up to the roof's foot
      const facade = []; for (let i = 0; i < N; i++) { const p = at(i, 1, 0); facade.push([p[0], p[2]]); }
      walls('aluminium', facade.slice().reverse(), ground - 1.5, pitch + FT * K, linear(site.facade || '#cfd0cc'));
      // the curved roof: up from the facade top, nearly flat over the upper tier, out over the seats
      const roofHex = site.roof || '#5d6266', prof = [[1, FT], [.94, FT + (RT - FT) * .55], [.84, RT - 1.2], [.66, RT - .2], [.44, RT], [.2, RT - .5]];
      for (let k = 0; k < prof.length - 1; k++) band(prof[k][0], prof[k][1], prof[k + 1][0], prof[k + 1][1], k % 2 ? roofHex : shadeHex(roofHex, 1.06));
      band(.2, RT - .5, .2, RT - 1.5, '#e8e8e4');         // white fascia on the roof's front edge
    },
    // Scandic Seilet (Kjell Kosberg, 2002): the 16-storey glass hotel shaped like a sail, standing
    // on piles in the fjord. Its real outline tapers towards the prow as it rises, so the prow edge
    // stays vertical (the luff, with the mast in front of it) and the other faces lean in; the mast
    // reaches 82 m. Spec: height (m, roof), mast (m), prow [lon, lat], taper (top shrink, 0-1).
    seilet(site) {
      const pts = ccw(ringPts(site.outline[0])), base = baseOf(pts), H = site.height || 54, T = site.taper ?? .45;
      const px = wx(site.prow[0] * 1e5), pz = wy(site.prow[1] * 1e5);
      const levels = [0, .2, .4, .6, .8, 1];
      const ringAt = f => { const s = 1 - T * Math.pow(f, 1.4); return pts.map(([x, z]) => [px + (x - px) * s, f ? base + f * H * K : base - 1.5, pz + (z - pz) * s]); };
      const b = bucket('glass'), [bay, storey] = TILE.glass, colour = linear('#a8c3d3');
      for (let k = 0; k < levels.length - 1; k++) {
        const lo = ringAt(levels[k]), hi = ringAt(levels[k + 1]);
        let run = 0;
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length, len = Math.hypot(lo[j][0] - lo[i][0], lo[j][2] - lo[i][2]);
          const ua = run / (bay * M), ub = (run + len) / (bay * M), va = levels[k] * H / storey, vb = levels[k + 1] * H / storey;
          quad(b, [lo[i], lo[j], hi[j], hi[i]], colour, [[ua, va], [ub, va], [ub, vb], [ua, vb]]);
          run += len;
        }
      }
      const top = ringAt(1).map(p => [p[0], p[2]]);
      cap([top], base + H * K, linear('#bdb8ad'));
      walls('aluminium', top, base + H * K, base + (H + 1.2) * K, linear('#e2e2de'));   // roof rim
      // the mast, a metre off the prow, with three pairs of spreaders
      let ox = 0, oz = 0; for (const p of pts) { ox += p[0]; oz += p[1]; } ox /= pts.length; oz /= pts.length;
      const d = Math.hypot(px - ox, pz - oz) || 1, ux = (px - ox) / d, uz = (pz - oz) / d, mx = px + ux * 1.2 * M, mz = pz + uz * 1.2 * M;
      cone(mx, mz, base, base + (site.mast || 82) * K, .55 * M, .25 * M, '#f2f2ee', 6);
      for (const h of [H + 6, H + 12, H + 17]) {
        const y = base + h * K, w = 3.2 * M, c = linear('#f2f2ee');
        quad(plain, [[mx - uz * w, y, mz + ux * w], [mx + uz * w, y, mz - ux * w], [mx + uz * w, y + .5 * K, mz - ux * w], [mx - uz * w, y + .5 * K, mz + ux * w]], c);
      }
    },
    // Molde domkirke (Finn Bryn, 1957): a white concrete long church. Its outline is built low
    // (foyer, north wing, buttressed south wall), the nave rises above it under a steep red tile roof
    // from the west gable with its rose window to the apse in the east. Nave rectangle in the
    // measured frame (metres): from the bake's frame of OSM w310662273.
    domkirke(site) {
      const pts = ccw(ringPts(site.outline[0])), base = baseOf(pts), wallHex = site.wall || '#f1efe8', roofHex = site.roof || '#c4532f';
      const E = site.eaves || 13, R = site.ridge || 25, low = 8;
      prism('church', [pts], base, 0, low, wallHex, '#9a9790');
      const f = frameOf(site), [u0, u1, v0, v1] = site.nave || [-20.7, 26, -18, -1.5];
      const fr = { at: (s, t) => f(s / M, t / M) };
      box('church', f, u0, u1, v0, v1, base, low - .5, E, wallHex, wallHex);
      gableRoof(fr, u0 * M, u1 * M, v0 * M, v1 * M, base + E * K, (R - E) * K, roofHex, 'church', wallHex);
      // the apse: a half-round under a conical roof at the east end
      const [ax, az] = f(u1 - .5, -12);
      cone(ax, az, base + low * K, base + (low + 6) * K, 6 * M, 0, roofHex, 12);
      // rose window high in the west gable
      const [wx0, wz0] = f(u0, (v0 + v1) / 2), [wx1, wz1] = f(u0 - 1, (v0 + v1) / 2);
      disc(wx0, base + (E + 4) * K, wz0, (wx1 - wx0) / M, (wz1 - wz0) / M, 2.3 * M, '#55646e', 16);
    },
    // The free-standing campanile (50 m, OSM w230972703): a white square shaft with pilasters, a
    // dark stone base storey, two balconies, the open bell storey, then a steep copper pyramid (25 m)
    // with a clock gable on each side and a gilded ball.
    campanile(site) {
      const pts = ccw(ringPts(site.outline[0])), base = baseOf(pts), H = site.height || 50, RH = site.roofHeight || 25, shaft = H - RH;
      const wallHex = site.wall || '#f1efe8', cap = site.cap || '#5f8a74';
      walls('brick', pts, base - 1.5, base + 6 * K, linear('#6f6a64'));
      prism('alabaster', [pts], base, 6, shaft, wallHex, '#d8d6d0');
      let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length;
      const grow = k => pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
      for (const h of [8, shaft - 4]) prism('aluminium', [grow(1.12)], base, h, h + .5, '#3d3b39', '#3d3b39');   // balconies
      roof('pyramid', grow(1.04), base + shaft * K, RH * K, cap);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const mx0 = (a[0] + b[0]) / 2 - cx, mz0 = (a[1] + b[1]) / 2 - cz, ml = Math.hypot(mx0, mz0) || 1, nx = mx0 / ml, nz = mz0 / ml, o = .55 * M;
        const out = (p, k = 1) => [cx + (p[0] - cx) * 1.04 + nx * o * k, cz + (p[1] - cz) * 1.04 + nz * o * k];
        if (len < 1e-6) continue;
        const A = out(a), B = out(b), mxz = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], y = base + shaft * K;
        tri(plain, [[A[0], y, A[1]], [B[0], y, B[1]], [mxz[0], y + 5.5 * K, mxz[1]]], linear(cap));
        disc(mxz[0], y + 2.2 * K, mxz[1], nx, nz, 1.4 * M, '#f3efe4', 12);
      }
      cone(cx, cz, base + (H - .4) * K, base + (H + 1) * K, .6 * M, .6 * M, '#d9b45a', 6);
    },
  };

  // ---- sites built from their OSM parts ----------------------------------------------------------
  for (const site of data.sites) {
    stats.sites++;
    stats.names.push(site.name);
    if (site.build === 'model') {
      const model = MODELS[site.model || site.id];
      if (model) model(site); else console.warn(`No landmark model "${site.model || site.id}" for ${site.name}`);
      continue;
    }
    const parts = site.parts || [];
    const base = baseOf(parts.flatMap(p => ringPts(p.rings[0])));
    const tallest = parts.reduce((m, p) => (p.max > (m?.max ?? -1) ? p : m), null);
    parts.forEach((p, i) => {
      let kind = site.facade || 'glass', wallHex = colourOf(p.colour, site.colour || '#d8d4cc');
      if (site.facade === 'barcode') {           // Barcode: each tower in its own skin
        kind = ['glass', 'stripes', 'dark', 'tower', 'glass', 'aluminium'][i % 6];
        wallHex = ['#8fa6b4', '#e8e6e1', '#53606b', '#dcdad5', '#a8b8c2', '#d6d8d6'][i % 6];
      }
      if (site.extras === 'light-hall' && p === tallest) { kind = 'alabaster'; wallHex = '#efe8d6'; }
      if (site.id === 'domkirke') kind = wallHex === '#b2cb65' ? 'alabaster' : 'church';   // copper tower top, arched windows
      const roofHex = site.extras === 'castle-roofs' || site.extras === 'portico' ? null : undefined;
      prism(kind, p.rings.map(ringPts), base, p.min, p.max, wallHex, roofHex);
      stats.parts++;
    });
    if (site.extras === 'castle-roofs') {
      // steep roofs: pyramids on the near-square towers, gables on the long wings
      for (const p of parts) {
        const pts = ringPts(p.rings[0]), { s0, s1, t0, t1 } = axes(pts), long = (s1 - s0) / Math.max(1e-6, t1 - t0);
        if (p.max < 12 || (s1 - s0) / M > 70) continue;
        const tower = long < 1.5 && (s1 - s0) / M < 20;
        roof(tower ? 'pyramid' : long < 1.5 ? 'hipped' : 'gabled', pts, base + p.max * K, ((t1 - t0) / 2) * (tower ? 1.6 : 1.1), tower ? '#6f9a85' : '#5b6466');
      }
    }
    if (site.extras === 'portico') {
      // low hipped zinc roofs, and the columned portico with its pediment on the main front (east)
      for (const p of parts.filter(q => q.min > 0)) { const pts = ringPts(p.rings[0]); roof('hipped', pts, base + p.max * K, (axes(pts).t1 - axes(pts).t0) * .18, '#7d8790'); }
      const main = parts.filter(q => q.min > 0).sort((a, b) => b.max - a.max || b.rings[0].length - a.rings[0].length)[0];
      if (main) {
        const pts = ringPts(main.rings[0]), { s0, s1, t0, t1, at } = axes(pts);
        // the long side facing east (+x), towards Karl Johans gate
        const sm = (s0 + s1) / 2, east = at(sm, t1)[0] > at(sm, t0)[0] ? t1 : t0, out = east === t1 ? 1 : -1;
        const y0 = base + main.min * K, y1 = base + (main.max - 4) * K, depth = 6 * M;
        for (let c = -2.5; c <= 2.5; c++) {
          const [cx, cz] = at(sm + c * 3.2 * M, east + out * (depth - .8 * M));
          cone(cx, cz, y0, y1, .75 * M, .65 * M, '#f7f1de', 10);
        }
        const A = at(sm - 9.5 * M, east), B = at(sm + 9.5 * M, east), C = at(sm + 9.5 * M, east + out * depth), D = at(sm - 9.5 * M, east + out * depth);
        prism('classic', [[A, B, C, D]], base, main.max - 4, main.max - 2.6, '#f7f1de');
        const peak = base + (main.max + .8) * K, ridgeA = at(sm, east), ridgeB = at(sm, east + out * depth), lo = base + (main.max - 2.6) * K;
        const c = linear('#f3ecd6');
        tri(plain, [[C[0], lo, C[1]], [D[0], lo, D[1]], [ridgeB[0], peak, ridgeB[1]]], c);
        quad(plain, [[D[0], lo, D[1]], [A[0], lo, A[1]], [ridgeA[0], peak, ridgeA[1]], [ridgeB[0], peak, ridgeB[1]]], shade('#7d8790', 1));
        quad(plain, [[B[0], lo, B[1]], [C[0], lo, C[1]], [ridgeB[0], peak, ridgeB[1]], [ridgeA[0], peak, ridgeA[1]]], shade('#7d8790', 1));
      }
    }
    if (site.extras === 'clocks') {
      // clock faces near the top of both towers, on all four sides
      for (const p of parts.filter(q => q.max >= 60)) {
        const pts = ccw(ringPts(p.rings[0])), y = base + (p.max - 9) * K;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len < 8 * M) continue;
          const nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
          disc(mx, y, mz, nx, nz, 3.4 * K, '#2c2a28');
          disc(mx + nx * .05, y, mz + nz * .05, nx, nz, 2.9 * K, '#f3ead2');
        }
      }
    }
    if (site.extras === 'spire') {
      // steep roofs over the nave, choir and transepts
      for (const p of parts.filter(q => q.min === 0 && q.max <= 25 && q.max >= 12)) {
        const pts = ringPts(p.rings[0]), { t0, t1 } = axes(pts);
        roof('gabled', pts, base + p.max * K, (t1 - t0) / 2 * 1.15, '#4e5559');
      }
    }
    // shallow domes on round halls (Stortinget's chambers)
    for (const p of parts) {
      const pts = ringPts(p.rings[0]);
      if (pts.length < 10) continue;
      let cx = 0, cz = 0, r = 0;
      for (const [x, z] of pts) { cx += x; cz += z; }
      cx /= pts.length; cz /= pts.length;
      for (const [x, z] of pts) r = Math.max(r, Math.hypot(x - cx, z - cz));
      if (Math.abs(area(pts)) / (Math.PI * r * r) < .85) continue;
      const y = base + p.max * K;
      cone(cx, cz, y, y + r * .22, r, r * .55, '#a8916a', 16);
      cone(cx, cz, y + r * .22, y + r * .34, r * .55, 0, '#a8916a', 16);
    }
    if (site.extras === 'spire' && tallest) {
      // the copper spire above the clock tower
      const pts = ringPts(tallest.rings[0]);
      let cx = 0, cz = 0, r = 0;
      for (const [x, z] of pts) { cx += x; cz += z; }
      cx /= pts.length; cz /= pts.length;
      for (const [x, z] of pts) r = Math.max(r, Math.hypot(x - cx, z - cz));
      const y = base + tallest.max * K;
      cone(cx, cz, y, y + 16 * K, r * .9, 0, '#7fae8c', 8);
      cone(cx, cz, y + 16 * K, y + 18 * K, .3 * M, .3 * M, '#d7b65a', 4);
    }
  }

  // ---- one mesh per material ---------------------------------------------------------------------
  const meshes = [];
  for (const [kind, b] of buckets) {
    if (!b.vertices) continue;
    const material = kind === 'plain' ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ map: facadeTexture(kind), color: wallTint, vertexColors: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(cartoon.geometry(b), material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.renderOrder = 19;                 // with the buildings (20), counted apart from them
    mesh.userData.landmarks = true;
    scene.add(mesh);
    meshes.push(mesh);
  }
  meshes.push(...extraMeshes);
  // moving water: streaks drift downstream (one texture offset per frame, nothing rebuilt)
  const update = time => { for (const a of animated) a.texture.offset.y = -(time * a.speed) % 1; };
  return { meshes, stats, update: animated.length ? update : null };
}

// White water: drifts of foam a few metres across, stretched downstream, on a faint white wash,
// tiling both ways (u: 14 m across the river, v: 18 m along it). `rough` is a fall's churning step.
function foamTexture(rough = false) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  let seed = rough ? 7 : 3;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = `rgba(255,255,255,${rough ? .55 : .16})`;
  g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < (rough ? 60 : 34); i++) {
    const x = rand() * 64, y = rand() * 256, w = (rough ? 5 : 4) + rand() * (rough ? 9 : 8), len = w * (1.8 + rand() * 2.2);
    g.fillStyle = `rgba(255,255,255,${(rough ? .6 : .5) + rand() * .4})`;
    for (const dx of [0, -64, 64]) for (const dy of [0, -256, 256]) { g.beginPath(); g.ellipse(x + dx, y + dy, w, len, 0, 0, Math.PI * 2); g.fill(); }
  }
  // fine streaks on top, so the moving water reads up close too
  g.fillStyle = 'rgba(255,255,255,.75)';
  for (let i = 0; i < 40; i++) { const x = rand() * 64, y = rand() * 256; g.fillRect(x, y, 1.5, 10 + rand() * 24); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/**
 * (x, z) => true where a landmark stands (its parts or modelled outline, plus `margin` world units):
 * trees were planted before these buildings were in the data, so the 3D view clears them here.
 */
export function landmarkClearance(data, wx, wy, margin = 6) {
  const shapes = [];
  for (const site of data?.sites || []) {
    const rings = [...(site.parts || []).map(p => p.rings[0]), ...(site.outline || [])];
    if (site.id === 'monolitten') {               // the stepped plinth is 24 m across its radius
      const cx = site.frame.center[0], cy = site.frame.center[1], r = 26 / 1.113, k = Math.cos(cy / 1e5 * Math.PI / 180);
      rings.push(Array.from({ length: 24 }, (_, i) => [cx + Math.cos(i / 24 * Math.PI * 2) * r / k, cy + Math.sin(i / 24 * Math.PI * 2) * r]).flat());
    }
    for (const flat of rings) {
      if (flat.length < 6) continue;
      const pts = [];
      for (let i = 0; i < flat.length; i += 2) pts.push([wx(flat[i]), wy(flat[i + 1])]);
      const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
      shapes.push({ pts, x0: Math.min(...xs) - margin, x1: Math.max(...xs) + margin, z0: Math.min(...zs) - margin, z1: Math.max(...zs) + margin });
    }
  }
  const near = (x, z, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[j];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
      const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(x - ax - t * dx, z - az - t * dz) < margin) return true;
    }
    return inside;
  };
  return (x, z) => shapes.some(s => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && near(x, z, s.pts));
}

/** (x, z) => the roof height in metres of the landmark part standing there, or null. */
export function landmarkTop(data, wx, wy) {
  const parts = [];
  for (const site of data?.sites || []) {
    if (site.build !== 'parts') continue;
    for (const p of site.parts || []) {
      const flat = p.rings[0], pts = [];
      for (let i = 0; i < flat.length; i += 2) pts.push([wx(flat[i]), wy(flat[i + 1])]);
      parts.push({ pts, max: p.max });
    }
  }
  const inside = (x, z, pts) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[j];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c;
    }
    return c;
  };
  return (x, z) => {
    let top = null;
    for (const p of parts) if (inside(x, z, p.pts)) top = Math.max(top ?? 0, p.max);
    return top;
  };
}
