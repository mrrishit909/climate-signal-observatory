import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NotificationCard } from "../components/NotificationCard";
import { WordReveal } from "../components/WordReveal";
import { stepState } from "../motion/progress";
import { HonestyChip } from "../components/HonestyChip";
import { SceneErrors } from "../components/StateUI";
import { useActiveScene } from "../scroll/hooks";
import { COAST } from "../data/artifacts";
import { useArtifact } from "../data/useArtifact";
import { FACTS, GRID_INTRO } from "../data/artifacts";
import { copyS00, copyS01 } from "../data/copy";
import { useMotion, useProgress } from "../scroll/hooks";
import { easeSymmetric } from "../motion/ease";
import { windowed } from "../motion/progress";
import { lerp } from "../lib/math";
import { viewportClass } from "../graphics/canvas";
import { bank } from "../state/bank";
import { faceQuat } from "../gl/projection";
import { paintStatic } from "./director";
import { planetFrame } from "./frames";

/**
 * S00 end state + S01 scrub (VISUAL_DESIGN 3.4): the OBSERVED note chip,
 * intro-grid states, the headline moving aside as the planet leaves G0, and
 * the reduced-motion static planet. The headline itself is static HTML (LCP).
 */
export function SignalLayer({ introPlaying }: { introPlaying: boolean }) {
  const [facts, retryF] = useArtifact(FACTS);
  const [coast, retryC] = useArtifact(COAST);
  const active = useActiveScene();
  const [grid, retry] = useArtifact(GRID_INTRO);
  const motion = useMotion();
  const copy = copyS00(facts.status === "ready" ? facts.data : null);
  const version = useSyncExternalStore(bank.subscribe, bank.getVersion);
  const still = useRef<HTMLCanvasElement>(null);
  const [cards, setCards] = useState(0);
  const cardStep = useRef(0);
  const s01Ref = useRef<HTMLDivElement>(null);
  useProgress("signal", (p) => {
    if (s01Ref.current) s01Ref.current.style.opacity = !motion || p > 0.3 ? "1" : "0";
    // D-006: past p 0.3 the S01 block carries the planet's tag itself, so the S00 note steps aside instead of printing over the cards
    const s = stepState(cardStep.current, p, [0.6]);
    if (s !== cardStep.current) { cardStep.current = s; setCards((k) => (s ? Math.abs(k) + 1 : -Math.abs(k))); }
  });
  const s01 = facts.status === "ready" ? copyS01(facts.data) : null;

  // S01 p 0-0.4: the headline scales down and rises as the planet moves G0 -> G1s
  useProgress("signal", (p) => {
    const h = document.querySelector<HTMLElement>("h1[data-hero]");
    if (!h) return;
    if (!motion) { h.style.transform = ""; return; }
    const s = easeSymmetric(windowed(p, 0, 0.4));
    const cls = viewportClass(innerWidth);
    const k = cls === "D" ? 44 / 96 : cls === "T" ? 36 / 64 : 28 / 40;
    const top = cls === "D" ? 120 : 64;
    h.style.transform = s > 0 ? `translateY(${(-(h.offsetTop - top) * s).toFixed(1)}px) scale(${lerp(1, k, s).toFixed(4)})` : "";
  });

  useEffect(() => {
    if (motion || !still.current) return;
    const draw = () => paintStatic(still.current!, (L, dpr) => {
      const f = planetFrame(L, dpr, L.G0, faceQuat(-30, 15), "gistemp", bank.axis().at(-1)!, "1951-1980");
      f.dim = L.cls === "M" ? 0.5 : 0.4;
      return [f, { orb: null, halo: null, outline: null, limb: { disc: L.G0, alpha: 0.24 } }];
    });
    draw();
    addEventListener("resize", draw);
    return () => removeEventListener("resize", draw);
  }, [motion, version]);

  return (
    <>
      {!motion ? <canvas ref={still} className="still-planet" aria-hidden="true" /> : null}
      <div className="signal-scrim" aria-hidden="true" />
      {s01 ? (
        <div className="s01" ref={s01Ref} style={{ opacity: motion ? 0 : 1 }}>
          <WordReveal as="p" className="s01-statement" text={s01.statement} mode={motion ? { kind: "scrub", track: "signal", from: 0.35, to: 0.75 } : { kind: "value", t: 1 }} />
          <div className={`s01-cards ${cards > 0 || !motion ? "is-in" : ""}`}>
            <p className="s01-tag"><HonestyChip tag="OBSERVED" detail="PLANET" /> <span>{copy.note}</span></p>
            <NotificationCard from={s01.card1Head} when="" body={s01.card1Body} playKey={motion && cards > 0 ? cards : 0} tag={<HonestyChip tag="OBSERVED" detail="GISTEMP v4 · 1951-1980" />} />
            <NotificationCard from={s01.card2Head} when="" body={s01.card2Body} variant="blue" playKey={motion && cards > 0 ? cards : 0} tag={<HonestyChip tag="OBSERVED" detail="NOAA GML" />} />
          </div>
        </div>
      ) : null}
      <SceneErrors active={active === "signal" || active === null} items={[{ file: "facts.json", state: facts, retry: retryF }, { file: "coastlines.json", state: coast, retry: retryC }, { file: "grid_gistemp_2deg_intro.i8.bin.gz", state: grid, retry }]} />
      <p className="sr-only">{copy.alt}</p>
      <div className={`signal-foot ${introPlaying ? "is-waiting" : ""} ${cards > 0 || !motion ? "is-s01" : ""}`}>
        <p className="state-line nogl-only">{copy.noGl}</p>
        <p className="signal-note"><HonestyChip tag="OBSERVED" /> <span>{copy.note}</span></p>
      </div>
    </>
  );
}
