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
import { EE_XMAX, faceQuat, slerp, type Quat } from "../gl/projection";
import { HIDDEN, type CellLayer, type Frame, type GridKey } from "../gl/frame";
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
import { FACE_NORTH, FACE_OPEN, FACE_ZERO, baseFrame, gridFor, layerOf, lyingBoxes, obsSheet, planetFrame, S04, strataFrame, uprightBoxes } from "./frames";
import { obs, regions, years as yearsStore, type BandId } from "../state/scenes";
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
const modeTw = new Tween(0, DUR.panel, easeSmooth);
const bandTw = new Tween(0, DUR.card, easePremium);
const mapTw = new Tween(0, DUR.scene, easeSmooth);

/** Retargetable rotation: slerp along the shortest arc from wherever it is now (MOTION_SYSTEM 4). */
class QuatTween {
  private from: Quat; private to: Quat; private start = 0; private dur = 0;
  constructor(q: Quat) { this.from = q; this.to = q; }
  value(now: number): Quat { const t = this.dur > 0 ? clamp((now - this.start) / this.dur) : 1; return slerp(this.from, this.to, easeSmooth(t)); }
  active(now: number) { return this.dur > 0 && now - this.start < this.dur; }
  set(q: Quat, now: number, ms: number) {
    if (q.every((v, i) => Math.abs(v - this.to[i]!) < 1e-9)) return;
    this.from = this.value(now); this.to = q; this.start = now; this.dur = motionEnabled() && now >= instantUntil ? ms : 0;
  }
}
const regionRot = new QuatTween(FACE_NORTH);
/** S03b states (VISUAL_DESIGN 3.4): the face each threshold turns to, and its band. */
export const REGION_FACES: [number, number][] = [[20, 72], [30, 20], [140, -62], [-150, 0]];
export const REGION_BANDS: (BandId | null)[] = ["arctic", null, "antarctic", null];
const BAND_FACE: Record<BandId, [number, number]> = { arctic: [20, 72], n_mid: [20, 45], low: [-150, 0], s_mid: [30, -45], antarctic: [140, -62] };
export const regionState = { step: 0 };
let echoStep = 0, echoAt = -1;
export const surface = { year: 0 };
let instantUntil = 0;
/** OBS core drag: 0ms crossfades while dragging (5.12). */
export let obsDragging = false;
export const setObsDragging = (v: boolean) => { obsDragging = v; };
let spineStep = 0, coverageStep = 0, coverageAt = -1, lastYearAt = 0, lastYearVal = 0;

/** Integer-year controller: crossfade 200ms, shortened as the scrub rate rises; 0 above 8 years/s (5.5). */
function setYear(y: number, now: number, force?: number) {
  if (y === yearFade.b) return;
  const rate = Math.abs(y - lastYearVal) / Math.max(1, now - lastYearAt) * 1000;
  lastYearAt = now; lastYearVal = y;
  const ms = force ?? (quality.tier === "high" && !obsDragging ? Math.max(0, DUR.fast * (1 - rate / 8)) : 0);
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
let losses = 0;
export const glLosses = () => losses;
export const debug = { radius: 0, scene: "", glFrames: 0, lastYear: 0, phase: 0, coreAlpha: 0, figure: { discs: [] as number[][], rects: [] as number[][] } };

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
    for (const [key, t] of bank.trends) globe.setTrend(key, t.data, t.meta.grid.n_lon, t.meta.grid.n_lat);
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
  f.cells = cellLayers();
  modeTw.retarget(yearsStore.get().plus2 ? 1 : 0, now, quality.tier === "high" ? DUR.standard : 0);
  modeTw.update(now);
  if (modeTw.value > 0) { f.mode = 2; f.modeMix = modeTw.value; }
  debug.lastYear = yearFade.shown;
  return [f, { ...NONE, halo: { disc: L.G1s, alpha: 0.06 }, limb: { disc: L.G1s, alpha: 0.24 } }];
}

function bandLat(id: BandId | null): [number, number] | null {
  const b = id ? bank.band(id) : undefined;
  return b ? [b.lat_min, b.lat_max] : null;
}

