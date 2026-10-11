/**
 * Planet director: ONE planet carries over S00 -> S04 on one fixed WebGL2
 * canvas (plus a Canvas2D layer beneath it for the orb, halo, limb and core
 * outline). Each frame it locates the active scene, builds that scene's Frame
 * (scenes/frames.ts) and draws only when something changed. Consecutive scenes
 * agree at their seams. Stepped parts (intro clock, year/baseline/source
 * crossfades, spine, coverage pulse) live here; scrubbed parts are pure.
 */
import { Globe } from "../gl/globe";
import { paint2d } from "../gl/paint2d";
import { EE_XMAX, faceQuat, slerp } from "../gl/projection";
import type { CellLayer, Frame, GridKey } from "../gl/frame";
import { addFrame } from "../motion/loop";
import { Tween } from "../motion/tween";
import { DUR, easePremium, easeSmooth, easeSymmetric, linear } from "../motion/ease";
import { stepState, windowed } from "../motion/progress";
import { clamp, idle, lerp } from "../lib/math";
import { getProgress, locate } from "../scroll/engine";
import { motionEnabled } from "../state/motion";
import { bank } from "../state/bank";
import { FIRST_YEAR, getClimate, setClimate, subscribeClimate } from "../state/climate";
import { getStore } from "../data/loader";
import { GRIDS } from "../data/artifacts";
import type { Baseline, Source } from "../data/types";
import { layout, discLerp, type Disc, type Layout } from "./geometry";
import { viewportClass, type ViewportClass } from "../graphics/canvas";
import { FACE_NORTH, FACE_OPEN, baseFrame, gridFor, layerOf, planetFrame, S04, strataFrame } from "./frames";
import { SCENES } from "../app/scenes";

export const INTRO_MS = 4600;
const SCENE_IDS = SCENES.map((s) => s.id);
const DRIFT = 0.003; // deg per ms (3 deg/s)

// ------------------------------------------------------------------ quality tiers (MOTION_SYSTEM 9.2)
export type Tier = "high" | "low" | "nogl";
const forced = (() => {
  const m = /[?&]quality=(low|high|nogl)/.exec(typeof location === "undefined" ? "" : location.search);
  return m ? (m[1] as Tier) : null;
})();
export const quality = { tier: (forced ?? "high") as Tier, forced: !!forced, median: 0, samples: [] as number[] };

// ------------------------------------------------------------------ S00 intro clock
export const intro = { playing: false, start: 0, completeFrom: -1, completeAt: 0, frozen: -1, arrival: -1, minR: Infinity, monotonic: true, lastR: 0, years: [] as number[] };
/** Intro clock in ms (0..4600). SKIP / Esc / scroll compress the remainder into 350ms. */
export function introTime(now: number) {
  if (intro.frozen >= 0) return intro.frozen;
  if (!intro.playing) return INTRO_MS;
  if (!intro.start) intro.start = now;
  const t = now - intro.start;
  if (intro.completeFrom < 0) return Math.min(INTRO_MS, t);
  const k = easePremium(clamp((now - intro.completeAt) / DUR.standard));
  return intro.completeFrom + (INTRO_MS - intro.completeFrom) * k;
}
const INTRO_STEPS = 15, RUN_AT = 2000, STEP_EVERY = 93, STEP_MS = 120;
/** Decade run (5.1): layers 1..15 of the DR-1 subset, a 120ms crossfade started every 93ms. */
function decadeLayers(t: number): [number, number, number] {
  const k = clamp(Math.floor((t - RUN_AT) / STEP_EVERY) + 1, 0, INTRO_STEPS);
  if (k === 0) return [0, 0, 0];
  return [k - 1, k, clamp((t - (RUN_AT + STEP_EVERY * (k - 1))) / STEP_MS)];
}

// ------------------------------------------------------------------ stepped state
class Fader<T> {
  a: T; b: T; private tw = new Tween(1, 0, linear);
  constructor(v: T) { this.a = v; this.b = v; }
  get mix() { return this.tw.value; }
  set(v: T, now: number, ms: number, ease = linear) {
    if (v === this.b) return;
    if (now < instantUntil) ms = 0; // chapter jump: stepped states resolve without animation (6.2)
    // retarget: the layer weighted 50% or more becomes A (5.5)
    this.a = this.mix >= 0.5 ? this.b : this.a;
    this.b = v;
    this.tw = new Tween(0, ms, ease);
    this.tw.retarget(1, now, ms);
  }
  snap() { this.tw.snap(); this.a = this.b; }
  update(now: number) { const busy = this.tw.update(now); if (!busy && this.a !== this.b) this.a = this.b; return busy; }
  get shown() { return this.mix >= 0.5 ? this.b : this.a; }
}

