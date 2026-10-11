import { useMemo, useRef, useState } from "react";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus, SceneErrors } from "../components/StateUI";
import { Tooltip } from "../components/Tooltip";
import { useArtifact } from "../data/useArtifact";
import { AR6, FACTS, SERIES } from "../data/artifacts";
import { copyS06 } from "../data/copy";
import { num } from "../data/types";
import { BINS, binIndex } from "../model/bins";
import { fixed } from "../model/format";
import { futuresModel, type Bracket } from "../model/futures";
import { clamp } from "../lib/math";
import { easeSymmetric } from "../motion/ease";
import { stepState, windowed } from "../motion/progress";
import { useActiveScene, useMotion, useProgress } from "../scroll/hooks";
import { futures, SCENARIOS } from "../state/scenes";
import { layout } from "./geometry";
import { useViewport } from "./useViewport";
import type { SceneDef } from "../app/scenes";

const WINDOWS = ["2021-2040", "2041-2060", "2081-2100"];
const VMIN = -0.5, VMAX = 6;

/** S06 Assessed Futures (interaction 7): colour becomes position, then the IPCC's windows light up, never joined to the record. */
export function S06Futures({ def }: { def: SceneDef }) {
  const motion = useMotion();
  const vp = useViewport();
  const { scenario } = futures.use();
  const [ar6, retryA] = useArtifact(AR6);
  const [series, retryS] = useArtifact(SERIES);
  const [facts, retryF] = useArtifact(FACTS);
  const active = useActiveScene();
  const [lit, setLit] = useState(0);
  const litRef = useRef(0);
  const groupRef = useRef<SVGGElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const L = layout(vp.w, vp.h);
  // short desktops: the value axis and its unit stay above the nav (h - 116)
  const ax = L.cls === "D" ? { x0: 0.528 * vp.w, x1: 0.933 * vp.w, y0: 0.094 * vp.h, y1: vp.h < 820 ? vp.h - 116 : 0.906 * vp.h }
    : L.cls === "T" ? { x0: 96, x1: vp.w - 48, y0: 0.33 * vp.h, y1: 0.84 * vp.h }
    : { x0: 56, x1: vp.w - 20, y0: 0.27 * vp.h, y1: 0.68 * vp.h };
  const xv = (v: number) => ax.x0 + ((v - VMIN) / (VMAX - VMIN)) * (ax.x1 - ax.x0);
  const yt = (year: number) => ax.y1 - ((year - 1850) / (2100 - 1850)) * (ax.y1 - ax.y0);

  const model = useMemo(() => {
    if (ar6.status !== "ready" || series.status !== "ready") return null;
    const h = series.data.series.find((s) => s.id === "hadcrut5_glb")!;
    return futuresModel(ar6.data, series.data.years, h.values["1850-1900"]!, h.ci_lo?.["1850-1900"] ?? undefined, h.ci_hi?.["1850-1900"] ?? undefined);
  }, [ar6, series]);

  // colour becomes position (5.9): each year's swatch leaves the spine's x for its value, oldest first (scrubbed, p 0.02-0.30)
  const k = L.core;
  useProgress(def.id, (p) => {
    const s = stepState(litRef.current, p, [0.35, 0.55, 0.75]);
    if (s !== litRef.current) { litRef.current = s; setLit(s); }
    const g = groupRef.current;
    if (!g || !model) return;
    const pts = g.querySelectorAll<SVGRectElement>("[data-obs]");
    const n = pts.length;
    pts.forEach((r, i) => {
      const e = motion ? easeSymmetric(windowed(p, 0.02 + 0.2 * (i / n), 0.1 + 0.2 * (i / n))) : 1;
      const o = model.observed[i]!;
      const sx = k.spine[0] + 2, sy = k.y0 + (k.n - 1 - (o.year - 1850)) * k.H;
      const tx = xv(o.value) - 2, ty = yt(o.year) - 2;
      r.setAttribute("x", (sx + (tx - sx) * e).toFixed(1));
      r.setAttribute("y", (sy + (ty - sy) * e).toFixed(1));
    });
    g.style.setProperty("--after", String(clamp((p - 0.28) / 0.06)));
  });
  const page = ar6.status === "ready" ? ar6.data.source.page_printed : 0;
  const copy = copyS06(page);
  const show = (b: Bracket, e: React.PointerEvent | React.FocusEvent) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    setTip({ x: r.right, y: r.top, text: `${b.scenario} · ${b.period} · BEST ${fixed(b.best, 1)} °C · VERY LIKELY ${fixed(b.low, 1)} TO ${fixed(b.high, 1)} · RELATIVE TO 1850-1900` });
  };
  const callout = facts.status === "ready" && model && num(facts.data, "hadcrut5_latest_year_anomaly_1850_1900") >= 1.5 && (model.means.find((m) => m.label === "2005-2024")?.value ?? 2) < 1.5;
  const litN = motion ? lit : 3;
  const statement = copy.statements[Math.max(0, litN - 1)]!;

  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="What is assessed next" className="scene scene-futures">
      <SceneErrors active={active === def.id} items={[{ file: "series_annual.json", state: series, retry: retryS }, { file: "facts.json", state: facts, retry: retryF }]} />
      <div className="fut-text">
        <h2 id="futures-title" tabIndex={-1} data-scene-heading className="scene-statement" key={statement}>{statement}</h2>
        {callout ? <p className="fut-callout serif">{copy.callout}</p> : null}
        <div className="seg-ctl fut-scen" role="radiogroup" aria-label="SCENARIO">
          <span className="seg-ctl__label" aria-hidden="true">SCENARIO</span>
          <div className="seg-ctl__row seg-ctl__row--scroll">
            {SCENARIOS.map((s) => {
              const meta = ar6.status === "ready" ? ar6.data.scenarios.find((x) => x.id === s) : undefined;
              return (
                <button key={s} type="button" role="radio" aria-checked={scenario === s} tabIndex={scenario === s ? 0 : -1} className={`chip-btn fut-chip ${scenario === s ? "is-on" : ""}`} onClick={() => futures.set({ scenario: s })}>
                  {s}{meta ? <span className="fut-chip__sub">{meta.ghg_description.toUpperCase()}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
        <p className="fut-locked">BASELINE {copy.locked} · HADCRUT5 ONLY</p>
        <p className="fut-source">{copy.source}</p>
        <div className="fut-chips">
          <HonestyChip tag="PREDICTED" detail={copy.chip} />
          <HonestyChip tag="DERIVED" detail="HADCRUT5 REBASED TO 1850-1900 · 20-YEAR MEANS" />
          <HonestyChip tag="OBSERVED" detail="HADCRUT5 95% RANGE (STIPPLE)" />
        </div>
        <ArtifactStatus file="ar6.json" state={ar6} retry={retryA} empty="ASSESSED RANGES UNAVAILABLE">{() => null}</ArtifactStatus>
      </div>
      {model ? (
        <svg className="fut-plot" viewBox={`0 0 ${vp.w} ${vp.h}`} role="group" aria-label="Observed record and IPCC AR6 assessed windows">
          <defs>
            <pattern id="fut-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1" height="6" fill="rgb(143 162 255 / 0.5)" /></pattern>
            <pattern id="fut-stipple" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="rgb(255 255 255 / 0.55)" /></pattern>
          </defs>
          <g className="fut-axis" aria-hidden="true">
            <line x1={ax.x0} x2={ax.x1} y1={ax.y1 + 8} y2={ax.y1 + 8} />
            {[0, 1, 2, 3, 4, 5, 6].map((v) => <text key={v} x={xv(v)} y={ax.y1 + 24} textAnchor="middle">{v === 0 ? "0" : `+${v}`}</text>)}
            <text x={ax.x1} y={ax.y1 + 40} textAnchor="end">°C VS 1850-1900</text>
            {[1850, 1900, 1950, 2000, 2050, 2100].map((yy) => <text key={yy} x={ax.x0 - 8} y={yt(yy) + 4} textAnchor="end">{yy}</text>)}
            {/* 1.5 to the left of its line, 2.0 to the right: the two labels never meet */}
            {[1.5, 2].map((v) => <g key={v}><line className="paris" x1={xv(v)} x2={xv(v)} y1={ax.y0} y2={ax.y1} /><text x={xv(v) + (v < 2 ? -4 : 4)} y={ax.y0 - 6} textAnchor={v < 2 ? "end" : "start"}>{fixed(v, 1)} °C</text></g>)}
            <text x={ax.x0} y={L.cls === "D" ? ax.y0 - 24 : ax.y1 + 58} textAnchor="start" className="paris-cap">{L.cls === "M" ? copy.parisShort : `DOTTED LINES: ${copy.paris}`}</text>
          </g>
          <g ref={groupRef} className="fut-observed" aria-hidden="true">
            {model.observed.map((o) => o.lo !== null && o.hi !== null ? <rect key={`ci${o.year}`} className="fut-ci" x={xv(o.lo)} y={yt(o.year) - 0.6} width={Math.max(1, xv(o.hi) - xv(o.lo))} height={1.2} fill="url(#fut-stipple)" /> : null)}
            {model.observed.map((o) => <rect key={o.year} data-obs className="fut-sq" width={4} height={4} fill={BINS[binIndex(o.value * 100)]!.color} x={xv(o.value) - 2} y={yt(o.year) - 2} />)}
            {model.means.map((m) => <rect key={m.label} className="fut-mean" x={xv(m.value) - 2} y={yt(m.y1)} width={4} height={yt(m.y0) - yt(m.y1)}><title>{m.label} MEAN {fixed(m.value, 2)} °C</title></rect>)}
            {model.assessed ? (
              <g className="fut-assessed">
                <path d={`M${xv(model.assessed.low)},${yt(model.assessed.y1) + 6}V${yt(model.assessed.y1)}H${xv(model.assessed.high)}V${yt(model.assessed.y1) + 6}`} />
                {/* below the 20-year bars and right of the bracket's high end, clear of every mark */}
                <text x={xv(model.assessed.high) + 6} y={yt(model.assessed.y0 - 3) + 10}>{L.cls === "M" ? copy.assessedShort : copy.assessed}</text>
              </g>
            ) : null}
          </g>
          <g className="fut-windows">
            {WINDOWS.map((w, wi) => (
              <g key={w} className={`fut-window ${wi < litN ? "is-lit" : ""}`}>
                {model.brackets.filter((b) => b.period === w).map((b) => {
                  const sel = b.scenario === scenario;
                  const y0 = yt(b.y1), y1 = yt(b.y0);
                  return (
                    <g key={b.scenario} className={`fut-br ${sel ? "is-sel" : ""}`} tabIndex={sel && wi < litN ? 0 : -1} role="img"
                      aria-label={`${b.scenario} ${b.period}: best ${b.best} C, very likely ${b.low} to ${b.high} C, relative to 1850-1900`}
                      onPointerEnter={(e) => show(b, e)} onPointerLeave={() => setTip(null)} onFocus={(e) => show(b, e)} onBlur={() => setTip(null)}>
                      {sel ? <rect className="fut-hatch" x={xv(b.low)} y={y0} width={xv(b.high) - xv(b.low)} height={y1 - y0} fill="url(#fut-hatch)" /> : null}
                      <path className="fut-bracket" d={`M${xv(b.low)},${y0 + 6}V${y0}H${xv(b.high)}V${y0 + 6}M${xv(b.low)},${y1 - 6}V${y1}H${xv(b.high)}V${y1 - 6}`} />
                      {sel ? <path className="fut-best" d={`M${xv(b.best)},${(y0 + y1) / 2 - 5}l5,5l-5,5l-5,-5z`} /> : null}
                    </g>
                  );
                })}
                <text className="fut-wlabel" x={ax.x1} y={yt(Number(w.slice(5))) - 4} textAnchor="end">{w}</text>
              </g>
            ))}
            <text className="fut-gap" x={L.cls === "M" ? ax.x0 : ax.x1} y={(yt(2061) + yt(2080)) / 2 + 4} textAnchor={L.cls === "M" ? "start" : "end"}>{copy.gap}</text>
          </g>
        </svg>
      ) : null}
      <Tooltip x={tip?.x ?? 0} y={tip?.y ?? 0} visible={!!tip}>{tip?.text}</Tooltip>
      <div className="sr-only"><table>
        <caption>IPCC AR6 WG1 SPM Table SPM.1, printed page {page}: global surface temperature change relative to 1850-1900, degrees C</caption>
        <thead><tr><th>Scenario</th><th>Period</th><th>Best estimate</th><th>Very likely range</th></tr></thead>
        <tbody>{model?.brackets.map((b) => <tr key={`${b.scenario}${b.period}`}><td>{b.scenario}</td><td>{b.period}</td><td>{b.best}</td><td>{b.low} to {b.high}</td></tr>)}</tbody>
      </table></div>
    </Track>
  );
}