/** S03b Regional Turn (5.6): stepped turns to a region, the TREND surface, the band outlined. */
function regionsFrame(p: number, now: number, L: Layout, dpr: number): [Frame | null, Overlay] {
  const s = stepState(regionState.step, p, [0.25, 0.5, 0.75]);
  if (s !== regionState.step) { regionState.step = s; regions.set({ override: null, drag: null }); }
  const st = regions.get();
  const band = st.override ?? REGION_BANDS[regionState.step]!;
  const [lon, lat] = st.drag ? [st.drag.lon, st.drag.lat] : st.override ? BAND_FACE[st.override] : REGION_FACES[regionState.step]!;
  regionRot.set(faceQuat(lon, lat), now, st.drag ? 0 : DUR.scene);
  // hand-over to S04: settle to face (0, 0), trend back to anomaly (p 0.92-1)
  const hand = easeSymmetric(windowed(p, 0.92, 1));
  const q = slerp(regionRot.value(now), FACE_ZERO, hand);
  const { source, baseline } = latestLook();
  const f = planetFrame(L, dpr, L.G1s, q, source, bank.axis().at(-1)!, baseline);
  const layers = bank.trendLayers(source, st.period);
  modeTw.retarget(layers ? 1 : 0, now, quality.tier === "high" ? DUR.panel : 0);
  modeTw.update(now);
  if (layers) { f.mode = 1; f.trend = { key: source, slope: layers[0], sig: layers[1] }; }
  f.modeMix = modeTw.value * (1 - hand);
  const lat2 = bandLat(band);
  bandTw.retarget(lat2 ? 1 : 0, now, motionEnabled() ? DUR.card : 0);
  bandTw.update(now);
  if (lat2) lastBand = lat2;
  f.band = [lastBand[0], lastBand[1], bandTw.value * (1 - hand)];
  return [f, { ...NONE, halo: { disc: L.G1s, alpha: 0.06 }, limb: { disc: L.G1s, alpha: 0.24 } }];
}
let lastBand: [number, number] = [60, 90];

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

/** S05 Zero Lab (5.8): the core lies down as the bench (p 0-0.2, scrubbed); time on x is shared with the series band. */
function zeroFrame(p: number, L: Layout, dpr: number): [Frame | null, Overlay] {
  const { source, baseline } = getClimate();
  const t = easeSymmetric(windowed(p, 0, 0.2));
  return [benchFrame(L, dpr, source, baseline, t, 1), NONE];
}
function benchFrame(L: Layout, dpr: number, source: Source, base: Baseline, t: number, alpha: number): Frame | null {
  const key = `${source}:${base}`;
  if (!bank.core(source, base)) return null;
  const k = L.core, g = bank.grids.get(source)!;
  const f = baseFrame(L, dpr, L.G1, FACE_ZERO);
  f.cellAlpha = 0;
  f.coast = 0;
  const v = uprightBoxes(k.n, { x0: k.x0, x1: k.x1, y0: k.y0, y1: k.y0 + k.n * k.H });
  const spine = uprightBoxes(k.n, { x0: k.spine[0], x1: k.spine[1], y0: k.y0, y1: k.y0 + k.n * k.H });
  if (t > 0.02) for (let i = 0; i < k.n; i++) spine[i * 4 + 1] = HIDDEN;
  f.core = { key, nLat: g.geom.nLat, step: g.geom.step, cur: k.n - 1, v, h: lyingBoxes(k.n, L.bench), bench: t, spine, alpha, sep: 1 - t, thickPx: k.H * dpr };
  return f;
}

/** S06: the bench returns upright and the core dims to 15% (the spine's colours leave it as positions, drawn in SVG). */
function futuresFrame(p: number, L: Layout, dpr: number): [Frame | null, Overlay] {
  const { source, baseline } = getClimate();
  const e = easeSymmetric(windowed(p, 0, 0.12));
  // the core stands up, dims, then leaves entirely once its spine has become positions (p 0.30): S06 text and chips stay clear
  const f = benchFrame(L, dpr, source, baseline, 1 - e, (1 - 0.85 * e) * (1 - windowed(p, 0.24, 0.34)));
  debug.coreAlpha = f?.core?.alpha ?? 0;
  if (f?.core) for (let i = 0; i < L.core.n; i++) f.core.spine[i * 4 + 1] = HIDDEN;
  return [f, NONE];
}

