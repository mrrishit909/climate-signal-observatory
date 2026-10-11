import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { getStore } from "../data/loader";
import { CO2, EXTREMES, GRIDS, SERIES } from "../data/artifacts";
import { copyS03a, SOURCE_LABEL, yearReadout } from "../data/copy";
import { BASELINES, type Baseline, type Source } from "../data/types";
import { BINS, EDGE_LABELS } from "../model/bins";
import { RANK_BASELINE, rankOf } from "../model/rank";
import { areaShares } from "../model/zonal";
import { DEFAULTS, NATIVE, baselineAllowed, getClimate, setClimate, subscribeClimate } from "../state/climate";
import { bank } from "../state/bank";
import { useActiveScene, useMotion } from "../scroll/hooks";
import { faceQuat } from "../gl/projection";
import { paintStatic } from "./director";
import { planetFrame } from "./frames";
import { layout } from "./geometry";
import { useViewport } from "./useViewport";
import type { SceneDef } from "../app/scenes";

export const SERIES_ID: Record<Source, string> = { gistemp: "gistemp_glb", hadcrut5: "hadcrut5_glb" };

/** Honesty chip for an anomaly under (source, baseline): only the source's native baseline is OBSERVED. */
export function anomalyTag(source: Source, baseline: Baseline) {
  return baseline === NATIVE[source]
    ? { tag: "OBSERVED" as const, detail: `${source === "gistemp" ? "GISTEMP v4" : "HADCRUT5"} · ${baseline}` }
    : { tag: "DERIVED" as const, detail: `${source === "gistemp" ? "GISTEMP v4" : "HADCRUT5"} REBASED TO ${baseline}` };
}

