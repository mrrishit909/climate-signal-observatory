# QA report: P03 Climate Signal Observatory (task P03-QA-002)

Independent visual, analytical, UX and performance QA. Reviewer: qa-reviewer (built none of this site).
Date: 2026-10-11, 04:29 to 05:20 EDT. Product code audited at HEAD `b29a485` (includes `8b9ec40` audit fixes and
`640e24c` docs). Build: `npm run build` (vite 8.3.4). Served with `site/tests/serve.mjs` (in-process vite preview on
4321, restarted in a loop). The dev server was never used. No product code was changed.

**Verdict: FAILED.** 9 major defects, no blocker. The site is distinctive and its numbers are honest (34 of 34 spot
checks match the artifacts), axe is clean in 56 runs, and the giant-orb and P02-confusion rules pass. It fails the gate on:

- **Operational states.** 10 probed artifacts fail silently: no inline error, no RETRY, content just disappears (D-001).
- **Responsiveness.** 1024x768 collides in 7 scenes even with overlay scrollbars (D-002). With classic scrollbars the
  JS geometry runs one class below the CSS at 1024 and 768 (D-003, the P01-D-033 class). Phones: the S01 landing is
  overprinted (D-006).
- **Honesty.** Data tags and colour keys are `display:none` at tablet and phone widths in S03a, S03b, S04, S05 and S06 (D-004).
  The OBS inspector silently drops the last third of every cell series (D-005).
- **Performance.** Lighthouse mobile LCP is 2555 ms in 3 of 3 runs (target 2500) (D-009).

Machine: Mac15,6 (Apple M3 Pro, 120 Hz display), Chromium 156.0.8078.4 (Playwright). Other agents shared the
machine, with load averages between 7 and 42 during capture. `uptime` is recorded next to every performance number.

## 1. Release gate

| Row | Result | Measured evidence |
|---|---|---|
| Visual design | PASS (with defects) | Art-directed and on-system: one Solar form per scene, serif statements over uppercase mono, and no chart chrome except the S05 lab (accepted LOW in DESIGN_AUDIT). Distinct scenes: globe, deck, years globe, regional bands, core strata, zero lab, futures brackets, chat stack, OBS, full-bleed surface (contact sheets, all 9 runs). The layout defects are logged under Responsiveness. |
| Motion UI (6 layers) | PASS | **Intro:** the orb cools in place into cells, then the decade run 1880 to 2025 (`screenshots/1440x900/00-s00-*`). **Nav:** instant jump plus stage fade. **Scroll storytelling:** S02 deck, S04 unwrap sphere to sheet to core (`contact-sheets/*` frames 40-48). **Component:** baseline clamp, handles, ledger, OBS rotate and slice. **Data transitions:** year crossfades, baseline fades. **Micro:** RESET confirmations, disabled-chip tooltips. **Frame pacing** (§5): headed Metal p95 10.2 ms (desktop) and 10.9 ms (390 at 4x CPU). |
| UX | **FAIL** | Keyboard journey works (§4): baseline radios skip the disabled 1850-1900 under GISTEMP, the S05 clamp offers SWITCH TO HADCRUT5, handles take Arrow/PageUp/Home/End, OBS core and globe take keys, Enter opens the inspector at the centre cell, Esc closes and returns focus, a wheel over the globe scrolls the page (19350 to 19949). Open: D-007 (OBS RETRY covered by the globe hit area), D-013 (first Tab goes into the off-screen S02 deck), D-015. |
| Functionality and states | **FAIL** | RETRY works where it exists: ar6 (S06), the intro grid (S01), the GISTEMP grid (S03a, S04, OBS), the trend grid (S03b) and the grid sidecar (S02). Each shows an in-scene alert, RETRY re-fetches exactly once and the alert clears, at 1440 and 390. **10 probed artifacts fail silently** in 50 of 66 artifact-and-scene cases (D-001). |
| AI / analytical honesty | **FAIL** | 34 on-screen numbers match facts/trends/regional/ar6/co2/validation/grid sidecars (§3). PREDICTED brackets are never joined to observations. The dotted missing lattice is distinct from the #2E2E2E neutral. "The far north (60-90N)" is used, never "Arctic Circle". Baselines are named in every °C view. Attributions are visible in S02 (sources line) and S08 (footer, including OGL and Natural Earth). Open: D-004 (tags and colour keys hidden at T and M) and D-005 (inspector series truncated). |
| Performance | **FAIL** | Lighthouse mobile LCP was 2557, 2555 and 2556 ms. Perf was 0.96 in all three runs, CLS 0 and a11y 0.97. Desktop perf was 0.90, 1.00 and 1.00, with LCP at 486 ms. The load average was 7.0 to 9.8 (run 1 started under 8). Three identical results point to simulated throttling, not load. Grids load after first paint (FCP 36 ms against grid fetch start 85 to 112 ms). `?quality=nogl` reaches every end state. |
| Responsiveness | **FAIL** | D, T and M are different compositions (globe-right D, stacked T, bottom-sheet M), but: D-002 (1024x768), D-003 (classic scrollbars), D-006 (S01 on phones), D-008 (sideways scroll at 768 under reduced motion), D-010 and D-011. |
| Professional quality | PASS | `uv run pytest -q` 80 passed. `npm run typecheck` clean. `npm run lint` clean. `npm test` 117 passed (6 files). `npm run e2e` 64 passed, 12 skipped, 0 failed. Every skip is a project-scoped duplicate: shell 22, 58 and 59; fixa1 39-46 desktop-only; stageb 68. axe (wcag2a/aa, 21a/aa) found 0 violations in 56 runs. All 8 required docs plus README are present. |
| GitHub | BLOCKED | Not in scope (QA does not push). |
| Deployment | BLOCKED | Not in scope. Performance must be re-measured on the gzip-serving Pages URL. |
| Portfolio | BLOCKED | Not in scope. |

Hard-rejection checks that **pass**:
- **#19 and #20 (test 15).** In every one of the 9 runs `introStats` gave minR equal to G0 and monotonic true. G0 radius was 560 at 1440x900 (a 124vh diameter), 672 at 1920, 478 at 1024x768, 621 at 768x1024 and at least the half-diagonal on phones. At S08 p0.6 the radius is above the half-diagonal: 1019 against 849 at 1440, 1322 against 1101 at 1920, 768 against 640 at 1024.
- **Test 16.** The P02 pair sheet was recomposed now that P02 has S08 frames (`p02-vs-p03-open-close-{1440x900,390x844}{,-grey}.jpg`). P02 opens on a horizon dome rising from the bottom edge, while P03 is a centred full disc larger than the frame that resolves into cells without contracting. P02 closes on a blue orb and horizon line, while P03 closes on a full-bleed cell surface. They are not confusable in colour or greyscale. One note: P03 S08 p0.3 shows a mid-size centred planet with a visible limb (D-012). It is a planet, not a glow orb, and test 15 only constrains p0.6.

## 2. Defect register (severity-ranked)

### Major