/** OBS (5.12): the planet the visitor turns, the docked core as the year scrubber, layers and regions. */
function obsFrame(now: number, L: Layout, dpr: number, dy: number): [Frame | null, Overlay] {
  const o = obs.get(), c = getClimate();
  setYear(o.year, now, o.playing ? (quality.tier === "high" ? 120 : 0) : undefined);
  baseFade.set(c.baseline, now, quality.tier === "high" ? DUR.panel : 0, easeSmooth);
  srcFade.set(c.source, now, quality.tier === "high" ? DUR.panel : 0, easeSmooth);
  mapTw.retarget(o.view === "map" ? 1 : 0, now, quality.tier === "nogl" ? 0 : DUR.scene);
  mapTw.update(now);
  const m = mapTw.value;
  const q = slerp(faceQuat(o.lon0, o.lat0), FACE_ZERO, clamp(m * 3));
  const d = { ...L.obs, cy: L.obs.cy + dy };
  const f = baseFrame(L, dpr, d, q);
  const sh = obsSheet(L);
  f.u.sheet = [sh.cx, sh.cy + dy, sh.k];
  f.u.s1 = easeSmooth(clamp((m - 0.33) / 0.67));
  f.cells = cellLayers();
  const mode = o.layer === "trend" ? 1 : o.layer === "plus2" ? 2 : o.layer === "coverage" ? 3 : 0;
  modeTw.retarget(mode ? 1 : 0, now, quality.tier === "high" ? DUR.panel : 0);
  modeTw.update(now);
  if (mode) lastMode = mode;
  f.mode = lastMode; f.modeMix = modeTw.value;
  const layers = bank.trendLayers(c.source, o.period);
  if (layers) f.trend = { key: c.source, slope: layers[0], sig: layers[1] };
  const r = o.region;
  const lat2 = typeof r === "string" ? bandLat(r) : r ? [r.lat0, r.lat1] as [number, number] : null;
  bandTw.retarget(lat2 ? 1 : 0, now, motionEnabled() ? DUR.card : 0);
  bandTw.update(now);
  if (lat2) lastBand = lat2;
  f.band = [lastBand[0], lastBand[1], bandTw.value];
  const g = bank.grids.get(c.source);
  if (bank.core(c.source, c.baseline) && g) {
    const k = { ...L.dock, y0: L.dock.y0 + dy, y1: L.dock.y1 + dy }, n = L.core.n;
    const v = uprightBoxes(n, k), h = lyingBoxes(n, k);
    f.core = { key: `${c.source}:${c.baseline}`, nLat: g.geom.nLat, step: g.geom.step, cur: n - 1, v, h, bench: k.lying ? 1 : 0, spine: Float32Array.from(v).fill(HIDDEN), alpha: 1, sep: 0.6, thickPx: (k.lying ? (k.x1 - k.x0) / n : (k.y1 - k.y0) / n) * dpr };
  }
  debug.lastYear = yearFade.shown;
  return [f, { ...NONE, limb: m < 0.3 ? { disc: d, alpha: 0.24 * (1 - m * 3) } : null, halo: m < 0.3 ? { disc: d, alpha: 0.06 * (1 - m * 3) } : null }];
}
let lastMode = 0;

/** Cell layers for the shared year / baseline / source faders (S03a, OBS). */
function cellLayers(): CellLayer[] {
  const layersFor = (src: Source, alpha: number): CellLayer | null => {
    if (!bank.grids.has(src)) return null;
    const A = layerOf(src, yearFade.a), B = layerOf(src, yearFade.b);
    const ok = (b: Baseline) => !!bank.grids.get(src)!.meta.baseline_offsets[b];
    if (B < 0) return null;
    return { grid: src, layerA: A < 0 ? B : A, layerB: B, mix: A < 0 ? 0 : yearFade.mix, baseA: ok(baseFade.a) ? baseFade.a : baseFade.b, baseB: ok(baseFade.b) ? baseFade.b : baseFade.a, baseMix: baseFade.mix, alpha };
  };
  const out = srcFade.a !== srcFade.b && srcFade.mix < 1 ? layersFor(srcFade.a, 1) : null;
  const inn = layersFor(srcFade.b, out ? srcFade.mix : 1);
  return [out, inn].filter((x): x is CellLayer => !!x);
}

