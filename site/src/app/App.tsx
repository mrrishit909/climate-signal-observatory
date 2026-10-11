import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Nav } from "../components/Nav";
import { Track } from "../scroll/Track";
import { jumpTo, registerTrack, resolveInitialHash } from "../scroll/engine";
import { useActiveScene } from "../scroll/hooks";
import { NAV_ITEMS, SCENES, navActive, type SceneDef } from "./scenes";
import { useIntro } from "./useIntro";
import { connectBank } from "../state/bank";
import { getStore } from "../data/loader";
import { COAST, FACTS, GRID_INTRO } from "../data/artifacts";
import { startDirector } from "../scenes/director";
import { SignalLayer } from "../scenes/S01Signal";
import { S03aYears } from "../scenes/S03aYears";
import { S04Strata } from "../scenes/S04Strata";
import { S02Record } from "../scenes/S02Record";
import { S03bRegions } from "../scenes/S03bRegions";
import { S05Zero } from "../scenes/S05Zero";
import { S06Futures } from "../scenes/S06Futures";
import { S07Evidence } from "../scenes/S07Evidence";
import { S08Surface } from "../scenes/S08Surface";
import { Observatory } from "../scenes/Observatory";

function Placeholder({ s }: { s: SceneDef }) {
  return (
    <Track id={s.id} height={s.track} landing={s.landing} className={`scene scene-${s.id} scene--placeholder`}>
      <div className="placeholder">
        <p className="scene-kicker">{s.code} · {s.nav ?? "CLOSING"} · BUILT IN STAGE B</p>
        <h2 id={`${s.id}-title`} tabIndex={-1} data-scene-heading className="placeholder__title">{s.title}</h2>
      </div>
    </Track>
  );
}

const SCENE_COMPONENTS: Record<string, (p: { def: SceneDef }) => React.ReactNode> = {
  record: S02Record, years: S03aYears, regions: S03bRegions, strata: S04Strata, zero: S05Zero, futures: S06Futures, evidence: S07Evidence, observatory: Observatory,
};

/** App: the static S00/S01 track (index.html) plus the React scenes, the planet canvases and the nav. */
export function App() {
  const active = useActiveScene();
  const intro = useIntro();
  const orb = useRef<HTMLCanvasElement>(null);
  const gl = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const el = document.getElementById("signal");
    return el ? registerTrack("signal", el, SCENES[0]!.landing) : undefined;
  }, []);
  useEffect(() => {
    connectBank();
    // first-paint artifacts (MOTION_SYSTEM 9.3): facts, the DR-1 intro subset and coastlines, in parallel with JS
    getStore(FACTS).prefetch(); getStore(GRID_INTRO).prefetch(); getStore(COAST).prefetch();
    startDirector(orb.current!, gl.current!);
    resolveInitialHash();
  }, []);
  const portal = document.getElementById("signal-portal");
  return (
    <>
      <canvas ref={orb} className="planet-layer planet-2d" aria-hidden="true" />
      <canvas ref={gl} className="planet-layer planet-gl" aria-hidden="true" />
      <p className="gl-lost-note state-line" role="status">RESTORING 3D VIEW</p>
      {portal ? createPortal(<SignalLayer introPlaying={intro.playing} />, portal) : null}
      {SCENES.slice(1).map((s) => {
        const C = SCENE_COMPONENTS[s.id];
        return s.id === "surface" ? <S08Surface key={s.id} def={s} onReplay={intro.replay} /> : C ? <C key={s.id} def={s} /> : <Placeholder key={s.id} s={s} />;
      })}
      <Nav
        items={NAV_ITEMS}
        active={navActive(active)}
        onJump={(id) => jumpTo(id, undefined, { push: true, focus: true })}
        introPlaying={!intro.navIn}
        onSkip={intro.skip}
        onReplay={intro.replay}
      />
    </>
  );
}
