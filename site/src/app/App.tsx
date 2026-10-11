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
      {portal ? createPortal(<SignalLayer introPlaying={intro.playing} />, portal) : null}
      {SCENES.slice(1).map((s) =>
        s.id === "years" ? <S03aYears key={s.id} def={s} /> : s.id === "strata" ? <S04Strata key={s.id} def={s} /> : <Placeholder key={s.id} s={s} />,
      )}
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
