import { useCallback, useEffect, useState } from "react";
import { addFrame } from "../motion/loop";
import { Reveal } from "../motion/reveal";
import { motionEnabled } from "../state/motion";
import { INTRO_MS, debug, intro, introTime } from "../scenes/director";
import { bank } from "../state/bank";

const KEY = "cso.intro";
const seen = () => { try { return sessionStorage.getItem(KEY) === "done"; } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem(KEY, "done"); } catch { /* storage blocked: plays again next load */ } };

/**
 * S00 "Solar Ignition" clock (MOTION_SYSTEM 5.1). The planet timeline lives in
 * the director; this drives the DOM from the same clock: corner labels, the
 * year counter (the year of the layer on screen), the headline sharpening
 * (3300-4500ms) and the nav entry (4200ms). SKIP, Esc and any scroll input
 * complete it in 350ms; scroll is never locked. Once per session; reduced
 * motion renders the end state on the first frame.
 */
export function useIntro() {
  const [playing, setPlaying] = useState(() => motionEnabled() && !seen());
  const [navIn, setNavIn] = useState(() => !playing);
  const [run, setRun] = useState(0);

  const complete = useCallback(() => {
    if (!intro.playing || intro.completeFrom >= 0 || intro.frozen >= 0) return;
    const now = performance.now();
    intro.completeFrom = introTime(now);
    intro.completeAt = now;
  }, []);

  useEffect(() => {
    const h = document.querySelector<HTMLElement>("h1[data-hero]");
    const reveal = h ? new Reveal(h) : null;
    const counter = document.querySelector<HTMLElement>("[data-intro-year]");
    const corners = document.querySelectorAll<HTMLElement>("[data-intro-corner]");
    const latest = () => String(bank.axis().at(-1));
    if (!playing) {
      intro.playing = false;
      reveal?.set(1);
      corners.forEach((c) => (c.style.opacity = ""));
      const show = () => { if (counter) counter.textContent = latest(); };
      show();
      return bank.subscribe(show);
    }
    Object.assign(intro, { playing: true, start: 0, completeFrom: -1, completeAt: 0, arrival: -1, minR: Infinity, monotonic: true, lastR: 0, years: [] });
    reveal?.set(0);
    let navShown = false;
    const off = addFrame((now) => {
      const t = introTime(now);
      corners.forEach((c) => (c.style.opacity = String(Math.min(1, t / 200))));
      if (counter) counter.textContent = String(debug.lastYear || 1880);
      reveal?.timed(t - 3300);
      if (!navShown && t >= 4200) { navShown = true; setNavIn(true); }
      if (t >= INTRO_MS && intro.frozen < 0) {
        off();
        intro.playing = false;
        reveal?.set(1);
        if (counter) counter.textContent = latest();
        markSeen();
        setPlaying(false);
      }
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "End", "Home"].includes(e.key)) complete();
    };
    addEventListener("wheel", complete, { passive: true });
    addEventListener("touchmove", complete, { passive: true });
    addEventListener("keydown", onKey);
    return () => {
      off();
      removeEventListener("wheel", complete);
      removeEventListener("touchmove", complete);
      removeEventListener("keydown", onKey);
    };
  }, [playing, run, complete]);

  const replay = useCallback(() => {
    scrollTo(0, 0);
    if (!motionEnabled()) return; // the 0ms version is the end state
    setNavIn(false);
    setPlaying(true);
    setRun((r) => r + 1);
  }, []);

  return { playing, navIn, skip: complete, replay };
}
