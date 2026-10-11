/**
 * Scene registry (VISUAL_DESIGN 3.1, landing progress from MOTION_SYSTEM 6.2).
 * `signal` (S00 intro + S01) is static HTML in index.html so the LCP headline
 * paints before JS. S08 has no nav item: the nav keeps OBSERVATORY active.
 */
export interface SceneDef { id: string; code: string; nav: string | null; track: string; landing: number; title: string }

export const SCENES: SceneDef[] = [
  { id: "signal", code: "S01", nav: "SIGNAL", track: "200vh", landing: 0.78, title: "The planet is keeping a record." },
  { id: "record", code: "S02", nav: "RECORD", track: "300vh", landing: 0.14, title: "Where the record comes from." },
  { id: "years", code: "S03a", nav: "YEARS", track: "250vh", landing: 0.5, title: "The planet, one year at a time." },
  { id: "regions", code: "S03b", nav: "REGIONS", track: "300vh", landing: 0.1, title: "Warming is not spread evenly." },
  { id: "strata", code: "S04", nav: "STRATA", track: "350vh", landing: 0.89, title: "Unwrap the planet and it becomes a record." },
  { id: "zero", code: "S05", nav: "ZERO", track: "250vh", landing: 0.3, title: "Choose your zero." },
  { id: "futures", code: "S06", nav: "FUTURES", track: "250vh", landing: 0.42, title: "The first assessed window has already begun." },
  { id: "evidence", code: "S07", nav: "EVIDENCE", track: "250vh", landing: 0.05, title: "How we know." },
  { id: "observatory", code: "OBS", nav: "OBSERVATORY", track: "auto", landing: 0, title: "Any year, any place, any zero." },
  { id: "surface", code: "S08", nav: null, track: "200vh", landing: 0.3, title: "The planet doesn't speak in words." },
];

export const NAV_ITEMS = SCENES.filter((s) => s.nav).map((s) => ({ id: s.id, label: s.nav! }));
/** S08 keeps OBSERVATORY active in the nav. */
export const navActive = (scene: string | null) => (scene === "surface" ? "observatory" : scene ?? "signal");