/** S08 The Surface (5.13): the unwrap in reverse, the push into the planet (G5), then the echo of the decade run. */
function surfaceFrame(p: number, now: number, L: Layout, dpr: number): [Frame | null, Overlay] {
  if (p < 0.3) {
    const local = p / 0.3;
    const { source, baseline } = getClimate();
    const r = strataFrame(L, dpr, 0.86 - 0.78 * local, { source, base: baseline, spine: 0, lattice: 0.4, nogl: quality.tier === "nogl" });
    if (r.frame.core) r.frame.core.alpha = 1 - clamp((local - 0.85) / 0.15) * 0;
    return [r.frame, { ...NONE, limb: r.frame.u.s1 < 1 ? { disc: r.disc, alpha: 0.24 * (1 - r.frame.u.s1) } : null }];
  }
  const s = easeSymmetric(windowed(p, 0.3, 0.55));
  const disc = discLerp(L.G1, L.G5, s);
  const f = baseFrame(L, dpr, disc, slerp(FACE_ZERO, faceQuat(0, 30), s));
  f.dim = 1 - 0.65 * windowed(p, 0.4, 0.75);
  const e = stepState(echoStep, p, [0.75]);
  if (e !== echoStep) { echoStep = e; echoAt = e && motionEnabled() && quality.tier !== "nogl" && now >= instantUntil ? now : -1; }
  const intGrid = bank.grids.get("intro"), latest = intGrid ? intGrid.meta.years.list.length - 1 : 0;
  let A = latest, B = latest, mix = 0;
  if (echoAt >= 0 && intGrid) [A, B, mix] = quality.tier === "high" ? decadeLayers(RUN_AT + (now - echoAt)) : [0, latest, 1];
  if (echoAt >= 0 && now - echoAt > 1500) echoAt = -1;
  if (intGrid) f.cells = [{ ...cell("intro", A, "1951-1980"), layerB: B, mix }];
  else { const g = gridFor("gistemp", bank.axis().at(-1)!, "1951-1980"); if (g) f.cells = [cell(g, layerOf(g, bank.axis().at(-1)!), "1951-1980")]; }
  f.coast = 0.35 * (1 - s) + 0.2 * s;
  surface.year = intGrid?.meta.years.list[mix >= 0.5 ? B : A] ?? bank.axis().at(-1)!;
  debug.lastYear = surface.year;
  return [f, { ...NONE, limb: s < 1 ? { disc, alpha: 0.24 * (1 - s) } : null }];
}
export const echoLive = () => echoAt >= 0;

/** Each frame: which scene owns the viewport, and its Frame. */
function build(now: number, L: Layout, dpr: number): [Frame | null, Overlay, string] {
  // OBS is in normal flow: whenever it holds the middle of the viewport it owns the planet, offset with the section
  const obsEl = document.getElementById("observatory");
  if (obsEl) {
    const r = obsEl.getBoundingClientRect();
    if (r.top < L.h * 0.5 && r.bottom > L.h * 0.5) return [...obsFrame(now, L, dpr, r.top), "observatory"];
  }
  const loc = locate(SCENE_IDS);
  const id = loc?.id ?? "signal";
  const p = loc ? loc.p : 0;
  switch (id) {
    case "signal": return [...signalFrame(p, now, L, dpr), id];
    case "record": return [...recordFrame(p, now, L, dpr), id];
    case "years": return [...yearsFrame(p, now, L, dpr), id];
    case "regions": return [...regionsFrame(p, now, L, dpr), id];
    case "strata": return [...strataSceneFrame(p, now, L, dpr), id];
    case "zero": return [...zeroFrame(p, L, dpr), id];
    case "futures": return [...futuresFrame(p, L, dpr), id];
    case "observatory": return [null, NONE, id];
    case "surface": return [...surfaceFrame(p, now, L, dpr), id];
    default: return [null, NONE, id];
  }
}

