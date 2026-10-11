import { useMemo } from "react";
import { Track } from "../scroll/Track";
import { StoryDeck, type DeckCard } from "../components/StoryDeck";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus } from "../components/StateUI";
import { Orb } from "../components/Orb";
import { useArtifact } from "../data/useArtifact";
import { AR6, FACTS, GRID_META, META } from "../data/artifacts";
import { copyS02 } from "../data/copy";
import { fixed } from "../model/format";
import { num, type GridMeta } from "../data/types";
import type { SceneDef } from "../app/scenes";

/** Coverage strip: one bar per year of the shared axis, height = measured area share; years before the record are blank. */
export function CoverageStrip({ meta, first = 1850, last, label }: { meta: GridMeta; first?: number; last: number; label: string }) {
  const n = last - first + 1;
  return (
    <svg className="coverage-strip" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" role="img" aria-label={label}>
      {Array.from({ length: n }, (_, i) => {
        const k = meta.years.list.indexOf(first + i);
        const v = k >= 0 ? meta.valid_area_share_per_year[k]! : null;
        return v === null ? null : <rect key={i} x={i} y={100 - v * 100} width={0.8} height={v * 100} style={{ ["--i" as string]: i }} />;
      })}
    </svg>
  );
}

/** Two lattices at true relative scale: the same 30 x 15 degree window in 2 degree and 5 degree squares. */
function Lattices({ g, h }: { g: GridMeta; h: GridMeta }) {
  return (
    <div className="lattices">
      {[g, h].map((m) => (
        <figure key={m.id}>
          <div className="lattice-box" style={{ ["--px" as string]: `${(m.grid.lon_step_deg / 30) * 100}%`, ["--py" as string]: `${(m.grid.lat_step_deg / 15) * 100}%` }} aria-hidden="true" />
          <figcaption>{m.grid.n_lat} × {m.grid.n_lon} · {m.grid.lat_step_deg}° · FROM {m.years.first} · NATIVE {m.native_baseline}</figcaption>
        </figure>
      ))}
      <p className="lattices__note">SAME 30° × 15° WINDOW, TRUE RELATIVE SCALE</p>
    </div>
  );
}

/** The zero: a mini timeline with the three contracted baselines; 1850-1900 is hatched out for GISTEMP. */
function Baselines({ last, offset }: { last: number; offset: string }) {
  const x = (y: number) => ((y - 1850) / (last - 1850)) * 100;
  const rows: [string, number, number, boolean][] = [["1850-1900", 1850, 1900, true], ["1951-1980", 1951, 1980, false], ["1991-2020", 1991, 2020, false]];
  return (
    <div className="baselines">
      {rows.map(([id, a, b, hatched], i) => (
        <div key={id} className={`bl-row ${hatched ? "is-hatched" : ""}`} style={{ ["--i" as string]: i }}>
          <span className="bl-bracket" style={{ left: `${x(a)}%`, width: `${x(b) - x(a)}%` }} />
          <span className="bl-label" style={{ left: `${x(a)}%` }}>{id}{hatched ? " · NOT FOR GISTEMP" : ""}{id === "1991-2020" ? ` · ${offset} °C` : ""}</span>
        </div>
      ))}
      <div className="bl-axis"><span>1850</span><span>{last}</span></div>
    </div>
  );
}