**P03-D-001: 10 probed artifacts fail silently, with no inline error and no RETRY** (major, operational states; P01-D-041 class)
- **Files:** `site/src/scenes/S01Signal.tsx:26`, `S02Record.tsx:62-64`, `S03aYears.tsx:82-84`, `S03bRegions.tsx:35-37`, `S04Strata.tsx:36-37,67`, `S05Zero.tsx:28-30`, `S06Futures.tsx:31-32`, `S07Evidence.tsx:60-66`, `S08Surface.tsx:22-23`, `Observatory.tsx:44`, `state/bank.ts:92` (coastlines). Each of these is destructured as `const [x] = useArtifact(...)`, so the retry is dropped and the error state is never rendered.
- **Viewports:** all of them (tested at 1440x900 and 390x844).
- **Repro:** route `**/data/<file>` to HTTP 404, Escape, `__cso.jumpTo(<scene>)`.
- **Expected:** every consuming scene shows its own `COULD NOT LOAD <FILE>` line and a RETRY that re-fetches once and recovers (VISUAL_DESIGN #13).
- **Actual:** no `[role=alert]` and no RETRY in 50 of the 66 artifact-and-scene cases probed. The silent artifacts are facts, trends, regional, co2, extremes, series_annual, changepoints, coastlines, meta, and ar6 in S02. validation.json and agreement.json use the same code path but were not probed.
  - **facts.json:** S01 loses both cards and its statement, S02 shows an empty globe with no cards, and S03b, S04, S06, S07 and S08 lose copy.
  - **trends.json:** S05 shows "LOADING TRENDS" forever.
  - **regional.json:** the S03b ledger and statement vanish.
  - **Also silent:** co2, extremes, series_annual, changepoints, coastlines, meta, and ar6 in S02.
  - When meta.json fails, the S08 attribution footer disappears.
  - The OBS trend layer shows "TREND GRID UNAVAILABLE" with no RETRY.
- **Evidence:** `artifacts/evidence/qa/probe/errors.json` and `probe/shots/err-D-facts_json-signal.jpg`, `err-D-facts_json-record.jpg`, `err-D-trends_json-zero.jpg`, `err-D-regional_json-regions.jpg`, `err-M-*`.
- **Verification test:** for each artifact and each consuming scene, fulfil 404, land on the scene, and assert three things:
  1. An in-viewport `[role=alert]` inside that section names the file.
  2. Clicking its RETRY causes exactly one re-request.
  3. The alert is gone afterwards.

  Use `probe/qa-probe.mjs errors` as the template.

**P03-D-002: 1024x768 collides in seven scenes, even with overlay scrollbars** (major, responsiveness)
- **Files:** `site/src/styles/scenes.css` (the D layout applied at 1024x768 with no short-height or compact-desktop rules); `layout()` in `site/src/scenes/geometry.ts`.
- **Viewport:** 1024x768 (headless, clientWidth 1024).
- **Repro:** `__cso.jumpTo` to each landing.
- **Expected:** no text overlaps text, controls or the data figure.
- **Actual** (bbox probe and frames):
  - **S01:** the CO2 card overprints the caption and the OBSERVED chip.
  - **S03a:** the globe crosses the body copy, and the legend sits under the nav bar ("-3" over SIGNAL).
  - **S05:** "+1.0 °C" and "0.0 °C = 1951-1980 MEAN" overprint the body copy, and RESET collides with the OBSERVED chip.
  - **S06:** the "1950" tick sits on "· HADCRUT5 ONLY", and "°C VS 1850-1900" collides with MOTION ON.
  - **S07:** the receipt and limitations column overprints the chat cards, and the headline is cut to "How we kr".
  - **OBS:** the rail covers the headline "Any year, any place, any…", the DRAG copy and the readout.
  - **S08:** the links overprint the attribution footer and the nav.
- **Evidence:** `probe/collide.json` (1024x768 entries); `probe/shots/col-1024x768-{signal-0.78,years-0.5,zero-0.3,futures-0.42,evidence-0.95,observatory-l,surface-0.98}.jpg`; `classic-vs-overlay-1024x768.jpg` (left column); `screenshots/1024x768/*.jpg`.
- **Verification test:** run the fixa1 bbox spec for every landing state at 1024x768. Assert zero intersections over 2px between visible text rects, and that every rect sits inside the viewport.

**P03-D-003: The JS viewport class disagrees with the CSS breakpoints under classic scrollbars** (major, responsiveness; P01-D-033 class)
- **File:** `site/src/scenes/geometry.ts:28`. `layout(w, h, n, cls = viewportClass(w))` is called with `w = documentElement.clientWidth` from `useViewport.ts:3` and `director.ts:538`. The CSS media queries, `S01Signal.tsx:48`, `StoryDeck.tsx:56` and `director.ts:659` all use `innerWidth`.
- **Viewports:** 1024x768 and 768x1024 with a classic scrollbar (Windows Chrome and Edge by default, or macOS "always show scroll bars"). Headed Chromium on this Mac shows it too (clientWidth 1425 at 1440).
- **Repro:** `node tests/evidence-harness.mjs --viewports 1024x768,768x1024 --classic`.
- **Actual:**
  - Under a classic scrollbar, clientWidth is 1009 and 753. The JS class becomes T at 1024 and M at 768, while the CSS stays D and T. Every shot is mismatched (27 of 27 and 29 of 29). Under overlay scrollbars no shot is mismatched (0 of 27 and 0 of 64).
  - **At 1024:** the S03a globe shrinks into the readout, S05 squashes into the controls, the S06 plot slides under the scenario chips, and the OBS globe runs under the rail with a white glow.
  - **At 768:** the S01 globe sits behind the cards, the S03a globe overprints the readout, and the S04 core overprints the chips. OBS draws the M horizontal core under the T rail.
- **Evidence:** `screenshots/{1024x768,768x1024}-classic.json` (jsClassFromClientW against cssClass), `classic-vs-overlay-1024x768.jpg`, `classic-vs-overlay-768x1024.jpg`, `probe/collide-classic.json`, `contact-sheets/*-classic.jpg`.
- **Verification test:** launch with `ignoreDefaultArgs: ['--hide-scrollbars']` plus a 15px `::-webkit-scrollbar`. Assert that `layout().cls` equals the CSS class from `matchMedia`, and run the D-002 bbox assertions under that browser.

**P03-D-004: Honesty tags and colour keys are `display:none` at tablet and phone widths** (major, honesty; P01-D-002 class)
- **File:** `site/src/styles/scenes.css`:
  - 120-121: S03a readout rank line, legend swatches and edges
  - 109: S03a body ("orange is warmer…")
  - 287: `.regions-chips`; 280: `.regions-text .legend`
  - 171: `.strata-text.is-landed .strata-chips`
  - 353: `.zero-chips`
  - 402 and 581: `.fut-chips .chip:not(:first-child)`
- **Viewports and hidden items** (`probe/chips.json`):
  - **768x1024:** S05 OBSERVED · SERIES and DERIVED · TREND; S06 DERIVED · HADCRUT5 REBASED and OBSERVED · HADCRUT5 95% RANGE.
  - **390x844 (and 375, 360):** the same, plus S03b DERIVED · CELL TRENDS and DERIVED · BAND MEANS, S04 OBSERVED · CELLS and DERIVED · LAYERS, and the S03a anomaly legend and body. That leaves the S03a and S03b globes on phones with no colour key at all.
- **Expected:** every data visual carries its tag (hard rejection #16), and colour carries no meaning without a key.
- **Actual:** the S06 HadCRUT5 dots and stipple, the S05 series and trend, the S03b trend surface and the S04 core render untagged. Only S06 PREDICTED survives.
- **Evidence:** `probe/chips.json`; `screenshots/768x1024/s05-01-p30.jpg`, `s06-02-p90.jpg`; `screenshots/390x844/s03b-01-p35.jpg`, `s05-01-p30.jpg`, `s06-02-p90.jpg`, `s03a-01-p50.jpg`.
- **Verification test:** at 768, 390 and 360, for every scene landing, assert that each `.chip` the scene renders at 1440 has a visible counterpart (non-zero rect, no `display:none` ancestor, inside the viewport). Assert also that a legend is visible whenever a coloured globe or core is.

**P03-D-005: The OBS cell inspector silently drops the last third of every series** (major, analytical honesty)
- **File:** `site/src/styles/scenes.css:537`. `.inspector__line { stroke-dasharray: 1000; animation: draw … }` with `@keyframes draw` from offset 1000 to 0. The rendered path is 1476 units long (`getTotalLength()`, viewBox 312x80), so it draws its first 1000 units and then a 1000-unit gap.
- **Viewports:** all of them.
- **Repro:** OBS, select any cell (`__cso.setObs({cell:{row:37,col:72}})`), and wait 3s.
- **Expected:** the full 1880-2025 series, broken only at missing years (interaction 9).
- **Actual:**
  - The line stops at about two-thirds of the width (around the late 1960s), and the most recent and warmest decades never draw.
  - The 1998 or 2025 marker floats on its own to the right.
  - The text says "VALID YEARS 146 OF 146".
- **Evidence:** `probe/recheck.json` (totalLength 1476, dasharray 1000px), `probe/shots/recheck-1440-inspector.jpg`, `recheck-390-inspector.jpg`, `screenshots/1440x900/obs-04-inspector.jpg`.
- **Verification test:** after the draw animation, assert `getTotalLength() <= dasharray`, or that no dasharray is set once the animation ends. Assert also that the path's last x is within 1 unit of `x(ys.length-1)` and that the stroke is visible there (pixel sample).

**P03-D-006: The S01 landing on phones is overprinted and dimmed** (major, responsiveness and legibility; present since Stage B)
- **Files:** the S01 M layout in `site/src/styles/scenes.css` (`.signal-scrim`, notes and caption positioning) and `S01Signal.tsx`.
- **Viewports:** 390x844, 375x812 and 360x800.
- **Repro:** `__cso.jumpTo('signal', 0.78)` and wait 6s.
- **Expected:** both cards are readable, the caption and OBSERVED chip sit clear of the cards, and the statement clears the globe.
- **Actual:**
  - Both cards render as faint grey on near-black under a scrim, although their computed opacity is 1.
  - The "CELLS = GISTEMP v4…" caption and the OBSERVED chip print over the CO2 card ("426.07" crosses "OBSERVED" and "MODELLED.").
  - "or an honest gap." touches the globe's limb.
  - The same frame is in the builder's own `artifacts/evidence/stage-b/390x844/01-s01-p78-cards.png`.
- **Evidence:** `probe/shots/recheck-390-s01-landing-6s.jpg`, `screenshots/390x844/s01-01-p78-landing.jpg`, `probe/collide.json` (390, 375, 360 `signal@0.78`).
- **Verification test:** at M widths, jump to signal 0.78 and assert three things:
  1. The `.note` rects and the caption rect do not intersect.
  2. The note text contrast is at least 4.5:1 against the composited background (screenshot sample).
  3. The statement bottom sits above the globe top.

**P03-D-007: The OBS grid RETRY cannot be clicked with a pointer at desktop** (major, functionality)
- **Files:** `site/src/scenes/Observatory.tsx:247-253`. The error line renders inside the readout, under the `.globe-hit.obs-globe` group, which sits above it in the stacking order.
- **Viewport:** 1440x900 (`elementFromPoint` at the RETRY centre returns `DIV.globe-hit obs-globe`). At 390 the button is on top.
- **Repro:** 404 on `grid_gistemp_2deg.i8.bin.gz`, then jump to observatory and click RETRY.
- **Expected:** the click re-fetches.
- **Actual:** the click lands on the globe. Playwright times out after 30s ("obs-globe intercepts pointer events"). Only the keyboard or AT path (`button.click()`) recovers.
- **Evidence:** `probe/errors.json` (D, grid, observatory: `covered: true`), `probe/shots/err-D-grid_gistemp_2deg_i8_bin_gz-observatory.jpg`.
- **Verification test:** with the grid blocked, `page.click()` on the OBS RETRY succeeds without `force` and the grid request count rises by 1.

**P03-D-008: Under reduced motion at 768 the page scrolls sideways by 316px** (major, responsiveness; P01-D-005 class)
- **Files:** the `.sr-only` rule in `site/src/styles/app.css:74` applied to `<table className="sr-only">` (`S03aYears.tsx:163`, `S04Strata.tsx:133`, `S06Futures.tsx:157`). A table ignores `width: 1px`, so the caption and header rows run to x=988.
- **Viewport:** 768x1024 with `prefers-reduced-motion: reduce`. 1440 and the phones measured 0.
- **Repro:** emulate reduced motion, then `scrollBy(500,0)`. scrollX becomes 316 on every scene, with scrollWidth 1084 against clientWidth 768.
- **Expected:** no horizontal scroll.
- **Evidence:** `probe/rm-overflow.json`. A related symptom on phones is in D-015.
- **Verification test:** for every scene, viewport and motion setting, assert `scrollWidth <= clientWidth`. Use a display-safe sr-only pattern such as a `display:block` wrapper with `overflow:hidden`.

**P03-D-009: Lighthouse mobile LCP is 2555 ms, over the 2500 ms gate** (major, performance)
- **Files:** the hero word reveal in `site/index.html`, the `h1#hero-title` spans and the font preload. The LCP element is `span.wr-word` "keeping".
- **Viewport:** the Lighthouse mobile preset.
- **Actual:**

  | Run | Mobile LCP | Mobile perf | Desktop LCP | Desktop perf | TBT d/m | Load average at start, end |
  |---|---|---|---|---|---|---|
  | 1 | 2557 ms | 0.96 | 486 ms | 0.90 | 258 / 10 ms | 7.01, 8.74 |
  | 2 | 2555 ms | 0.96 | 487 ms | 1.00 | 0 / 23 ms | 8.74, 9.80 |
  | 3 | 2556 ms | 0.96 | 486 ms | 1.00 | 0 / 11 ms | 9.80, 9.18 |

  - Mobile FCP is 1655 ms and Speed Index 2833 ms. CLS is 0 everywhere. A11y is 0.97 (D-016).
  - Run 1 started below the load threshold. The three runs agree to within 2 ms, so this reads as deterministic, not load-confounded.
- **Evidence:** `artifacts/evidence/qa/lighthouse/run{1,2,3}/{desktop,mobile}.report.json`.
- **Verification test:** run Lighthouse mobile 3 or more times, and on the Pages URL. Assert median LCP is 2500 ms or less.

### Minor

- **P03-D-010: S05 and S06 label collisions at T and M** (the DESIGN_AUDIT P03 item 2 is still partly open)
  - **768x1024:**
    - The zero-line label is clipped at the left edge ("= 1951-1980 MEAN").
    - A large empty band sits above the chart.
  - **390x844:**
    - "-0.5 °C" and "0.0 °C = 1951-1980 MEAN" sit under the series line.
    - MORE CONTROLS opens a sheet that lets the trend readout show through behind its rows.
    - In S06, "2061-2080 NOT IN TABLE SPM.1" overprints the 2041-2060 bracket outline, and "ASSESSED · AR6" sits on the observed dots.
  - DESIGN_AUDIT P03 item 1 (S06 at 1440) is closed: `screenshots/1440x900/s06-02-p90.jpg` is clean.
  - **Evidence:** `screenshots/768x1024/s05-01-p30.jpg`, `screenshots/390x844/s05-01-p30.jpg`, `s05-04-more-controls.jpg`, `s06-02-p90.jpg`.
  - **Verification test:** a bbox check of the `.zero-plot text` and `.fut-plot text` rects against the series path bbox and each other.
- **P03-D-011: Phone-edge clipping**
  - S04's "◂ TEN WARMEST" is cut at the right edge (390 and 360).
  - At 360x800 the S04 spine footnote runs under the menu pill and REPLAY INTRO, and the S08 footer overprints "→ SOURCE CODE".
  - **Evidence:** `probe/shots/col-360x800-strata-0.89.jpg`, `col-360x800-surface-0.98.jpg`, `screenshots/390x844/s04-04-p89.jpg`.
- **P03-D-012: S08 p0.3 and p0.6 show planet data with no tag**
  - p0.3 shows a mid-size centred planet with a visible limb and only the footer. p0.6 is a full-bleed surface with no chip.
  - The OBSERVED chip appears only at p0.9 or later.
  - **Evidence:** `screenshots/1440x900/s08-01-p30.jpg`, `s08-02-p60.jpg`.
- **P03-D-013: Tab order**
  - The first Tab from page load lands on the off-screen S02 deck ("Card 1 of 4"), and the next stops are S03a controls.
  - SKIP INTRO and the chapter nav come last in the DOM.
  - **Evidence:** `probe/keyboard.json` (`firstTabs`).
- **P03-D-014: The S05 sr-only trend summary lags one step behind the handles**
  - After Home on the "from" handle, the visible result reads 1880-2025 while the sr line still reads "1975 to 2025: 0.21…".
  - **Evidence:** `probe/keyboard.json` (`s05handles`).
- **P03-D-015: Reduced motion on phones: after the S08 landing, the MENU pill click is intercepted** (intermittent)
  - In the axe run, all 3 of 3 menu-pill clicks at 390 under reduced motion timed out ("div.stage in #observatory intercepts pointer events"). The page was panned horizontally (`probe/shots/navfail-M-reduce-years.jpg`).
  - An isolated `elementFromPoint` probe did not reproduce it (`probe/navblock.json`). Likely related to D-008.
- **P03-D-016: Touch targets too small**
  - Lighthouse a11y is 0.97, with `target-size` failing on the S03b `.step-dot` buttons (mobile and desktop).
  - **Evidence:** `lighthouse/run*/mobile.report.json`.
- **P03-D-017: Colours outside the legend in S00**
  - The decade-run frames are dominated by blended magenta and violet hues between the Solar and Electric bins. These colours are not in the 11-bin legend.
  - Each step is a 120ms crossfade every 93ms, so the run is always mid-blend.
  - **Evidence:** `screenshots/1440x900/00-s00-t2500.jpg`, `00-s00-t3000.jpg`.
  - A fix would cut the crossfade or blend in luminance only. Low priority.
- **P03-D-018: 768x1024 S01 headline clipped**
  - "The planet is / keeping a record." is clipped at the top edge at the S01 landing.
  - **Evidence:** `screenshots/768x1024/s01-01-p78-landing.jpg`.
- **P03-D-019: OBS inspector covers PLAY at 1440**
  - The inspector card covers the core's lower end and half of PLAY.
  - **Evidence:** `screenshots/1440x900/obs-04-inspector.jpg`.

## 3. Honesty spot checks (34 of 34 match)

| Where | On screen | Artifact |
|---|---|---|
| S01, S03a, OBS, S08 | +1.19 °C vs 1951-1980 (2025) | facts `gistemp_latest_year_anomaly_1951_1980` 1.185 |
| S01 | 426.07 ppm, 2026-09 | `co2_mlo_latest_ppm` 426.07, `co2_mlo_latest_month` |
| S03a | rank 2 of 146 | `latest_year_rank_gistemp` {2, 146} |
| S03a | CO2 427.4 ppm Mauna Loa (2025) | co2 `mlo_annual_ppm` 427.35 |
| S03a | measured area 99% | `gistemp_valid_area_share_latest_year` 0.9922 |
| S03a | 83% above p95 (7% expected) | `extremes_area_share_above_p95_latest_year` 0.834 / `_reference_mean` 0.067 |
| S02 | subtracts 0.61 °C | `baseline_offset_1951_1980_to_1991_2020_gistemp` 0.6114 |
| S02 | 1880: 83% GISTEMP, 68% HadCRUT5 | `gistemp_valid_area_share_first_year` 0.8265; HadCRUT5 sidecar `valid_area_share_per_year[1880]` 0.6773 |
| S02 | 90x180 2° from 1880; 36x72 5° from 1850 | grid sidecars |
| S03b | about 2.8 times as fast | `arctic_to_global_trend_ratio_1975_latest` 2.77 |
| S03b ledger (5 bands) | +0.57 (0.50-0.65), +0.32 (0.27-0.38), +0.17 (0.14-0.21), +0.09 (0.06-0.12), +0.12 (0.05-0.18) | trends `gistemp_band_*` 1975_latest: 0.5733 [0.5011,0.6455], 0.3221 [0.2661,0.378], 0.1738 [0.1379,0.2098], 0.0877 [0.0564,0.1189], 0.115 [0.0544,0.1755] |
| S03b | barely measured until 1956 | `south_band_first_year_valid_share_ge_50pct` 1956 |
| S03b | every band warmed since 1975 | `band_trends_all_positive_1975_latest` true |
| S03b | land 1.59, ocean 0.88 (AR6, 2011-2020) | `ar6_published_land/ocean_2011_2020` |
| S04 | spine differs by at most 0.043 °C | validation `grid_vs_official_global.gistemp.max_abs_diff` 0.0428 |
| S05 | +0.21 per decade, CI 0.18-0.24; naive 0.19-0.23 | `trend_gistemp_1975_latest` 0.2067 [0.1771,0.2363]; naive half-width 0.0202 |
| S05 | 1880-2025: +0.08, CI 0.06-0.11 | `trend_gistemp_1880_latest` 0.0826 [0.0567,0.1085] |
| S07 | corr 0.992, gap 0.05, trends differ 0.005 | `gistemp_hadcrut5_annual_corr` 0.99238, `_rmsd` 0.0519, `_trend_gap` -0.0046 |
| S07 | ocean 0.88 (0.68 to 1.01) | `ar6_published_ocean_2011_2020` |
| S07 | corr 0.95 levels, 0.19 first differences | `co2_temperature_corr_levels` 0.9509, `_first_differences` 0.191 |
| S07 | ±0.020 naive vs ±0.030 adjusted | `trend_gistemp_1975_latest_{naive,ar1}_ci_halfwidth` |
| S07 | 93% / 73% / 83% SIMULATED | METHODOLOGY 3 (validation) |
| S07 | 11% of square-months missing | `gistemp_missing_cells_total_share` 0.1086 |
| S07 | breaks 1912, 1942, 1972 EXPLORATORY | `changepoint_gistemp_selected_breaks` |
| S06 | brackets per SSP and period | aria-labels against ar6.json (Vitest asserts equality); 1.5/2.0 dotted Paris lines |

Other honesty checks:
- **Missing cells and near-zero.** The dotted lattice (e.g. Antarctic cells in `00-s00-end.jpg` and `s08-04-p98.jpg`) is visibly distinct from the #2E2E2E neutral cells.
- **PREDICTED windows.** They are hatched with a PREDICTED chip, and no line joins the observed dots to the brackets (`s06-02-p90.jpg` at all viewports).
- **The 1850-1900 baseline.** It is disabled under GISTEMP, with a tooltip and a fallback announcement.
- **"Arctic".** It appears only inside the GISTEMP limitation sentence ("ARCTIC COVERAGE"), never as a band name.

## 4. Keyboard, axe, states

- **axe:** wcag2a, 2aa, 21a and 21aa. Runs covered 1440 and 390, normal and reduced motion, the intro end, all 10 landings and 3 nav jumps (desktop bar clicks; mobile pill open, then an item). The result was **0 violations in 56 runs**. Three mobile reduced-motion nav jumps could not be clicked (D-015). File: `probe/axe.json`.
- **Keyboard** (`probe/keyboard.json`):
  - **S03a:** baseline arrows go 1951 to 1991 to 1951, skipping the disabled 1850-1900. Clicking the disabled chip is a no-op. HadCRUT5 with 1850-1900 works. Switching back to GISTEMP falls back to 1951-1980 with the announcement "BASELINE SET TO 1951-1980: GISTEMP HAS NO 1850-1900".
  - **S05 clamp:** Arrow keys step through the baselines. At 1850-1900 under GISTEMP it stays on 1951-1980 and offers SWITCH TO HADCRUT5.
  - **S05 handles:** Arrow ±1 and PageUp ±10. Home and End respect the 10-year minimum window (from 2016 at most; to 1889 at least).
  - **OBS core:** Left goes to 2024, PageDown to 2014, Home to 1880 and End to 2025. Shift+Arrows move the latitude slice.
  - **OBS globe:** arrows rotate it ±10°. Enter opens the inspector at the centre cell (5°N 29°W), and focus moves into the dialog. Esc closes it and returns focus to the globe.
  - **Mobile pill:** Esc closes it and focus returns to the pill.
- **States:** loading lines, error lines and RETRY exist only for the grid family and ar6 (D-001). `?quality=nogl` shows "3D GLOBE UNAVAILABLE: FLAT MAPS USED" and reaches every end state at D and M with no page errors (`probe/nogl.json`, `probe/shots/nogl-*`).

## 5. Frame pacing (recorded, not estimated)

Heavy interaction: a scripted 6s scroll at 1 px/ms from the start of S04 strata through S05 and S06 (stateChanged true in every run). Device: Mac15,6.

| Browser | Renderer | Run | p50 | p95 | >16.7 ms | >33 ms | Load average at start |
|---|---|---|---|---|---|---|---|
| headed | ANGLE Metal, Apple M3 Pro (real GPU) | 1440 unthrottled | 8.3 | 10.2 | 0% | 0% | 7.99 |
| headed | same | 1440, 4x CPU | 8.4 | 11.8 | 2.1% | 0.1% | |
| headed | same | 390, 4x CPU | 8.3 | 10.9 | 1.3% | 0.1% | |
| headless | SwiftShader (software GL) | 1440 unthrottled | 17.1 | 62.4 | 59.8% | 24.4% | 9.15 |
| headless | same | 1440, 4x CPU | 17.6 | 64.8 | 70.1% | 25.6% | |
| headless | same | 390, 4x CPU | 17.8 | 44.0 | 69.4% | 20.2% | |

The headless numbers are software rendering and say nothing about phones. The headed numbers come from a 120 Hz Apple GPU, not a phone. Data: `artifacts/evidence/qa/frame-pacing.json`.

## 6. What I read

- **Contact sheets** (every one): `contact-sheets/1920x1080.jpg`, `1440x900.jpg`, `768x1024.jpg`, `390x844.jpg`, plus `1024x768`, `375x812`, `360x800`, `1024x768-classic` and `768x1024-classic`. The last five were read through the composite pair sheets and their probe shots.
- **Full-resolution frames (more than 45):**
  - **1440x900:** `00-s00-t0500`, `t1500`, `t2500`, `t3000`, `end`; `s01-01`; `s02-01`; `s03a-01`, `s03a-07`; `s03b-01`; `s04-04`; `s05-01`; `s06-02`; `s07-01`, `s07-03`; `obs-04`; `s08-01`, `02`, `04`.
  - **768x1024:** `s03b-01`, `s05-01`, `s06-02`.
  - **390x844:** `s01-01`, `s03a-01`, `s03b-01`, `s04-04`, `s05-01`, `s05-04`, `s06-02`, `obs-04`.
  - **Recheck and probe shots:** `recheck-390-s01-landing-6s`, `err-D-*` (6), `err-D-grid…-observatory`, `nogl-D-*` (7), `navfail-M-reduce-years`, `col-1024x768-*` (4), `col-390/360-*` (3).
  - **Classic against overlay pairs:** 12 at 1024 and 12 at 768.
  - **Prior Stage B frame:** `stage-b/390x844/01-s01-p78-cards.png`.
- **The P02 and P03 pair sheets:** colour and greyscale.

## 7. Evidence and tooling

- **Harness:** `site/tests/evidence-harness.mjs` and `site/tests/evidence.config.json`. This is the P03 copy of the shared v2 harness: JPEG output, S00 freeze frames with radius logs, a `--classic` mode, and Pillow contact sheets, because Playwright's bundled ffmpeg has no VP8 decoder.
  - Runs: 7 viewports headless (SwiftShader; the overlay-scrollbar case), plus 1024x768 and 768x1024 headed with `--classic` (Metal).
  - Recordings: `artifacts/evidence/recordings/*.webm` (gitignored, about 300 MB).
- **Probes:** `artifacts/evidence/qa/probe/qa-probe.mjs` with parts errors, axe, keyboard, text, nogl, paint, collide (`--classic`) and chips. Also `recheck.mjs`, `navblock.mjs`, `rm-overflow.mjs` and `p02-pair.py`. To run them, symlink `site/node_modules` into `probe/`, then run from `site/`.
- **Lighthouse:** `site/tests/run-lighthouse.sh` (shared copy). JSON reports are in `artifacts/evidence/qa/lighthouse/run{1,2,3}/`. The HTML reports were dropped for size.
- **Committed evidence:** about 40 MB. Screenshots are JPEG q72, and secondary viewports and probe shots are q60.

---

# Pass 2 (task P03-QA-003)

Re-run of the same harness and probes against HEAD `405bc5d` (fix commits `de26c40`..`405bc5d`, P03 FIX-A2), served by
`site/tests/serve.mjs` on 4321 from a fresh `npm run build`. Date 2026-10-11, 07:37 to 08:40 EDT. Reviewer as in pass 1
(built none of this site). No product code was changed. Evidence: `artifacts/evidence/qa-2/` (about 30 MB). The probe
scripts are copied into `artifacts/evidence/qa-2/probe/`, and every path below is relative to that folder.

Changes to the probes since pass 1:
- The collision probe now also covers 1280x720 (L2) and runs under reduced motion at 390, 375, 360 and 768 (L5, L11).
- It reports text under 11 px (L7) and the app's own `__cso.classes()` (L1).
- The error probe adds validation.json and agreement.json.
- Five new single-purpose probes: `deck.mjs`, `ring.mjs`, `rmobs.mjs`, `rm-landings.mjs` and `p02-pair.py` (recomposed).

**Verdict: FAILED.** 7 of the 9 pass-1 majors are closed and verified from my own frames. D-003 is closed with 0 of 56
classic-scrollbar shots mismatched, and D-009 with mobile LCP 1956 to 1968 ms. **3 major defects remain, all new to the register.**

1. **D-020** (regression from the D-001 fix). The S01 error line at desktop sits under the hero headline, which makes it unreadable and blocks RETRY for the pointer.
2. **D-021** (missed in pass 1). On phones, the S00 resting frame's OBSERVED tag and caption are under the bottom scrim, at effectively about 1.3:1 contrast.
3. **D-022** (pre-existing, missed in pass 1). Under reduced motion the Observatory draws no planet and no core at any viewport, because the static canvas is 0 px tall. At 768 the rail also overprints the headline and readout.

Every other measured row passes.

## P2.1 Release gate (pass 2)

| Row | Result | Measured evidence |
|---|---|---|
| Visual design | PASS | **Compositions:** compact desktop (1024 and 1280), short desktop, tablet and phone are deliberate and on-system (`contact-sheets/*.jpg`, all 9 runs). **Orb (test 15):** minR equals G0 and is monotonic in all 9 runs. The S08 p0.6 radius is at least the half-diagonal everywhere: 1019 against 849 at 1440, 761 against 632 at 1024 classic, and 526 against 440 at 360. **Test 16:** recomposed (`p02-vs-p03-open-close-*`), still not confusable. |
| Motion UI | PASS | Unchanged layers. **Frame pacing** (`frame-pacing.json`): headed Metal (M3 Pro) p95 was 10.0, 11.3 and 10.6 ms, load average 8.9 at start. SwiftShader (software GL, headless) p95 was 49.7, 59.5 and 45.6 ms, load 7.3. stateChanged was true in every run. |
| UX | PASS (with defects) | **Keyboard** (`keyboard.json`): the first four Tab stops are now the chapter nav (D-013 closed). Baseline radios skip the disabled 1850-1900 under GISTEMP. The S05 clamp offers SWITCH TO HADCRUT5. OBS core and globe keys work. Enter opens the inspector at 5°N 29°W and Esc returns focus to the globe. A wheel over the globe scrolls the page (19350 to 19948). On mobile the pill closes on Esc and focus returns to it. **Nav:** every landing, normal and reduced, at 1440 and 390, has the nav and pill on top (`navblock.json`: 0 blocked). All 6 mobile reduced-motion nav jumps now click (D-015 closed). |
| Functionality and states | **FAIL** | **Route-block** (`errors.json`): all 72 artifact-and-scene cases at 1440 and 390 show an in-scene alert, and RETRY re-fetches exactly once and recovers. The OBS RETRY is clickable (D-007 closed). **But** in 2 of 72 cases (S01 at desktop) the RETRY sits under `h1.hero-title` and the error text is overprinted (D-020). D-022: the reduced-motion Observatory draws no data. |
| AI / analytical honesty | **FAIL** | Re-checked 29 on-screen numbers against the pass-1 artifact values, and all match (`text.json`). **D-004 closed:** `chips.json` shows no tag hidden at 768 or 390. The S04 phone tags are the `m-only` copies. The legend is visible on phone S03a and S03b. **D-005 closed:** the inspector path has dasharray `none`, the full 1880-2025 line is drawn, and its last point is x=308 (`recheck.json`, `shots/recheck-*-inspector.jpg`). "Arctic Circle" and "live" appear nowhere. **Open:** D-021, a phone S00 tag at about 1.3:1 contrast. |
| Performance | PASS | **Lighthouse** (`lighthouse/run{1,2,3}/*.report.json.gz`), started at load 7.47 and ending at 8.39: mobile LCP 1956, 1959 and 1968 ms; perf 0.98; a11y 1.00; CLS 0; TBT 5 to 10 ms. Desktop LCP 445 ms and perf 1.00 in all three runs. **Grids** start at 68 to 92 ms after an FCP of 24 ms (`paint.json`). **nogl:** no page errors at D or M (`nogl.json`). |
| Responsiveness | **FAIL** | **Closed:** D-002 (1024x768 collisions; `collide.json` 1024 and 1280 entries show only hidden-text false positives), D-003 (`screenshots/*-classic.json`: app JS class equals CSS class in 27 of 27 and 29 of 29 shots, clientWidth 1009 and 753; `classic-vs-overlay-*.jpg`), D-006 (S01 on phones), D-008 (`rm-overflow.json`: 100 checks, scrollX 0 everywhere), D-018 (768 S01 headline). **Open:** D-022 (reduced-motion OBS at 768), D-010 (minor), D-024 (minor). |
| Professional quality | PASS | `uv run pytest -q`: 80 passed. `typecheck` and `lint` clean. `npm test`: 130 passed (7 files). `npm run e2e` (2 workers at load 15 to 29): 176 passed, 40 skipped (project-scoped), 0 failed, 0 flaky. axe (wcag2a/aa, 21a/aa): 0 violations in 62 runs, covering 1440 and 390, normal and reduced, every landing and nav jumps (`axe.json`). |
| GitHub, Deployment, Portfolio | BLOCKED | Out of scope for QA. |

## P2.2 Pass-1 register: status from my pass-2 frames

| ID | Pass 1 | Pass 2 | Evidence |
|---|---|---|---|
| D-001 silent failures | major | **CLOSED** (one regression split out as D-020) | `errors.json`: 72 of 72 cases have an in-scene alert, exactly 1 re-fetch, and recover. Includes validation and agreement. |
| D-002 1024x768 collisions | major | **CLOSED** | `screenshots/1024x768/*`, `contact-sheets/1024x768.jpg`, `collide.json` |
| D-003 classic-scrollbar class | major | **CLOSED** | `screenshots/{1024x768,768x1024}-classic.json` (`appClasses` js equals css), `classic-vs-overlay-*.jpg` |
| D-004 hidden tags and keys | major | **CLOSED** | `chips.json`, `screenshots/390x844/s03a-01-p50.jpg`, `s05-01-p30.jpg`, `s06-02-p90.jpg` |
| D-005 inspector truncation | major | **CLOSED** | `recheck.json` (dasharray none), `shots/recheck-1440-inspector.jpg` |
| D-006 S01 on phones | major | **CLOSED** | `screenshots/390x844/s01-01-p78-landing.jpg`, `shots/recheck-390-s01-landing-6s.jpg` |
| D-007 OBS RETRY covered | major | **CLOSED** | `errors.json` (D, grid, observatory: covered false), `shots/err-D-grid_gistemp_2deg_i8_bin_gz-observatory.jpg` |
| D-008 reduced-motion sideways scroll at 768 | major | **CLOSED** | `rm-overflow.json` |
| D-009 mobile LCP | major | **CLOSED** | `lighthouse/run*/mobile.report.json.gz` (1956 to 1968 ms) |
| D-010 S05/S06 labels at T/M | minor | **OPEN (minor)** | The S05 "-0.5 °C" and "0.0 °C = … MEAN" labels are still struck by the series at 390, 360 and 1024 (`screenshots/390x844/s05-01-p30.jpg`, `1024x768/s05-00-p30.jpg`). The S06 phone label is accepted by ruling. |
| D-011 phone-edge clipping | minor | **CLOSED** | `screenshots/390x844/s04-04-p89.jpg` (TEN WARMEST fits), `360x800/s08-02-p98.jpg` (links clear the footer) |
| D-012 S08 untagged | minor | **CLOSED** | `screenshots/1440x900.json`: s08 p15, p30 and p60 carry OBSERVED · GISTEMP v4 |
| D-013 tab order | minor | **CLOSED** | `keyboard.json` `firstTabs` |
| D-014 S05 sr lag | minor | **ACCEPTED** (ruling: 400 ms debounce) | |
| D-015 mobile reduced-motion pill | minor | **CLOSED** | `axe.json` (all navjumps ran), `navblock.json` |
| D-016 target size | minor | **CLOSED** | Lighthouse a11y 1.00 |
| D-017 off-palette decade-run blends | minor | **OPEN (minor)** | `screenshots/1440x900/00-s00-t2500.jpg` (violet and magenta blends between bins) |
| D-018 768 S01 headline clip | minor | **CLOSED** | `screenshots/768x1024/s01-01-p78-landing.jpg` |
| D-019 inspector covers PLAY | minor | **CLOSED** | `screenshots/1440x900/obs-04-inspector.jpg` (inspector under the rail, PLAY clear) |

## P2.3 QA_LESSONS L1-L11

| # | Result | Evidence |
|---|---|---|
| L1 | PASS | App `__cso.classes()` js equals css in every shot, including classic 1009 and 753 px (`screenshots/*.json`). |
| L2 | PASS | 1024x768 and 1280x720: no visible text collisions (`collide.json`). The only hits are hidden table text under the nav. |
| L3 | **FAIL** (D-021) | No `display:none` tags at 360-768 (`chips.json`). But the phone S00 tag sits under the scrim at about 1.3:1. |
| L4 | **FAIL** (D-020) | 72 of 72 cases visible with exactly one re-fetch. S01 at desktop is overprinted, and its RETRY is covered by the h1. |
| L5 | PASS | `rm-overflow.json`: 0 sideways scroll in 100 scene, viewport and motion checks. |
| L6 | PASS | Mobile LCP 1956 to 1968 ms (3 of 3 runs, load 7.5 to 9.1). |
| L7 | PASS (with D-010) | `collide*.json` `tiny`: no visible text under 11 px. The S05 axis labels are struck by marks (D-010). |
| L8 | PASS | REPLAY INTRO clears the pill at 768, 390, 375 and 360 (`collide.json`: no corner/pill overlaps). |
| L9 | **FAIL** (D-020) | OBS RETRY passes. S01 RETRY: `elementFromPoint` returns `H1.hero-title`. |
| L10 | PASS | Copy checks: no "live", no "every one" without a bound fact. The universal claims ("Every latitude band has warmed since 1975", "The ten warmest layers all came after 2010") are bound to `band_trends_all_positive_1975_latest` and `years_since_2010_in_gistemp_top10`. |
| L11 | PASS at normal motion, minor issues under reduced motion | No collisions among visible scene text at 360x800 or 375x812 with normal motion (`collide.json`). Under reduced motion only one in-scene collision remains (D-024): the S05 note against the clamp label. Text scrolling under the fixed nav is ordinary flow, not a collision. |

## P2.4 Defect register (pass 2, open items only)

### Major

**P03-D-020: The S01 error line at desktop sits under the hero headline. It is unreadable and its RETRY cannot be clicked** (major, states; L4/L9; regression from the D-001 fix)
- **Files:** the S01 error placement in `site/src/scenes/S01Signal.tsx` (the alert renders in the top band where the static `h1#hero-title` of `site/index.html` sits on top), plus the S01 styles in `site/src/styles/scenes.css`.
- **Viewport:** 1440x900, and any D composition where the hero sits top centre. At 390 the alert is clear.
- **Repro:** route `facts.json` or `grid_gistemp_2deg_intro.i8.bin.gz` to 404, Escape, then `__cso.jumpTo('signal')`.
- **Expected:** a readable `COULD NOT LOAD …` line, and a RETRY that is the top element at its centre.
- **Actual:**
  - "COULD NOT LOAD FACTS.JSON (HTTP 404)" is overprinted by "The planet is".
  - `elementFromPoint` at the RETRY centre returns `H1.hero-title wr`, so a pointer click lands on the headline.
  - The probe recovered only through `button.click()` (the keyboard/AT path).
- **Evidence:** `probe/errors.json` (D facts/intro grid at signal: `covered: true`), `probe/shots/err-D-facts_json-signal.jpg`, `err-D-grid_gistemp_2deg_intro_i8_bin_gz-signal.jpg`.
- **Verification test:** extend `e2e/states.spec.ts` to click RETRY with `page.mouse.click` at its centre, without `force` and without `button.click()`. Assert that `elementFromPoint` returns the button, and that the alert rect does not intersect the `h1#hero-title` rect.

**P03-D-021: On phones the S00 resting frame's OBSERVED tag and caption are hidden under the scrim** (major, honesty; L3; missed in pass 1, present there too)
- **File:** `site/src/styles/scenes.css:49`. `.signal-scrim` is a linear gradient to 85% black from y 460 to 600, and it sits above the `#signal` chip and caption (z-index 1).
- **Viewports:** 390x844, 375x812 and 360x800. At 768 and 1440 the tag is clear.
- **Repro:** load the page at 390 and wait for the intro to end.
- **Expected:** the tag that names the planet as OBSERVED, and its caption ("CELLS = GISTEMP v4, 2° ANNUAL MEANS VS 1951-1980. DOTS = NOT MEASURED."), stay legible: 4.5:1 or better.
- **Actual:**
  - The chip and caption are visible only as faint grey, about 1.3:1 against the scrimmed planet.
  - This is the first resting frame every phone visitor sees.
  - The chip's own computed opacity is 1. The scrim is what hides it, so `chips.json` and axe cannot see it.
- **Evidence:** `probe/shots/s00end-390.jpg`, `s00end-360.jpg`, `s00end-375.jpg` (and `s00end-768.jpg` as the clear control), `probe/deck.json` (`s00-end` entries), `screenshots/360x800/00-s00-end.jpg`.
- **Verification test:** at M widths after the intro ends, sample the screenshot pixels behind and inside the `#signal` OBSERVED chip and the caption. Assert a contrast of 4.5:1 or better, or assert that the scrim's top edge is below the caption's bottom.

**P03-D-022: Under reduced motion the Observatory draws no planet and no core, and at 768 the rail overprints the headline** (major, functionality and responsiveness; pre-existing, missed in pass 1)
- **Files:**
  - `site/src/styles/scenes.css:538`: `.obs-static { inset: 0; width: 100%; height: 100%; }` has no positioned or sized parent, so the canvas measures 1440x0 (or 390x0).
  - `paintStatic` in `site/src/scenes/director.ts:672-674` returns early when `clientHeight` is 0.
  - At T, the reduced-motion `.obs-rail` is absolute at the top (48,16 to 624,251) over the title (48,45 to 434,77).
- **Viewports:** all of them under `prefers-reduced-motion: reduce`, or with MOTION OFF.
- **Repro:** emulate reduced motion, then `__cso.jumpTo('observatory')` and wait 5s.
- **Expected:** the static planet and core for the current year, source and baseline (MOTION_SYSTEM: "every control still works", reduced-motion static frames).
- **Actual:**
  - Only the controls, a "2025" stub and PLAY render. The canvas is unpainted (`getImageData` alpha samples all 0).
  - At 768 the rail covers "Any year, any place, any zero." and the readout "+1.19 °C · MEASURED 99%".
  - Every other scene's reduced-motion figures paint (`rm-landings.json`).
- **Evidence:** `probe/shots/rm-obs-768.jpg`, `rm-obs-1024.jpg`, `rm-obs-390.jpg`, `rm-obs-1440.jpg`, `probe/rm-landings.json` (observatory: `obs-static 1440x0`, `390x0`), `probe/shots/rmland-*-observatory.jpg`, `probe/collide-reduced.json` (768 observatory).
- **Verification test:** under reduced motion at 1440, 768 and 390:
  1. Assert that `.obs-static` has a non-zero height and painted pixels.
  2. Assert that the rail rect does not intersect `#observatory [data-scene-heading]` or the readout.

### Minor

- **P03-D-010 (open):** the S05 axis labels are struck by the series at 390, 360 and 1024. See the table above.
- **P03-D-017 (open):** off-palette blends during the S00 decade run.
- **P03-D-023: S08 entry dead zone with a transient limb arc.**
  - Between OBS and S08 (scroll steps 85 and 86 of 90) the frame is black, apart from an orphan "OBSERVED · CELLS · GISTEMP v4" chip and the footer.
  - In the contact-sheet frame one transient thin white circle is visible (`contact-sheets/1440x900.jpg` frame 85).
  - The settled frames are clean: `probe/shots/ring-1440-{84,85,86}.jpg` show debug radius 0 and no arc. Not a ring-dial violation, but the beat reads as empty.
- **P03-D-024: Reduced-motion phone S05 note collision.**
  - At 375 and 360 the note "THE BENCH IS DRAWN ONLY WITH MOTION ON; …" collides with the clamp's "1951-1980" label at the top of the stage.
  - **Evidence:** `probe/collide-reduced.json` (375 and 360 `zero@0.3`), `probe/shots/col-360x800r-zero-0.3.jpg`.

Considered and not logged:
- **S02 deck card clipped at 390 p0.45:** a mid-scrub state between centred steps. At p0.3, 0.6 and 0.75 the active card is centred (`deck.json`), as in the reference horizontal deck.
- **Collision hits against the fixed nav under reduced motion:** content scrolling under a fixed bar, not a layout collision.
- **Collisions inside closed `<details>` and sr-only tables:** not visible.

## P2.5 Frames read in pass 2

- **Contact sheets:** `1440x900`, `1024x768` and `768x1024` were read in full. `390x844`, `360x800` and the classic pair were read through the composite sheets.
- **Full resolution:** 1440 `s01-01`, `s03a-01`, `s05-01`, `s06-02`, `s07-01`, `s04-04`, `obs-04`, `s08-01`, `s08-02`, `00-s00-t2500`. 1024 `s01-00`, `s03a-00`, `s05-00`, `s06-01`, `s07-01`, `obs-00`, `obs-02`, `s08-02`. 390 `s01-01`, `s03a-01`, `s03b-01`, `s04-04`, `s05-01`, `s05-04`, `s06-02`, `obs-04`, `s02-00/01/02`, `00-s00-end`. 360: 16 frames incl. `00-s00-end`, `s02-00`, `s05-00`, `s08-02`. 375 `s02-00`. 768 `s01-01`, `s02-01`. Classic: 12 pairs at 1024 and 12 at 768. Probe shots: `err-D-facts_json-signal`, `s00end-390/768/1440`, `ring-1440-84/85/86`, `rm-obs-768/1024/390/1440`, `col-1024x768-observatory-l`, `col-390x844-evidence-0.05`, `col-768x1024r-observatory-l`, `col-360x800r-zero-0.3`.
- **Commit size:** to keep the commit near 30 MB, non-S00 frames at 1440, 768 and 390 are committed at 70% scale (JPEG q50). Lighthouse JSON is gzipped and the HTML reports are dropped.
