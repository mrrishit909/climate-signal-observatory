import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { Tooltip } from "../components/Tooltip";
import { SERIES } from "../data/artifacts";
import { obs } from "../state/scenes";
import { pct, signed } from "../model/format";
import { SERIES_ID } from "./S03aYears";
import { MISSING_F } from "../model/zonal";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus, SceneErrors } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { getStore } from "../data/loader";
import { COAST, FACTS, GRIDS, VALIDATION } from "../data/artifacts";
import { copyS04, SOURCE_LABEL, top10 } from "../data/copy";
import type { Source } from "../data/types";
import { stepState } from "../motion/progress";
import { getClimate, setClimate, subscribeClimate } from "../state/climate";
import { bank } from "../state/bank";
import { useActiveScene, useMotion, useProgress } from "../scroll/hooks";
import { paintStatic } from "./director";
import { S04, strataFrame, strataPhase } from "./frames";
import { layout } from "./geometry";
import { useViewport } from "./useViewport";
import { anomalyTag } from "./S03aYears";
import type { SceneDef } from "../app/scenes";

const STATIC_P = [0.08, 0.3, 0.45, 0.86, 1] as const;
const STATIC_NAMES = ["SPHERE", "SHEET", "STRIP", "CORE", "CORE + SPINE"];

