import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus, SceneErrors } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { getStore } from "../data/loader";
import { COAST, FACTS, REGIONAL, TREND_GRIDS, TRENDS } from "../data/artifacts";
import { copyS03b } from "../data/copy";
import { fixed, pct, signed } from "../model/format";
import { BINS } from "../model/bins";
import { TREND_EDGE_LABELS } from "../model/trend";
import { getClimate, subscribeClimate } from "../state/climate";
import { BAND_IDS, PERIODS, regions, type BandId } from "../state/scenes";
import { useActiveScene, useMotion, useProgress } from "../scroll/hooks";
import { jumpTo } from "../scroll/engine";
import { stepState } from "../motion/progress";
import { REGION_BANDS, REGION_FACES, paintStatic } from "./director";
import { planetFrame } from "./frames";
import { faceQuat } from "../gl/projection";
import { layout } from "./geometry";
import { useViewport } from "./useViewport";
import { bank } from "../state/bank";
import type { SceneDef } from "../app/scenes";

const PERIOD_LABEL: Record<string, string> = { "1880_latest": "SINCE 1880", "1951_latest": "SINCE 1951", "1975_latest": "SINCE 1975", "1991_latest": "SINCE 1991" };
const THRESH = [0.25, 0.5, 0.75];

/** S03b Regional Turn (interaction 3): four stepped turns, the TREND surface, a band ledger the visitor can drive. */
export function S03bRegions({ def }: { def: SceneDef }) {
  const c = useSyncExternalStore(subscribeClimate, getClimate);
  const st = regions.use();
  const motion = useMotion();
  const active = useActiveScene();
  const vp = useViewport();
  const [facts, retryF] = useArtifact(FACTS);
  const [trends, retryT2] = useArtifact(TRENDS);
  const [reg, retryR] = useArtifact(REGIONAL);
  const [coast, retryK] = useArtifact(COAST);
  const [tg, retryT] = useArtifact(TREND_GRIDS[c.source], false);
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  useProgress(def.id, (p) => {
    const s = stepState(stepRef.current, p, THRESH);
    if (s !== stepRef.current) { stepRef.current = s; setStep(s); }
  });
  useEffect(() => { if (active === "regions" || active === "years") getStore(TREND_GRIDS[c.source]).prefetch(); }, [active, c.source]);

  const band: BandId | null = st.override ?? REGION_BANDS[step] ?? null;
  const copy = useMemo(() => {
    if (facts.status !== "ready" || reg.status !== "ready") return null;
    const arctic = trends.status === "ready" ? trends.data.series.find((s) => s.series_id === "gistemp_band_arctic")?.fits.find((f) => f.period === "1975_latest")?.slope_per_decade ?? null : null;
    return copyS03b(facts.data, (id) => reg.data.bands.find((b) => b.id === id)?.label ?? id, arctic);
  }, [facts, reg, trends]);
  const ledger = useMemo(() => {
    if (trends.status !== "ready" || reg.status !== "ready") return null;
    const last = reg.data.years.length - 1;
    return BAND_IDS.map((id) => {
      const b = reg.data.bands.find((x) => x.id === id)!;
      const fit = trends.data.series.find((s) => s.series_id === `${c.source}_band_${id}`)?.fits.find((f) => f.period === st.period);
      const row = reg.data.rows.find((r) => r.band === id && r.source === c.source);
      const share = row?.valid_area_share[last] ?? null;
      const start = PERIOD_LABEL[st.period]!.slice(6);
      return {
        id, label: b.label.toUpperCase(),
        text: fit ? `${signed(fit.slope_per_decade)} °C / DECADE (${fixed(fit.ci_ar1[0], 2)} TO ${fixed(fit.ci_ar1[1], 2)})` : `TOO FEW MEASURED YEARS FOR A TREND SINCE ${start}`,
        share: share === null ? "n/a" : `${pct(share)}%`,
      };
    });
  }, [trends, reg, c.source, st.period]);
  const state = copy?.states[step];
  const turn = (id: BandId) => regions.set({ override: id, drag: null });
  const key = (e: KeyboardEvent) => {
    const i = BAND_IDS.indexOf(band ?? "arctic");
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); turn(BAND_IDS[Math.min(4, i + 1)]!); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); turn(BAND_IDS[Math.max(0, i - 1)]!); }
  };

  // drag rotates the globe (pointer only; wheel always scrolls); on release it returns to the state's face after 1.5s
  const L = layout(vp.w, vp.h);
  const drag = useRef<{ x: number; y: number; lon: number; lat: number } | null>(null);
  const releaseT = useRef(0);
  const down = (e: PointerEvent) => {
    const [lon, lat] = st.drag ? [st.drag.lon, st.drag.lat] : REGION_FACES[step]!;
    drag.current = { x: e.clientX, y: e.clientY, lon, lat };
    (e.target as Element).setPointerCapture(e.pointerId);
    clearTimeout(releaseT.current);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const k = 90 / L.G1r.r;
    regions.set({ drag: { lon: d.lon - (e.clientX - d.x) * k, lat: Math.max(-85, Math.min(85, d.lat + (e.clientY - d.y) * k)) } });
  };
  const up = () => { drag.current = null; releaseT.current = window.setTimeout(() => { if (!regions.get().override) regions.set({ drag: null }); }, 1500); };
  const legend = (
    <div className="legend" aria-label="Trend bins in degrees C per decade">
      <div className="legend__swatches">{BINS.map((b) => <span key={b.id} style={{ background: b.color }} />)}</div>
      <div className="legend__edges" aria-hidden="true">{TREND_EDGE_LABELS.map((e, i) => <span key={e} style={{ "--i": i + 1 } as CSSProperties}>{e}</span>)}</div>
      <p className="legend__miss"><span className="lattice-swatch" aria-hidden="true" /> TOO FEW YEARS <span className="stipple-swatch" aria-hidden="true" /> CI INCLUDES 0</p>
    </div>
  );
  const nSig = tg.status === "ready" ? tg.data.meta.periods.find((p) => p.id === st.period) : undefined;

  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="Where it warms fastest" className="scene scene-regions">
      <SceneErrors active={active === def.id} items={[{ file: "facts.json", state: facts, retry: retryF }, { file: "trends.json", state: trends, retry: retryT2 }, { file: "regional.json", state: reg, retry: retryR }, { file: "coastlines.json", state: coast, retry: retryK }]} />
      <div className="regions-text">
        <h2 id="regions-title" tabIndex={-1} data-scene-heading className="scene-statement">{copy?.statement ?? def.title}</h2>
        {state ? <p className="scene-body" key={`b${step}`}>{state.body}</p> : null}
        <div className="seg-ctl" role="radiogroup" aria-label="TREND PERIOD">
          <span className="seg-ctl__label" aria-hidden="true">TREND PERIOD</span>
          <div className="seg-ctl__row seg-ctl__row--scroll">
            {PERIODS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={st.period === p} tabIndex={st.period === p ? 0 : -1} className={`chip-btn ${st.period === p ? "is-on" : ""}`} onClick={() => regions.set({ period: p })}>{PERIOD_LABEL[p]}</button>
            ))}
          </div>
        </div>
        {ledger ? (
          <ol className="ledger" aria-label="Band trends, AR(1)-adjusted 95% intervals">
            {ledger.map((r) => (
              <li key={r.id} className={r.id === band ? "is-active" : ""}>
                <button type="button" onClick={() => turn(r.id)} aria-pressed={r.id === band}>
                  <span className="ledger__label">{r.label}</span>
                  <span className="ledger__val tnum">{r.text} · MEASURED {r.share}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="regions-chips">
          <HonestyChip tag="DERIVED" detail={`CELL TRENDS ${PERIOD_LABEL[st.period]}${nSig ? ` · ${nSig.n_significant_cells} OF ${nSig.n_valid_cells} CELLS BEYOND THEIR CI` : ""}`} />
          <HonestyChip tag="DERIVED" detail="BAND MEANS · AR(1) 95% CI" />
        </div>
        <ArtifactStatus file={`grid_trends_${c.source === "gistemp" ? "gistemp_2deg" : "hadcrut5_5deg"}`} state={tg} retry={retryT} empty="">{() => null}</ArtifactStatus>
        {tg.status === "error" ? <p className="state-line state-line--muted">SURFACE: {bank.axis().at(-1)} ANOMALY, NOT TREND</p> : null}
        {st.override ? <button type="button" className="text-btn" onClick={() => regions.set({ override: null, drag: null })}>RESET VIEW</button> : null}
        {motion ? legend : null}
      </div>
      {state ? <p className="regions-title serif" key={`t${step}`} aria-live="polite">{st.override ? (ledger?.find((l) => l.id === st.override)?.label ?? "") : state.title}</p> : null}
      {motion ? (
        <div className="globe-hit" role="group" tabIndex={0} aria-label="Globe: Left and Right turn to the next latitude band; drag to rotate" onKeyDown={key}
          style={{ left: L.G1r.cx - L.G1r.r, top: L.G1r.cy - L.G1r.r, width: 2 * L.G1r.r, height: 2 * L.G1r.r }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      ) : (
        <StaticRegions period={st.period} source={c.source} copyTitles={copy?.states.map((s) => s.title) ?? []} legend={legend} />
      )}
      {motion ? <nav className="regions-steps" aria-label="Regional states">{(copy?.states ?? []).map((s, i) => (
        <button key={s.title} type="button" className={`step-dot ${i === step ? "is-on" : ""}`} aria-label={s.title} aria-current={i === step ? "step" : undefined}
          onClick={() => jumpTo(def.id, [0.1, 0.35, 0.6, 0.85][i]!)} />
      ))}</nav> : null}
    </Track>
  );
}

/** Reduced motion: one planet per state, instant (MOTION_SYSTEM 8). */
function StaticRegions({ period, source, copyTitles, legend }: { period: string; source: "gistemp" | "hadcrut5"; copyTitles: string[]; legend: React.ReactNode }) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const version = useSyncExternalStore(bank.subscribe, bank.getVersion);
  useEffect(() => {
    refs.current.forEach((cv, i) => cv && paintStatic(cv, (L, dpr) => {
      const d = { cx: L.w / 2, cy: L.h / 2, r: Math.min(L.w, L.h) * 0.46 };
      const [lon, lat] = REGION_FACES[i]!;
      const f = planetFrame(L, dpr, d, faceQuat(lon, lat), source, bank.axis().at(-1)!, "1951-1980");
      const layers = bank.trendLayers(source, period);
      if (layers) { f.mode = 1; f.modeMix = 1; f.trend = { key: source, slope: layers[0], sig: layers[1] }; }
      const b = REGION_BANDS[i] ? bank.band(REGION_BANDS[i]!) : undefined;
      if (b) f.band = [b.lat_min, b.lat_max, 1];
      return [f, { orb: null, halo: null, outline: null, limb: { disc: d, alpha: 0.24 } }];
    }));
  }, [period, source, version]);
  return (
    <div className="years-static regions-static">
      {REGION_FACES.map((_, i) => (
        <figure key={i}>
          <canvas ref={(el) => { refs.current[i] = el; }} role="img" aria-label={`${copyTitles[i] ?? ""}: cell trends ${period.replace("_latest", "")} to latest`} />
          <figcaption>{copyTitles[i]}</figcaption>
        </figure>
      ))}
      <div className="regions-static__legend">{legend}</div>
    </div>
  );
}
