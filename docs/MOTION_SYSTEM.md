# Motion system: Climate Signal Observatory

This is the phase 17 motion bible. It pairs with `VISUAL_DESIGN.md`, and all references point there:

- scene ids S00-S08 and OBS
- geometry states G0/G1/G1s/G2 (globe, sheet) and K1-K4 (core, bench, spine column)
- interaction numbers 1-10

Every value here is binding for the frontend engineer. A deviation needs a written reason in `docs/ENGINEERING_DECISIONS.md` (the orchestrator owns that file).

## Contents

1. [Global principles and the six motion layers](#1-global-principles-and-the-six-motion-layers)
2. [Hard rules](#2-hard-rules)
3. [Token mapping](#3-token-mapping)
4. [The scroll engine](#4-the-scroll-engine)
5. [Animation specifications](#5-animation-specifications)
6. [Navigation, chapter jumps, interruption](#6-navigation-chapter-jumps-interruption)
7. [Operational state motion](#7-operational-state-motion)
8. [Reduced motion](#8-reduced-motion)
9. [Performance budgets and quality tiers](#9-performance-budgets-and-quality-tiers)
10. [Technical stack recommendation](#10-technical-stack-recommendation)
11. [Motion test plan](#11-motion-test-plan)

---

## 1. Global principles and the six motion layers

1. **Motion performs the analysis. Nothing moves to decorate.**
   - The sphere turns *to* a region.
   - Cells *travel* from the sphere to the sheet.
   - Rows *collapse* into their zonal mean.
   - Strata *land* in time order.
   - Colour *becomes* position.
   - The planet *returns* to the orb.
2. **Two motion modes,** from the reference:
   - **Scrubbed.** A pure function of scroll progress, reversible and stateless: camera moves, the unwrap, the core build, colour-to-position, card decks, word reveals.
   - **Stepped.** A threshold triggers a timed, retargetable transition: region turns, statement swaps, the spine, the coverage pulse, the futures windows, the argument cards.
3. **Data is shown only at integer years.** A year change is a 200ms crossfade between two *real* layers. A fractional-year state is never held on screen. Scrubbing moves the year; it does not interpolate the planet.
4. **One luminous form at a time:**
   - In S00 and S08 it is the orb.
   - From S01 to OBS it is the planet with its Solar halo, at 20% or less.
   - In S05 and S06 the halo is off, and the light comes only from the data.
5. **Slow structure, quick data.** Structure (the sphere, sheet, core and bench) moves over 800-1200ms with long settles. Data re-binning takes 200-600ms.
6. **Keyed continuity:**
   - every cell is keyed by `(row, col)`
   - every stratum by year
   - every band by its `regional.bands` id
   - every AR6 bracket by `(scenario, period)`

   Keyed things travel or re-colour in place. They never swap identity in a cross-fade between different positions.
7. **Settle, don't bounce.** There is no overshoot on data marks or the globe. Drag-rotate inertia decays exponentially with no spring. Springs (damping ratio 1.0 or more) are allowed only on bottom sheets.
8. **The visitor always wins.** Any input retargets or completes an animation immediately. Nothing queues, and nothing blocks scroll. The wheel always scrolls the page, even over the globe.

### The six motion layers (directive requirement)

| Layer | Where it lives | Spec |
|---|---|---|
| 1. Intro | S00 Solar Ignition: the orb, sphere, decade run, headline and nav | 5.1 |
| 2. Navigation transitions | Bottom bar active block, MENU pill, chapter jumps with a stage fade, focus moves | 6 |
| 3. Scroll storytelling | G1 to G1s camera moves, year scrub, region turns, the unwrap and core build, bench, colour-to-position, the return | 4, 5.3, 5.5-5.9, 5.13 |
| 4. Component interaction | Clamp drag and snap, trend handles, the core scrubber, drag-rotate, the inspector, bottom sheets | 5.8, 5.12, 5.14 |
| 5. Data transitions | Year crossfades, baseline/source re-bin, trend surface swaps, ledger FLIP, numeral tweens, inspector path morph, bracket emphasis | 5.10 |
| 6. Microinteractions | Hover, press and focus on squares and chips, segmented active blocks, tooltip, copy check marks, the RESET confirmation | 5.14, 7 |

## 2. Hard rules

Each rule is checked in QA.

| Rule | Test |
|---|---|
| **LCP:** `h1[data-hero]` is in the HTML and painted from first paint as ghost text: opacity 0.55, `filter: blur(12px)` (ENGINEERING_DECISIONS #10). It is never opacity 0. The display font is preloaded, with `font-display: swap` and a metric-matched fallback. The WebGL canvas is created after first paint and never before the headline is painted. | Lighthouse: the LCP element is `h1[data-hero]`, LCP is 2.5s or less, and CLS is 0.1 or less (mobile and desktop presets). |
| **The grid never blocks first paint.** `grid_gistemp_2deg.i8.bin.gz` (about 0.6 MB) is fetched after `load`, or on the first idle callback. The intro uses the DR-1 subset. | A Lighthouse network waterfall shows the grid request starting after FCP. |
| Animate only `transform`, `opacity`, and `filter` (at most 14 word spans at once) in the DOM. WebGL draws its own pixels. Never animate layout properties or `backdrop-filter`. | A DevTools trace shows no Layout events inside scrubbed frames. |
| **One `requestAnimationFrame` loop** owns everything: Lenis, progress, tweens and the WebGL draw. | Grep finds one `requestAnimationFrame` call site (`src/motion/loop.ts`). |
| **Integer-year display.** `u_mixYear` is non-zero only during a crossfade of 200ms or less (0ms on the LOW tier). | Vitest on the year controller: after 250ms with no input, `mix` is 0 or 1. |
| **No LINEAR sampling of data textures.** All data textures are `R8I` / `R32F` with `NEAREST` filtering. | A WebGL wrapper assertion in dev builds, and a code review. |
| No artificial delays, and no fake progress. | Code review: no `setTimeout` gates any data display. |
| No animation on hidden stages. The WebGL draw is skipped when no scene using it is active (S07 and below the fold). | Playwright: with S07 centred, the GL frame counter is flat for 2s. |

## 3. Token mapping

| Token | Value | Used for |
|---|---|---|
| `--motion-fast` | 200ms | Nav hover (reference `0.2s ease-in-out`), tooltips, the **year crossfade**, pill label swap, chip text crossfade |
| `--motion-standard` | 350ms | Argument card stack (reference `all .35s ease-in-out`), intro completion on input, clamp snap, chapter-jump stage fade, segmented active block, cells' first fade-in |
| `--motion-panel` | 600ms | Baseline/source re-bin, trend surface swap, numeral tweens, ledger FLIP, statement exit, bracket emphasis on scenario change, inspector enter |
| `--motion-card` | 800ms | Story-card settle, spine growth, band outline draw, bracket draw, drag-rotate return-to-face, colour-to-position on a jump |
| `--motion-scene` | 1200ms | **Region turn** (reference `transform 1.2s cubic-bezier(.33,1,.68,1)`), GLOBE/MAP unwrap in OBS (time-based), intro headline span, coverage pulse hold |
| `--ease-premium` `cubic-bezier(.5,0,0,1)` | | Entrances and departures: strata landing, cards, nav enter, bracket draw, the spine |
| `--ease-symmetric` `cubic-bezier(.5,0,.5,1)` | | Every scrubbed interpolation (camera, unwrap, collapse, turn, core build, colour-to-position), so reverse scroll feels identical |
| `--ease-smooth` `cubic-bezier(.33,1,.68,1)` | | Stepped settles: the region turn, data tweens, the clamp snap, word sharpening |
| `linear` | | Story progress segments, year counter steps, PLAY advance |
| `ease-in-out` | | Nav hover only (matches the reference) |

These all fall inside the directive's ranges:

| Directive category | Directive range (ms) | Our value (ms) |
|---|---|---|
| Hover | 120-250 | 200 |
| Buttons | 150-300 | 200-350 |
| Panels | 250-600 | 350-600 |
| Charts | 400-1000 | 600-800 |
| Section transitions | 700-1800 | 800-1200 |
| Cinematic | 1000-3000 | 1200, plus the 4.6s composite intro |

## 4. The scroll engine

Reuse the app shell already ported from P01 into P02 (`site/src/motion`, `scroll`, the loader and the nav). Do not rebuild it. The specifics:

- **Tracks.** A `<section>` with the track height from VISUAL_DESIGN 3.1, and a sticky `100dvh` stage inside it. Progress is `p = clamp((scrollY - trackTop) / (trackHeight - innerHeight), 0, 1)` from Lenis's value, with geometry cached and re-measured on resize.
- **Active set.** Only the scene at the viewport centre and the next scene receive `update(p, dt)`. The single WebGL canvas is shared by S00-S06, OBS and S08. Each frame it draws only the state of the active scene.
- **Scrubbed** functions take the form `s = ease((p - a) / (b - a))`, clamped. They hold no state.
- **Stepped** thresholds use **hysteresis ±0.02**.
- **Retargetable tweens.** `retarget(to)` restarts from the current value with the full duration. Rotations use **quaternion slerp** along the shortest arc (not independent lon/lat tweens), so a turn from the Arctic to the Pacific never swings through the pole the long way.
- **Lenis:** `lerp 0.1` on D, native touch scroll on T/M (`syncTouch: false`), and off under reduced motion.

## 5. Animation specifications

Format for each entry:

- **Trigger**
- **Initial → End**
- **Duration / Easing**
- **Sync** (scrubbed or stepped)
- **Interruption**
- **Input**
- **Reduced motion**
- **Performance**

### 5.1 S00 intro: "Solar Ignition" (4.6s total)

| Time (ms) | What happens | Duration / easing |
|---|---|---|
| 0 | First paint: black, the ghost headline at its final position, the corner labels at 0, and SKIP INTRO. | |
| 0-200 | Corner labels fade in. The year counter shows `1880`. | 200, linear |
| up to 300 | First rAF after `document.fonts.ready` (capped at 300ms): the **Orb component** (shared, Canvas2D, cached bitmap) is drawn at G0. The WebGL context and programs compile in the same idle slot. | |
| 200-1200 | **The orb breathes in:** scale 0.92 to 1, opacity 0 to 1. | 1000, smooth |
| 1000-1700 | **The glow contracts:** the orb's outer radius goes from 1.6r to 1.18r (it becomes the halo), its core luminance drops to 35%, and the 1px limb draws (opacity 0 to 0.24). | 700, premium |
| 1500-1700 | **The handoff:** the WebGL sphere (cells at uniform `#FF7A1F`, matching the orb's mid stop at that frame) crossfades in over the 2D orb's disc. The 2D layer keeps only the halo. | 200, linear |
| 1600-2000 | **The 1880 layer appears:** cell colours tween from the uniform colour to their binned values. Missing cells resolve to the lattice. Coastlines fade in (0 to 0.35). | 400, premium |
| 2000-3400 | **The decade run:** the DR-1 layers 1890, 1900, ..., 2020 and then the latest year. Each step is a 120ms crossfade, started every 93ms (15 steps). The counter shows **the year of the layer on screen**, jumping by decades with no invented in-between years. | 120 per step, linear |
| 0-4600 | Idle rotation of 3 deg/s about the planet's axis, starting from lon0 -30, lat0 15. | linear |
| 3300-4500 | **The headline sharpens** word by word: 6 words, each blur 12 to 0 and opacity 0.55 to 1 over 600ms, staggered 120ms. On D/T the planet dims to 45% behind it. On M it stays 100% (the headline sits below the planet). | 600 per word, smooth |
| 4200-4550 | The nav enters: translateY 24px to 0, opacity 0 to 1. | 350, premium |
| 4600 | `intro = done`. Scroll was never locked. | |

- **Data timing.**
  - If DR-1 has not arrived by 1600ms, the sphere stays uniform until it arrives, then runs only the 1880-to-latest crossfade (350ms) with no decade run.
  - If it never arrives, the cells stay hidden and the limb and coastlines carry the shape.
  - The counter then stops at `{{facts.latest_complete_year}}` without stepping.
- **Interruption.** SKIP, Esc, wheel, touch-move or a scroll key complete the intro: every value tweens to its end state in 350ms (premium), the year jumps to latest with one 200ms crossfade, and the input is then honoured. The intro never rewinds.
- **Replay.** REPLAY INTRO scrolls instantly to the top and resets. The `sessionStorage['climate.intro']` flag is in try/catch.
- **Reduced motion.** The end state on the first frame: the planet at G1 (latest year, no rotation), the sharp headline and the nav.
- **Performance.**
  - The Orb bitmap is at most 1024px (D) and 512px (M).
  - The WebGL sphere shades only the disc.
  - The decade run uploads the DR-1 subset once as a 16-layer texture array, so each step only changes `u_layerA`, `u_layerB` and `u_mix`.

### 5.2 Word blur reveal (S01 statement, S08 paragraph, statement swaps)

This matches P01 5.2, with the ghost state at opacity 0.55 and a 12px blur:

- **Scrubbed** (S01, S08): `local_i = clamp(((p - a) / (b - a)) x (N + 3) - i, 0, 3) / 3`, then `e = ease_smooth(local_i)`, applied as blur `12px x (1 - e)`, opacity `0.55 + 0.45 e` and translateY `0.06em x (1 - e)`.
- **Stepped** (statement swaps in S03b, S04, S06): outgoing words fade to 0 with blur 6px over 350ms. Incoming words follow at 600ms each with a 60ms stagger, starting 200ms after the exit begins.
- **Limits:** at most 14 spans animate `filter` at once. Revealed words get `filter: none`. The LOW tier uses opacity only.
- **Reduced motion:** static and sharp.
- **Screen readers:** get the full text from the start.

### 5.3 Globe camera moves (S01 G1 to G1s, S02 dim, S03a to S03b, S04 re-centre, OBS)

- **Scrubbed.**
  - The centre interpolates linearly in s, and the radius interpolates in log space (`r = r0 x (r1 / r0)^s`), with `s = ease_symmetric(local)`.
  - The halo opacity interpolates linearly.
  - The planet opacity (S02 dim to 25%) interpolates linearly.
- **Rotation inside scrubbed moves.** A slerp between the two scene orientations is driven by the same s. Idle drift (3 deg/s) is added only in S00, S01 and S03a, and its accumulated angle is folded into the slerp start when S03a hands off to S03b. The S03b state-1 face is therefore reached exactly at p = 1 of the S03a hand-off band, with no jump.
- **Reverse:** exact.
- **Reduced motion:** the scene's resting geometry and no drift.

### 5.4 Story-card choreography (S02)

This is identical to P01 5.4: rise, plateau-and-step row translate, scaleX progress segments, activation animations reset on exit. The per-card visual zones are:

| Card | Activation animation (800ms premium unless noted) |
|---|---|
| 1 | The inner Solar orb contracts into one square cell (the S00 motif in miniature), then the field rows light up with an 80ms stagger |
| 2 | The two lattices draw row by row (2ms stagger per row), the 2° grid first and then the 5° grid |
| 3 | The three baseline brackets slide in from the left in time order, then the offset numeral tweens (600ms smooth) |
| 4 | The 176 coverage bars grow from 0 (scaleY, 1ms stagger by year) |

- **Card 1 orb:** it does not shift hue, and it stops when inactive or under reduced motion.
- **Reduced motion:** a vertical list, with visuals at their final state.

### 5.5 Year scrub (S03a) and the year controller (everywhere)

- **Mapping.** p 0.08-0.92 maps to `yearFloat` over the active source's range. The **displayed year** is `round(yearFloat)`.
- **Crossfade.** When the displayed year changes, `u_layerB` is set to the new layer and `u_mix` tweens 0 to 1 over 200ms (linear). On completion, A becomes B and mix resets to 0.
- **Retarget.** If the year changes again mid-fade, the layer currently weighted 50% or more becomes A, the new year becomes B, and mix restarts at 0.
- **Fast scrub.** If the year rate exceeds 8 years/s, the crossfade duration drops to 0 (hard steps), so a fling never shows mush. Duration is `max(0, 200 x (1 - rate / 8))`.
- **Readout.** The integer year and global value switch instantly during scrub (tabular, fixed `ch` width, no layout shift). Rank and CO2 also switch instantly.
- **Baseline change (stepped).** Two offset sets are bound (`u_offA`, `u_offB` as R16I textures from the sidecar `baseline_offsets`), and `u_baseMix` tweens over 600ms smooth. The shader bins each side and mixes the two *binned* colours, so every intermediate frame is a blend of two real states. The readout numerals tween over 600ms.
- **Source change.** Both source textures are bound and `u_srcMix` tweens over 600ms. Cell gap lines crossfade between the 2° and 5° lattices, and the year track re-maps if the range changes (the y tween is 600ms).
- **+2 °C toggle.** The outline alpha goes 0 to 1 and the non-qualifying dim goes 1 to 0.35, both over 350ms.
- **Reduced motion.** All of these are 0ms.
- **Performance.** Per frame the cost is 1 draw for the cells plus 1 for the coastlines. The uniform changes are cheap.

### 5.6 Regional Turn (S03b), the stepped signature turn

At a threshold crossing (or a ledger click or arrow key):

1. **Rotation.** Slerp to the state's face over **1200ms `cubic-bezier(.33,1,.68,1)`**.
2. **Title exit.** The old title goes `rotate(0 to -6deg)`, `translateY(0 to -12px)` and opacity to 0 over 600ms premium (transform origin at the bottom-left, toward the planet).
3. **Title enter.** It starts at 300ms: `rotate(6deg to 0)`, `translateY(12px to 0)` and opacity 0 to 1 over 800ms smooth.
4. **Band outline.** The old outline fades over 200ms. The new pair of parallels **draws along the visible hemisphere** from the meridian facing the viewer outward (stroke progress 0 to 1, 800ms premium, starting at 600ms). Outside-band cells dim to 30% over 600ms smooth, starting at 400ms.
5. **Ledger.** The active row's white highlight moves via FLIP (600ms premium). Values do not change on a state change, only on a period change.
6. **Body.** Out over 350ms, in from 400ms (600ms smooth).

- **Interruption.** A new target mid-turn slerps from the current orientation. A rapid multi-threshold scroll goes directly to the last state in one 1200ms turn.
- **TREND PERIOD change.** No rotation. The surface swaps via `u_layerMix` (600ms smooth, keyed cells), and the ledger numerals tween over 600ms.
- **Drag.** Rotation follows the pointer directly (an arcball on the sphere). On release, inertia decays with `omega(t) = omega0 x e^(-t / 300ms)`, capped at 180 deg/s, then holds for 1.5s and returns to the state's face (800ms smooth) unless a band was selected.
- **Reduced motion.** The rotation and the outline are instant, the titles swap instantly, and there is no inertia.

### 5.7 The Unwrap (S04), the signature transformation

**Geometry pipeline (one vertex shader, keyed per cell).**

- The cell mesh has **one quad per cell, with unshared vertices** (16,200 quads, 64,800 vertices, 32,400 triangles for the 2° grid).
- Its attributes are `a_lonlat` (the corner), `a_cell` (row, col) and `a_rowMeanX` (the strip-local x of the cell centre after collapse, precomputed).
- **Seam.** Columns are built from -180 to +180 with duplicated edge vertices, so no triangle crosses the antimeridian. That is why phase 0 first turns the globe to face (0, 0): the orthographic centre then matches Equal Earth's central meridian, and the seam sits at the back.

| p | Motion | Sync |
|---|---|---|
| 0-0.08 | G1s to G1 (5.3). Slerp to face (0, 0). The idle drift is off. | scrubbed |
| 0.08-0.30 | `s1 = ease_symmetric(local)`. Position is `mix(ortho(lonlat), equalEarth(lonlat), s1)`, and `z = mix(orthoZ, 0, s1)`, with a depth test, so the back hemisphere is hidden at s1 = 0 and emerges at the flanks as it flattens. The coastline polyline uses the same function. The halo fades to 0. | scrubbed |
| 0.30-0.45 | `s2`: **collapse.** Each cell's x moves from its Equal Earth x to `stripX + a_rowMeanX x stripW x (1 - s2)`, so the cells of a row converge into the strip. Cell width scales toward `stripW / nValidInRow`. Colour is `mix(binColour(cell), binColour(rowMean), s2)` (two real values). Rows under the 20% valid rule mix toward the lattice instead. | scrubbed |
| 0.45-0.58 | `s3`: **turn and re-space.** The strip rotates -90 degrees about its centre. Each row's y moves from its Equal Earth y to the sine-spaced position, `x = left + w/2 x (1 + sin(lat))` after the turn. The strip translates and scales to the K1 top-stratum slot. | scrubbed |
| 0.58-0.85 | **The core builds.** Stratum k (k = 1..N-1, years from latest-1 down to the first) has the window `[0.58 + 0.19 x (k / N), +0.08]`. Its y goes from `vh + 40` to its K1 slot (ease_symmetric). Strata are instanced quads sampling a client-built zonal texture (`R32F`, rows x years; NaN = missing, drawn as the lattice). | scrubbed |
| 0.85 | **SPINE** (stepped): the global column grows with scaleY 0 to 1 from the bottom (800ms premium). Statement 1 swaps to statement 2 (5.2 stepped). The footnote fades in (350ms). | stepped |
| 0.93 | **COVERAGE** (stepped): the lattice opacity goes 0.40 to 0.70 (350ms smooth), holds for 1200ms, then settles to 0.50 (600ms smooth). The measured-area readout fades in (350ms). | stepped |

- **Phase captions** (DOM, mono 13px). Each crossfades over 200ms when its phase's window starts. The numbers are bound (`16,200` = n_lat x n_lon from the sidecar).
- **Reverse.** Phases 0-0.85 are pure, so a reverse scroll re-wraps the planet exactly. The steps follow hysteresis.
- **Source change after landing.** The strata re-colour over 600ms (keyed by year). For HadCRUT5 the 1850-1879 strata go from lattice to colour.
- **Reduced motion.** Five static frames at the phase ends, swapped instantly at thresholds.
- **Performance.**
  - Building the zonal texture from the grid (146 years x 90 rows) is a one-time client computation per (source, baseline), under 15ms on D. It runs in an idle callback when the grid arrives, and again on a baseline change (debounced).
  - The unwrap is 1 draw (cells) plus 1 (coastlines), then 1 instanced draw (strata) plus 1 (spine).
- **Parity.** `src/gl/projection.ts` holds the same Equal Earth and orthographic formulas as the GLSL. Vitest compares it against `d3.geoEqualEarth` and `d3.geoOrthographic` to 1e-6. Playwright reads three vertex positions at p 0.30 via a debug hook and checks they are within 1px.

### 5.8 Bench and Zero Lab (S05)

- **Entry (scrubbed, p 0-0.2).** The core rotates -90 degrees about its centre and translates and rescales from K1 to K3. Strata keep their year keys. The series band fades in from p 0.12-0.2 (opacity). The controls enter (350ms, 40ms stagger) at a 0.2 stepped threshold.
- **Clamp drag.**
  - The bracket follows the pointer with no lag.
  - On release it **snaps** to the nearest available stop (350ms smooth).
  - A snap starts the re-bin (5.5 baseline crossfade, 600ms on the bench strata) and the **series re-level**: all points translate vertically by the conversion offset delta (600ms smooth, one transform on the series group, not per point). The trend line travels with the series.
  - The zero hairline labels crossfade (200ms). The invariance check line fades in (350ms) and its ✓ draws (200ms).
- **The disabled stop** (1850-1900 under GISTEMP). Dropping there returns the clamp to its previous stop (350ms smooth). The `SWITCH TO HADCRUT5` button fades in (350ms). There is **no shake**.
- **Trend handles.**
  - Pointer drag follows directly. The fit, line and CI wedge recompute every rAF, with no tween while dragging.
  - On release the result numerals settle (600ms tween from the last drag value to the final value, which is the same value, so it settles in place without visible motion).
  - Keyboard steps tween the line and wedge over 200ms smooth.
- **SMOOTH / BREAKS.** The LOESS line draws in (stroke progress 0 to 1, 800ms premium) with its band edges. Break verticals scale from 0 (scaleY 0 to 1, 350ms premium), and their CI brackets fade in (350ms).
- **RESET.** Everything tweens to the defaults over 600ms. The button briefly shows `RESET ✓` (1.2s).
- **Reduced motion.** Instant snapping and values.

### 5.9 Colour becomes position (S06)

| p | Motion | Sync |
|---|---|---|
| 0-0.30 | Each year's spine swatch i (oldest first) has the window `[0.02 + 0.2 x (i / N), +0.08]`. Its x goes from the spine x to `xScale(value_1850_1900)`, and its y from the K1 slot to the K4 time scale. Its shape goes from a 12x4px swatch to a 4px square, keeping its bin colour. The baseline is HadCRUT5 1850-1900, so before this phase the spine re-bins to that baseline (600ms, at p 0). | scrubbed |
| 0.28-0.34 | Stipple bands fade in (opacity), and the 1.5 / 2.0 °C hairlines draw downward (scaleY). | scrubbed |
| 0.30 | The observed 20-year bars grow from their centre year outward (scaleY, 800ms premium). The `ASSESSED · IPCC AR6` bracket fades in after them (350ms). | stepped |
| 0.35 / 0.55 / 0.75 | Windows 1 / 2 / 3 light up: the hatch is revealed by a clip-path wiping from `best_estimate_c` outward to both ends (800ms premium), the hollow diamond scales 0 to 1 (350ms premium, after 400ms), and the statement swaps. | stepped |

- **Scenario change.** The selected scenario's brackets go to full opacity and 1.5px strokes, and the previous one drops to 30% and 1px (350ms smooth). Bracket extents never animate between scenarios: each `(scenario, period)` bracket stays at its own published position, so no value is ever shown that the table does not contain.
- **Reverse.** Pure, and windows release with hysteresis.
- **Reduced motion.** The final composition, with all windows lit and the selected scenario emphasised.

### 5.10 Data transitions (keyed, everywhere)

| Element | Key | Transition |
|---|---|---|
| Globe/sheet cells, year change | (row, col) | 200ms crossfade between binned layers (5.5). 0ms while dragging the OBS core, and on the LOW tier |
| Cells, baseline/source/layer change | (row, col) | 600ms crossfade of binned colours (`--ease-smooth`) |
| Strata (core, bench) | year | 600ms re-colour. Position changes only through scrubbed phases |
| Numerals (readouts, result line, ledger, inspector) | field id | A 600ms tween, tabular, in a fixed `ch` box. Integers round per frame, and the sign is always shown |
| Band ledger and region chips | band id | FLIP 600ms premium for the highlight. Values tween 600ms |
| Inspector series line | cell id | The y arrays morph over 600ms, **only between years valid in both** cells. Segments that appear or disappear fade (200ms). A gap is never bridged |
| AR6 brackets | (scenario, period) | Opacity and stroke only (5.9) |
| Series re-level (S05) | series id | One group translateY, 600ms smooth |
| Empty data | n/a | Marks go to the lattice (600ms). The empty copy fades in (350ms). Scales keep their last valid domain |
| Hairline labels / axes | label | Position tweens 600ms, and the text crossfades 200ms |

### 5.11 Argument stack (S07)

This is identical to P01 5.12, with 7 exchanges:

- The objection enters (translateY 40px to 0, 350ms ease-in-out).
- `THE RECORD IS TYPING...` appears only during the 350ms between cards (skipped under reduced motion).
- The answer enters offset (+24, +16) on D.
- Older cards dim through the palette (not via opacity below the AA threshold) and scale to 0.96.
- On M, cards older than 2 collapse to slivers.
- **Mini-visuals:**
  - difference bars grow from zero (scaleY, 600ms, 2ms stagger)
  - the rolling slope line draws (800ms)
  - scatter points fade in by year order (600ms)
  - the three CI bars scaleX from their centre (600ms)
- **Reverse:** cards retract in order.

### 5.12 Observatory (OBS)

- **Core scrubber.**
  - Drag moves the year line directly. The globe steps with **0ms crossfades while dragging**. On release, a 200ms crossfade completes and the readout tweens (600ms).
  - Clicking a stratum moves the year line (200ms smooth) and crossfades.
  - Keyboard steps use 200ms.
- **PLAY** (a square button at the core's foot).
  - The year advances at 4 years/s on D and 2 years/s on M, with a 120ms crossfade per step, and wraps to the first year.
  - It pauses on any drag, on Space, when the tab is hidden, when OBS leaves view, or under reduced motion.
- **Latitude slice.**
  - A drag across the core's width shows a white 1px bracket on the core.
  - On release, the band's parallels draw on the globe (800ms premium), and outside cells dim to 30% (600ms).
  - A region chip produces the same motion.
- **Drag-rotate.** As 5.6, but with no return-to-face. The orientation persists in the store.
- **VIEW GLOBE/MAP.** Time-based: a slerp to face (0, 0) over 400ms smooth, then the unwrap phase (s1 0 to 1) over 800ms smooth. MAP to GLOBE is the reverse. Under reduced motion it is instant.
- **Inspector.**
  - D: enters from the right (x 24px to 0, opacity 0 to 1, 600ms premium).
  - T/M: a bottom sheet (translateY to the peak, 350ms premium, critically damped drag release).
  - Exit is 350ms.
  - Its line draws on open (stroke progress, 600ms).

### 5.13 Closing: The Return (S08)

| p | Motion | Sync |
|---|---|---|
| 0-0.35 | The S04 phases in reverse, compressed: the core un-stacks (strata fall below the viewport, newest last), the top stratum turns back into the strip, the strip widens into the sheet, and the sheet wraps into the sphere (`s1` 1 to 0). | scrubbed |
| 0.35-0.6 | The planet re-centres and its radius eases to the orb radius. Cell opacity goes 1 to 0. The Solar halo grows from 1.18r to 1.6r, and the 2D Orb bitmap crossfades back in (from p 0.5 to 0.6). The result is the G0 orb, the same component and colours as S00. | scrubbed |
| 0.4-0.75 | Paragraph word reveal (5.2 scrubbed). | scrubbed |
| 0.75 | **The echo** (stepped, once per down-crossing): the year counter fades in top-right showing the latest year (350ms). The orb brightens by +0.3 core opacity (600ms smooth up, 1200ms back). The caption fades in (350ms) after the brightening peaks. | stepped |
| 0.8-1 | The links fade in (350ms, 60ms stagger). | stepped |

- **Reverse.** Re-crossing above 0.73 resets the echo. The caption never duplicates.
- **Reduced motion.** The static orb with the caption.

### 5.14 Component microinteractions

| Component | Behaviour |
|---|---|
| Square buttons and chips | Hover: background to white and text to black (200ms ease-in-out). Press: scale 0.97 (120ms). Focus: a 2px white outline offset 2px on `:focus-visible` |
| Segmented controls | The white active block slides between items (Motion `layoutId`, 350ms premium) |
| Disabled chips | 50% white and a 45-degree hatch at 25%. No hover motion. The tooltip appears after 80ms |
| Baseline clamp grip | A 16px square. On grab it grows to 20px (200ms), and the bracket stroke goes from 2px to 3px. On snap, the grip briefly fills light blue (200ms) and returns |
| Trend handles | 12px squares that grow to 16px on grab (200ms). The span between them is light blue |
| Core scrubber | On hover (D), a 1px 50% white year line follows the pointer with the year label. The active line is white |
| Tooltips | Opacity 0 to 1 and y 4px to 0 (200ms, 80ms delay). Out in 120ms. They follow the pointer at a 12px offset, clamped to the viewport |
| Copy checks (✓ / ✗) | The stroke draws over 200ms. ✗ uses `--state-error` and never animates repeatedly |

## 6. Navigation, chapter jumps, interruption

### 6.1 Nav

The nav is identical to P01 6.1, using the shared shell:

- **D bar.** Bottom centre, `--surface-glass` with a static 16px blur, and square 13px mono items. The white active block slides (350ms premium) and hover is 200ms ease-in-out. The right end holds REPLAY INTRO and MOTION ON/OFF.
- **T/M MENU pill.** A 160x32 white pill showing the current label (200ms crossfade). A tap opens a clip-path list upward (300ms premium, 30ms item stagger), and the icon morphs from "=" to "-". Close is 250ms (also on Esc, an outside tap or a selection).
- **Labels:** SIGNAL · RECORD · YEARS · REGIONS · STRATA · ZERO · FUTURES · EVIDENCE · OBSERVATORY. S08 keeps OBSERVATORY active.

### 6.2 Direct chapter jumps: instant, with a stage fade

We jump instantly (the reference reached its target within 190ms). Smooth-scrolling across the unwrap would replay the whole transformation, which is noise and is expensive. **Procedure:**

1. `lenis.scrollTo(target, {immediate: true})`.
2. The DOM layer fades in over 350ms. The GL scene renders the target state directly.
3. Every stepped state between the old and new positions is resolved without animation.
4. The hash is written with `replaceState` (`#strata`). `popstate` jumps the same way.
5. Focus moves to the scene heading.

**Landing progress per scene.** Each value sits at least 0.03 clear of every threshold ± hysteresis.

| Scene | Landing p | Why |
|---|---|---|
| S01 | 0.78 | Statement revealed, cards typing |
| S02 | 0.14 | Card 1 centred |
| S03a | 0.50 | A mid-record year |
| S03b | 0.10 | State 1 settled |
| S04 | 0.89 | Core built, spine shown (the band is 0.87 to 0.91) |
| S05 | 0.30 | Bench landed, lab live |
| S06 | 0.42 | Window 1 lit (above 0.37, below 0.53) |
| S07 | 0.05 | First objection |
| OBS | section top | |

### 6.3 Scroll interruption

| Case | Behaviour |
|---|---|
| Reverse scroll | Scrubbed phases reverse exactly. Steps use hysteresis. Year crossfades retarget (5.5). |
| Rapid scroll / fling | The year controller hard-steps above 8 years/s. Region turns go straight to the final state. A scene entered and left within 200ms gets its stepped state set directly. |
| Mid-transition exit | Tweens finish their remaining time, then the scene pauses. A scene re-entered within 1.2s continues from its current values. |
| Resize / orientation | A `ResizeObserver` (debounced 150ms) records the scene and p, snaps tweens, re-measures, recomputes G/K geometry from the D/T/M table (breakpoints 768 / 1024), resizes the GL drawing buffer (DPR cap), and restores scrollY. Nothing animates during a resize. |
| Tab hidden | The loop stops, PLAY pauses, and the GL draw stops. |
| Long task | Frames are skipped, never queued. Tweens are time-based. |
| WebGL context lost | `webglcontextlost`: preventDefault and show the static Orb bitmap plus `RESTORING 3D VIEW`. On `webglcontextrestored`, re-upload textures and resume the current state with no replay. After 2 losses, drop to the NO-WEBGL tier for the session. |

## 7. Operational state motion

| State | Motion |
|---|---|
| **Initial** | The sphere limb (1px, 24%), plus coastlines if loaded, or the core outline. No shimmer. |
| **Loading** | The mono line `LOADING {ARTIFACT} · {n}%` with real stream progress (jumps, no tween). It fades in (200ms) only if loading lasts 150ms or longer. |
| **Ready** | Cells tween from limb-only to binned colours (350ms premium). Missing cells settle into the lattice. The strata fill top-down (1ms stagger). |
| **Empty** | Marks go to the lattice (600ms). The copy fades in (350ms). The controls stay live. |
| **Error** | The loading line crossfades (200ms) to `COULD NOT LOAD {ARTIFACT} ({reason})` in `--state-error`, plus `RETRY`. No shake. |
| **Retry** | The same fetch re-runs. The button shows `RETRYING`. A second failure adds `(ATTEMPT 2)`. |
| **Disabled** | 50% white plus hatch, `aria-disabled`, and a tooltip giving the reason. No hover motion. |
| **Reset** | Values tween to the defaults (600ms, keyed), and the button shows `RESET ✓` for 1.2s (`aria-live`). |

## 8. Reduced motion

It is triggered by `prefers-reduced-motion: reduce` **or** the MOTION OFF toggle. The tokens zero their durations and blur. In addition:

1. The intro shows its end state at once. REPLAY plays the 0ms version.
2. Lenis is off, and native scroll is used.
3. **Pinned tracks become normal flow:**

| Scene | Static rendering |
|---|---|
| S01 | Statement, the planet at G1s (no drift), and the cards |
| S02 | 4 cards stacked vertically |
| S03a | 4 planets (1880, 1940, 1980, latest): a row on D, 2x2 on T, stacked on M. The controls redraw all 4 |
| S03b | One planet plus a 4-button tablist. Turns are instant |
| S04 | 5 frames: sphere, sheet, strip, core, core plus spine (a 5-column strip on D, 2-3 per row on T, stacked on M) |
| S05 | Fully functional, with instant updates |
| S06 | The final composition, with all windows lit and the scenario selector live |
| S07 | All 7 exchanges as a vertical list |
| OBS | Fully functional. No PLAY tweening, instant view switch, no inertia |
| S08 | The static orb plus the caption and links |

4. No idle rotation anywhere. The globe faces its scene orientation.
5. No blur, and no word reveals.

**Tests (Playwright `reducedMotion: 'reduce'`):**

- The document height is below the pinned height.
- No sticky positioning inside scenes.
- The GL frame counter is stable after idle.
- A scroll to the bottom needs fewer than 10 wheel events per 1000px.

## 9. Performance budgets and quality tiers

### 9.1 Rendering decision: raw WebGL2, not R3F

| Option | Cost | Verdict |
|---|---|---|
| R3F + three.js (MASTER_PLAN default) | About 150-180 KB gz of three plus R3F. A scene graph, a renderer and a material system for **one mesh, one instanced quad set and one polyline** | Rejected. Its size alone threatens the 180 KB main-bundle budget and TBT on mobile, for no capability we use |
| Canvas2D orthographic (d3-geo `geoPath` per cell) | 16,200 polygons re-projected and filled per frame. Several ms per frame on D, far too slow on M during drag and unwrap | **Fallback tier only** (NO-WEBGL), where frames are redrawn only on change |
| Fragment shader on a full-screen quad (ray-sphere) | Very cheap for the static globe, but the unwrap needs a per-pixel **inverse** of a blended projection, which has no closed form | Rejected for the unwrap |
| **Raw WebGL2 cell mesh** (vertex-shader projection blend, R8I texture array, instanced strata) | About 8-12 KB of our own code. 32,400 triangles. 2-5 draw calls per frame | **Chosen.** Explicit, testable (projection parity), and the cheapest path to keyed cells |

This departs from MASTER_PLAN's "R3F globe" and is raised for `docs/ENGINEERING_DECISIONS.md` (the orchestrator decides). If the orchestrator insists on three.js, the same shaders port to a `ShaderMaterial` on a `BufferGeometry`. Only the bundle size changes.

### 9.2 Budgets

| Item | Desktop D | Tablet T / Mobile M | LOW tier | NO-WEBGL tier |
|---|---|---|---|---|
| Frame budget | 16.7ms (60fps); JS 6ms or less | 33ms (30fps); JS 10ms or less | same targets | redraw on change only |
| GL drawing-buffer DPR cap | 2 | 1.5 | 1 | n/a (Canvas2D DPR 1.5 / 1) |
| Cells drawn | 16,200 (2°) or 2,592 (5°) | same | same (fill-rate bound, not vertex bound) | Equal Earth flat map only, `geoPath` cached per size |
| Draw calls per frame | 5 or fewer | 5 or fewer | 3 or fewer | n/a |
| Year crossfade | 200ms | 200ms | 0ms (hard steps) | 0ms |
| Intro decade run | yes | yes | no (single crossfade) | no (orb, then flat map) |
| Halo / orb bitmap | cached, 1024px max | 512px max | 512px max, halo 0 in scenes | cached 2D |
| Idle rotation | 3 deg/s | 3 deg/s | off | n/a |
| Word spans animating filter | 14 or fewer | 14 or fewer | 0 (opacity only) | 0 |
| GPU texture memory | GISTEMP 146 x 16,200 B = 2.4 MB R8I, HadCRUT5 0.45 MB, offsets 3 x 32 KB, zonal R32F 63 KB | same | same | n/a |

- **Tier detection.**
  - WebGL2 context creation fails, or `MAX_ARRAY_TEXTURE_LAYERS < 180`: NO-WEBGL.
  - Otherwise, measure the median frame time over the first 60 frames after the intro. Above 22ms on D or 40ms on M means LOW.
  - The result is recorded in `window.__climateQuality`. `?quality=low|high|nogl` forces a tier.
- **Offscreen pause.** No GL draw in S07, or when OBS is out of view and no GL scene is active. The loop draws only when dirty (progress changed, a tween is active, drift is on, or PLAY is on).
- **Uploads.**
  - The grid uploads once, in one `texImage3D` call after gunzip.
  - Decompression runs on the main thread via `DecompressionStream` (streaming, about 0.6 MB). If a trace shows a task over 50ms, move decode and upload preparation to a worker (YAGNI until measured).
- **Measured, not claimed.** FPS, LCP and TBT come only from real runs (Lighthouse desktop and mobile presets, a Playwright trace with frame pacing on a stated device, and the evidence harness).

### 9.3 Loading budget (Lighthouse perf 90+, LCP 2.5s or less, CLS 0.1 or less)

| Resource | Budget (gz / transfer) | When |
|---|---|---|
| HTML + critical CSS (headline, ghost state) | 25 KB or less | first paint |
| Main JS (React, shell, loop, Lenis, Motion lazy core, WebGL module and shaders, d3-scale/shape/array subset) | 170 KB or less | deferred module |
| Fonts (2 latin woff2, display preloaded) | 120 KB or less | first paint |
| `facts.json`, `meta.json`, DR-1 intro subset, DR-2 coastlines | 130 KB or less | in parallel with JS |
| `series_annual`, `regional`, `trends`, `co2`, grid sidecars | 250 KB or less | idle after the intro |
| `grid_gistemp_2deg.i8.bin.gz` (about 0.6 MB, contract) | as published | after `load` / first idle. Required by S03a |
| `grid_hadcrut5_5deg.i8.bin.gz`, DR-3 trend grids | 400 KB or less | prefetched at S03a entry, required on SOURCE / S03b |
| `agreement`, `changepoints`, `ar6`, `validation`, `reconciliation`, `series_monthly` | 300 KB or less | at S05 entry |
| d3-geo (NO-WEBGL tier only) | about 15 KB | lazy, only on that tier |

## 10. Technical stack recommendation

| Layer | Choice | Reason |
|---|---|---|
| App | React 18 + TypeScript strict + Vite, using the shell already ported in P02 (`site/src/motion`, `scroll`, loader, nav, primitives) | Program standard. No rebuild |
| Styles | `tokens.css` + CSS Modules, with project overrides only for `--accent-primary` (Solar mid `#FF7A1F`), `--accent-secondary` (`#58B8E1`) and the anomaly bin variables | Tokens own the language |
| Scroll | Lenis plus the one rAF loop | Same as P01/P02 |
| GSAP | Not used | The intro is a keyframe table run by the shared tween, and the scrub/threshold engine covers the rest (P01 decision 6) |
| Component motion | Motion (`motion/react`, `LazyMotion` + `domAnimation`) | FLIP ledgers, `layoutId` active blocks, inspector, sheets |
| Globe, sheet, strata | **Raw WebGL2** in `src/gl/` with 2 programs: `cells` (projection-blend vertex shader, `isampler2DArray` grid, offsets, bins and lattice in the fragment shader) and `strata` (instanced quads, `R32F` zonal texture). The coastline polyline uses the `cells` vertex path with a line fragment shader | 9.1 |
| Projection math | `src/gl/projection.ts` (Equal Earth and orthographic, mirrored in GLSL). `d3-geo` is a **dev dependency** for parity tests, and a lazy runtime import only on the NO-WEBGL tier | Parity without bundle cost |
| Series and charts | `d3-scale`, `d3-shape`, `d3-array` (tree-shaken), drawn as SVG by our components (series band, bench rail, inspector line, S06 column, mini-visuals) | Stays in the visual language, with no chart-library defaults |
| Models | `src/model/trend.ts` (OLS plus AR(1)-adjusted CI, the `trends.json` method), `src/model/zonal.ts` (DR-4 rule), `src/model/rebase.ts` (cell offsets) | Pure functions, each with Vitest parity against artifact fixtures |
| Data | `fetch` with stream progress. `DecompressionStream('gzip')` for `.i8.bin.gz`, verified against the sidecar `sha256_uncompressed` (SubtleCrypto). Hand-written type guards from the JSON Schemas | Validation at the trust boundary |
| Workers | None initially. Add one only if a trace shows a task over 50ms (grid decode or zonal build on M) | Measured trigger |

## 11. Motion test plan

Playwright runs against `npm run build && npm run preview` at D, T and M.

1. **Intro.**
   - SKIP is visible at 100ms, and the nav appears within 400ms of the click.
   - A wheel at 1s completes the intro within 400ms.
   - A same-session reload starts at the end state.
   - The year counter only ever shows years present in the DR-1 layer list.
   - Under reduced motion, the end state shows in the first screenshot.
2. **LCP and CLS.** In the Lighthouse JSON, the LCP element is `h1[data-hero]`, LCP is 2.5s or less, CLS is 0.1 or less, and the grid request starts after FCP.
3. **Track release.** At each scene's end plus 10px, the next heading is in view. No traps.
4. **Reverse and rapid.**
   - Fling S01 to S06 and back: the final frames match a direct load (screenshot diff under 0.5%).
   - S03b at p 0.6 shows state 3 both forward and backward.
   - S04 at p 0.30, reached in reverse, matches a forward load.
5. **Chapter jumps.** For every nav item: scrollY lands within 2px of the landing progress within 200ms, the hash updates, back/forward work, and focus is on the heading.
6. **Resize mid-scene.** At S04 p 0.40, resize 1440 to 390: the scene and p are preserved within ±0.01, there are no console errors, and the K1-M geometry matches the table.
7. **Unwrap parity.** At p 0.30, three debug-hook vertex positions are within 1px of `d3.geoEqualEarth`. At p 0.08, they are within 1px of `d3.geoOrthographic`.
8. **Integer-year rule.** During a slow S03a scrub, sampled `u_mix` values are 0 or 1 whenever no year change has happened in the previous 250ms.
9. **Baseline invariance.** In S05, changing only the baseline leaves the slope text identical, and the ✓ shows.
10. **Futures honesty.** In S06, no SVG path or GL line has vertices in both observed and PREDICTED groups (debug hook), and the bracket values equal `ar6.json`.
11. **OBS scroll safety.** A wheel over the globe scrolls the page. On M, a vertical swipe over the globe scrolls the page and a horizontal swipe rotates it.
12. **Reduced motion.** No sticky in scenes, no animated filter, a stable GL counter, and every control still works.
13. **Pause offscreen.** With S07 centred, the GL frame counter is flat for 2s.
14. **Tiers.** `?quality=low` disables crossfades and the decade run. `?quality=nogl` renders the Equal Earth flat map with the note, and every scene still reaches its end state.
15. **Frame pacing** (evidence harness). Scroll recordings at D and M report p50/p95 frame times on a stated device and browser. They are recorded, never estimated.