/** S04 "The Unwrap" (interaction 5): sphere -> Equal Earth sheet -> zonal rows -> one strip -> the core. */
export function S04Strata({ def }: { def: SceneDef }) {
  const c = useSyncExternalStore(subscribeClimate, getClimate);
  const version = useSyncExternalStore(bank.subscribe, bank.getVersion);
  const motion = useMotion();
  const vp = useViewport();
  const [facts, retryF] = useArtifact(FACTS);
  const [val, retryV] = useArtifact(VALIDATION);
  const [coast, retryK] = useArtifact(COAST);
  const activeScene = useActiveScene();
  const [grid, retry] = useArtifact(GRIDS[c.source], false);
  const [phase, setPhase] = useState(0);
  const [spine, setSpine] = useState(0);
  const [cover, setCover] = useState(0);
  useEffect(() => { getStore(GRIDS[c.source]).prefetch(); }, [c.source]);
  useProgress(def.id, (p) => {
    setPhase(strataPhase(p));
    setSpine((s) => stepState(s, p, [S04.spine]));
    setCover((s) => stepState(s, p, [S04.coverage]));
  });

  const L = layout(vp.w, vp.h);
  const k = L.core;
  const g = bank.grids.get(c.source);
  const axis = bank.axis();
  const copy = facts.status === "ready" ? copyS04(facts.data, {
    nCells: (g?.geom.nLat ?? 90) * (g?.geom.nLon ?? 180), nLayers: axis.length, source: c.source,
    firstYear: g?.meta.years.first ?? 1880, firstShare: g?.meta.valid_area_share_per_year[0] ?? 0,
    latestYear: axis.at(-1)!, latestShare: g?.meta.valid_area_share_per_year.at(-1) ?? 0,
    validation: val.status === "ready" ? val.data : null, baseline: c.baseline,
  }) : null;
  void version;
  const ready = !!bank.cores.get(`${c.source}:${c.baseline}`);
  const landed = !motion || phase >= 4;
  const showSpine = !motion || spine > 0;
  const slotY = (year: number) => k.y0 + (k.n - 1 - (year - 1850)) * k.H;
  const every = L.cls === "M" ? 40 : 20;
  const labels = [1850, ...axis.filter((y) => y % every === 0 && y > 1850 && axis.at(-1)! - y >= 4 * (L.cls === "M" ? 2 : 1)), axis.at(-1)!];
  const tag = anomalyTag(c.source, c.baseline);
  const [series, retryS] = useArtifact(SERIES);
  const [tip, setTip] = useState<{ x: number; y: number; year: number } | null>(null);
  const yearAt = (clientY: number) => Math.max(1850, Math.min(axis.at(-1)!, 1850 + (k.n - 1) - Math.floor((clientY - k.y0) / k.H)));
  const hover = (e: PointerEvent) => setTip({ x: e.clientX, y: e.clientY, year: yearAt(e.clientY) });
  const tipText = (yy: number) => {
    const s = series.status === "ready" ? series.data.series.find((x) => x.id === SERIES_ID[c.source])?.values[c.baseline]?.[yy - 1850] : null;
    const gi = g?.meta.years.list.indexOf(yy) ?? -1;
    const share = g && gi >= 0 ? g.meta.valid_area_share_per_year[gi] : null;
    return `${yy} · GLOBAL ${s === null || s === undefined ? "n/a" : `${signed(s)} °C`} VS ${c.baseline} · MEASURED ${share === null || share === undefined ? "n/a" : `${pct(share)}%`}`;
  };
  // a11y: decade-mean zonal anomalies for five bands, from the same core texture the strata draw
  const table = useMemo(() => {
    const tex = bank.cores.get(`${c.source}:${c.baseline}`);
    if (!tex || !g) return null;
    const W = g.geom.nLat + 1, bands: [string, number, number][] = [["60-90N", 60, 90], ["30-60N", 30, 60], ["30S-30N", -30, 30], ["30-60S", -60, -30], ["60-90S", -90, -60]];
    const decades = [1880, 1900, 1920, 1940, 1960, 1980, 2000, 2020].filter((d) => d >= (g.meta.years.first));
    return decades.map((d) => ({ d, v: bands.map(([, lo, hi]) => {
      let s = 0, w = 0;
      for (let yy = d; yy < d + 10 && yy <= axis.at(-1)!; yy++) for (let r = 0; r < g.geom.nLat; r++) {
        const lat = g.geom.latFirst - r * g.geom.step; if (lat < lo || lat > hi) continue;
        const m = tex[(yy - 1850) * W + r]!; if (m <= MISSING_F) continue;
        const cw = Math.cos((lat * Math.PI) / 180); s += cw * m / 100; w += cw;
      }
      return w ? signed(s / w) : "n/a";
    }) }));
  }, [c.source, c.baseline, g, version]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="From planet to record" className="scene scene-strata">
      <SceneErrors active={activeScene === def.id} items={[{ file: "facts.json", state: facts, retry: retryF }, { file: "validation.json", state: val, retry: retryV }, { file: "series_annual.json", state: series, retry: retryS }, { file: "coastlines.json", state: coast, retry: retryK }]} />
      <div className={`strata-text ${landed && ready ? "is-landed" : ""}`}>
        <h2 id="strata-title" tabIndex={-1} data-scene-heading className="scene-statement" key={showSpine ? "s2" : "s1"}>
          {copy ? (showSpine ? copy.s2 : copy.s1) : def.title}
        </h2>
        {copy && motion ? <p className="phase-caption tnum" key={phase} aria-live="polite">{copy.captions[phase]}</p> : null}
        {copy && !motion ? <ol className="phase-list">{copy.captions.map((t) => <li key={t}>{t}</li>)}</ol> : null}
        <div className="strata-chips">
          <HonestyChip tag={tag.tag} detail={`CELLS · ${tag.detail}`} />
          <HonestyChip tag="DERIVED" detail="LAYERS = ZONAL MEANS" />
        </div>
        {copy ? <p className="sr-only">{copy.alt}</p> : null}
      </div>
      {!ready ? (
        <div className="strata-loading">
          <ArtifactStatus file={`grid_${c.source === "gistemp" ? "gistemp_2deg" : "hadcrut5_5deg"}`} state={grid} retry={retry} empty="">{() => null}</ArtifactStatus>
          {copy && grid.status !== "error" ? <p className="state-line state-line--muted">{copy.loading}</p> : null}
        </div>
      ) : null}
      {motion ? (
        <div className={`core-labels ${landed && ready ? "is-in" : ""}`} aria-hidden="true">
          {labels.map((y) => <span key={y} className="core-year tnum" style={{ top: slotY(y) + k.H / 2, left: L.cls === "M" ? k.x0 - 44 : k.spine[1] + 16 }}>{y}</span>)}
          <span className="core-axis" style={{ top: k.y0 + k.n * k.H + 8, left: k.x0 }}>S</span>
          <span className="core-axis" style={{ top: k.y0 + k.n * k.H + 8, left: (k.x0 + k.x1) / 2 - 8 }}>EQ</span>
          <span className="core-axis" style={{ top: k.y0 + k.n * k.H + 8, left: k.x1 - 8 }}>N</span>
          {facts.status === "ready" && showSpine && c.source === "gistemp" ? top10(facts.data).map((y) => (
            <span key={`t${y}`} className="core-top10" style={{ top: slotY(y) + k.H / 2, left: k.spine[1] + 4 }} />
          )) : null}
          {facts.status === "ready" && showSpine && c.source === "gistemp" ? <span className="core-top10-label" style={{ top: slotY(axis.at(-1)! - 6), left: k.spine[1] + (L.cls === "M" ? 14 : 60), maxWidth: L.w - k.spine[1] - (L.cls === "M" ? 22 : 68) }}>◂ TEN WARMEST</span> : null}
          {c.source === "gistemp" && copy ? <span className="core-begins" style={{ top: slotY(1865), left: (k.x0 + k.x1) / 2 }}>{copy.begins}</span> : null}
        </div>
      ) : null}
      {motion && landed && ready ? (
        <div className="core-hit" aria-hidden="true" style={{ left: k.x0, top: k.y0, width: k.x1 - k.x0, height: k.n * k.H }}
          onPointerMove={hover} onPointerLeave={() => setTip(null)} onClick={(e) => { const yy = yearAt(e.clientY); obs.set({ year: yy }); setTip({ x: e.clientX, y: e.clientY, year: yy }); }} />
      ) : null}
      <Tooltip x={tip?.x ?? 0} y={tip?.y ?? 0} visible={!!tip}>{tip ? tipText(tip.year) : ""}</Tooltip>
      {table ? (
        <div className="sr-only"><table>
          <caption>Decade-mean zonal anomalies, {c.source.toUpperCase()}, vs {c.baseline}, degrees C (mean of each layer's latitude rows)</caption>
          <thead><tr><th>Decade</th><th>60-90N</th><th>30-60N</th><th>30S-30N</th><th>30-60S</th><th>60-90S</th></tr></thead>
          <tbody>{table.map((r) => <tr key={r.d}><td>{r.d}s</td>{r.v.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
        </table></div>
      ) : null}
      <div className={`strata-foot ${landed && ready ? "is-in" : ""}`}>
        {landed && ready ? (
          <div className="seg-ctl" role="radiogroup" aria-label="SOURCE">
            <span className="seg-ctl__label" aria-hidden="true">SOURCE</span>
            <div className="seg-ctl__row">
              {(["gistemp", "hadcrut5"] as Source[]).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={c.source === s} tabIndex={c.source === s ? 0 : -1}
                  className={`chip-btn ${c.source === s ? "is-on" : ""}`} onClick={() => setClimate({ source: s, announce: "" })}>{SOURCE_LABEL[s]}</button>
              ))}
            </div>
          </div>
        ) : null}
        <span className="m-only"><HonestyChip tag={tag.tag} detail={`CELLS · ${tag.detail}`} /><HonestyChip tag="DERIVED" detail="LAYERS = ZONAL MEANS" /></span>
        {copy && showSpine ? <p className="strata-note"><HonestyChip tag="DERIVED" detail="SPINE" className="chip--inline" /> {copy.footnote}</p> : null}
        {copy && (!motion || cover > 0) ? <p className="strata-note tnum" data-coverage>{copy.coverage}</p> : null}
      </div>
      {!motion ? <StaticUnwrap source={c.source} version={version} /> : null}
    </Track>
  );
}

/** Reduced motion: five static frames at the phase ends (MOTION_SYSTEM 5.7, 8). */
function StaticUnwrap({ source, version }: { source: Source; version: number }) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const base = getClimate().baseline;
  useEffect(() => {
    refs.current.forEach((cv, i) => cv && paintStatic(cv, (L, dpr) => {
      const r = strataFrame(L, dpr, STATIC_P[i]!, { source, base, spine: i === 4 ? 1 : 0, lattice: 0.4 });
      return [r.frame, { orb: null, halo: null, outline: null, limb: i === 0 ? { disc: r.disc, alpha: 0.24 } : null }];
    }));
  });
  void version;
  return (
    <div className="strata-static">
      {STATIC_NAMES.map((n, i) => (
        <figure key={n}>
          <canvas ref={(el) => { refs.current[i] = el; }} role="img" aria-label={`Unwrap step ${i + 1}: ${n.toLowerCase()}`} />
          <figcaption>{i + 1} · {n}</figcaption>
        </figure>
      ))}
    </div>
  );
}