// ------------------------------------------------------------------ 2D layer: orb, halo, limb, outline
const SOLAR = ["#fff3a6", "#ffc23d", "#ff7a1f", "#ff4c25"];
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i]! - v) * t)).join(",")})`; };

let haloCache: { size: number; c: HTMLCanvasElement } | null = null;
function haloBitmap(size: number) {
  if (haloCache?.size === size) return haloCache.c;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!, h = size / 2, inner = h * (0.97 / 1.18);
  const grad = g.createRadialGradient(h, h, inner, h, h, h);
  grad.addColorStop(0, "rgba(255,92,34,1)");
  grad.addColorStop(1, "rgba(255,92,34,0)");
  g.fillStyle = grad;
  g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.arc(h, h, inner, 0, Math.PI * 2, true); g.fill();
  haloCache = { size, c };
  return c;
}

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
    // the halo is a cached bitmap (1024px max, 512px on M): live gradients are for the intro orb only (9.2)
    const d = o.halo.disc, R = d.r * 1.18;
    ctx.globalAlpha = o.halo.alpha;
    ctx.drawImage(haloBitmap(innerWidth < 768 ? 512 : 1024), d.cx - R, d.cy - R, 2 * R, 2 * R);
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
  trend: (k: string) => bank.trends.get(k as Source),
  get coast() { return bank.coast; },
};

let orbDpr = 1;
function frame(now: number) {
  tick++;
  if (!orbCanvas || !motionEnabled()) return;
  const w = document.documentElement.clientWidth, h = innerHeight;
  if (!L || L.w !== w || L.h !== h) { L = layout(w, h); lastKey = ""; }
  const dpr = dprFor(L.cls);
  // intro radius stats (MOTION_SYSTEM test 15): the disc the renderer actually uses, every frame
  const [f, o, id] = build(now, L, dpr);
  debug.scene = id;
  // the drawn figure, for layout tests: the sphere disc while it is a sphere, the core's box once it stands
  debug.figure = { discs: [], rects: [] };
  if (f && f.cells.length && f.cellAlpha > 0.05 && f.u.s1 === 0 && f.dim > 0.3) debug.figure.discs.push([...f.u.sphere]);
  if (f?.core && f.core.alpha > 0.05) {
    const v = f.core.v, n = v.length / 4;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      if (v[i * 4 + 1]! <= HIDDEN) continue;
      const t = f.core.bench, lie = f.core.h;
      const bx = t >= 1 ? [lie[i * 4]!, lie[i * 4 + 1]!, lie[i * 4]! + lie[i * 4 + 2]!, lie[i * 4 + 1]! + lie[i * 4 + 3]!] : [v[i * 4]!, v[i * 4 + 1]!, v[i * 4]! + v[i * 4 + 2]!, v[i * 4 + 1]! + v[i * 4 + 3]!];
      x0 = Math.min(x0, bx[0]!); y0 = Math.min(y0, bx[1]!); x1 = Math.max(x1, bx[2]!); y1 = Math.max(y1, bx[3]!);
    }
    if (x1 > x0 && (f.core.bench === 0 || f.core.bench === 1)) debug.figure.rects.push([x0, y0, x1, y1]);
  }
  const r = o.orb?.disc.r ?? (f ? f.u.sphere[2] : 0);
  debug.radius = r;
  if (intro.playing && r > 0) {
    intro.minR = Math.min(intro.minR, r);
    if (intro.lastR && r < intro.lastR - 1e-6) intro.monotonic = false;
    intro.lastR = r;
    const y = debug.lastYear;
    if (y && intro.years.at(-1) !== y) intro.years.push(y);
  }
  const busy = [yearFade.update(now), baseFade.update(now), srcFade.update(now), spineTw.active, modeTw.active, bandTw.active, mapTw.active, regionRot.active(now), echoAt >= 0].some(Boolean);
  const live = intro.playing || (["signal", "record", "years"].includes(id) && drift(now) !== 0) || busy || coverageAt >= 0 && now - coverageAt < 2200;
  const key = `${id}:${getProgress(id).toFixed(4)}:${id === "observatory" ? Math.round(scrollY) : 0}:${bank.version}:${w}x${h}:${getClimate().source}:${getClimate().baseline}:${quality.tier}`;
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
  if (document.documentElement.dataset.gl === "lost" && f) {
    const [cx, cy, r] = f.u.sphere;
    drawOverlay(ctx, { ...NONE, orb: { disc: { cx, cy, r }, alpha: 1, cool: 1, glow: 1.06, body: 1 } }, w, h);
    return;
  }
  if (!globe || !glCanvas) return;
  globe.resize(glCanvas, w, h, dpr);
  if (f) { globe.draw(f); debug.glFrames = globe.frames; } else globe.clear();
  tier(now, f !== null);
}

let lastT = 0, lastTick = -2, tick = 0;
function tier(now: number, drew: boolean) {
  if (quality.forced || tierChecked || intro.playing || !drew) { lastT = now; return; }
  // only draws in back-to-back rAF ticks count: an idle gap (nothing changed, draw skipped) is not a frame time
  if (lastT && lastTick === tick - 1) quality.samples.push(now - lastT);
  lastT = now;
  lastTick = tick;
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
  [obs, regions, yearsStore].forEach((st) => st.subscribe(() => { lastKey = ""; }));
  // context loss (6.3): keep the static orb and a note, rebuild on restore, give up after two losses
  gl.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    globe = null;
    losses++;
    document.documentElement.dataset.gl = "lost";
  });
  gl.addEventListener("webglcontextrestored", () => {
    if (losses >= 2) { quality.tier = "nogl"; document.documentElement.dataset.tier = "nogl"; }
    else globe = Globe.create(gl);
    uploaded = -1; uploadedCores.clear(); coastDone = false; slotKey = ""; lastKey = "";
    document.documentElement.dataset.gl = "";
  });
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

/** Current year crossfade weight (integer-year rule: 0 or 1 except inside a <= 200ms fade). */
export const yearMix = () => yearFade.mix;