const yearFade = new Fader<number>(2025);
const baseFade = new Fader<Baseline>("1951-1980");
const srcFade = new Fader<Source>("gistemp");
const spineTw = new Tween(0, DUR.card, easePremium);
let instantUntil = 0;
let spineStep = 0, coverageStep = 0, coverageAt = -1, lastYearAt = 0, lastYearVal = 0;

/** Integer-year controller: crossfade 200ms, shortened as the scrub rate rises; 0 above 8 years/s (5.5). */
function setYear(y: number, now: number) {
  if (y === yearFade.b) return;
  const rate = Math.abs(y - lastYearVal) / Math.max(1, now - lastYearAt) * 1000;
  lastYearAt = now; lastYearVal = y;
  const ms = quality.tier === "high" ? Math.max(0, DUR.fast * (1 - rate / 8)) : 0;
  yearFade.set(y, now, ms);
}

// ------------------------------------------------------------------ runtime
let globe: Globe | null = null;
let glCanvas: HTMLCanvasElement | null = null;
let orbCanvas: HTMLCanvasElement | null = null;
let L: Layout | null = null;
let lastKey = "";
let tierChecked = false;
let started = false;
export const debug = { radius: 0, scene: "", glFrames: 0, lastYear: 0, phase: 0 };

function dprFor(cls: string) {
  const d = devicePixelRatio || 1;
  return quality.tier === "low" ? 1 : Math.min(d, cls === "D" ? 2 : 1.5);
}

/** Upload anything the bank gained since the last frame. */
let uploaded = -1;
const uploadedCores = new Set<string>();
let slotKey = "";
function sync(f: Frame | null) {
  if (!globe) return;
  if (bank.version !== uploaded) {
    uploaded = bank.version;
    for (const [key, g] of bank.grids) {
      globe.setGrid(key, g.data, g.geom.nLon, g.geom.nLat);
      for (const [base, o] of Object.entries(g.meta.baseline_offsets)) if (o) globe.setOffsets(`${key}:${base}`, o.values, g.geom.nLon, g.geom.nLat);
    }
    for (const [key, data] of bank.cores) if (!uploadedCores.has(key)) {
      uploadedCores.add(key);
      const nLat = bank.grids.get(key.split(":")[0] as GridKey)!.geom.nLat;
      globe.setCore(key, data, nLat + 1);
    }
    if (bank.coast && !coastDone) { coastDone = true; globe.setCoast(bank.coast.coords, bank.coast.starts); }
  }
  if (f && f.u.s2 > 0 && f.cells[0]) {
    const c = f.cells[0], year = bank.axis()[f.core?.cur ?? 0]!;
    const k = `${c.grid}:${year}:${c.baseA}`;
    if (k !== slotKey) {
      const s = bank.slots(c.grid, year, c.baseA);
      if (s) { slotKey = k; globe.setSlots(c.grid === "hadcrut5" ? "5" : "2", s); slots2d.set(c.grid, s); }
    }
  }
}
let coastDone = false;
const slots2d = new Map<string, Float32Array>();

export interface Overlay {
  orb: { disc: Disc; alpha: number; cool: number; glow: number; body: number } | null;
  halo: { disc: Disc; alpha: number } | null;
  limb: { disc: Disc; alpha: number } | null;
  outline: { x0: number; x1: number; y0: number; y1: number; alpha: number } | null;
}
const NONE: Overlay = { orb: null, halo: null, limb: null, outline: null };

// ------------------------------------------------------------------ per-scene frames
function drift(now: number) { return motionEnabled() && quality.tier === "high" ? now * DRIFT : 0; }
const openFace = (now: number) => faceQuat(FACE_OPEN.lon + (drift(now) % 360), FACE_OPEN.lat);