/** S02 Provenance Deck (interaction 4): what a cell is, two agencies, the zero, the gaps. */
export function S02Record({ def }: { def: SceneDef }) {
  const [facts] = useArtifact(FACTS);
  const [meta] = useArtifact(META);
  const [ar6] = useArtifact(AR6);
  const [gm, retryG] = useArtifact(GRID_META.gistemp);
  const [hm, retryH] = useArtifact(GRID_META.hadcrut5);
  const cards = useMemo((): DeckCard[] | null => {
    if (facts.status !== "ready" || gm.status !== "ready" || hm.status !== "ready") return null;
    const f = facts.data, g = gm.data, h = hm.data;
    const enc = g.encoding as unknown as { scale_degC_per_unit: number; missing_value: number };
    const last = g.years.last;
    const c = copyS02(f, {
      stepDeg: g.grid.lat_step_deg, scale: enc.scale_degC_per_unit, missing: enc.missing_value,
      hadShare1880: h.valid_area_share_per_year[h.years.list.indexOf(1880)] ?? null,
      offsetLabel: fixed(num(f, "baseline_offset_1951_1980_to_1991_2020_gistemp"), 2),
      pipeline: meta.status === "ready" ? meta.data.pipeline_version : "", generated: meta.status === "ready" ? meta.data.generated_at : "",
      ar6Page: ar6.status === "ready" ? ar6.data.source.page_printed : null,
    });
    return [
      { variant: "dark", chip: c[0].chip, title: c[0].title, body: <p>{c[0].body}</p>, tag: <HonestyChip tag="OBSERVED" detail="GISTEMP v4 SIDECAR" />,
        visual: (on: boolean) => (
          <div className={`cell-anatomy ${on ? "is-on" : ""}`}>
            <div className="cell-anatomy__orb"><Orb family="solar" size={150} /></div>
            <div className="cell-anatomy__cell" aria-hidden="true" />
            <ul className="cell-anatomy__fields">{c[0].fields.map((t, i) => <li key={t} style={{ ["--i" as string]: i }}>{t}</li>)}</ul>
          </div>
        ) },
      { variant: "blue", chip: c[1].chip, title: c[1].title, body: <p>{c[1].body}</p>, tag: <HonestyChip tag="OBSERVED" detail="GRID SIDECARS" />, visual: <Lattices g={g} h={h} /> },
      { variant: "dark", chip: c[2].chip, title: c[2].title, body: <p>{c[2].body}</p>, tag: <HonestyChip tag="DERIVED" detail="BASELINE OFFSET" />,
        visual: <Baselines last={last} offset={fixed(num(f, "baseline_offset_1951_1980_to_1991_2020_gistemp"), 2)} /> },
      { variant: "light", chip: c[3].chip, title: c[3].title, body: <><p>{c[3].body}</p><p className="card-foot">{c[3].foot}</p></>, tag: <HonestyChip tag="OBSERVED" detail="MEASURED AREA" onLight />,
        visual: (
          <div className="coverage-card">
            <CoverageStrip meta={g} last={last} label={`Measured area rises from ${Math.round(g.valid_area_share_per_year[0]! * 100)}% in ${g.years.first} to ${Math.round(g.valid_area_share_per_year.at(-1)! * 100)}% in ${last}`} />
            <div className="coverage-card__axis"><span>1850 · NO DATA</span><span>{g.years.first}</span><span>{last}</span></div>
          </div>
        ) },
    ];
  }, [facts, gm, hm, meta, ar6]);
  const sources = facts.status === "ready" && gm.status === "ready" && hm.status === "ready" && ar6.status === "ready"
    ? copyS02(facts.data, { stepDeg: 2, scale: 0.1, missing: -128, hadShare1880: null, offsetLabel: "", pipeline: "", generated: "", ar6Page: ar6.data.source.page_printed })[4].sources : "";
  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="Where the record comes from" className="scene scene-record">
      <h2 id="record-title" tabIndex={-1} data-scene-heading className="sr-only">{def.title}</h2>
      {cards ? <div className="deck-stage"><StoryDeck track={def.id} cards={cards} /></div> : (
        <div className="record-state">
          <ArtifactStatus file="grid_gistemp_2deg.meta.json" state={gm} retry={retryG} empty="">{() => null}</ArtifactStatus>
          <ArtifactStatus file="grid_hadcrut5_5deg.meta.json" state={hm} retry={retryH} empty="">{() => null}</ArtifactStatus>
        </div>
      )}
      {sources ? <p className="record-sources">{sources}</p> : null}
    </Track>
  );
}