function Radio<T extends string>({ label, value, options, onChange, disabled, render }: {
  label: string; value: T; options: readonly T[]; onChange: (v: T) => void; disabled?: (v: T) => string | null; render?: (v: T) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    for (let k = 1; k <= options.length; k++) {
      const j = (i + d * k + options.length) % options.length;
      if (!disabled?.(options[j]!)) { onChange(options[j]!); refs.current[j]?.focus(); break; }
    }
  };
  return (
    <div className="seg-ctl" role="radiogroup" aria-label={label}>
      <span className="seg-ctl__label" aria-hidden="true">{label}</span>
      <div className="seg-ctl__row">
        {options.map((o, i) => {
          const why = disabled?.(o) ?? null;
          return (
            <button key={o} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={o === value} aria-disabled={why ? true : undefined}
              tabIndex={o === value ? 0 : -1} title={why ?? undefined} className={`chip-btn ${o === value ? "is-on" : ""} ${why ? "is-disabled" : ""}`}
              onClick={() => { if (!why) onChange(o); }} onKeyDown={(e) => key(e, i)}>
              {render ? render(o) : o}
              {why ? <span className="chip-btn__why" role="tooltip">{why}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend" aria-label="Anomaly bins in degrees C">
      <div className="legend__swatches">{BINS.map((b) => <span key={b.id} style={{ background: b.color }} title={b.label} />)}</div>
      <div className="legend__edges" aria-hidden="true">{EDGE_LABELS.map((e) => <span key={e}>{e}</span>)}</div>
      <p className="legend__miss"><span className="lattice-swatch" aria-hidden="true" /> NOT MEASURED <span className="legend__unit">°C VS THE CHOSEN NORMAL</span></p>
    </div>
  );
}

/** S03a "Year Scrub" (interaction 2): scroll sets an integer year; BASELINE and SOURCE re-bin every cell. */
export function S03aYears({ def }: { def: SceneDef }) {
  const c = useSyncExternalStore(subscribeClimate, getClimate);
  const motion = useMotion();
  const active = useActiveScene();
  const [series] = useArtifact(SERIES);
  const [co2] = useArtifact(CO2);
  const [ext] = useArtifact(EXTREMES);
  const [grid, retry] = useArtifact(GRIDS[c.source], false);
  const version = useSyncExternalStore(bank.subscribe, bank.getVersion);
  const vp = useViewport();
  const [resetOk, setResetOk] = useState(false);

  // HadCRUT5 is prefetched at S03a entry (MOTION_SYSTEM 9.3); the active source loads now
  useEffect(() => { getStore(GRIDS[c.source]).prefetch(); }, [c.source]);
  useEffect(() => { if (active === "years") getStore(GRIDS.hadcrut5).prefetch(); }, [active]);

  const year = c.year;
  const r = useMemo(() => {
    const yi = year - 1850;
    const s = series.status === "ready" ? series.data.series.find((x) => x.id === SERIES_ID[c.source]) : undefined;
    const vals = s?.values[c.baseline];
    const g = bank.grids.get(c.source);
    const layer = g ? g.meta.years.list.indexOf(year) : -1;
    const off = g?.meta.baseline_offsets[c.baseline]?.values;
    const shares = g && off && layer >= 0 ? areaShares(g.data, layer, g.geom, off) : null;
    const metric = ext.status === "ready" ? ext.data.metrics.find((m) => m.id === `${c.source}_above_p95_${c.baseline}`) : undefined;
    const co2First = co2.status === "ready" ? Number(co2.data.monthly.start.slice(0, 4)) + Math.floor(co2.data.monthly.mlo_ppm.findIndex((v) => v !== null) / 12) : 1958;
    return {
      lines: yearReadout({
        year, source: c.source, baseline: c.baseline,
        global: vals?.[yi] ?? null,
        rank: s?.values[RANK_BASELINE] ? rankOf(s.values[RANK_BASELINE]!, yi) : null,
        co2: co2.status === "ready" ? co2.data.mlo_annual_ppm[yi] ?? null : null, co2First,
        measured: g && layer >= 0 ? g.meta.valid_area_share_per_year[layer]! : null,
        extremes: metric ? { share: metric.area_share[yi] ?? null, expected: metric.expected_share_in_reference } : null,
        lostMost: !!shares && shares.measured > 0 && shares.referenced < 0.4 * shares.measured,
      }),
      empty: !!shares && shares.referenced === 0,
    };
    // version: recompute when a grid lands
  }, [year, c.source, c.baseline, series, co2, ext, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const tag = anomalyTag(c.source, c.baseline);
  const changed = c.source !== DEFAULTS.source || c.baseline !== DEFAULTS.baseline;
  const reset = () => { setClimate({ ...DEFAULTS, announce: "RESET TO GISTEMP, 1951-1980" }); setResetOk(true); setTimeout(() => setResetOk(false), 1200); };
  const L = layout(vp.w, vp.h);
  const k = L.core;
  const ty = k.y0 + (k.n - 1 - (year - 1850)) * k.H;

  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="Year by year" className="scene scene-years">
      <div className="years-text">
        <h2 id="years-title" tabIndex={-1} data-scene-heading className="scene-statement">{copyS03a.statement}</h2>
        <p className="scene-body">{copyS03a.body}</p>
      </div>
      <div className="years-controls">
        <Radio label="BASELINE" value={c.baseline} options={BASELINES} onChange={(b) => setClimate({ baseline: b, announce: "" })}
          disabled={(b) => (baselineAllowed(c.source, b) ? null : copyS03a.disabled1850)} />
        <Radio label="SOURCE" value={c.source} options={["gistemp", "hadcrut5"] as const} render={(s) => SOURCE_LABEL[s]} onChange={(s) => setClimate({ source: s, announce: "" })} />
        {changed || resetOk ? <button type="button" className="text-btn" onClick={reset}>{resetOk ? "RESET ✓" : "RESET"}</button> : null}
        <p className="sr-only" aria-live="polite">{c.announce}</p>
      </div>
      <div className="years-readout" data-readout>
        <p className="readout-year tnum" data-year>{r.lines.year}</p>
        <p className="readout-line tnum" data-global>{r.lines.global}</p>
        <p className="readout-line tnum">{r.lines.rank} <HonestyChip tag="DERIVED" className="chip--inline" /></p>
        <p className="readout-line tnum">{r.lines.co2}</p>
        <p className="readout-line tnum">{r.lines.measured}</p>
        <p className="readout-line readout-line--sm tnum">{r.lines.extremes}</p>
        {r.lines.lost ? <p className="readout-line readout-line--warn">{r.lines.lost}</p> : null}
        {r.empty ? <p className="state-line state-line--empty">NO MEASURED CELLS FOR {year} UNDER {c.baseline}</p> : null}
        <ArtifactStatus file={`grid_${c.source === "gistemp" ? "gistemp_2deg" : "hadcrut5_5deg"}`} state={grid} retry={retry} empty="">{() => null}</ArtifactStatus>
        <Legend />
        <HonestyChip tag={tag.tag} detail={tag.detail} />
      </div>
      {motion ? (
        <div className="year-track" aria-hidden="true" style={{ top: k.y0, height: k.n * k.H }}>
          <span className="year-track__mark" style={{ transform: `translateY(${ty - k.y0 - 6}px)` }} />
        </div>
      ) : (
        <StaticYears source={c.source} baseline={c.baseline} version={version} />
      )}
    </Track>
  );
}

/** Reduced motion: four static planets (1880, 1940, 1980, latest); the controls redraw all four (MOTION_SYSTEM 8). */
function StaticYears({ source, baseline, version }: { source: Source; baseline: Baseline; version: number }) {
  const latest = bank.axis().at(-1)!;
  const years = [1880, 1940, 1980, latest];
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    refs.current.forEach((cv, i) => cv && paintStatic(cv, (L, dpr) => {
      const d = { cx: L.w / 2, cy: L.h / 2, r: Math.min(L.w, L.h) * 0.46 };
      return [planetFrame(L, dpr, d, faceQuat(-30, 15), source, years[i]!, baseline), { orb: null, halo: null, outline: null, limb: { disc: d, alpha: 0.24 } }];
    }));
  }); // repaint on every render: source, baseline and grid version drive it
  void version;
  return (
    <div className="years-static">
      {years.map((y, i) => (
        <figure key={y}>
          <canvas ref={(el) => { refs.current[i] = el; }} role="img" aria-label={`${y} anomaly map, ${source.toUpperCase()}, vs ${baseline}`} />
          <figcaption className="tnum">{y}</figcaption>
        </figure>
      ))}
    </div>
  );
}