function signalFrame(p: number, now: number, L: Layout, dpr: number): [Frame | null, Overlay] {
  const intGrid = bank.grids.get("intro");
  const latestLayer = intGrid ? intGrid.meta.years.list.length - 1 : 0;
  const dimEnd = L.cls === "M" ? 0.5 : 0.4;
  if (intro.playing || intro.frozen >= 0) {
    const t = introTime(now);
    const breath = easeSmooth(clamp((t - 200) / 1000)), cool = easePremium(clamp((t - 1000) / 700));
    const gl = quality.tier !== "nogl";
    const hand = gl ? clamp((t - 1500) / 200) : 0;
    const f = baseFrame(L, dpr, L.G0, openFace(now));
    f.cellAlpha = hand;
    if (intGrid && intro.arrival < 0) intro.arrival = t;
    const runs = intro.arrival >= 0 && intro.arrival <= 1600 && quality.tier === "high" && motionEnabled();
    let A = latestLayer, B = latestLayer, mix = 0;
    if (!intGrid) f.uniform = 0;
    else if (intro.completeFrom >= 0) {
      const [a, b, m] = runs ? decadeLayers(intro.completeFrom) : [0, latestLayer, 0];
      A = m >= 0.5 ? b : a; B = latestLayer; mix = clamp((now - intro.completeAt) / DUR.fast);
      f.uniform = Math.max(easePremium(clamp((intro.completeFrom - 1600) / 400)), clamp((now - intro.completeAt) / DUR.standard));
    } else if (runs) {
      [A, B, mix] = decadeLayers(t);
      f.uniform = easePremium(clamp((t - 1600) / 400));
    } else {
      const at = Math.max(1600, intro.arrival);
      f.uniform = easePremium(clamp((t - at) / 350));
      if (quality.tier === "low") { A = 0; B = latestLayer; mix = t >= RUN_AT ? 1 : 0; }
    }
    if (intGrid) f.cells = [{ ...cell("intro", A, "1951-1980"), layerB: B, mix }];
    f.coast = 0.35 * easePremium(clamp((t - 1600) / 400));
    f.dim = 1 - (1 - dimEnd) * easeSmooth(clamp((t - 3300) / 1200));
    const shownLayer = mix >= 0.5 ? B : A;
    debug.lastYear = intGrid?.meta.years.list[shownLayer] ?? 0;
    const glow = 1 + 0.25 * breath - 0.19 * cool;
    return [f, {
      ...NONE,
      orb: { disc: L.G0, alpha: breath * (gl ? 1 : 1) * f.dim, cool, glow, body: 1 - hand },
      limb: { disc: L.G0, alpha: 0.24 * cool },
    }];
  }
  // S01 (scrubbed): G0 -> G1s, halo 20% -> 6%, dims to 25% before S02
  const s = easeSymmetric(windowed(p, 0, 0.4));
  const disc = discLerp(L.G0, L.G1s, s);
  const { source, baseline } = latestLook();
  const f = planetFrame(L, dpr, disc, openFace(now), source, bank.axis().at(-1)!, baseline);
  f.dim = lerp(dimEnd, 1, s) * lerp(1, 0.25, windowed(p, 0.8, 1));
  debug.lastYear = bank.axis().at(-1)!;
  return [f, { ...NONE, halo: { disc, alpha: lerp(0.2, 0.06, s) * f.dim }, limb: { disc, alpha: 0.24 } }];
}

/** S01-S03b show the shared look only when it is renderable at the latest year; otherwise the native view. */
function latestLook(): { source: Source; baseline: Baseline } {
  const c = getClimate();
  return gridFor(c.source, bank.axis().at(-1)!, c.baseline) ? c : { source: "gistemp", baseline: "1951-1980" };
}
const cell = (grid: GridKey, layer: number, base: Baseline): CellLayer => ({ grid, layerA: layer, layerB: layer, mix: 0, baseA: base, baseB: base, baseMix: 0, alpha: 1 });

function recordFrame(p: number, now: number, L: Layout, dpr: number): [Frame | null, Overlay] {
  const { source, baseline } = latestLook();
  const f = planetFrame(L, dpr, L.G1s, openFace(now), source, bank.axis().at(-1)!, baseline);
  f.dim = lerp(0.25, 1, windowed(p, 0.85, 1));
  return [f, { ...NONE, halo: { disc: L.G1s, alpha: 0.06 * f.dim }, limb: { disc: L.G1s, alpha: 0.24 } }];
}

