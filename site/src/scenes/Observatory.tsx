import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { motionEnabled } from "../state/motion";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus, SceneErrors } from "../components/StateUI";
import { Tooltip } from "../components/Tooltip";
import { useArtifact } from "../data/useArtifact";
import { getStore } from "../data/loader";
import { COAST, GRIDS, REGIONAL, TREND_GRIDS } from "../data/artifacts";
import { copyOBS, SOURCE_LABEL } from "../data/copy";
import { BASELINES, type Baseline, type Source } from "../data/types";
import { fixed, pct, signed } from "../model/format";
import { anomalyAt, regionMean } from "../model/zonal";
import { faceQuat, invertEqualEarth, invertOrtho, quatMat3 } from "../gl/projection";
import { DEFAULTS, FIRST_YEAR, baselineAllowed, getClimate, setClimate, subscribeClimate } from "../state/climate";
import { BAND_IDS, OBS_DEFAULT, PERIODS, obs, type Layer, type Region } from "../state/scenes";
import { bank } from "../state/bank";
import { useActiveScene, useFrame, useMotion } from "../scroll/hooks";
import { paintStatic, setObsDragging } from "./director";
import { lyingBoxes, obsSheet, planetFrame, still, uprightBoxes } from "./frames";
import { HIDDEN } from "../gl/frame";
import { layout } from "./geometry";
import { useViewport } from "./useViewport";
import { anomalyTag } from "./S03aYears";
import type { SceneDef } from "../app/scenes";

const LAYERS: Layer[] = ["anomaly", "trend", "plus2", "coverage"];
const LAYER_LABEL: Record<Layer, string> = { anomaly: "ANOMALY", trend: "TREND", plus2: "+2 °C", coverage: "COVERAGE" };
const PERIOD_START: Record<string, number> = { "1880_latest": 1880, "1951_latest": 1951, "1975_latest": 1975, "1991_latest": 1991 };
const latLabel = (lat: number) => `${Math.abs(Math.round(lat))}°${lat >= 0 ? "N" : "S"}`;
const lonLabel = (lon: number) => `${Math.abs(Math.round(lon))}°${lon >= 0 ? "E" : "W"}`;

interface Readout { text: string; value: string; share: number; empty: boolean; tag: { tag: "OBSERVED" | "DERIVED"; detail: string } }

