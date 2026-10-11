import { useEffect, useRef, useSyncExternalStore } from "react";
import { HonestyChip } from "../components/HonestyChip";
import { ErrorLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { FACTS, GRID_INTRO } from "../data/artifacts";
import { copyS00 } from "../data/copy";
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
  const [facts] = useArtifact(FACTS);
  const [grid, retry] = useArtifact(GRID_INTRO);
  const motion = useMotion();
  const copy = copyS00(facts.status === "ready" ? facts.data : null);
  const version = useSyncExternalStore(bank.subscribe, bank.getVersion);
  const still = useRef<HTMLCanvasElement>(null);

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
      <p className="sr-only">{copy.alt}</p>
      <div className={`signal-foot ${introPlaying ? "is-waiting" : ""}`}>
        <p className="state-line nogl-only">{copy.noGl}</p>
        {grid.status === "error" ? <ErrorLine file="grid_gistemp_2deg_intro" reason={grid.reason} attempt={grid.attempt} onRetry={retry} /> : null}
        <p className="signal-note"><HonestyChip tag="OBSERVED" /> <span>{copy.note}</span></p>
      </div>
    </>
  );
}