function yearsFrame(p: number, now: number, L: Layout, dpr: number): [Frame | null, Overlay] {
  const c = getClimate();
  const latest = bank.axis().at(-1)!;
  const first = FIRST_YEAR[c.source];
  const year = Math.round(first + windowed(p, 0.08, 0.92) * (latest - first));
  if (year !== c.year) setClimate({ year });
  setYear(year, now);
  baseFade.set(c.baseline, now, quality.tier === "high" ? DUR.panel : 0, easeSmooth);
  srcFade.set(c.source, now, quality.tier === "high" ? DUR.panel : 0, easeSmooth);
  const hand = easeSymmetric(windowed(p, 0.92, 1));
  const q = slerp(openFace(now), FACE_NORTH, hand);
  const f = baseFrame(L, dpr, L.G1s, q);
  const layersFor = (src: Source, alpha: number): CellLayer | null => {
    if (!bank.grids.has(src)) return null;
    const A = layerOf(src, yearFade.a), B = layerOf(src, yearFade.b);
    const bA = baseFade.a, bB = baseFade.b;
    const ok = (b: Baseline) => !!bank.grids.get(src)!.meta.baseline_offsets[b];
    if (B < 0) return null;
    return { grid: src, layerA: A < 0 ? B : A, layerB: B, mix: A < 0 ? 0 : yearFade.mix, baseA: ok(bA) ? bA : bB, baseB: ok(bB) ? bB : bA, baseMix: baseFade.mix, alpha };
  };
  const out = srcFade.a !== srcFade.b && srcFade.mix < 1 ? layersFor(srcFade.a, 1) : null;
  const inn = layersFor(srcFade.b, out ? srcFade.mix : 1);
  f.cells = [out, inn].filter((x): x is CellLayer => !!x);
  debug.lastYear = yearFade.shown;
  return [f, { ...NONE, halo: { disc: L.G1s, alpha: 0.06 }, limb: { disc: L.G1s, alpha: 0.24 } }];
}

function regionsFrame(L: Layout, dpr: number): [Frame | null, Overlay] {
  const { source, baseline } = latestLook();
  const f = planetFrame(L, dpr, L.G1s, FACE_NORTH, source, bank.axis().at(-1)!, baseline);
  return [f, { ...NONE, halo: { disc: L.G1s, alpha: 0.06 }, limb: { disc: L.G1s, alpha: 0.24 } }];
}

function strataSceneFrame(p: number, now: number, L: Layout, dpr: number): [Frame | null, Overlay] {
  const c = getClimate();
  // stepped: SPINE at 0.85, COVERAGE at 0.93 (hysteresis 0.02)
  const s = stepState(spineStep, p, [S04.spine]);
  if (s !== spineStep) { spineStep = s; spineTw.retarget(s, now, motionEnabled() && now >= instantUntil ? DUR.card : 0); }
  spineTw.update(now);
  const cv = stepState(coverageStep, p, [S04.coverage]);
  if (cv !== coverageStep) { coverageStep = cv; coverageAt = cv && now >= instantUntil ? now : -1; }
  let lattice = 0.4;
  if (coverageAt >= 0 && motionEnabled()) {
    const t = now - coverageAt;
    lattice = t < 350 ? lerp(0.4, 0.7, easeSmooth(t / 350)) : t < 1550 ? 0.7 : lerp(0.7, 0.5, easeSmooth(clamp((t - 1550) / 600)));
  } else if (coverageStep) lattice = 0.5;
  const r = strataFrame(L, dpr, p, { source: c.source, base: c.baseline, spine: spineTw.value, lattice, nogl: quality.tier === "nogl" });
  debug.phase = r.phase;
  const halo = lerp(0.06, 0, r.frame.u.s1);
  const k = L.core;
  const landed = clamp((p - (S04.build[1] - 0.04)) / 0.04);
  return [r.frame, {
    ...NONE,
    halo: halo > 0 ? { disc: r.disc, alpha: halo } : null,
    limb: r.frame.u.s1 < 1 ? { disc: r.disc, alpha: 0.24 * (1 - r.frame.u.s1) } : null,
    outline: r.fullReady || p > S04.turn[1] ? { x0: k.x0 - 1, x1: k.spine[1] + 1, y0: k.y0 - 1, y1: k.y0 + k.n * k.H + 1, alpha: r.fullReady ? 0.24 * landed : 0.24 * clamp((p - S04.turn[1]) / 0.05) } : null,
  }];
}

