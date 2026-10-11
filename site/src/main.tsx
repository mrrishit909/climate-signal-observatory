import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "lenis/dist/lenis.css";
import "./styles/app.css";
import "./styles/scenes.css";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { App } from "./app/App";
import { getProgress, jumpTo, startEngine } from "./scroll/engine";
import { debug, intro, introTime, quality, snapAll, yearMix } from "./scenes/director";
import { layout } from "./scenes/geometry";
import { getClimate, setClimate } from "./state/climate";
import { obs } from "./state/scenes";

// The dev gallery is excluded from production builds: the guard is a build-time constant, so the
// chunk is not emitted. `npm run build:gallery` (VITE_GALLERY=1, separate outDir) is for evidence only.
const GALLERY_ENABLED = import.meta.env.DEV || import.meta.env.VITE_GALLERY === "1";
const Gallery = GALLERY_ENABLED ? lazy(() => import("./dev/Gallery")) : null;
const isGallery = !!Gallery && document.documentElement.classList.contains("is-gallery");
if (!isGallery) document.documentElement.classList.remove("is-gallery");

// Test/evidence hook: the same instant-jump path the nav uses (deterministic captures).
Object.assign(window, {
  __cso: {
    jumpTo, getProgress, getClimate, setClimate, obs: obs.get, setObs: obs.set,
    quality: () => ({ tier: quality.tier, median: quality.median }),
    /** freeze the S00 clock at t ms (evidence frames); -1 releases it */
    freeze: (t: number) => { intro.frozen = t; if (t >= 0) intro.playing = true; },
    introStats: () => ({ minR: intro.minR, monotonic: intro.monotonic, years: [...intro.years], playing: intro.playing, G0: layout(document.documentElement.clientWidth, innerHeight).G0.r }),
    debug: () => ({ ...debug }),
    introT: () => introTime(performance.now()),
    yearMix,
  },
});
addEventListener("cso:jump", snapAll);

startEngine();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {isGallery && Gallery ? (
        <Suspense fallback={null}>
          <Gallery />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
