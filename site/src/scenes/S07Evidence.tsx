import { useMemo, useRef, useState } from "react";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { useArtifact } from "../data/useArtifact";
import { AGREEMENT, CO2, FACTS, GRID_META, META, TRENDS, VALIDATION } from "../data/artifacts";
import { copyS07, type Exchange } from "../data/copy";
import { stepState } from "../motion/progress";
import { useMotion, useProgress } from "../scroll/hooks";
import { CoverageStrip } from "./S02Record";
import type { SceneDef } from "../app/scenes";

const THRESH = [0.02, 0.15, 0.28, 0.41, 0.54, 0.67, 0.8];
const REPO = "https://github.com/mrrishit909/climate-signal-observatory/blob/main/site/public/data/";

/** Bars around a zero line (diff series), a line with dashed CI edges, or scatter: tiny SVG mini-visuals, max 460 x 160. */
function Bars({ values, label }: { values: (number | null)[]; label: string }) {
  const m = Math.max(...values.map((v) => Math.abs(v ?? 0)), 0.01);
  return (
    <svg className="mini" viewBox={`0 0 ${values.length} 100`} preserveAspectRatio="none" role="img" aria-label={label}>
      <line x1={0} x2={values.length} y1={50} y2={50} className="mini-zero" />
      {values.map((v, i) => (v === null ? null : <rect key={i} x={i} width={0.7} y={v > 0 ? 50 - (v / m) * 48 : 50} height={(Math.abs(v) / m) * 48} className="mini-bar" style={{ ["--i" as string]: i }} />))}
    </svg>
  );
}
function Rolling({ v, lo, hi, label }: { v: (number | null)[]; lo: (number | null)[]; hi: (number | null)[]; label: string }) {
  const all = [...lo, ...hi].filter((x): x is number => x !== null);
  const a = Math.min(...all), b = Math.max(...all);
  const y = (x: number) => 95 - ((x - a) / (b - a)) * 90;
  const path = (s: (number | null)[]) => s.map((x, i) => (x === null ? "" : `${i && s[i - 1] !== null ? "L" : "M"}${i},${y(x).toFixed(1)}`)).join("");
  return (
    <svg className="mini" viewBox={`0 0 ${v.length} 100`} preserveAspectRatio="none" role="img" aria-label={label}>
      {a < 0 && b > 0 ? <line x1={0} x2={v.length} y1={y(0)} y2={y(0)} className="mini-zero" /> : null}
      <path d={path(lo)} className="mini-ci" /><path d={path(hi)} className="mini-ci" /><path d={path(v)} className="mini-line" />
    </svg>
  );
}
function Scatter({ xs, ys, label }: { xs: number[]; ys: number[]; label: string }) {
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  return (
    <svg className="mini mini--sq" viewBox="0 0 100 100" role="img" aria-label={label}>
      {xs.map((x, i) => <rect key={i} x={((x - x0) / (x1 - x0)) * 94 + 2} y={96 - ((ys[i]! - y0) / (y1 - y0)) * 94} width={2.5} height={2.5} className="mini-pt" style={{ ["--i" as string]: i }} />)}
    </svg>
  );
}
function CiBars({ rows }: { rows: [string, [number, number]][] }) {
  const a = Math.min(...rows.map((r) => r[1][0])), b = Math.max(...rows.map((r) => r[1][1]));
  const x = (v: number) => 30 + ((v - a) / (b - a)) * 66;
  return (
    <svg className="mini" viewBox="0 0 100 40" role="img" aria-label="Three 95% intervals for the 1975 to latest GISTEMP trend">
      {rows.map(([n, [lo, hi]], i) => (
        <g key={n}><text x={0} y={i * 13 + 9} className="mini-t">{n}</text><rect x={x(lo)} y={i * 13 + 4} width={x(hi) - x(lo)} height={5} className={`mini-ci-bar mini-ci-bar--${i}`} /></g>
      ))}
    </svg>
  );
}

