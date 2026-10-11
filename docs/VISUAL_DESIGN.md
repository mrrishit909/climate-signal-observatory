# Visual design: Climate Signal Observatory ("The Planet Is Speaking in Data")

This document covers phases 14-16: reference research, three competing concepts with a scored
selection, and the experience blueprint. The motion bible (phase 17) is `MOTION_SYSTEM.md`.
Author: Creative Director (task P03-CD-001), 2026-10-10.

## Contents

0. [Binding inputs](#0-binding-inputs)
1. [Reference research (phase 14)](#1-reference-research-phase-14)
2. [Three concepts and the selection (phase 15)](#2-three-concepts-and-the-selection-phase-15)
3. [Experience blueprint (phase 16)](#3-experience-blueprint-phase-16)
4. [Signature interactions](#4-signature-interactions)
5. [Copy deck](#5-copy-deck)
6. [Placeholder bindings and data requests](#6-placeholder-bindings-and-data-requests)
7. [Hard rejection criteria](#7-hard-rejection-criteria)

---

## 0. Binding inputs

These are inputs to the design. The design does not choose them.

- **Shared language.** The sources are `design/reference-analysis.md` and `design/interaction-inventory.md`. For this document I opened these evidence images: `design/reference/sheet-desktop-scrollA.png` and project 01's `artifacts/evidence/stage-b2/sheet-1440x900.png`. The second one is the format and quality bar, and it shows what P01 already owns visually.
- **Tokens and fonts.** Tokens come from `shared/design-tokens/tokens.css`. Fonts are Newsreader for display and JetBrains Mono for everything else (`design/fonts/DECISION.md`). The ghost-word state is opacity 0.55 plus a 12px blur (ENGINEERING_DECISIONS #10).
- **Data facts read from the raw files on 2026-10-10.** These come from `data/raw/` (headers only) and `research/P03-sources.md`:
  - **GISTEMP v4 gridded:** `tempanomaly` is 1761 x 90 x 180. That is a **2-degree grid** (lat -89..89, lon -179..179), monthly from 1880-01 to **2026-09**. The native baseline is 1951-1980.
  - **HadCRUT5 5.2.0.0 ensemble mean:** `tas_mean` is 2120 x 36 x 72. That is a **5-degree grid**, monthly from 1850-01 to **2026-08**. The native baseline is 1961-1990. The global summary CSV carries a 95% range.
  - **NOAA GML CO2:** Mauna Loa monthly runs from 1958-03, with interpolated months flagged by negative sdev/unc. The site moved to Maunakea between 2022-11 and 2023-07. The global monthly series runs from 1979-01.
  - **IPCC AR6 WG1 SPM Table SPM.1:** five SSPs, each with a best estimate and a very likely range, for 20-year windows 2021-2040, 2041-2060 and 2081-2100. Values are relative to 1850-1900, from the SPM PDF (PDF page 18).
- **Contracts are not yet published.** No `data/contracts/*.schema.json` existed at the time of writing, and there was no "Contracts:" commit. Every binding in [section 6](#6-placeholder-bindings-and-data-requests) is marked PENDING-CONTRACT or DR-n. The frontend must reconcile field names against `docs/DATA_CONTRACTS.md` when it lands. Where they differ, the contract wins on names and this document wins on what the design needs.
- **What we take from the reference.** We take principles only, never assets or copy:
  - black stages lit by one luminous form
  - oversized serif statements revealed word by word through blur
  - uppercase mono for all UI and body copy
  - 100dvh sticky stages in long tracks
  - threshold-stepped 1.2s settles
  - 4-segment story cards
  - an argument card stack
  - a square blur bottom nav and a mobile current-section pill
  - a closing that echoes the opening

  We deliberately **do not** take the reference's 164vw ring dial. Section 2 explains why.

### Colour semantics (project 03 rule set)

The project 03 rule differs from P01. **Here, orange is a data colour.** Warm anomalies are OBSERVED (or DERIVED) data and are drawn in the Solar family, while cool anomalies use the Electric family. Honesty is therefore carried by **text chips plus non-colour cues**, never by hue alone.

| Role | Value | Rule |
|---|---|---|
| Anomaly scale (diverging, luminance-symmetric) | See the bin table below | **Sign is hue** (Solar warm, Electric cool). **Magnitude is luminance**, so large anomalies of either sign glow and near-zero cells are a dim neutral. The scale is binned (11 bins), never continuous, so every colour reads as a stated range. Blue-versus-orange is safe for protan and deutan vision. |
| Neutral (anomaly within ±0.2 °C) | `#2E2E2E` | 1.55:1 against black. With the 1px globe limb line, a neutral cell is visibly *data*, not background |
| **Missing cell** | Dot lattice: 1px white dots at 40% opacity, 4px pitch, on black | It is never a colour. This is the "missing stays missing" cue, and it is distinct from both neutral (a solid grey) and the background (pure black) |
| Primary accent | Solar orb family (`--orb-solar`: `#fff3a6`, `#ffc23d`, `#ff7a1f`, `#ff4c25`) | The opening orb, warm data, and the S08 return |
| Secondary accent | Electric family (`#8fd9ff`, `#58b8e1`, `#192ce4`) | Cool data. `#192CE4` (2.5:1) is **fill only**: it is used solely for the weakest cool bin, which sits next to neutral, and never as text or a line |
| UI structure | White, and `#58B8E1` for DERIVED overlays (trend lines, CI edges) | Light blue is never used for raw observations |
| PREDICTED (IPCC AR6) | `#8fa2ff` (`--tag-predicted`, 8.8:1) outline plus a 45-degree hatch (1px at 6px pitch, 50% opacity) plus the chip `PREDICTED · IPCC AR6` | It is never a solid fill and never a line continuing from observations (see S06) |
| SIMULATED / SYNTHETIC | **Not used in this project.** The site makes no projection of its own | If either appears in the UI, that is a defect |
| Text | `#fff`, and `rgba(255,255,255,.5)` at 13px and larger only | Data colours are never used for body text. Numerals in readouts are white, and their sign is written out (`+1.28 °C`) |

**Anomaly bins** (°C, relative to the active baseline; contrast is against `#000`):

| Bin | Range | Colour | Contrast |
|---|---|---|---|
| C5 | -3.0 or below | `#E6F6FF` | 17.9 |
| C4 | -3.0 to -2.0 | `#8FD9FF` | 13.5 |
| C3 | -2.0 to -1.0 | `#58B8E1` | 9.4 |
| C2 | -1.0 to -0.5 | `#3A7BD5` | 5.0 |
| C1 | -0.5 to -0.2 | `#192CE4` (fill only) | 2.5 |
| N | -0.2 to +0.2 | `#2E2E2E` | 1.6 |
| W1 | +0.2 to +0.5 | `#B8361A` | 3.0 |
| W2 | +0.5 to +1.0 | `#FF4C25` | 6.3 |
| W3 | +1.0 to +2.0 | `#FF7A1F` | 8.1 |
| W4 | +2.0 to +3.0 | `#FFC23D` | 13.0 |
| W5 | +3.0 or above | `#FFF3A6` | 18.6 |

- **Edges.** Bin edges are inclusive on the side away from zero.
- **Legend.** The legend is **direct**: a single 11-swatch mono strip with its edge values written under it, sitting under the readout. It is never a floating gradient box.
- **TREND layer.** The same hues are reused with edges at ±0.05, 0.1, 0.2, 0.4 and 0.6 °C per decade. The legend label switches to say so, and the chip changes to DERIVED.

### Uncertainty grammar (each kind looks different)

| Kind | Tag | Visual |
|---|---|---|
| Observation (annual mean, one source) | OBSERVED | Solid white 3px squares, joined by a 1.5px solid line where shown as a series |
| Measurement/coverage uncertainty (HadCRUT5 95% range) | OBSERVED (published by the Met Office) | **Stipple band:** white 1px dots, density 35%, no edge line. It reads as fog around the solid line |
| Statistical uncertainty (trend CI) | DERIVED | Light-blue 10% fill with **dashed** 1px edges (4px dash, 3px gap) |
| Assessed future range (AR6 very likely) | PREDICTED | A `#8fa2ff` hatched open bracket, with the best estimate as a hollow 9px diamond |
| Exploratory change point | DERIVED | A dotted 1px vertical (1px dot, 3px gap), always captioned `EXPLORATORY` |
| Partial year (2026 YTD) | OBSERVED | A hollow square (1px outline) with the label `YTD`. It is never ranked, never trended, and never part of an annual mean comparison |

### Honesty tags

Every visual carries one chip: OBSERVED / DERIVED / PREDICTED (13px mono, 8px padding, `#ffffff1a` background, tag colour from tokens). SIMULATED and SYNTHETIC never appear.

- Rebased anomalies are **DERIVED**, because subtracting a different climatology is our computation. Only the native baseline of each source is OBSERVED. The chip reads `OBSERVED · GISTEMP v4 · 1951-1980` or `DERIVED · REBASED TO 1991-2020`.
- CO2 values are OBSERVED. The CO2-temperature association in S07 is DERIVED and labelled "association, not attribution".

---

## 1. Reference research (phase 14)

Each reference was verified on 2026-10-10 by one of these methods:

- **C:** `curl -L` (desktop UA) returned HTTP 200, and the page title was read (quoted where useful).
- **R:** the orchestrator's earlier captured reference walk (`design/reference/`).
- **F:** a fact read from a file in this repository's `data/raw/`.

**The Motion column describes, it does not observe.** Unless the row is marked R, the motion described comes from the title, page text or general documentation. I did not watch it in a browser for this task, and the design does not claim it as an observed interaction.

Excluded after checking (not cited):

| URL | Result |
|---|---|
| equal-earth.com | 403 bot challenge |
| observablehq.com/@d3/projection-transitions and @mbostock/orthographic-to-equirectangular | 429 Vercel checkpoint |
| idl.cs.washington.edu/papers/hops/ | 404 |
| nytimes.com "How Much Hotter Is Your Hometown" (2018) | 403 |
| tympanus.net Codrops blurry text reveal | 403 (P01 verified it in a browser; it is not re-cited here) |
| A Carbon Brief state-of-climate URL | 404 |
| ogl.xyz | 200 but no title (not cited) |

| # | Reference (URL) | Verified | Technique | Motion (described, not observed, unless R) | Strength for us | Implementation direction | Originality strategy |
|---|---|---|---|---|---|---|---|
| 1 | Blink Capital, https://blink.capital/ | R | 100dvh sticky stages in 200-300vh tracks, story cards, chat stack, blur bottom nav, one luminous form on black | Observed: 1.2s `cubic-bezier(.33,1,.68,1)` stepped settles, word blur reveal, instant nav jumps | The mandatory grammar for all ten sites | Reuse the principles (tracks, stepped settles, card anatomy, nav) through shared components and tokens | Our luminous form is a **planet** that turns into a stratified column. We use no ring dial, and the copy, fonts and imagery are original |
| 2 | Ed Hawkins, #ShowYourStripes, https://showyourstripes.info/ | C ("#ShowYourStripes") | One colour stripe per year of a global or regional annual anomaly | Static | Proof that a year-per-band colour field is instantly legible to a lay audience | The **global spine** on the core's right edge is a stripe column. The strata themselves are **latitude-resolved** | Stripes are one-dimensional. Our strata keep latitude (equal-area), so Arctic amplification is visible as a bright north edge, and the core is *built* on screen by reducing the globe (S04) |
| 3 | Ed Hawkins, Climate Lab Book "Climate spirals", https://www.climate-lab-book.ac.uk/spirals/ | C ("Climate spirals \| Climate Lab Book") | Monthly anomalies wound around a polar month axis | A spiral grows outward year by year | The most famous animated climate graphic | **Anti-reference.** A month-angle radial plot reads as a clock (P04 owns the 24-hour radial clock) and as a ring (P01/P02/P06/P08 own rings) | We have no polar time axis anywhere. Time is always vertical (strata) or horizontal (bench) |
| 4 | NASA SVS "GISTEMP Climate Spiral", https://svs.gsfc.nasa.gov/4975 | C ("NASA SVS \| GISTEMP Climate Spiral") | The same spiral form, rendered from GISTEMP | Same as 3 | Confirms the spiral is the GISTEMP house visual, so ours must not repeat it | Same anti-reference rule | Same as 3 |
| 5 | NASA SVS "Global Temperature Anomalies from 1880 to 2023", https://svs.gsfc.nasa.gov/5207 | C (title read) | Year-by-year GISTEMP anomaly maps as a video | Frames advance through the years | The canonical "map through time" from the same source we use | The S03a year scrub uses the same source and grid, but it is interactive, baseline-switchable, and has missing cells drawn as a lattice | Video is fixed. Ours rebases live, compares agencies, and shows gaps honestly |
| 6 | NASA GISS, GISTEMP "Global Maps" tool, https://data.giss.nasa.gov/gistemp/maps/ | C ("Data.GISS: ... Global Maps") | A form that renders any period, baseline and smoothing radius as a map | None (form submit) | Shows the analytical parameters experts expect: period, base period, smoothing | The S05 Zero Lab exposes the base period as a draggable clamp, and OBS exposes source and layer | We turn a form into a direct-manipulation instrument, with no "submit" step |
| 7 | earth.nullschool.net, https://earth.nullschool.net/ | C ("earth :: a global map of wind, weather, and ocean conditions") | An orthographic globe on Canvas/WebGL with a data overlay and a drag to rotate | Particle advection over a draggable globe | Proof that a lightweight, non-three.js globe can be beautiful and fast | Our globe is a raw WebGL2 sphere mesh with no scene graph. **Drag rotates** in OBS | No particles (there is no wind field here), and the cells are honest square grid cells, never smoothed |
| 8 | Copernicus "Climate Pulse", https://pulse.climate.copernicus.eu/ | C ("Climate Pulse - Near real-time updates of global climate variables") | Near-real-time daily global temperature and SST series with reference periods | Live-updating charts | An agency-grade benchmark for "today versus the reference period" | We show **no live claim**: the copy states the data vintage (GISTEMP file date, last month 2026-09) | A narrative instrument, not a monitoring dashboard |
| 9 | Climate Reanalyzer, "Daily 2-meter air temperature", https://climatereanalyzer.org/clim/t2_daily/ | C ("Climate Reanalyzer") | Daily series per year overlaid, with the current year highlighted | Hover per year | The "spaghetti of years" shows the range, not just the mean | The S03a readout shows the current year's rank among complete years (DERIVED) | Strata instead of spaghetti. We use reanalysis-free station and SST products only |
| 10 | IPCC WGI Interactive Atlas, https://interactive-atlas.ipcc.ch/ | C ("IPCC WGI Interactive Atlas") | Region and scenario selection, maps, a baseline selector | Map updates on selection | The IPCC's own way of letting a reader pick a scenario and period | S06 offers a scenario selector, but **only for the table values we cite** (SPM.1), never maps of the future | We show no projected spatial field: AR6 maps are not in our data, so S06 is deliberately non-spatial |
| 11 | IPCC AR6 WG1 Figure SPM.1, https://www.ipcc.ch/report/ar6/wg1/figures/summary-for-policymakers/figure-spm-1/ | C (title read) | The observed series plus an attributed and assessed context figure | Static | The authoritative framing of "observed so far" against a 1850-1900 baseline | S06 locks the baseline to 1850-1900 and compares **20-year means with 20-year windows**, as the table defines them | A vertical time axis (oldest at the bottom), continuing the core's grammar |
| 12 | NOAA NCEI "Climate at a Glance: Global Time Series", https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series | C (title read) | A configurable series with trend lines and rank tables | Form-driven | The analytical bar: trends over chosen periods, with ranks | The S05 trend window (two handles) and the slope readout with its CI | Direct manipulation on the bench, and the slope-is-invariant-to-baseline proof shown live |
| 13 | NOAA GML "Trends in CO2", https://gml.noaa.gov/ccgg/trends/ | C ("Trends in CO2 - NOAA Global Monitoring Laboratory") | Monthly Mauna Loa and global CO2 with the seasonal cycle | Static charts | Source-of-record presentation and citation text | The S01 card and the S03a readout give CO2 for the scrubbed year. Before 1958 the readout says `NOT MEASURED AT MAUNA LOA` | We give CO2 a voice only where it was measured, with no proxy backfill |
| 14 | Met Office Hadley Centre, HadCRUT5, https://www.metoffice.gov.uk/hadobs/hadcrut5/ | C (title read) | A 5-degree ensemble gridded product with uncertainty | n/a | Second-agency validation with published uncertainty | The S02 card "Two agencies, two methods" and the OBS DIFFERENCE layer | Agreement and disagreement are both shown, not averaged away |
| 15 | Claus O. Wilke, *Fundamentals of Data Visualization*, ch. 16 "Visualizing uncertainty", https://clauswilke.com/dataviz/visualizing-uncertainty.html | C ("Fundamentals of Data Visualization") | Error bars versus graded bands versus frequency framing | Static | Graded and stippled bands read as uncertainty better than crisp edges | The uncertainty grammar in section 0: stipple for measurement, dashed edges for CI, hatch for assessed ranges | Three different visual kinds for three different kinds of uncertainty |
| 16 | D3 "Cylindrical projections" (`geoEqualEarth`), https://d3js.org/d3-geo/cylindrical | C ("Cylindrical projections \| D3 by Observable") | Equal Earth, an equal-area pseudocylindrical projection | n/a | Equal-area is required so polar cells are not over-weighted visually | The unwrap target (S04) and the no-WebGL fallback. The GLSL formulas are parity-tested against d3 | The sheet is an **intermediate state** of a transformation, not the destination |
| 17 | D3 "Azimuthal projections" (`geoOrthographic`), https://d3js.org/d3-geo/azimuthal | C ("Azimuthal projections \| D3 by Observable") | Orthographic projection and clipping | n/a | The exact math of a globe seen from far away | The vertex shader's orthographic branch, parity-tested against `geoOrthographic` to 1e-6 | n/a |
| 18 | Stripe, "To design and develop an interactive globe", https://stripe.com/blog/globe | C (title read) | A custom WebGL globe with dot-matrix land and a performance discipline | Rotation and arcs (described) | Craft and restraint for a brand globe | The quality-tier and DPR caps in MOTION_SYSTEM section 9 | Our globe *is* the data (every cell is a measurement), with no decorative arcs |
| 19 | GitHub Blog, "How we built the GitHub globe", https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/ | C (title read) | WebGL globe with quality tiers and pause-offscreen | Arcs spawn and fade (described) | Concrete performance discipline | The LOW tier and the offscreen pause | No arcs or flight paths: those belong to P07's network language |
| 20 | WebGL2 Fundamentals, "WebGL2 3D - Data Textures", https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html | C ("WebGL2 3D - Data Textures") | Uploading raw arrays as textures (formats, `UNPACK_ALIGNMENT`, nearest filtering) | n/a | The core technique for the anomaly atlas | The atlas is an R8 texture with NEAREST filtering, so cells stay crisp and a value is never interpolated between cells | n/a |
| 21 | MDN, `createImageBitmap()`, https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap | C (title read) | Off-main-thread image decode with `colorSpaceConversion: 'none'` and `premultiplyAlpha: 'none'` | n/a | Lets a lossless PNG carry exact 8-bit codes to the GPU without colour management altering them | The atlas decode path (DR-1), with a parity test reading back known cells | n/a |
| 22 | React Three Fiber, https://r3f.docs.pmnd.rs/getting-started/introduction | C ("Introduction - React Three Fiber") | A declarative three.js scene graph in React | n/a | The MASTER_PLAN default for 3D | **Considered and rejected for P03.** One mesh, one texture and two programs do not need a scene graph (see MOTION_SYSTEM section 10). This is an open question for the orchestrator | n/a |
| 23 | Natural Earth, https://www.naturalearthdata.com/ | C (title read) | Public-domain vector coastlines and land polygons | n/a | Coastline context and a land mask for LAND/OCEAN regions | DR-11: 110m coastlines drawn as a 1px 35% white overlay, plus a rasterized land fraction per grid cell | Coastlines are context only and sit **above** the data, never filled |
| 24 | The Pudding, "Human Terrain", https://pudding.cool/2018/10/city_3d/ | C ("Human Terrain") | Editorial 3D data form revealed by scroll-driven camera moves | Scroll-driven camera (described) | The pacing of a single object transforming under scroll | S04's unwrap is one continuous scrubbed transformation with labelled intermediate states | We use no extrusion or terrain (P01, P02 and P09 own surfaces) |
| 25 | Igloo Inc (Awwwards SOTD), https://www.awwwards.com/sites/igloo-inc | C ("Igloo Inc - Awwwards SOTD") | A cinematic WebGL intro handing off to scroll | Intro to scroll handoff (described) | Award-level intro pacing | A 4.6s skippable intro whose end state *is* the S01 start | No crystal aesthetic: ours is a glow resolving into measurements |
| 26 | Lenis, https://lenis.darkroom.engineering/ | C ("Lenis - Smooth Scroll") | Normalized smooth scroll | Inertial scroll | The same smoothing the reference uses | Lenis drives the one progress loop | n/a |
| 27 | Copernicus "Temperature" indicator, https://climate.copernicus.eu/climate-indicators/temperature | C (title read) | Multi-dataset comparison (several agencies on one chart) | Static | Agencies agree on the shape and differ in detail | S07 answer 2 and the OBS DIFFERENCE layer | We difference the two agencies on a common 5-degree grid and show where they disagree |

---

## 2. Three concepts and the selection (phase 15)

All three use the shared family:

- black stages, Newsreader statements, mono UI
- sticky stages in tracks
- story cards and an argument stack
- the bottom blur nav and a closing echo
- the Solar/Electric orbs as flat concentric glows

What differs is the metaphor, the signature geometry, the scene composition and the closing.

**The distinctness constraint I designed against** (MASTER_PLAN identities, and DESIGN_AUDIT's pairwise rule):

| Project | Owns |
|---|---|
| P01 | A 164vw ring of nodes with chords inside, stepping as a horizon dial; a rising spectral horizon closing |
| P02 | Concentric depth rings, and a 3D liquidity surface |
| P04 | A 24-hour radial clock |
| P05 | A rotating radial field of dots |
| P06 | A radar sweep over concentric rings, and a telemetry waterfall |
| P07 | An oversized **globe-limb arc with nodes travelling its circumference** |
| P08 | Concentric population rings |
| P09 | Cohort rings, and a 3D landscape |
| P10 | A central orb branching into a radial field |

The plan's "radial year ring around the globe" collides with P01 (a ring of marks), P04 (a radial time axis reads as a clock) and P07 (an arc around a globe). **It is dropped.** None of the three concepts uses a ring of marks, chords, a horizon dial, a radial time axis or the globe's limb as a track.

### Concept A: "The Core Sample"

- **Philosophy.** The planet keeps a record, the way ice and rock do: in layers. The globe holds one year; the record is every year stacked. The site shows the actual reduction pipeline as geometry:
  1. a sphere of 16,200 measured cells
  2. unwrapped into an equal-area sheet
  3. each latitude row averaged into one zonal strip
  4. the strip laid down as one **stratum**
  5. 146 strata stacked into a **core**, oldest at the bottom

  Every step of the transformation is a real computation the visitor watches happen.
- **Signature geometry.** The **sphere** (an orthographic globe whose surface is the 2-degree anomaly grid) and the **core** (a tall vertical column: one stratum per year, with latitude across its width).
  - The core's width uses **sine-of-latitude spacing**, the visible face of an equal-area cylinder. Each pixel of width therefore represents the same share of Earth's surface, so polar rows are not visually inflated.
  - The core is also the year control: drag along its height to choose a year.
  - Time is vertical, so nothing about the core is radial.
- **Accent use.**
  - The Solar orb *becomes* the planet in S00 and returns in S08.
  - Warm data uses Solar bins and cool data uses Electric bins.
  - Light blue is reserved for DERIVED overlays. The PREDICTED periwinkle hatch appears only in S06.
- **Layout.** Asymmetric editorial: statements on a left measure, the globe centre-right, the core as a tall right-hand column (D). The core becomes a horizontal "bench" for the lab (S05), and lies horizontally at the bottom on mobile OBS.
- **3D/2D strategy.** A raw WebGL2 sphere mesh whose vertex shader blends orthographic and Equal Earth positions (the unwrap). The core is drawn in the same context from a small latitude-by-year texture, and all text and controls are DOM. There is no three.js.
- **Hero concept.** A Solar orb glows on black. Its glow contracts into a sphere edge, and the orb resolves into the planet in 1880 (mostly neutral, with large lattice gaps). The years run to the last complete year, and the warming appears as the surface brightens. "The planet is keeping a record."
- **Nav labels.** SIGNAL · RECORD · YEARS · REGIONS · STRATA · ZERO · FUTURES · EVIDENCE · OBSERVATORY
- **Storytelling.** The signal, where it comes from, how it changes by year, where it changes most, how a planet becomes a record, how the "zero" is chosen, what is assessed for the future, why you can trust it, then free exploration, then the return.
- **Motion character.** The sphere turns slowly and deliberately (1.2s settles to a region). The unwrap is long, continuous and scrubbed. Strata land with weight (premium ease). Year changes are 200ms crossfades between real states, never interpolated values.
- **Responsive approach.** D puts the core at the right edge. T puts the core centred under the globe as a tall object. M stacks the globe at the top and the core below it in the scenes, and lays the core horizontally as a scrubber band in OBS.

### Concept B: "Eclipse of the Baseline"

- **Philosophy.** An anomaly is a difference from a chosen "normal". Make the normal a physical object: a black baseline disc eclipsing the planet disc. The thin bright crescent that escapes is the anomaly, and its width is the global anomaly against the chosen baseline. Changing the baseline slides the occluder.
- **Signature geometry.** Two overlapping discs (planet and baseline) and the crescent between them.
- **Accent use.** The Solar crescent for warm offsets, Electric for cool, and the corona glow for uncertainty.
- **Layout.** Centred and symmetric. The eclipse sits mid-stage throughout, with text above and below.
- **3D/2D strategy.** Mostly 2D. Canvas discs plus a flat Equal Earth map revealed "behind" the eclipse in S04.
- **Hero concept.** A total eclipse on black. The occluder slides off by 1.28 °C worth of crescent: "Measured against 1951-1980, the planet has moved."
- **Nav labels.** NORMAL · RECORD · OFFSET · REGIONS · REVEAL · ZERO · FUTURES · PROOF · OBSERVATORY
- **Motion character.** Slow occlusion slides and corona breathing.
- **Weaknesses.**
  - The crescent is one number. It cannot carry 16,200 cells, regions or missing data, so the gridded product (the project's core output) becomes secondary.
  - A corona is a bright rim, which reads as a ring and as P01's spectral rim closing.
  - The metaphor implies astronomy causes warming, which is confusing on a climate site.

### Concept C: "The Space-Time Cube"

- **Philosophy.** The GISTEMP record *is* a cube: latitude by longitude by time. Every view is a slice: a year-slice is a map, a latitude-slice is a Hovmöller diagram, averaging gives a series. The visitor rotates and slices the cube.
- **Signature geometry.** A translucent cuboid with a cutting plane.
- **Accent use.** Cell colours as in A, with the cutting plane edged in Electric.
- **Layout.** A centred 3D object with an orbiting camera.
- **3D/2D strategy.** Full 3D with volume rendering (R3F, a 3D texture, ray marching).
- **Hero concept.** The orb collapses into a cube of light, and the cube slices open.
- **Nav labels.** VOLUME · RECORD · SLICE · REGIONS · CUT · ZERO · FUTURES · PROOF · OBSERVATORY
- **Weaknesses.**
  - It abandons the planned identity (the Solar orb becoming the planet).
  - Volume ray marching on mobile at 30fps is risky.
  - A translucent volume hides missing data rather than showing it.
  - "A 3D data object you orbit" overlaps P02's liquidity surface and P09's landscape.

### Scores (1 = poor, 5 = excellent)

| Criterion | A The Core Sample | B Eclipse | C Space-Time Cube |
|---|---|---|---|
| Fidelity to the reference language (one luminous form, statements, cards, stack, stepped settles, closing echo) | 5 | 4 | 3 |
| Analytical clarity (grid, regions, baselines, trends, uncertainty, futures all legible) | 5 | 2 | 4 |
| **Distinct from P01 and P02** (and the planned P04-P10 identities) | 5 | 3 | 2 |
| Feasibility on static Pages (Lighthouse 90+, 60fps D / 30fps M) | 4 | 5 | 2 |
| Data honesty (missing cells visible, baselines explicit, uncertainty kinds separable) | 5 | 2 | 3 |
| Mobile quality | 4 | 4 | 2 |
| Memorability | 5 | 4 | 4 |
| **Total (of 35)** | **34** | **24** | **20** |

**Why A gets 5 for distinctness.** Here is A checked against every owner in the table above:

1. **No ring.** The globe is shown whole, as a sphere filled with data, never as an outline with marks on it. The globe's limb is a 1px edge, never a track, so P07's limb arc is not touched.
2. **No radial time.** Time is vertical (the core) or horizontal (the bench and mobile scrubber). Nothing rotates to mean "later", so there is no clock (P04).
3. **No chords, no surface.** We draw no lines between places (P01, P07) and no extruded or 3D surface (P02, P09).
4. **The core versus P06's waterfall.** P06 streams metric lanes over time. Our core is static stratigraphy whose width is latitude in equal-area spacing, built *from* the sphere by a visible reduction. Its rows never scroll as a stream.
5. **Accent pairing.** P02 is Electric-primary with orange trades. P03 is Solar-primary with Electric cool data.

DESIGN_AUDIT should check items 1, 2 and 4 when P06 and P07 are designed.

**Why A gets 4, not 5, for feasibility.** A full 2-degree annual atlas (146 x 16,200 values) is about 2.4 MB at 8 bits. It has to be delivered as lazily loaded PNG blocks (DR-1), and the intro uses a small decadal atlas (DR-2). That is solvable, but it is the main performance risk.

### Selection: A, "The Core Sample", with two grafts

A is the only concept where the project's core analytical object (the gridded anomaly record) *is* the signature geometry, and where the transformation (sphere to sheet to strip to stratum to core) is the analysis itself. Two grafts make it stronger:

- **From B, the baseline as a physical object.** In S05 the base period is a white **clamp**: a 30-year bracket that the visitor slides along the bench. Every colour in the core re-bins live and the zero line moves, but the trend slope does not change. That invariance is shown as a computed check.
- **From C, slicing.** In OBS, a click on a stratum sets the year (a time slice). A click across the core's width selects a latitude band, which highlights the same band on the globe (a latitude slice). The cube is never drawn; its slices are the interaction.

---

## 3. Experience blueprint (phase 16)

### 3.1 Chapter-to-scene map

| Scene | Directive chapter | Nav label | Track | Kind |
|---|---|---|---|---|
| S00 Opening | The planet is speaking (intro) | (none, overlay) | 0 (fixed overlay, 4.6s or less) | Timed intro, skippable |
| S01 Big Idea | The planet is speaking | SIGNAL | 200vh | Scrubbed blur reveal; the globe moves to the side |
| S02 Origin of the Data | Where the record comes from | RECORD | 300vh | Story-card deck |
| S03a Mechanism I | Year by year | YEARS | 250vh | Scrubbed year, 1880 to the last complete year |
| S03b Mechanism II | Where it warms fastest | REGIONS | 300vh | 4 threshold-stepped globe turns |
| S04 Transformation | From planet to record | STRATA | 350vh | The unwrap: sphere, sheet, zonal strip, stratum, core |
| S05 Experiment | Choosing the zero | ZERO | 250vh | The bench: a baseline clamp and trend window, live |
| S06 Consequences | What is assessed next | FUTURES | 250vh | Colour becomes position; PREDICTED windows |
| S07 Evidence | How we know | EVIDENCE | 250vh | Argument card stack |
| OBS | The Climate Signal Observatory | OBSERVATORY | 100dvh, **not pinned**, normal flow | Free exploration |
| S08 Conclusion | Closing (echoes S00) | (none; the nav keeps OBSERVATORY active) | 200vh | The core folds back; the planet becomes the orb |

The total is about 2,350vh. If the QA scroll recording shows fatigue, cut S04 to 300vh first, then S03b to 250vh.

### 3.2 Global layout constants

- **Viewports:**
  - D = 1440x900 desktop
  - T = 768x1024 tablet
  - M = 390x844 mobile
- **Gutter:** `--gutter`.
- **Grid:**
  - D: 12 columns, side margins 96px. The text column is x 96-560.
  - T: 8 columns, margins 48px.
  - M: 4 columns, margins 16px.
- **Nav:** a bottom bar 12px from the bottom on D. On T/M, a 160x32 MENU pill at the bottom centre, plus SKIP INTRO / REPLAY at the bottom right.
- **Safe zone:** nothing interactive within 64px of the bottom on D, or 72px on T/M.
- **One WebGL2 canvas,** fixed and viewport-sized inside the sticky stage layer. The globe, sheet and core are drawn from parameters (centre, radius, rotation, morph t, core rect), never by scaling a bitmap.
- **Globe cell rendering.** The cell texture uses NEAREST filtering. Each 2-degree cell is a flat quad patch on the sphere with a hairline 6% black gap between cells (in the shader, via `fract` of the cell coordinate), so the grid reads as measurements, not as a smooth painting.
- **Coastlines:** Natural Earth 110m, 1px, white at 35%, drawn above the cells (DR-11).
- **Limb:** a 1px white line at 24% opacity, plus a Solar halo (cached orb bitmap, 20% opacity, 1.18x the radius) that dims to 0 in analytical scenes. **No marks ever sit on the limb.**
- **Core geometry:**
  - One stratum per complete year, with an **integer pixel height** (D 5px, T 5px, M 4px). There are 146 strata for 1880-2025 (GISTEMP), plus one hollow YTD stratum for 2026 when shown.
  - The horizontal axis is `x = left + w/2 x (1 + sin(lat))`: south at the left, north at the right, equal-area.
  - The global spine is an extra 12px column (D/T; 8px on M) at the core's right edge, with a 4px gap, holding the area-weighted global mean as a single swatch per year.
  - The core has 8px corners, a 1px 24% white outline and no shading on data.

### 3.3 Geometry states (exact)

`c` = centre in CSS px from the viewport's top-left. `r` = globe radius. The core rect is `x0-x1 / y0-y1`.

| State | D 1440x900 | T 768x1024 | M 390x844 | Notes |
|---|---|---|---|---|
| G0 Orb (S00 start, S08 end) | c (720, 450), orb radius 200, no sphere | c (384, 470), 190 | c (195, 360), 130 | Solar orb, flat concentric glow (cached bitmap) |
| G1 Planet hero (S00 end) | c (720, 450), r 290, halo 20% | c (384, 450), r 280 | c (195, 330), r 160 | Rotation lon0 = -30 (Atlantic), lat0 = 15; idle drift 3 deg/s |
| G1s Planet aside (S01-S03b) | c (1000, 470), r 320, text x 96-560 | c (384, 640), r 270, text y 72-330 | c (195, 520), r 168, text y 56-300 | Drift stops at S03b; settles are stepped |
| G2 Sheet (S04 mid) | Equal Earth, width 1080, centre (720, 430) | width 704, centre (384, 520) | width 358, centre (195, 380) | Aspect from the projection (about 2.05:1) |
| K1 Core hero (S04 end) | x 610-830 (+ spine to 846), y 85-815 (146 x 5px) | x 284-484 (+ spine to 500), y 120-850 | x 120-270 (+ spine to 282), y 96-680 (146 x 4px) | Centred, oversized; labels at the left (years) and the bottom (S/EQ/N) |
| K2 Core docked (S05 bench start, OBS D) | x 1190-1310 (+ spine), y 85-815 | x 640-720, y 160-890 (5px) | horizontal: x 16-374 (146 years over 358px, nearest-pixel strata), y 690-750 | In OBS M, the docked core is horizontal (time left to right, north on top) |
| K3 Bench (S05) | Horizontal: x 600-1344 (744px = 146 x 5px + 14), y 520-640 (latitude rows, north on top) | x 48-720 (4px per year), y 600-700 | x 16-374, y 380-440 | The series sits above the bench (D y 160-500) |
| K4 Spine column (S06) | The spine detaches: x 760-1344 is the value axis (0 to 6 °C relative to 1850-1900), y 85-815 is time from 1850 at the bottom to 2100 at the top | x 96-720, y 140-900 | x 56-374, y 120-700 | Colour becomes position (S06) |

**Why the core is vertical on D and M.** Strata are a geological reading, with the newest on top. A tall column also fits a tall phone screen. The only horizontal states are the S05 bench (a timeline needs width for the trend handles) and the mobile OBS scrubber.
