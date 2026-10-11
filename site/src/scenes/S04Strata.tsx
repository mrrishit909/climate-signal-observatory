import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { getStore } from "../data/loader";
import { FACTS, GRIDS, VALIDATION } from "../data/artifacts";
import { copyS04, SOURCE_LABEL } from "../data/copy";
import type { Source } from "../data/types";
import { stepState } from "../motion/progress";
import { getClimate, setClimate, subscribeClimate } from "../state/climate";
import { bank } from "../state/bank";
import { useMotion, useProgress } from "../scroll/hooks";
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
  const [facts] = useArtifact(FACTS);
  const [val] = useArtifact(VALIDATION);
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

  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="From planet to record" className="scene scene-strata">
      <div className="strata-text">
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
          {c.source === "gistemp" && copy ? <span className="core-begins" style={{ top: slotY(1865), right: vp.w - k.x0 + 12 }}>{copy.begins}</span> : null}
        </div>
      ) : null}
      <div className={`strata-foot ${landed ? "is-in" : ""}`}>
        {landed ? (
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