/** S07 Evidence (argument stack): seven objections, each answered with a receipt. */
export function S07Evidence({ def }: { def: SceneDef }) {
  const motion = useMotion();
  const [facts] = useArtifact(FACTS);
  const [meta] = useArtifact(META);
  const [val] = useArtifact(VALIDATION);
  const [agr] = useArtifact(AGREEMENT);
  const [tr] = useArtifact(TRENDS);
  const [co2] = useArtifact(CO2);
  const [gm] = useArtifact(GRID_META.gistemp);
  const [shown, setShown] = useState(0);
  const sRef = useRef(0);
  useProgress(def.id, (p) => { const s = stepState(sRef.current, p, THRESH); if (s !== sRef.current) { sRef.current = s; setShown(s); } });
  const ex = useMemo((): Exchange[] | null => {
    if (facts.status !== "ready") return null;
    const giss = meta.status === "ready" ? Object.entries(meta.data.sources).find(([k]) => k.startsWith("gistemp"))?.[1].last_modified ?? null : null;
    const sim = val.status === "ready" ? (val.data as unknown as { trend_ci_simulation: { coverage_naive: number; coverage_ar1: number; coverage_hac: number } }).trend_ci_simulation : null;
    return copyS07(facts.data, { lastModified: giss, coverage: sim ? { naive: sim.coverage_naive, ar1: sim.coverage_ar1, hac: sim.coverage_hac } : null });
  }, [facts, meta, val]);
  const visual = (i: number) => {
    if (i === 1 && agr.status === "ready") {
      const d = agr.data.annual.diff_gistemp_minus_hadcrut5["1951-1980"]!;
      return <Bars values={d} label="GISTEMP minus HadCRUT5, every year, on 1951-1980" />;
    }
    if (i === 3 && gm.status === "ready") return <CoverageStrip meta={gm.data} last={gm.data.years.last} label="Measured area share per year, GISTEMP" />;
    if (i === 4 && tr.status === "ready") {
      const r = tr.data.rolling.find((x) => x.series_id === "gistemp_glb");
      return r ? <Rolling v={r.slope_per_decade} lo={r.ci_ar1_lo} hi={r.ci_ar1_hi} label="Rolling 30-year GISTEMP trends with AR(1) 95% intervals" /> : null;
    }
    if (i === 5 && co2.status === "ready") {
      const c = co2.data as unknown as { annual_years: number[]; global_annual_ppm: (number | null)[]; temperature_annual: Record<string, (number | null)[]> };
      const t = c.temperature_annual["1951-1980"]!;
      const idx = c.annual_years.map((_, k) => k).filter((k) => c.global_annual_ppm[k] !== null && t[k] !== null);
      const xs = idx.map((k) => c.global_annual_ppm[k]!), ys = idx.map((k) => t[k]!);
      const dx = xs.slice(1).map((v, k) => v - xs[k]!), dy = ys.slice(1).map((v, k) => v - ys[k]!);
      return <div className="mini-pair"><figure><Scatter xs={xs} ys={ys} label="Levels: CO2 against temperature" /><figcaption>LEVELS</figcaption></figure><figure><Scatter xs={dx} ys={dy} label="Year-to-year changes" /><figcaption>CHANGES</figcaption></figure></div>;
    }
    if (i === 6 && tr.status === "ready") {
      const f = tr.data.series.find((s) => s.series_id === "gistemp_glb")?.fits.find((x) => x.period === "1975_latest");
      return f ? <CiBars rows={[["NAIVE", f.ci_naive], ["AR(1)", f.ci_ar1], ["HAC", f.ci_hac]]} /> : null;
    }
    return null;
  };
  const receipt = (e: Exchange) => {
    const fm = meta.status === "ready" ? meta.data.artifact_files[e.receipt] : undefined;
    return (
      <div className="receipt" key={e.receipt}>
        <p className="receipt__h">RECEIPT</p>
        <a href={REPO + e.receipt} target="_blank" rel="noopener">{e.receipt}</a>
        {fm ? <p className="tnum">SHA256 {fm.sha256.slice(0, 8)} · {fm.bytes.toLocaleString("en-US")} BYTES</p> : null}
        {meta.status === "ready" ? <p>GENERATED {meta.data.generated_at.slice(0, 10)} · PIPELINE v{meta.data.pipeline_version}</p> : null}
      </div>
    );
  };
  const n = motion ? shown : 7;
  const cur = ex?.[Math.max(0, n - 1)];
  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="How we know" className="scene scene-evidence">
      <h2 id="evidence-title" tabIndex={-1} data-scene-heading className="ev-title serif">How we know.</h2>
      <ol className="ev-stack" aria-label="Seven objections and their answers">
        {ex?.slice(0, n).map((e, i) => (
          <li key={e.q} className={`ev-ex ${i < n - 2 ? "is-old" : ""} ${i < n - 1 ? "is-prev" : ""}`} style={{ ["--d" as string]: n - 1 - i }}>
            <article className="ev-q"><header>A SKEPTIC / NOW</header><p>{e.q}</p></article>
            <article className="ev-a">
              <header>THE RECORD / SINCE 1850</header>
              <p>{e.a}</p>
              {visual(i)}
              {e.simulated ? <p className="ev-sim"><HonestyChip tag="SIMULATED" onLight className="chip--inline" /> {e.simulated}</p> : null}
              <div className="ev-tag"><HonestyChip tag={e.tag} onLight detail={i === 5 ? "ASSOCIATION, NOT ATTRIBUTION" : e.receipt.toUpperCase()} /></div>
            </article>
          </li>
        ))}
      </ol>
      <aside className="ev-side">
        {cur ? receipt(cur) : null}
        {meta.status === "ready" ? (
          <details className="ev-limits" open={motion ? shown >= 7 : true}>
            <summary>LIMITATIONS ({meta.data.limitations.length})</summary>
            <ul tabIndex={0} aria-label="Limitations">{meta.data.limitations.map((l) => <li key={l}>{l.toUpperCase()}</li>)}</ul>
          </details>
        ) : null}
      </aside>
    </Track>
  );
}