/** Each frame: which scene owns the viewport, and its Frame. */
function build(now: number, L: Layout, dpr: number): [Frame | null, Overlay, string] {
  const loc = locate(SCENE_IDS);
  const id = loc?.id ?? "signal";
  const p = loc ? loc.p : 0;
  switch (id) {
    case "signal": return [...signalFrame(p, now, L, dpr), id];
    case "record": return [...recordFrame(p, now, L, dpr), id];
    case "years": return [...yearsFrame(p, now, L, dpr), id];
    case "regions": return [...regionsFrame(L, dpr), id];
    case "strata": return [...strataSceneFrame(p, now, L, dpr), id];
    default: return [null, NONE, id];
  }
}

// ------------------------------------------------------------------ 2D layer: orb, halo, limb, outline
const SOLAR = ["#fff3a6", "#ffc23d", "#ff7a1f", "#ff4c25"];
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i]! - v) * t)).join(",")})`; };

export function drawOverlay(ctx: CanvasRenderingContext2D, o: Overlay, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  if (o.orb && o.orb.alpha > 0) {
    // the oversized Solar orb, drawn live as concentric radial gradients at G0 (5.1): it cools in place
    const { disc: d, cool, glow, body } = o.orb;
    ctx.globalAlpha = o.orb.alpha;
    const g = ctx.createRadialGradient(d.cx, d.cy, d.r * 0.92, d.cx, d.cy, d.r * glow);
    g.addColorStop(0, "rgba(255,76,37,0.34)");
    g.addColorStop(1, "rgba(255,76,37,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (body > 0) {
      ctx.globalAlpha = o.orb.alpha * body;
      const b = ctx.createRadialGradient(d.cx, d.cy, 0, d.cx, d.cy, d.r);
      const stops = SOLAR.map((c) => mixHex(c, "#ff7a1f", cool * 0.85));
      b.addColorStop(0, stops[0]!); b.addColorStop(0.34, stops[1]!); b.addColorStop(0.6, stops[2]!); b.addColorStop(0.9, stops[3]!);
      b.addColorStop(0.97, mixHex("#ff4c25", "#ff7a1f", 0.5)); b.addColorStop(1, "rgba(255,122,31,0.9)");
      ctx.fillStyle = b;
      ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (o.halo && o.halo.alpha > 0) {
    const d = o.halo.disc;
    ctx.globalAlpha = o.halo.alpha;
    const g = ctx.createRadialGradient(d.cx, d.cy, d.r * 0.97, d.cx, d.cy, d.r * 1.18);
    g.addColorStop(0, "rgba(255,92,34,1)");
    g.addColorStop(1, "rgba(255,92,34,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r * 1.18, 0, Math.PI * 2); ctx.arc(d.cx, d.cy, d.r * 0.97, 0, Math.PI * 2, true); ctx.fill();
  }
  if (o.limb && o.limb.alpha > 0) {
    const d = o.limb.disc;
    ctx.globalAlpha = o.limb.alpha;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r + 0.5, 0, Math.PI * 2); ctx.stroke();
  }
  if (o.outline && o.outline.alpha > 0) {
    const r = o.outline;
    ctx.globalAlpha = r.alpha;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(r.x0 + 0.5, r.y0 + 0.5, r.x1 - r.x0 - 1, r.y1 - r.y0 - 1, 8); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export const paintData = {
  grid: (k: string) => bank.grids.get(k as GridKey),
  core: (k: string) => bank.cores.get(k),
  slots: (k: string) => slots2d.get(k),
  get coast() { return bank.coast; },
};

let orbDpr = 1;
function frame(now: number) {
  if (!orbCanvas || !motionEnabled()) return;
  const w = document.documentElement.clientWidth, h = innerHeight;
  if (!L || L.w !== w || L.h !== h) { L = layout(w, h); lastKey = ""; }
  const dpr = dprFor(L.cls);
  // intro radius stats (MOTION_SYSTEM test 15): the disc the renderer actually uses, every frame
  const [f, o, id] = build(now, L, dpr);
  debug.scene = id;
  const r = o.orb?.disc.r ?? (f ? f.u.sphere[2] : 0);
  debug.radius = r;
  if (intro.playing && r > 0) {
    intro.minR = Math.min(intro.minR, r);
    if (intro.lastR && r < intro.lastR - 1e-6) intro.monotonic = false;
    intro.lastR = r;
    const y = debug.lastYear;
    if (y && intro.years.at(-1) !== y) intro.years.push(y);
  }
  const busy = [yearFade.update(now), baseFade.update(now), srcFade.update(now), spineTw.active].some(Boolean);
  const live = intro.playing || (["signal", "record", "years"].includes(id) && drift(now) !== 0) || busy || coverageAt >= 0 && now - coverageAt < 2200;
  const key = `${id}:${getProgress(id).toFixed(4)}:${bank.version}:${w}x${h}:${getClimate().source}:${getClimate().baseline}:${quality.tier}`;
  if (!live && key === lastKey) return;
  lastKey = key;
  const od = Math.min(devicePixelRatio || 1, 1.5);
  if (orbCanvas.width !== Math.round(w * od) || orbCanvas.height !== Math.round(h * od)) { orbCanvas.width = Math.round(w * od); orbCanvas.height = Math.round(h * od); }
  orbDpr = od;
  const ctx = orbCanvas.getContext("2d")!;
  ctx.setTransform(orbDpr, 0, 0, orbDpr, 0, 0);
  drawOverlay(ctx, o, w, h);
  if (quality.tier === "nogl") {
    // NO-WEBGL tier (9.2): the orb stays an orb in S00-S02; the record is drawn as flat Equal Earth maps
    if (!f || o.orb) return;
    drawOverlay(ctx, { ...NONE, outline: o.outline }, w, h); // a flat map has no limb or halo
    const [cx, cy, r] = f.u.sphere;
    if (id === "signal" || id === "record") {
      drawOverlay(ctx, { ...NONE, orb: { disc: { cx, cy, r }, alpha: f.dim, cool: 1, glow: 1.06, body: 1 } }, w, h);
      return;
    }
    if (id !== "strata") {
      const width = Math.min(2.4 * r, w - 32);
      f.u.s1 = 1;
      f.u.sheet = [cx, cy, width / (2 * EE_XMAX)];
    }
    if (f.cells.length) paint2d(ctx, { ...f, dpr: orbDpr }, paintData);
    return;
  }
  sync(f);
  if (!globe || !glCanvas) return;
  globe.resize(glCanvas, w, h, dpr);
  if (f) { globe.draw(f); debug.glFrames = globe.frames; } else { const gl = globe.gl; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  tier(now, f !== null);
}

let lastT = 0;
function tier(now: number, drew: boolean) {
  if (quality.forced || tierChecked || intro.playing || !drew) { lastT = now; return; }
  if (lastT) quality.samples.push(now - lastT);
  lastT = now;
  if (quality.samples.length >= 60) {
    tierChecked = true;
    const s = [...quality.samples].sort((a, b) => a - b);
    quality.median = s[30]!;
    if (quality.median > (L?.cls === "D" ? 22 : 40)) quality.tier = "low";
  }
}

/** Start after first paint: WebGL compiles in an idle slot, never before the headline paints (MOTION_SYSTEM 2). */
export function startDirector(orb: HTMLCanvasElement, gl: HTMLCanvasElement) {
  orbCanvas = orb; glCanvas = gl;
  if (started) return;
  started = true;
  const init = () => {
    if (quality.tier !== "nogl" && motionEnabled()) {
      globe = Globe.create(gl);
      if (!globe) quality.tier = "nogl";
    }
    document.documentElement.dataset.tier = quality.tier;
    lastKey = "";
  };
  if (quality.tier === "nogl") document.documentElement.dataset.tier = "nogl";
  idle(init, 300);
  addFrame(frame, 50);
  subscribeClimate(() => { lastKey = ""; });
  // the full grids are needed from S03a on: fetched after load / first idle, never on the LCP path
  const later = () => getStore(GRIDS.gistemp).prefetch();
  if (document.readyState === "complete") idle(later);
  else addEventListener("load", () => idle(later), { once: true });
}

/** Resolve any in-flight stepped transition instantly (chapter jumps, resize). */
export function snapAll() { yearFade.snap(); baseFade.snap(); srcFade.snap(); spineTw.snap(); instantUntil = performance.now() + 120; lastKey = ""; }
export const glAvailable = () => !!globe;

/**
 * Paint one static frame into a canvas with the Canvas2D painter: the
 * reduced-motion figures (MOTION_SYSTEM 8). `cls` keeps the page's D/T/M
 * composition inside a small figure box.
 */
export function paintStatic(canvas: HTMLCanvasElement, build: (L: Layout, dpr: number) => [Frame | null, Overlay | null], cls?: ViewportClass) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const L2 = layout(w, h, 176, cls ?? viewportClass(innerWidth));
  const [f, o] = build(L2, dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawOverlay(ctx, o ?? NONE, w, h);
  if (f) paint2d(ctx, { ...f, dpr }, paintData);
}
