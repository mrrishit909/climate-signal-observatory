import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { useArtifact } from "../data/useArtifact";
import { CHANGEPOINTS, SERIES, TRENDS } from "../data/artifacts";
import { copyS05, SOURCE_LABEL, trendLine } from "../data/copy";
import type { Baseline, Source } from "../data/types";
import { olsTrend } from "../model/trend";
import { fixed } from "../model/format";
import { DEFAULTS, baselineAllowed, getClimate, setClimate, subscribeClimate } from "../state/climate";
import { LAB_DEFAULT, lab } from "../state/scenes";
import { useMotion } from "../scroll/hooks";
import { layout } from "./geometry";
import { useViewport } from "./useViewport";
import { anomalyTag, SERIES_ID } from "./S03aYears";
import type { SceneDef } from "../app/scenes";

const BASE_YEARS: Record<Baseline, [number, number]> = { "1850-1900": [1850, 1900], "1951-1980": [1951, 1980], "1991-2020": [1991, 2020] };
const STOPS: Baseline[] = ["1850-1900", "1951-1980", "1991-2020"];
const REF: Baseline = "1951-1980"; // both series publish it: the group is drawn here and translated to the active zero

/** S05 Zero Lab (interaction 6): the baseline clamp moves the zero, the trend handles measure a slope that does not move. */
export function S05Zero({ def }: { def: SceneDef }) {
  const c = useSyncExternalStore(subscribeClimate, getClimate);
  const st = lab.use();
  const motion = useMotion();
  const vp = useViewport();
  const [series] = useArtifact(SERIES);
  const [trends] = useArtifact(TRENDS);
  const [cps] = useArtifact(CHANGEPOINTS);
  const [note, setNote] = useState("");
  const [switchOffer, setSwitchOffer] = useState(false);
  const [resetOk, setResetOk] = useState(false);
  const [sheet, setSheet] = useState(false);
  const L = layout(vp.w, vp.h);
  const B = L.bench, n = 176, bw = (B.x1 - B.x0) / n;
  const x = (year: number) => B.x0 + (year - 1850 + 0.5) * bw;
  const first = c.source === "gistemp" ? 1880 : 1850, last = 2025;

  const sv = series.status === "ready" ? series.data : null;
  const ser = (src: Source) => sv?.series.find((s) => s.id === SERIES_ID[src]);
  const shift = (src: Source, base: Baseline) => {
    const s = ser(src); const a = s?.values[REF], b = s?.values[base];
    if (!a || !b) return 0;
    const i = a.findIndex((v, k) => v !== null && b[k] !== null);
    return i < 0 ? 0 : b[i]! - a[i]!;
  };
  const dom = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const s of sv?.series.filter((x) => x.id === "gistemp_glb" || x.id === "hadcrut5_glb") ?? []) for (const vals of Object.values(s.values)) for (const v of vals ?? []) if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return Number.isFinite(lo) ? [lo - 0.1, hi + 0.1] : [-1.5, 1.6];
  }, [sv]);
  const [Y0, Y1] = B.series;
  const y = (v: number) => Y1 - ((v - dom[0]!) / (dom[1]! - dom[0]!)) * (Y1 - Y0);
  const k = (Y1 - Y0) / (dom[1]! - dom[0]!);

  const path = (vals: readonly (number | null)[] | undefined) => {
    if (!vals) return "";
    let d = "", pen = false;
    vals.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(1850 + i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    return d;
  };
  const yearsAxis = useMemo(() => sv?.years ?? [], [sv]);
  const values = ser(c.source)?.values[c.baseline];
  const win = useMemo(() => {
    if (!values) return null;
    const idx = yearsAxis.map((yy, i) => [yy, i] as const).filter(([yy]) => yy >= st.from && yy <= st.to);
    return olsTrend(idx.map(([yy]) => yy), idx.map(([, i]) => values[i] ?? null));
  }, [values, yearsAxis, st.from, st.to]);
  const ref = c.baseline === REF ? "1991-2020" as Baseline : REF;
  const winRef = useMemo(() => {
    const v = ser(c.source)?.values[ref];
    if (!v) return null;
    const idx = yearsAxis.map((yy, i) => [yy, i] as const).filter(([yy]) => yy >= st.from && yy <= st.to);
    return olsTrend(idx.map(([yy]) => yy), idx.map(([, i]) => v[i] ?? null));
  }, [sv, c.source, ref, st.from, st.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const invariant = win && winRef ? Math.abs(win.slope - winRef.slope) <= 0.001 : null;
  const lines = win ? trendLine(st.from, st.to, win.slope, win.ciAr1, win.ciNaive) : null;
  const [spoken, setSpoken] = useState("");
  useEffect(() => { const t = setTimeout(() => setSpoken(lines?.spoken ?? copyS05.tooFew), 400); return () => clearTimeout(t); }, [lines?.spoken]);

  // the trend line and AR(1) wedge through the window centroid, in the active baseline's units
  const fitGeo = useMemo(() => {
    if (!win || !values) return null;
    const xs = yearsAxis.filter((yy, i) => yy >= st.from && yy <= st.to && values[i] !== null);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = win.intercept + (win.slope / 10) * mx;
    const at = (yy: number, s: number) => my + (s / 10) * (yy - mx);
    return { line: `M${x(st.from)},${y(at(st.from, win.slope))}L${x(st.to)},${y(at(st.to, win.slope))}`,
      wedge: `M${x(st.from)},${y(at(st.from, win.ciAr1[0]))}L${x(st.to)},${y(at(st.to, win.ciAr1[0]))}L${x(st.to)},${y(at(st.to, win.ciAr1[1]))}L${x(st.from)},${y(at(st.from, win.ciAr1[1]))}Z`,
      edges: [win.ciAr1[0], win.ciAr1[1]].map((s) => `M${x(st.from)},${y(at(st.from, s))}L${x(st.to)},${y(at(st.to, s))}`) };
  }, [win, values, yearsAxis, st.from, st.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const loess = trends.status === "ready" ? trends.data.loess.find((l) => l.series_id === SERIES_ID[c.source]) : undefined;
  const cp = cps.status === "ready" ? cps.data.results.find((r) => r.series_id === SERIES_ID[c.source]) : undefined;
  // the group is drawn on REF and translated to the active zero: a REF value r lands at y(r + shift), one transform, 600ms
  const ty = -k * shift(c.source, c.baseline);
  /** each series sits on its own active-baseline values once the group is translated by the active source's shift */
  const adj = (src: Source) => (src === c.source ? 0 : shift(src, c.baseline) - shift(c.source, c.baseline));
  const showGiss = c.baseline !== "1850-1900"; // GISTEMP begins in 1880: no 1850-1900 values exist

  // ---- clamp
  const setBase = (b: Baseline) => {
    if (!baselineAllowed(c.source, b)) { setSwitchOffer(true); setNote(copyS05.disabled); return; }
    setSwitchOffer(false);
    setClimate({ baseline: b, announce: "" });
    setNote("changed");
  };
  const [clampX, setClampX] = useState<number | null>(null);
  const clampDrag = useRef<{ x0: number; c0: number } | null>(null);
  const [a, b2] = BASE_YEARS[c.baseline];
  const cx = (x(a) + x(b2)) / 2;
  const onClampDown = (e: PointerEvent) => { clampDrag.current = { x0: e.clientX, c0: cx }; (e.target as Element).setPointerCapture(e.pointerId); setClampX(cx); };
  const onClampMove = (e: PointerEvent) => { const d = clampDrag.current; if (d) setClampX(d.c0 + e.clientX - d.x0); };
  const onClampUp = () => {
    const d = clampDrag.current; clampDrag.current = null;
    if (!d || clampX === null) return;
    const near = STOPS.reduce((best, s) => { const [p, q] = BASE_YEARS[s]; const m = (x(p) + x(q)) / 2; return Math.abs(m - clampX) < Math.abs(best[1]) ? [s, m - clampX] as [Baseline, number] : best; }, [c.baseline, Infinity] as [Baseline, number])[0];
    setClampX(null);
    setBase(near);
  };
  const clampKey = (e: KeyboardEvent) => {
    const i = STOPS.indexOf(c.baseline);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); if (i > 0) setBase(STOPS[i - 1]!); }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); if (i < 2) setBase(STOPS[i + 1]!); }
  };
  const clampLeft = clampX !== null ? clampX - (x(b2) - x(a)) / 2 : x(a) - bw / 2;

  // ---- trend handles
  const clampYear = (yy: number) => Math.round(Math.max(first, Math.min(last, yy)));
  const setFrom = (v: number) => lab.set({ from: Math.min(clampYear(v), st.to - 9) });
  const setTo = (v: number) => lab.set({ to: Math.max(clampYear(v), st.from + 9) });
  useEffect(() => { if (st.from < first) lab.set({ from: first, to: Math.max(st.to, first + 9) }); }, [first, st.from, st.to]);
  const handle = (which: "from" | "to") => ({
    onPointerDown: (e: PointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); },
    onPointerMove: (e: PointerEvent) => { if (!(e.buttons & 1)) return; const yy = 1850 + (e.clientX - B.x0) / bw - 0.5; (which === "from" ? setFrom : setTo)(yy); },
    onKeyDown: (e: KeyboardEvent) => {
      const v = which === "from" ? st.from : st.to, set = which === "from" ? setFrom : setTo;
      const d = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "PageDown" ? -10 : e.key === "PageUp" ? 10 : 0;
      if (d) { e.preventDefault(); set(v + d); }
      if (e.key === "Home") { e.preventDefault(); set(first); }
      if (e.key === "End") { e.preventDefault(); set(last); }
    },
  });
  const reset = () => { lab.set({ ...LAB_DEFAULT }); setClimate({ ...DEFAULTS, announce: "" }); setNote(""); setSwitchOffer(false); setResetOk(true); setTimeout(() => setResetOk(false), 1200); };
  const tag = anomalyTag(c.source, c.baseline);
  const hz = [-0.5, 0, 1].filter((v) => v > dom[0]! && v < dom[1]!);
  const hRef = ser("hadcrut5");

  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="Choosing the zero" className="scene scene-zero">
      <div className="zero-text">
        <h2 id="zero-title" tabIndex={-1} data-scene-heading className="scene-statement">{copyS05.statement}</h2>
        <p className="scene-body">{copyS05.body}</p>
      </div>
      <svg className="zero-plot" viewBox={`0 0 ${vp.w} ${vp.h}`} aria-hidden="true">
        <defs>
          <pattern id="stipple" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="rgb(255 255 255 / 0.55)" /></pattern>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1" height="6" fill="rgb(255 255 255 / 0.5)" /></pattern>
        </defs>
        {hz.map((v) => (
          <g key={v} className="hairline">
            <line x1={B.x0} x2={B.x1} y1={y(v)} y2={y(v)} />
            <text x={L.cls === "M" ? B.x0 + 2 : B.x0 - 8} y={L.cls === "M" ? y(v) - 3 : y(v) + 4} textAnchor={L.cls === "M" ? "start" : "end"}>{v === 0 ? `0.0 °C = ${c.baseline} MEAN` : `${v > 0 ? "+" : ""}${fixed(v, 1)} °C`}</text>
          </g>
        ))}
        <g className="series" style={{ transform: `translateY(${ty.toFixed(2)}px)` }}>
          {hRef?.ci_lo?.[REF] && hRef.ci_hi?.[REF] ? (
            <path className="stipple-band" d={(() => {
              const lo = hRef.ci_lo![REF]!, hi = hRef.ci_hi![REF]!, d = adj("hadcrut5");
              const top = hi.map((v, i) => (v === null ? null : `${x(1850 + i).toFixed(1)},${y(v + d).toFixed(1)}`)).filter(Boolean);
              const bot = lo.map((v, i) => (v === null ? null : `${x(1850 + i).toFixed(1)},${y(v + d).toFixed(1)}`)).filter(Boolean).reverse();
              return `M${top.join("L")}L${bot.join("L")}Z`;
            })()} fill="url(#stipple)" />
          ) : null}
          <path className="had-line" d={path(hRef?.values[REF]?.map((v) => (v === null ? null : v + adj("hadcrut5"))))} />
          {showGiss ? <path className="giss-line" d={path(ser("gistemp")?.values[REF]?.map((v) => (v === null ? null : v + adj("gistemp"))))} /> : null}
          {showGiss ? ser("gistemp")?.values[REF]?.map((v, i) => (v === null ? null : <rect key={i} className="giss-pt" x={x(1850 + i) - 1.5} y={y(v + adj("gistemp")) - 1.5} width={3} height={3} />)) : null}
        </g>
        <g className="derived">
          {st.smooth && loess?.fit[c.baseline] ? (
            <>
              <path className="loess-band" d={path(loess.band_hi[c.baseline])} />
              <path className="loess-band" d={path(loess.band_lo[c.baseline])} />
              <path className="loess" d={path(loess.fit[c.baseline])} />
            </>
          ) : null}
          {fitGeo ? (
            <>
              <path className="wedge" d={fitGeo.wedge} />
              {fitGeo.edges.map((d) => <path key={d} className="wedge-edge" d={d} />)}
              <path className="fit" d={fitGeo.line} />
            </>
          ) : <rect x={x(st.from)} y={Y0} width={x(st.to) - x(st.from)} height={Y1 - Y0} fill="url(#hatch)" />}
          {st.breaks && cp?.fit[c.baseline] ? (
            <>
              <path className="breaks" d={path(cp.fit[c.baseline])} />
              {cp.selected_breaks.map((yy, i) => (
                <g key={yy}>
                  <line className="break-v" x1={x(yy)} x2={x(yy)} y1={Y0} y2={Y1} />
                  <line className="break-ci" x1={x(cp.break_ci_95[i]![0])} x2={x(cp.break_ci_95[i]![1])} y1={Y1 + 6} y2={Y1 + 6} />
                  <text className="break-t" x={x(yy)} y={Y0 - 4} textAnchor="middle">{yy}</text>
                </g>
              ))}
            </>
          ) : null}
        </g>
        <line className="rail" x1={B.x0} x2={B.x1} y1={B.y1 + 16} y2={B.y1 + 16} />
        <line className="span" x1={x(st.from)} x2={x(st.to)} y1={B.y1 + 16} y2={B.y1 + 16} />
        <text className="axis-t" x={B.x0} y={B.y1 + 36}>1850</text>
        <text className="axis-t" x={B.x1} y={B.y1 + 36} textAnchor="end">{last}</text>
      </svg>
      {/* the clamp: a 30-year bracket over the series band and the bench; snaps to the contracted baselines */}
      <div className={`clamp ${clampX !== null ? "is-drag" : ""}`} style={{ left: clampLeft, top: Y0 - 8, width: x(b2) - x(a) + bw, height: B.y1 - Y0 + 16 }}>
        <span className="clamp__label">{c.baseline}</span>
        <button type="button" className="clamp__grip" role="slider" aria-label="Baseline clamp" aria-valuemin={0} aria-valuemax={2} aria-valuenow={STOPS.indexOf(c.baseline)} aria-valuetext={c.baseline}
          onPointerDown={onClampDown} onPointerMove={onClampMove} onPointerUp={onClampUp} onPointerCancel={onClampUp} onKeyDown={clampKey} />
      </div>
      {(["from", "to"] as const).map((w) => (
        <button key={w} type="button" className="handle" role="slider" aria-label={`Trend window ${w}`} aria-valuemin={first} aria-valuemax={last} aria-valuenow={st[w]}
          style={{ left: x(st[w]) - 6, top: B.y1 + 10 }} {...handle(w)} />
      ))}
      <div className="zero-result">
        {lines ? <p className="result-line tnum" data-result>{lines.result}</p> : <p className="result-line" data-result>{copyS05.tooFew}</p>}
        {lines ? <p className="result-naive tnum">{lines.naive}</p> : null}
        {note && invariant !== null ? (
          <p className={`invariance ${invariant ? "" : "is-bad"}`} data-invariance>
            SLOPE UNDER {c.baseline} = SLOPE UNDER {ref} {invariant ? "✓" : "✗ CHECK FAILED"}
          </p>
        ) : null}
        {switchOffer ? <p className="state-line">{copyS05.disabled} <button type="button" className="btn-square" onClick={() => { setClimate({ source: "hadcrut5", baseline: "1850-1900", announce: "" }); setSwitchOffer(false); setNote("changed"); }}>SWITCH TO HADCRUT5</button></p> : null}
        <p className="sr-only" aria-live="polite">{spoken}</p>
        {st.breaks ? <p className="result-naive"><HonestyChip tag="DERIVED" detail="EXPLORATORY" className="chip--inline" /> {copyS05.breaks}</p> : null}
      </div>
      <div className={`zero-controls ${sheet ? "is-open" : ""}`}>
        <div className="seg-ctl" role="radiogroup" aria-label="BASELINE">
          <span className="seg-ctl__label" aria-hidden="true">BASELINE</span>
          <div className="seg-ctl__row">{STOPS.map((b) => {
            const off = !baselineAllowed(c.source, b);
            return <button key={b} type="button" role="radio" aria-checked={c.baseline === b} aria-disabled={off || undefined} title={off ? copyS05.disabled : undefined}
              className={`chip-btn ${c.baseline === b ? "is-on" : ""} ${off ? "is-disabled" : ""}`} onClick={() => setBase(b)}>{b}</button>;
          })}</div>
        </div>
        <div className="zero-steppers" aria-label="Trend window">
          <span className="seg-ctl__label">WINDOW</span>
          <button type="button" className="chip-btn" aria-label="From one year earlier" onClick={() => setFrom(st.from - 1)}>−</button>
          <span className="tnum">{st.from}</span>
          <button type="button" className="chip-btn" aria-label="From one year later" onClick={() => setFrom(st.from + 1)}>+</button>
          <span className="zero-to">TO</span>
          <button type="button" className="chip-btn" aria-label="To one year earlier" onClick={() => setTo(st.to - 1)}>−</button>
          <span className="tnum">{st.to}</span>
          <button type="button" className="chip-btn" aria-label="To one year later" onClick={() => setTo(st.to + 1)}>+</button>
        </div>
        <button type="button" className="text-btn zero-more" aria-expanded={sheet} onClick={() => setSheet((o) => !o)}>{sheet ? "LESS" : "MORE CONTROLS"}</button>
        <div className="zero-more-panel">
          <div className="seg-ctl" role="radiogroup" aria-label="SOURCE">
            <span className="seg-ctl__label" aria-hidden="true">SOURCE</span>
            <div className="seg-ctl__row">{(["gistemp", "hadcrut5"] as Source[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={c.source === s} className={`chip-btn ${c.source === s ? "is-on" : ""}`} onClick={() => setClimate({ source: s, announce: "" })}>{SOURCE_LABEL[s]}</button>
            ))}</div>
          </div>
          <div className="seg-ctl" role="radiogroup" aria-label="SMOOTH">
            <span className="seg-ctl__label" aria-hidden="true">SMOOTH</span>
            <div className="seg-ctl__row">
              <button type="button" role="radio" aria-checked={!st.smooth} className={`chip-btn ${!st.smooth ? "is-on" : ""}`} onClick={() => lab.set({ smooth: false })}>OFF</button>
              <button type="button" role="radio" aria-checked={st.smooth} aria-disabled={!loess?.fit[c.baseline] || undefined}
                className={`chip-btn ${st.smooth ? "is-on" : ""} ${!loess?.fit[c.baseline] ? "is-disabled" : ""}`}
                title={trends.status !== "ready" ? "LOADING TRENDS" : !loess?.fit[c.baseline] ? `NO LOESS FIT ON ${c.baseline}` : undefined}
                onClick={() => loess?.fit[c.baseline] && lab.set({ smooth: true })}>{trends.status !== "ready" ? "LOADING TRENDS" : "LOESS"}</button>
            </div>
          </div>
          <div className="seg-ctl" role="radiogroup" aria-label="BREAKS">
            <span className="seg-ctl__label" aria-hidden="true">BREAKS</span>
            <div className="seg-ctl__row">
              <button type="button" role="radio" aria-checked={!st.breaks} className={`chip-btn ${!st.breaks ? "is-on" : ""}`} onClick={() => lab.set({ breaks: false })}>OFF</button>
              <button type="button" role="radio" aria-checked={st.breaks} aria-disabled={!cp?.fit[c.baseline] || undefined}
                className={`chip-btn ${st.breaks ? "is-on" : ""} ${!cp?.fit[c.baseline] ? "is-disabled" : ""}`} title={!cp?.fit[c.baseline] ? `NO BREAK FIT ON ${c.baseline}` : undefined}
                onClick={() => cp?.fit[c.baseline] && lab.set({ breaks: true })}>EXPLORATORY</button>
            </div>
          </div>
          <button type="button" className="text-btn" onClick={reset}>{resetOk ? "RESET ✓" : "RESET"}</button>
        </div>
      </div>
      <div className="zero-chips">
        <HonestyChip tag={tag.tag} detail={`SERIES · ${tag.detail}`} />
        <HonestyChip tag="DERIVED" detail="TREND, AR(1) CI, LOESS" />
      </div>
      {!motion ? <p className="state-line state-line--muted zero-rm">THE BENCH IS DRAWN ONLY WITH MOTION ON; EVERY CONTROL ABOVE STILL UPDATES THE SERIES AND THE TREND.</p> : null}
    </Track>
  );
}
