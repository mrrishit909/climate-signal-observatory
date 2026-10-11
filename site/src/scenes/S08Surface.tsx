import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { WordReveal } from "../components/WordReveal";
import { useArtifact } from "../data/useArtifact";
import { FACTS, META } from "../data/artifacts";
import { copyS08, footer } from "../data/copy";
import { stepState, windowed } from "../motion/progress";
import { useActiveScene, useFrame, useMotion, useProgress } from "../scroll/hooks";
import { SceneErrors } from "../components/StateUI";
import { jumpTo } from "../scroll/engine";
import { bank } from "../state/bank";
import { faceQuat } from "../gl/projection";
import { echoLive, paintStatic, surface } from "./director";
import { planetFrame } from "./frames";
import { getClimate, subscribeClimate } from "../state/climate";
import type { SceneDef } from "../app/scenes";

const REPO = "https://github.com/mrrishit909/climate-signal-observatory";

/** S08 The Surface (interaction 10): the record folds back into the planet, the camera pushes into it, the decade run echoes. */
export function S08Surface({ def, onReplay }: { def: SceneDef; onReplay: () => void }) {
  const motion = useMotion();
  const [facts, retryF] = useArtifact(FACTS);
  const [meta, retryM] = useArtifact(META);
  const active = useActiveScene();
  const version = useSyncExternalStore(bank.subscribe, bank.getVersion);
  const [echo, setEcho] = useState(0);
  const [links, setLinks] = useState(0);
  const [captionOn, setCaptionOn] = useState(false);
  const eRef = useRef(0), lRef = useRef(0), fRef = useRef(0);
  // D-012: the cells on screen carry their tag from the first frame: the folding core (shared look) before p 0.3, then the GISTEMP surface
  const [folding, setFolding] = useState(1);
  const look = useSyncExternalStore(subscribeClimate, getClimate);
  const scrim = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  useProgress(def.id, (p) => {
    if (scrim.current) scrim.current.style.opacity = motion ? String(windowed(p, 0.4, 0.75)) : "1";
    if (text.current) text.current.style.opacity = !motion || p > 0.36 ? "1" : "0";
    const e = stepState(eRef.current, p, [0.75]);
    if (e !== eRef.current) { eRef.current = e; setEcho(e); if (!e) setCaptionOn(false); }
    const k = p < 0.3 ? 1 : 0;
    if (k !== fRef.current) { fRef.current = k; setFolding(k); }
    const l = stepState(lRef.current, p, [0.8]);
    if (l !== lRef.current) { lRef.current = l; setLinks(l); }
  });
  useFrame(() => {
    if (!echo || !counter.current) return;
    counter.current.textContent = String(surface.year || bank.axis().at(-1));
    if (!echoLive() && !captionOn) setCaptionOn(true);
  });
  const still = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (motion || !still.current) return;
    paintStatic(still.current, (L, dpr) => {
      const f = planetFrame(L, dpr, L.G5, faceQuat(0, 30), "gistemp", bank.axis().at(-1)!, "1951-1980");
      f.dim = 0.35;
      return [f, null];
    });
  }, [motion, version]);
  const c = facts.status === "ready" ? copyS08(facts.data) : null;
  const on = !motion || captionOn;
  const act = [() => jumpTo("observatory", undefined, { push: true, focus: true }), onReplay];
  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="Closing: the surface" className="scene scene-surface">
      <SceneErrors active={active === def.id} items={[{ file: "facts.json", state: facts, retry: retryF }, { file: "meta.json", state: meta, retry: retryM }]} />
      {!motion ? <canvas ref={still} className="still-planet" aria-hidden="true" /> : null}
      <div className="surface-scrim" ref={scrim} aria-hidden="true" style={{ opacity: motion ? 0 : 1 }} />
      {motion && !on && active === def.id ? (
        <p className="surface-tag">{folding
          ? <HonestyChip tag="OBSERVED" detail={`CELLS · ${look.source === "gistemp" ? "GISTEMP V4" : "HADCRUT5"} · ${look.baseline}`} />
          : <HonestyChip tag="OBSERVED" detail="GISTEMP V4 · 1951-1980" />}</p>
      ) : null}
      <p className={`surface-year tnum ${echo || !motion ? "is-in" : ""}`} aria-hidden="true"><span ref={counter}>{bank.axis().at(-1)}</span></p>
      <div className="surface-text" ref={text} style={{ opacity: motion ? 0 : 1 }}>
        <h2 id="surface-title" tabIndex={-1} data-scene-heading className="sr-only">{def.title}</h2>
        {c ? <WordReveal as="p" className="surface-para" text={c.paragraph} mode={motion ? { kind: "scrub", track: def.id, from: 0.4, to: 0.75 } : { kind: "value", t: 1 }} /> : null}
        {c && on ? <p className="surface-caption" data-caption><HonestyChip tag="OBSERVED" className="chip--inline" /> {c.caption}</p> : null}
        {c ? (
          <ul className={`surface-links ${links || !motion ? "is-in" : ""}`}>
            {c.links.map((t, i) => (
              <li key={t} style={{ ["--i" as string]: i }}>
                {i < 2 ? <button type="button" className="link-btn" onClick={act[i]} tabIndex={links || !motion ? 0 : -1}>{t}</button>
                  : <a className="link-btn" href={i === 2 ? `${REPO}/blob/main/docs/METHODOLOGY.md` : REPO} target="_blank" rel="noopener" tabIndex={links || !motion ? 0 : -1}>{t}</a>}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {meta.status === "ready" ? <p className="surface-foot">{footer(meta.data.generated_at)}</p> : null}
    </Track>
  );
}