/** OBS (interaction 8): any year, any place, any zero. One store; globe, core, readout and inspector all derive from it. */
export function Observatory({ def }: { def: SceneDef }) {
  const o = obs.use();
  const c = useSyncExternalStore(subscribeClimate, getClimate);
  const version = useSyncExternalStore(bank.subscribe, bank.getVersion);
  const motion = useMotion();
  const vp = useViewport();
  const L = layout(vp.w, vp.h);
  const [grid, retry] = useArtifact(GRIDS[c.source], false);
  const [tg, retryTg] = useArtifact(TREND_GRIDS[c.source], false);
  const [reg, retryR] = useArtifact(REGIONAL);
  const [coast, retryK] = useArtifact(COAST);
  const active = useActiveScene();
  const [sheet, setSheet] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [resetOk, setResetOk] = useState(false);
  const section = useRef<HTMLElement | null>(null);
  useEffect(() => { section.current = document.getElementById("observatory"); getStore(GRIDS[c.source]).prefetch(); getStore(TREND_GRIDS[c.source]).prefetch(); }, [c.source]);
  const g = bank.grids.get(c.source);
  const first = Math.max(FIRST_YEAR[c.source], g?.meta.years.first ?? 1850), last = bank.axis().at(-1)!;
  useEffect(() => { if (o.year < first) obs.set({ year: first }); }, [first, o.year]);

  const bandOf = (r: Region) => (typeof r === "string" ? bank.band(r) : undefined);
  const range = (r: Region): [number, number] => (typeof r === "string" ? [bandOf(r)?.lat_min ?? -90, bandOf(r)?.lat_max ?? 90] : r ? [r.lat0, r.lat1] : [-90, 90]);
  const regionName = (r: Region) => (typeof r === "string" ? (bandOf(r)?.label ?? r).toUpperCase() : r ? `${latLabel(r.lat0)} TO ${latLabel(r.lat1)}` : "THE GLOBE");

  /** The readout is the cos(lat)-weighted mean of exactly the cells rendered as valid for this filter. */
  const readout = useMemo((): Readout | null => {
    if (!g) return null;
    const layer = g.meta.years.list.indexOf(o.year), off = g.meta.baseline_offsets[c.baseline]?.values;
    if (layer < 0 || !off) return null;
    const [a, b] = range(o.region);
    const at = anomalyAt(g.data, layer, g.geom, off);
    const base = regionMean(g.geom, a, b, at);
    const tag = anomalyTag(c.source, c.baseline);
    const empty = base.n === 0;
    if (o.layer === "trend") {
      const t = bank.trends.get(c.source), li = bank.trendLayers(c.source, o.period);
      if (!t || !li) return { text: "LOADING TREND GRID", value: "n/a", share: 0, empty: false, tag: { tag: "DERIVED", detail: "CELL TRENDS" } };
      const plane = g.geom.nLat * g.geom.nLon;
      const r = regionMean(g.geom, a, b, (i) => { const v = t.data[li[0] * plane + i]!; return v === -128 ? null : v * 0.01; });
      return { text: `${signed(r.mean ?? 0)} °C / DECADE SINCE ${PERIOD_START[o.period]}`, value: r.mean === null ? "n/a" : `${signed(r.mean)} °C / DECADE`, share: r.share, empty: r.n === 0, tag: { tag: "DERIVED", detail: `CELL TRENDS SINCE ${PERIOD_START[o.period]}` } };
    }
    if (o.layer === "plus2") {
      const r = regionMean(g.geom, a, b, (i) => { const v = at(i); return v === null ? null : Math.round(v * 100) >= 200 ? 1 : 0; });
      return { text: "", value: r.mean === null ? "n/a" : `${pct(r.mean)}% OF MEASURED AREA AT +2 °C OR MORE`, share: r.share, empty, tag: { tag: "DERIVED", detail: `+2 °C VS ${c.baseline}` } };
    }
    if (o.layer === "coverage") return { text: "", value: `MEASURED AREA ${pct(base.share)}%`, share: base.share, empty, tag: { tag: "OBSERVED", detail: "COVERAGE" } };
    return { text: "", value: base.mean === null ? "n/a" : `${signed(base.mean)} °C`, share: base.share, empty, tag };
  }, [g, o.year, o.region, o.layer, o.period, c.source, c.baseline, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const bandTable = useMemo(() => {
    if (!g || reg.status !== "ready") return [];
    const layer = g.meta.years.list.indexOf(o.year), off = g.meta.baseline_offsets[c.baseline]?.values;
    if (layer < 0 || !off) return [];
    const at = anomalyAt(g.data, layer, g.geom, off);
    return reg.data.bands.map((b) => { const r = regionMean(g.geom, b.lat_min, b.lat_max, at); return { label: b.label, mean: r.mean, share: r.share }; });
  }, [g, reg, o.year, c.baseline, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- PLAY: 4 years/s on D, 2 on M, wraps; pauses on drag, Space, a hidden tab or when OBS leaves view
  const playT = useRef(0);
  useFrame((now) => {
    if (!o.playing) { playT.current = 0; return; }
    if (!motion || document.hidden) { obs.set({ playing: false }); return; }
    const r = section.current?.getBoundingClientRect();
    if (r && (r.bottom < 0 || r.top > innerHeight)) { obs.set({ playing: false }); return; }
    if (!playT.current) playT.current = now;
    if (now - playT.current >= 1000 / (L.cls === "M" ? 2 : 4)) { playT.current = now; obs.set({ year: o.year >= last ? first : o.year + 1 }); }
  });

  // ---- the docked core: drag along time sets the year; drag across latitude picks a slice (snapped to grid rows)
  const dock = L.dock, n = L.core.n;
  const stageTop = () => section.current?.getBoundingClientRect().top ?? 0;
  const drag = useRef<{ x: number; y: number; mode: "" | "year" | "slice"; s0: number } | null>(null);
  const toYear = (px: number, py: number) => {
    const t = dock.lying ? (px - dock.x0) / (dock.x1 - dock.x0) : 1 - (py - dock.y0) / (dock.y1 - dock.y0);
    return Math.round(Math.max(first, Math.min(last, 1850 + Math.floor(t * n))));
  };
  const toLat = (px: number, py: number) => {
    const s = dock.lying ? 1 - (2 * (py - dock.y0)) / (dock.y1 - dock.y0) : (2 * (px - dock.x0)) / (dock.x1 - dock.x0) - 1;
    const step = g?.geom.step ?? 2;
    return Math.max(-90, Math.min(90, Math.round((Math.asin(Math.max(-1, Math.min(1, s))) * 180) / Math.PI / step) * step));
  };
  const coreDown = (e: PointerEvent) => {
    const px = e.clientX, py = e.clientY - stageTop();
    drag.current = { x: px, y: py, mode: "", s0: toLat(px, py) };
    (e.target as Element).setPointerCapture(e.pointerId);
    obs.set({ playing: false });
  };
  const coreMove = (e: PointerEvent) => {
    const d = drag.current, px = e.clientX, py = e.clientY - stageTop();
    if (!d) return;
    if (!d.mode) {
      const dt = dock.lying ? Math.abs(px - d.x) : Math.abs(py - d.y), dl = dock.lying ? Math.abs(py - d.y) : Math.abs(px - d.x);
      if (Math.max(dt, dl) < 4) return;
      d.mode = dl > dt ? "slice" : "year";
      if (d.mode === "year") setObsDragging(true);
    }
    if (d.mode === "year") obs.set({ year: toYear(px, py) });
    else { const s1 = toLat(px, py); if (s1 !== d.s0) obs.set({ region: { lat0: Math.min(d.s0, s1), lat1: Math.max(d.s0, s1) } }); }
  };
  const coreUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setObsDragging(false);
    if (d && !d.mode) obs.set({ year: toYear(e.clientX, e.clientY - stageTop()) });
  };
  const coreKey = (e: KeyboardEvent) => {
    const r = o.region;
    if (e.shiftKey && (e.key.startsWith("Arrow"))) {
      e.preventDefault();
      const [a, b] = typeof r === "object" && r ? [r.lat0, r.lat1] : [-10, 10];
      const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? 2 : -2;
      if (b + d <= 90 && a + d >= -90) obs.set({ region: { lat0: a + d, lat1: b + d } });
      return;
    }
    const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : e.key === "PageUp" ? 10 : e.key === "PageDown" ? -10 : 0;
    if (d) { e.preventDefault(); obs.set({ year: Math.max(first, Math.min(last, o.year + d)), playing: false }); }
    if (e.key === "Home") { e.preventDefault(); obs.set({ year: first }); }
    if (e.key === "End") { e.preventDefault(); obs.set({ year: last }); }
  };
  const yi = o.year - 1850;
  const markPos = dock.lying ? { left: dock.x0 + ((yi + 0.5) / n) * (dock.x1 - dock.x0), top: dock.y0 } : { left: dock.x0, top: dock.y1 - ((yi + 0.5) / n) * (dock.y1 - dock.y0) };

  // ---- the globe: drag turns it (single-finger horizontal pans on touch; vertical swipes scroll), click inspects a square
  const gdrag = useRef<{ x: number; y: number; lon: number; lat: number; moved: boolean } | null>(null);
  const pick = (cx: number, cy: number) => {
    if (!g) return null;
    const y = cy - stageTop();
    let ll: [number, number] | null;
    if (o.view === "map") { const sh = obsSheet(L); ll = invertEqualEarth((cx - sh.cx) / sh.k, (sh.cy - y) / sh.k); }
    else ll = invertOrtho(cx, y, quatMat3(faceQuat(o.lon0, o.lat0)), [L.obs.cx, L.obs.cy, L.obs.r]);
    if (!ll) return null;
    const step = g.geom.step;
    return { row: Math.min(g.geom.nLat - 1, Math.floor((90 - ll[1]) / step)), col: Math.min(g.geom.nLon - 1, Math.floor((ll[0] + 180) / step)) };
  };
  const cellText = (cell: { row: number; col: number }) => {
    if (!g) return "";
    const step = g.geom.step, lat = 90 - (cell.row + 0.5) * step, lon = -180 + (cell.col + 0.5) * step;
    const off = g.meta.baseline_offsets[c.baseline]?.values, layer = g.meta.years.list.indexOf(o.year);
    const v = off && layer >= 0 ? anomalyAt(g.data, layer, g.geom, off)(cell.row * g.geom.nLon + cell.col) : null;
    return `${latLabel(lat)} ${lonLabel(lon)} · ${o.year} · ${v === null ? "NOT MEASURED" : `${signed(v, 1)} °C`} · ${anomalyTag(c.source, c.baseline).tag}`;
  };
  const gDown = (e: PointerEvent) => { gdrag.current = { x: e.clientX, y: e.clientY, lon: o.lon0, lat: o.lat0, moved: false }; (e.target as Element).setPointerCapture(e.pointerId); };
  const gMove = (e: PointerEvent) => {
    const d = gdrag.current;
    if (!d) {
      if (e.pointerType === "mouse") { const cell = pick(e.clientX, e.clientY); setTip(cell ? { x: e.clientX, y: e.clientY, text: cellText(cell) } : null); }
      return;
    }
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
    if (!d.moved || o.view === "map") return;
    const k = 90 / L.obs.r;
    obs.set({ lon0: d.lon - (e.clientX - d.x) * k, lat0: Math.max(-85, Math.min(85, d.lat + (e.clientY - d.y) * k)), playing: false });
  };
  const gUp = (e: PointerEvent) => {
    const d = gdrag.current;
    gdrag.current = null;
    if (d && !d.moved) { const cell = pick(e.clientX, e.clientY); obs.set({ cell }); }
  };
  const gKey = (e: KeyboardEvent) => {
    const m: Record<string, [number, number]> = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    if (m[e.key]) { e.preventDefault(); obs.set({ lon0: o.lon0 + m[e.key]![0], lat0: Math.max(-85, Math.min(85, o.lat0 + m[e.key]![1])) }); }
    if (e.key === "Enter" && g) {
      const step = g.geom.step;
      obs.set({ cell: { row: Math.min(g.geom.nLat - 1, Math.floor((90 - o.lat0) / step)), col: Math.floor((((o.lon0 + 540) % 360) - 180 + 180) / step) % g.geom.nLon } });
    }
  };
  const globeBox = o.view === "map" ? (() => { const sh = obsSheet(L); return { left: sh.cx - sh.width / 2, top: sh.cy - sh.width / 4.1, width: sh.width, height: sh.width / 2.05 }; })()
    : { left: L.obs.cx - L.obs.r, top: L.obs.cy - L.obs.r, width: 2 * L.obs.r, height: 2 * L.obs.r };

  const reset = () => { obs.set({ ...OBS_DEFAULT, year: last }); setClimate({ ...DEFAULTS, announce: "" }); setResetOk(true); setTimeout(() => setResetOk(false), 1200); };
  const rail = (
    <div className={`obs-rail ${sheet ? "is-open" : ""}`} id="obs-rail">
      {([
        ["VIEW", ["globe", "map"], o.view, (v: string) => obs.set({ view: v as "globe" | "map" }), (v: string) => v.toUpperCase(), () => null],
        ["SOURCE", ["gistemp", "hadcrut5"], c.source, (v: string) => setClimate({ source: v as Source, announce: "" }), (v: string) => SOURCE_LABEL[v as Source], () => null],
        ["BASELINE", BASELINES, c.baseline, (v: string) => setClimate({ baseline: v as Baseline, announce: "" }), (v: string) => v, (v: string) => (baselineAllowed(c.source, v as Baseline) ? null : "GISTEMP BEGINS IN 1880: NO 1850-1900 BASELINE")],
        ["LAYER", LAYERS, o.layer, (v: string) => obs.set({ layer: v as Layer }), (v: string) => LAYER_LABEL[v as Layer], () => null],
        ["REGION", ["all", ...BAND_IDS], typeof o.region === "string" ? o.region : o.region ? "" : "all", (v: string) => obs.set({ region: v === "all" ? null : (v as Region) }),
          (v: string) => (v === "all" ? "ALL" : (bandOf(v as Region)?.label.split(",")[1]?.trim().replace(" to ", "-").toUpperCase() ?? v.toUpperCase())), () => null],
      ] as const).map(([label, opts, val, set, render, why]) => (
        <div key={label} className="seg-ctl" role="radiogroup" aria-label={label}>
          <span className="seg-ctl__label" aria-hidden="true">{label}</span>
          <div className="seg-ctl__row">
            {(opts as readonly string[]).map((v) => {
              const w = (why as (v: string) => string | null)(v);
              return <button key={v} type="button" role="radio" aria-checked={val === v} aria-disabled={w ? true : undefined} title={w ?? undefined}
                className={`chip-btn ${val === v ? "is-on" : ""} ${w ? "is-disabled" : ""}`} onClick={() => !w && (set as (v: string) => void)(v)}>{(render as (v: string) => string)(v)}</button>;
            })}
          </div>
        </div>
      ))}
      {o.layer === "trend" ? (
        <div className="seg-ctl" role="radiogroup" aria-label="TREND PERIOD">
          <span className="seg-ctl__label" aria-hidden="true">TREND PERIOD</span>
          <div className="seg-ctl__row">{PERIODS.map((p) => <button key={p} type="button" role="radio" aria-checked={o.period === p} className={`chip-btn ${o.period === p ? "is-on" : ""}`} onClick={() => obs.set({ period: p })}>SINCE {PERIOD_START[p]}</button>)}</div>
        </div>
      ) : null}
      <button type="button" className="text-btn" onClick={reset}>{resetOk ? "RESET VIEW ✓" : "RESET VIEW"}</button>
    </div>
  );

  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="The Climate Signal Observatory" className="scene scene-obs">
      <div className="obs-head">
        <p className="obs-title">{copyOBS.title}</p>
        <h2 id="observatory-title" tabIndex={-1} data-scene-heading className="obs-line serif">{copyOBS.line}</h2>
        <p className="obs-hint">{copyOBS.hint}</p>
        <p className="obs-readout tnum" aria-live="polite" data-obs-readout>
          {o.year} · {c.source === "gistemp" ? "GISTEMP" : "HADCRUT5"} · {c.baseline} · {regionName(o.region)} → {readout ? (readout.empty ? "n/a" : readout.value) : "n/a"}
          {readout && !readout.empty && o.layer === "anomaly" ? ` · MEASURED ${pct(readout.share)}%` : ""}
        </p>
        {readout?.empty ? <p className="state-line state-line--empty">NO MEASURED CELLS IN {regionName(o.region)} IN {o.year}</p> : null}
        {readout ? <HonestyChip tag={readout.tag.tag} detail={readout.tag.detail} /> : null}
        <ArtifactStatus file={`grid_${c.source === "gistemp" ? "gistemp_2deg" : "hadcrut5_5deg"}`} state={grid} retry={retry} empty="">{() => null}</ArtifactStatus>
        {o.layer === "trend" && tg.status === "loading" ? <p className="state-line">LOADING TREND GRID</p> : null}
        <SceneErrors active={active === def.id} items={[{ file: `grid_trends_${c.source === "gistemp" ? "gistemp_2deg" : "hadcrut5_5deg"}.i8.bin.gz`, state: tg, retry: retryTg }, { file: "regional.json", state: reg, retry: retryR }, { file: "coastlines.json", state: coast, retry: retryK }]} />
      </div>
      <button type="button" className="obs-layers chip-btn" aria-expanded={sheet} aria-controls="obs-rail" onClick={() => setSheet((s) => !s)}>{sheet ? "CLOSE" : "LAYERS"}</button>
      {rail}
      {motion ? (
        <div className="globe-hit obs-globe" role="group" tabIndex={0} aria-label="Globe: arrow keys rotate it 10 degrees, Enter inspects the square at the centre"
          style={{ ...globeBox, borderRadius: o.view === "map" ? 0 : "50%" }}
          onPointerDown={gDown} onPointerMove={gMove} onPointerUp={gUp} onPointerLeave={() => setTip(null)} onKeyDown={gKey} />
      ) : <StaticObs year={o.year} source={c.source} baseline={c.baseline} version={version} />}
      <div className="obs-core" role="slider" tabIndex={0} aria-label="Year (drag along the core; drag across it to pick latitudes; Shift+arrows move the slice)" aria-valuemin={first} aria-valuemax={last} aria-valuenow={o.year}
        style={{ left: dock.x0, top: dock.y0, width: dock.x1 - dock.x0, height: dock.y1 - dock.y0 }}
        onPointerDown={coreDown} onPointerMove={coreMove} onPointerUp={coreUp} onPointerCancel={coreUp} onKeyDown={coreKey} />
      <div className={`obs-mark ${dock.lying ? "is-lying" : ""}`} aria-hidden="true" style={{ ...markPos, [dock.lying ? "height" : "width"]: dock.lying ? dock.y1 - dock.y0 : dock.x1 - dock.x0 }}>
        <span className="obs-mark__sq" /><span className="obs-mark__y tnum">{o.year}</span>
      </div>
      <button type="button" className="obs-play chip-btn" aria-pressed={o.playing} disabled={!motion} style={dock.lying ? { left: dock.x0, top: dock.y1 + 8 } : { left: dock.x0, top: dock.y1 + 12 }}
        onClick={() => obs.set({ playing: !o.playing })}>{o.playing ? "PAUSE" : "PLAY"}</button>
      <details className="obs-table">
        <summary>DATA TABLE FOR THIS VIEW</summary>
        <table>
          <caption>Latitude bands, {o.year}, {c.source.toUpperCase()}, anomaly vs {c.baseline} (cos-latitude weighted mean of measured squares)</caption>
          <thead><tr><th>Band</th><th>°C</th><th>Measured</th></tr></thead>
          <tbody>{bandTable.map((b) => <tr key={b.label}><td>{b.label}</td><td>{b.mean === null ? "n/a" : signed(b.mean)}</td><td>{pct(b.share)}%</td></tr>)}</tbody>
        </table>
      </details>
      {o.cell && g ? <Inspector cell={o.cell} onClose={() => obs.set({ cell: null })} /> : null}
      <Tooltip x={tip?.x ?? 0} y={tip?.y ?? 0} visible={!!tip}>{tip?.text}</Tooltip>
    </Track>
  );
}

/** Cell inspector (interaction 9): the square's full series under the active baseline, broken at missing years. */
function Inspector({ cell, onClose }: { cell: { row: number; col: number }; onClose: () => void }) {
  const c = useSyncExternalStore(subscribeClimate, getClimate);
  const o = obs.use();
  const g = bank.grids.get(c.source)!;
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<Element | null>(null);
  useEffect(() => {
    prev.current = document.activeElement;
    ref.current?.focus();
    const k = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k);
    return () => { removeEventListener("keydown", k); (prev.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);
  const { nLat, nLon, step } = g.geom;
  const i = cell.row * nLon + cell.col;
  const lat = 90 - (cell.row + 0.5) * step, lon = -180 + (cell.col + 0.5) * step;
  const off = g.meta.baseline_offsets[c.baseline]?.values;
  const ys = g.meta.years.list;
  const vals = ys.map((_, l) => (off ? anomalyAt(g.data, l, g.geom, off)(i) : null));
  const valid = vals.filter((v) => v !== null) as number[];
  const lo = Math.min(...valid, 0), hi = Math.max(...valid, 0);
  const x = (k: number) => 4 + (k / (ys.length - 1)) * 304, y = (v: number) => 76 - ((v - lo) / (hi - lo || 1)) * 72;
  let d = "", pen = false, subpaths = 0;
  vals.forEach((v, k) => { if (v === null) { pen = false; return; } if (!pen) subpaths++; d += `${pen ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
  const cur = ys.indexOf(o.year);
  // D-005: the line draws over its own measured length, then the dash is removed so the whole series stays drawn
  const line = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const el = line.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.dataset.length = String(len);
    if (!motionEnabled()) { el.style.strokeDasharray = ""; return; }
    el.style.transition = "none";
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    void el.getBoundingClientRect();
    el.style.transition = "stroke-dashoffset 600ms cubic-bezier(.5,0,0,1)";
    el.style.strokeDashoffset = "0";
    const done = () => { el.style.transition = ""; el.style.strokeDasharray = ""; el.style.strokeDashoffset = ""; };
    el.addEventListener("transitionend", done, { once: true });
    const t = window.setTimeout(done, 900);
    return () => { clearTimeout(t); el.removeEventListener("transitionend", done); };
  }, [d]);
  const t = bank.trends.get(c.source), li = bank.trendLayers(c.source, o.period);
  const slope = t && li ? t.data[li[0] * nLat * nLon + i] : undefined;
  const sig = t && li ? t.data[li[1] * nLat * nLon + i] : undefined;
  const firstValid = vals.findIndex((v) => v !== null), lastValid = vals.length - 1 - [...vals].reverse().findIndex((v) => v !== null);
  const tag = anomalyTag(c.source, c.baseline);
  return (
    <div className="inspector" role="dialog" aria-modal="false" aria-label={`Square ${latLabel(lat)} ${lonLabel(lon)}`} tabIndex={-1} ref={ref}>
      <span className="story-card__chip">CELL {latLabel(lat)} {lonLabel(lon)} · {c.source === "gistemp" ? "GISTEMP" : "HADCRUT5"}</span>
      <h3 className="inspector__title serif">{latLabel(lat)}, {lonLabel(lon)}</h3>
      {valid.length === 0 ? <p className="state-line">NEVER MEASURED IN THIS PRODUCT</p> : (
        <svg className="inspector__series" viewBox="0 0 312 80" role="img" data-subpaths={subpaths}
          aria-label={`Anomaly vs ${c.baseline} from ${ys[firstValid]} to ${ys[lastValid]}, min ${fixed(Math.min(...valid), 1)}, max ${fixed(Math.max(...valid), 1)} C, ${vals.length - valid.length} missing years`}>
          <line x1={0} x2={312} y1={y(0)} y2={y(0)} className="inspector__zero" />
          <path ref={line} d={d} className="inspector__line" data-last-x={x(lastValid).toFixed(1)} />
          {cur >= 0 && vals[cur] !== null ? <rect x={x(cur) - 3} y={y(vals[cur]!) - 3} width={6} height={6} className="inspector__now" /> : null}
        </svg>
      )}
      <p className="inspector__line-t tnum">VALID YEARS {valid.length} OF {ys.length} · {o.year}: {cur >= 0 && vals[cur] !== null ? `${signed(vals[cur]!, 1)} °C VS ${c.baseline}` : "NOT MEASURED"}</p>
      {slope !== undefined ? <p className="inspector__line-t tnum">TREND SINCE {PERIOD_START[o.period]}: {slope === -128 ? "TOO FEW YEARS" : `${signed(slope * 0.01)} °C / DECADE · ${sig ? "BEYOND ITS AR(1) 95% CI" : "CI INCLUDES 0"}`}</p> : null}
      <div className="inspector__tags"><HonestyChip tag={tag.tag} detail={tag.detail} /><HonestyChip tag="DERIVED" detail="CELL TREND" /></div>
      <button type="button" className="btn-square" onClick={onClose}>CLOSE</button>
    </div>
  );
}

/** Reduced motion / no motion: the observatory planet as a static frame; every control still redraws it. */
function StaticObs({ year, source, baseline, version }: { year: number; source: Source; baseline: Baseline; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const o = obs.use();
  useEffect(() => {
    if (!ref.current) return;
    const draw = () => paintStatic(ref.current!, (L, dpr) => {
      const d = L.obs;
      const f = planetFrame(L, dpr, d, faceQuat(o.lon0, o.lat0), source, year, baseline);
      const g = bank.grids.get(source);
      if (g && bank.core(source, baseline)) {
        const k = L.dock, n = L.core.n;
        const v = uprightBoxes(n, k), h = lyingBoxes(n, k);
        f.core = { key: `${source}:${baseline}`, nLat: g.geom.nLat, step: g.geom.step, cur: n - 1, v, h, bench: k.lying ? 1 : 0, spine: Float32Array.from(v).fill(HIDDEN), alpha: 1, sep: 0.6, thickPx: 1 };
      }
      const gk = f.cells[0]?.grid;
      if (gk && gk !== "intro") f.cells = [still(gk, bank.grids.get(gk)!.meta.years.list.indexOf(year), baseline)];
      const mode = o.layer === "trend" ? 1 : o.layer === "plus2" ? 2 : o.layer === "coverage" ? 3 : 0;
      const li = bank.trendLayers(source, o.period);
      f.mode = mode; f.modeMix = 1;
      if (li) f.trend = { key: source, slope: li[0], sig: li[1] };
      const b = typeof o.region === "string" ? bank.band(o.region) : null;
      if (b) f.band = [b.lat_min, b.lat_max, 1];
      else if (o.region && typeof o.region === "object") f.band = [o.region.lat0, o.region.lat1, 1];
      return [f, { orb: null, halo: null, outline: null, limb: { disc: d, alpha: 0.24 } }];
    });
    // L15 / D-022: paint on mount and on every resize (the canvas is sized by the 100dvh stage)
    draw();
    addEventListener("resize", draw);
    return () => removeEventListener("resize", draw);
  }, [year, source, baseline, version, o]);
  return <canvas ref={ref} className="obs-static" role="img" aria-label={`Observatory planet, ${year}, ${source}, vs ${baseline}`} />;
}
