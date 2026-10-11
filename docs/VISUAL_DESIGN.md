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
- **Contracts.** `docs/DATA_CONTRACTS.md` and 14 schemas in `data/contracts/` landed in commit `0d59bf7` ("Contracts: ...") while this document was being written. Section 6 binds every placeholder to those artifact and field names (`facts.json` keys, `series_annual`, `trends`, `regional`, `extremes`, `changepoints`, `agreement`, `co2`, `ar6`, `validation`, `reconciliation`, `grid_*`).
  - Anything the design needs that the contracts do not provide is a numbered data request (DR-n).
  - The contract decisions that shape this design are:
    - **One shared annual axis, 1850 to the latest complete year.** GISTEMP is `null` before 1880, and the partial 2026 is excluded from annual artifacts.
    - **The 1850-1900 baseline exists for HadCRUT5 only.**
    - **Grids are gzipped C-order Int8 at 0.1 °C per unit, with -128 = missing.** Per-cell baseline offsets come in the sidecar (`null` = unavailable for that cell). The GISTEMP 2-degree grid is about 0.6 MB gzip, and both grids together are under 1.5 MB.
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
| SIMULATED | Appears in **one place only:** S07 answer 7, which cites `validation.trend_ci_simulation` (a synthetic-noise check of CI coverage, tagged SIMULATED by the contract). It shows as text and an orange chip, never as a mark on a data visual | The site makes no projection of its own. SIMULATED anywhere else is a defect |
| SYNTHETIC | Never used | Its appearance is a defect |
| Text | `#fff`, and `rgba(255,255,255,.5)` at 13px and larger only | Data colours are never used for body text. Numerals in readouts are white, and their sign is written out (`+1.28 °C`) |

**Anomaly bins** (°C, relative to the active baseline; contrast is against `#000`):

| Bin | Range | Colour | Contrast |
|---|---|---|---|
| C5 | -3.0 or below | `#E6F6FF` | 19.0 |
| C4 | -3.0 to -2.0 | `#8FD9FF` | 13.5 |
| C3 | -2.0 to -1.0 | `#58B8E1` | 9.4 |
| C2 | -1.0 to -0.5 | `#3A7BD5` | 5.0 |
| C1 | -0.5 to -0.2 | `#192CE4` (fill only) | 2.5 |
| N | -0.2 to +0.2 | `#2E2E2E` | 1.6 |
| W1 | +0.2 to +0.5 | `#B8361A` | 3.6 |
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

Every visual carries one chip: OBSERVED / DERIVED / PREDICTED (13px mono, 8px padding, `#ffffff1a` background, tag colour from tokens). SIMULATED appears only on S07 answer 7, and SYNTHETIC never appears. Where an artifact carries a `tags` entry for the field shown, the chip text comes **from the artifact**, not from this document.

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
| 20 | WebGL2 Fundamentals, "WebGL2 3D - Data Textures", https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html | C ("WebGL2 3D - Data Textures") | Uploading raw arrays as textures (formats, `UNPACK_ALIGNMENT`, nearest filtering) | n/a | The core technique for the anomaly grid | The contract's Int8 grid is uploaded unchanged as an **R8I integer texture array** (one layer per year, `isampler2DArray`, NEAREST). Each cell's code is read exactly in the shader (-128 = missing) and is never interpolated between cells | n/a |
| 21 | MDN, `DecompressionStream`, https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream | C (200) | Native streaming gzip decode in the browser | n/a | GitHub Pages does not content-encode `.gz` binaries, so the page must gunzip the grid itself with no library | The grid load path (`DATA_CONTRACTS.md` "Grid encoding"). Byte progress comes from the compressed stream | n/a |
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
  5. 176 strata (1850 to the latest complete year) stacked into a **core**, oldest at the bottom

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

**Why A gets 4, not 5, for feasibility.** The full 2-degree annual grid (146 x 16,200 Int8 values) is 2.4 MB raw and about 0.6 MB gzip (contract figure). It must stay off the LCP path. It is fetched after first paint, and the intro must work before it arrives (DR-1: a small intro subset). That is solvable, but it is the main performance risk.

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
  - One stratum per year on the contract's shared annual axis: 1850 to `facts.latest_complete_year`. That is 176 strata if the latest complete year is 2025.
  - Each stratum has an **integer pixel height**: D 4px, T 4px, M 3px.
  - Under SOURCE = GISTEMP, the 30 strata for 1850-1879 render as the missing lattice with a direct label `GISTEMP BEGINS 1880`. The axis never rescales between sources, so one year always sits at one height.
  - The partial current year is never a stratum. It appears only as a hollow `YTD` marker above the top stratum, from `series_monthly`.
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
| K1 Core hero (S04 end) | x 610-830 (+ spine to 846), y 98-802 (176 x 4px) | x 284-484 (+ spine to 500), y 150-854 (176 x 4px) | x 120-270 (+ spine to 282), y 96-624 (176 x 3px) | Centred, oversized. Year labels at the left (every 20 years, plus first and last), S / EQ / N labels below |
| K2 Core docked (OBS) | x 1190-1310 (+ spine), y 98-802 | x 640-720, y 150-854 | Horizontal: x 19-371 (176 x 2px), y 690-750 | In OBS M the docked core is horizontal (time left to right, north on top) |
| K3 Bench (S05) | Horizontal: x 620-1324 (176 x 4px), y 560-660 (latitude, north on top, sine spacing) | x 120-648 (176 x 3px), y 620-700 | x 19-371 (176 x 2px), y 400-456 | The series band sits above the bench (D y 150-520, T y 330-600, M y 72-380) |
| K4 Spine column (S06) | The spine detaches: x 760-1344 is the value axis (0 to 6 °C relative to 1850-1900), y 85-815 is time from 1850 at the bottom to 2100 at the top | x 96-720, y 140-900 | x 56-374, y 120-700 | Colour becomes position (S06) |

**Why the core is vertical on D and M.** Strata are a geological reading, with the newest on top. A tall column also fits a tall phone screen. The only horizontal states are the S05 bench (a timeline needs width for the trend handles) and the mobile OBS scrubber.

### 3.4 Scenes

Each scene lists: track, compositions (D/T/M), data, insight, honesty tags, interactions, transition out, and states.

**Shared state UI** (every data-backed scene):

- **Initial:** the sphere skeleton: the 1px limb at 24% plus coastlines once DR-2 is loaded, or the core outline in the scene's geometry state. Headings are sharp.
- **Loading:** the mono line `LOADING GRID_GISTEMP_2DEG · 42%`. The percentage is real (compressed bytes read / Content-Length). With no length it reads `LOADING GRID_GISTEMP_2DEG` with no %.
- **Error:** `COULD NOT LOAD GRID_GISTEMP_2DEG (HTTP 404)` plus a `RETRY` square button that re-runs the same fetch. A decode failure (`DecompressionStream` or a sidecar sha256 mismatch) reads `GRID FAILED ITS CHECKSUM` and also offers RETRY.
- **Empty:** scene-specific copy (below). An all-missing year/baseline/source combination is an *empty* state, never a blank canvas.
- **Ready:** normal render.
- **Disabled:** a control that cannot apply (for example 1850-1900 under GISTEMP) is `aria-disabled` and 50% white, with a tooltip giving the reason.
- **Reset:** scene-specific (below).

There are no spinners and no artificial delays anywhere.

#### S00 Opening: the planet is speaking (overlay, 4.6s or less)

- **Composition.** Pure black. The timeline is in MOTION_SYSTEM 5.1:
  1. A Solar orb (G0) breathes in.
  2. Its glow contracts to a sphere's edge.
  3. The orb resolves into the planet in 1880.
  4. The years run to the latest complete year and the surface brightens.
  5. The headline sharpens.
  6. The nav enters.
- **Per viewport.**
  - **D:** headline centred over the planet, 2 lines at 96px, with the planet (G1) at 45% opacity behind it.
  - **T:** 64px, 2-3 lines, over G1.
  - **M:** the planet sits in the top half (c 195, 330), and the headline (40px, 3 lines) sits *below* it at y 560-700. It is not overlaid, for legibility.
- **Corner labels.** Top-left is the mono wordmark `CLIMATE SIGNAL OBSERVATORY` (13px). Top-right is a mono year counter that counts `1880` up to `{{facts.latest_complete_year}}` in step with the surface. It is an original element, not the reference's spread wordmark.
- **LCP rule.** The `h1[data-hero]` is in the DOM from first paint as ghost text (opacity 0.55, blur 12px), never at opacity 0.
- **Data:**
  - **DR-1:** the intro grid subset (the decade years plus the latest).
  - **DR-2:** coastlines.
  - `facts.latest_complete_year`.
- **Insight.** The planet has a measured surface, and it has changed.
- **Tags.** The end-state chip (bottom-left) reads OBSERVED, with the note `CELLS = GISTEMP v4, 2° ANNUAL MEANS VS 1951-1980. DOTS = NOT MEASURED.`
- **Interactions.**
  - SKIP INTRO is visible from 0ms. Esc, or any wheel/touch/key scroll, completes the intro in 350ms.
  - It plays once per session (`sessionStorage`, in try/catch). REPLAY INTRO lives at the nav's right end and in S08.
- **Transition to S01.** None: the S00 end state is the S01 start state.
- **States.**
  - If DR-1 has not arrived by 1.2s, the orb resolves into the sphere with the limb and coastlines only. The counter runs, but the cells fade in (350ms) whenever the subset arrives, with no year run.
  - If the coastlines fail, the sphere still renders (no coastlines).
  - If WebGL2 is unavailable, the orb stays an orb (the cached 2D bitmap), the headline sharpens, and the note reads `3D GLOBE UNAVAILABLE: FLAT MAPS USED`.

#### S01 Big Idea: the signal (200vh)

| p | Change |
|---|---|
| 0-0.4 | The headline scales from 96px to 44px and moves to y 120 (D). Scrubbed, the planet moves **G1 to G1s** and the halo fades from 20% to 6%. The year stays at the latest complete year. |
| 0.35-0.75 | Statement 2 blur-reveals: 64px in the left column (D), 48px (T), 36px (M). |
| 0.6-1 | Two notification cards type in. |

- **Notification cards** (radius 8, padding 24; 13px mono header at 50%, 18px body):
  - **Card 1** (`#161616`): header `FROM: NASA GISTEMP v4 / {{facts.latest_complete_year}}`, body `THE PLANET AVERAGED {{facts.gistemp_latest_year_anomaly_1951_1980}} °C ABOVE ITS 1951-1980 NORMAL.` Tag OBSERVED.
  - **Card 2** (`#192CE4` fill, white text): header `FROM: MAUNA LOA / {{facts.co2_mlo_latest_month}}`, body `{{facts.co2_mlo_latest_ppm}} PPM OF CO2 IN THE AIR. MEASURED, NOT MODELLED.` Tag OBSERVED.
- **Placement.**
  - D: the cards sit top-right of the text column at x 96-456, y 560-760. They are **not** over the planet.
  - T: full width minus 96, under the statement.
  - M: stacked above the planet, one-line bodies.
- **Data:** `facts.json`.
- **Insight.** The headline number has a stated zero (1951-1980). CO2 is shown next to it, measured and not modelled.
- **Interactions.** Scroll only. Cards are not buttons.
- **Transition to S02.** The planet dims to 25% and holds at G1s as the backdrop of the card deck.
- **States.** Statements are static text. If facts are missing, the cards do not render (there are no placeholder cards).

#### S02 Origin of the Data: where the record comes from (300vh)

- **Composition.** A horizontal story deck driven by vertical scroll. This is the reference mechanic, using shared components.
  - **D:** cards 360x620, 8px gap, the active card centred at x 720.
  - **T:** cards 320x600, neighbours peeking 24px.
  - **M:** cards 300x560, neighbours peeking 12px.
- **Card anatomy.** Radius 8, padding 24:
  - a chip (`RECORD 0n · ...`)
  - a 4-segment progress bar
  - the serif title (40 / 32 / 28px)
  - a visual zone
  - a mono body (18 / 15 / 14px)
  - the tag at the bottom-left
- **The four cards:**

| # | Fill | Visual zone | Data | Tag |
|---|---|---|---|---|
| 1 "A cell, not a thermometer." | `#161616` with an inner Solar orb (cached, 240px) that **resolves into one 2° cell**: a square with the field list beneath it, `LAT · LON · YEAR · ANOMALY (0.1 °C STEPS) · MISSING = -128`, rows lighting in sequence | `grid_gistemp_2deg.meta.json` (`encoding`, `grid`) | OBSERVED |
| 2 "Two agencies, two methods." | `#192CE4`, white text | Two lattices at true relative scale, side by side: GISTEMP 90x180 (2°) and HadCRUT5 36x72 (5°), each labelled with its first year and native baseline | `grid_*.meta.json` (`grid`, `years.first`, `native_baseline`) | OBSERVED |
| 3 "Every anomaly needs a zero." | `#161616` | A 176px mini timeline, 1850 to latest, with three bracketed baseline windows (1850-1900 hatched-out for GISTEMP, 1951-1980, 1991-2020). The offset value appears beside the 1991-2020 bracket | `facts.baseline_offset_1951_1980_to_1991_2020_gistemp`, `series_annual.conversions` | DERIVED |
| 4 "Gaps stay gaps." | `#F2F2F2` fill, black text (the one light card) | A 176-column coverage strip: each year's measured-area share as a black bar height (`valid_area_share_per_year`). Pre-1880 GISTEMP columns are blank with the label `NO DATA` | `grid_gistemp_2deg.meta.json`, `facts.gistemp_valid_area_share_first_year`, `facts.gistemp_valid_area_share_latest_year` | OBSERVED |

- **Footer** of card 4: `PIPELINE v{{meta.pipeline_version}} · GENERATED {{meta.generated_at}}`.
- **Insight.** What a cell is, why two agencies are compared, that "warmer" always means "warmer than a chosen period", and that early coverage is thin and stays thin.
- **Interactions.** The progress segments are a `role="tablist"`. Arrow keys jump to that card's band.
- **Transition to S03a.** The last card slides off left while the planet brightens from 25% to 100% at G1s (scrubbed over the final 15%).
- **States.** If a sidecar is missing, cards 1, 2 and 4 show `GRID METADATA UNAVAILABLE` plus RETRY. Card 3 still renders from `facts.json`.

#### S03a Mechanism I: year by year (250vh)

- **Composition.**
  - **D:**
    - The planet sits at G1s (c 1000, 470, r 320), turning slowly at 3 deg/s.
    - Left column x 96-560:
      - the serif statement (64px)
      - a mono body (18px)
      - a BASELINE segmented control: 1951-1980 / 1991-2020 / 1850-1900
      - a SOURCE control: GISTEMP 2° / HADCRUT5 5°
      - a `+2 °C CELLS` toggle
    - **Year readout,** below the controls at y 520-760:
      - `{{year}}` in mono 56px tabular
      - `GLOBAL {{+0.00}} °C VS {{baseline}}`
      - `RANK {{k}} OF {{n}} COMPLETE YEARS`
      - `CO2 {{ppm}} PPM · MAUNA LOA`
      - `MEASURED AREA {{pct}}%`
      - the 11-swatch legend
    - **The year track:** a 1px vertical line at x 1392, y 98-802, using the same year-to-y mapping as the core K1. A 12px white square marks the current year. It is a quiet preview of the core: vertical time, oldest at the bottom.
  - **T:** text and controls at the top (y 72-380), the planet below (c 384, 680, r 270), and the readout as a 2-column block at y 400-520.
  - **M:**
    - Statement (32px) at the top.
    - Planet c (195, 430), r 150.
    - Readout as 3 lines under the planet (y 600-660).
    - Controls in a single bottom row above the MENU pill: `BASE 51-80` (opens an upward list), `SRC GISS`, `+2°`.
- **Behaviour.**
  - Scroll p 0.08-0.92 maps to years from the first year of the active source to `facts.latest_complete_year` (GISTEMP 1880-latest, HadCRUT5 1850-latest).
  - **The displayed state is always an integer year.** A change of year crossfades the two real layers over 200ms (MOTION 5.5). No fractional-year blend is ever held.
  - The readout snaps to the integer year.
- **Data:**
  - `grid_gistemp_2deg` and `grid_hadcrut5_5deg` (the bin plus `baseline_offsets`).
  - `series_annual` (GISTEMP global land-ocean and HadCRUT5 global, `values[baseline]`).
  - `co2.mlo_annual_ppm`.
  - `grid_*.meta.valid_area_share_per_year`.
- **Rank** is derived in the client from `series_annual` for the active source and baseline. Ranks never change with the baseline (constant shift); a Vitest test asserts it.
- **Insight.** Warmth arrives everywhere, unevenly. Early years are full of gaps.
- **Tags.**
  - Cells: OBSERVED at the native baseline, DERIVED when rebased (the chip updates).
  - Global readout: OBSERVED (`series_annual`), DERIVED when rebased.
  - CO2: OBSERVED.
  - Rank: DERIVED.
  - `+2 °C CELLS`: DERIVED.
- **Interactions** (all visitor-set parameters, interaction 2):
  - **BASELINE:** 3 values. 1850-1900 is disabled under GISTEMP with the tooltip `GISTEMP BEGINS IN 1880: NO 1850-1900 BASELINE`.
  - **SOURCE:** 2 values. Switching to GISTEMP while 1850-1900 is active snaps the baseline to 1951-1980 and announces it (`aria-live`: `BASELINE SET TO 1951-1980: GISTEMP HAS NO 1850-1900`).
  - **+2 °C CELLS:** valid cells at +2.0 °C or more under the *active* baseline get a 1px white inner outline. Other cells dim to 35%. The readout adds `{{pct}}% OF MEASURED AREA AT +2 °C OR MORE` (area-weighted, computed from the rendered cells).
  - Arrow Up/Down on the focused globe step the year by scrolling the track.
- **Transition to S03b.** At p 0.92-1, the planet's drift stops and it settles to the S03b state-1 rotation (scrubbed). The year locks to the latest complete year.
- **States.**
  - **Empty:** a cell with a `null` offset under the chosen baseline renders as the missing lattice. If more than 60% of the measured area is lost that way, the readout adds `MANY CELLS HAVE NO {{baseline}} REFERENCE`. For HadCRUT5 at 1850-1900 this is expected and is the honest picture.
  - **CO2 before 1959:** `NOT MEASURED AT MAUNA LOA (RECORD BEGINS 1958)`.
  - **Reset:** a `RESET` text button appears when any control differs from the default (GISTEMP, 1951-1980, +2 off).

#### S03b Mechanism II: where it warms fastest (300vh, 4 stepped states)

- **Composition (D).**
  - The planet sits at G1s and **turns to face a region** at each threshold (1200ms `cubic-bezier(.33,1,.68,1)`). This is a rotation of a sphere toward a place: no dial, no marker on the limb.
  - **Surface layer = TREND.** Per-cell OLS slope for the active TREND PERIOD (DR-3), on the trend bins.
  - Cells whose trend CI includes zero get a **stipple overlay** (1px dots, 25%, 3px pitch): uncertain, not missing. This is a different pitch and opacity from the missing lattice, and the legend shows both.
  - **The active band is outlined:** two 1px white latitude lines (parallels) at the band edges, drawn only on the visible hemisphere. Cells outside the band dim to 30%.
  - Left column (x 96-560):
    - the statement and body
    - a **band ledger:** 5 rows, one per `regional.bands`, each `{{label}} · {{slope}} °C / DECADE ({{ci}}) · MEASURED {{share}}%`, with the active row white and the others 50%
    - TREND PERIOD chips: `SINCE 1880 · SINCE 1951 · SINCE 1975 · SINCE 1991` (ids must match `trends.periods`, DR-3/DR-5)
  - Top-right of the planet: the state title (serif 44px), entering with the rotation.
- **T:** the title sits above the planet, the ledger becomes 5 compact rows under it, and the chips go in a row.
- **M:** planet r 150 at (195, 360). The title (28px) sits above it. The ledger becomes a bottom card showing only the active band row plus `1/4`. The chips scroll horizontally.
- **The four states** (threshold-stepped at p = 0, 0.25, 0.5, 0.75):

| State | Faces (lon0, lat0) | Band / data | Claim to verify before build |
|---|---|---|---|
| 1 "The far north" | (20, 72) | Northernmost band (its edge and label come from `regional.bands`; with DR-7 edges this is 60-90°N, so the title never says "Arctic circle") | `facts.arctic_to_global_trend_ratio_1975_latest` (DR-5; the key name may follow the band id) is at least 2, else the fallback title "The fastest-warming band" |
| 2 "Land and sea" | (30, 20) (Eurasia and Africa in view) | `regional.land_ocean` land-only versus land-ocean, plus the AR6 land and ocean 2011-2020 values | `facts.land_minus_landocean_gap_latest_decade` (DR-5) is above 0, else the body uses the neutral fallback |
| 3 "The least-watched south" | (140, -62) | Southernmost band, `valid_area_share` | Descriptive. It uses `facts.south_band_first_year_valid_share_ge_50pct` (DR-5) |
| 4 "Nowhere is cooling" | (-150, 0) (Pacific) | All bands | `facts.band_trends_all_positive_1975_latest` (DR-5) is true, else the title "Not everywhere at once" |

- **Data:** DR-3 (cell trends), `regional.json`, `trends.json` (band series, DR-5), `facts.json`.
- **Insight.** The north warms fastest, land faster than ocean, and the far south is the least observed. The honest framing is that it is least *known*, not least warming.
- **Tags.** Cell trends DERIVED, band means DERIVED, AR6 land/ocean values as the artifact tags.
- **Interactions** (visitor-set parameters, interaction 3):
  - TREND PERIOD (4 values) re-keys the surface and the ledger, with no rotation.
  - Click a ledger row, or press Left/Right with the globe focused, to turn to that band. The scroll state is then marked overridden, and the next threshold resumes the authored sequence.
  - **Drag** rotates the globe freely in this scene (pointer only, the wheel always scrolls). On release it eases back to the state's face (800ms) unless the visitor has selected a band.
- **Transition to S04.** The rotation settles to (0, 0) and the trend layer crossfades back to the anomaly layer of the latest complete year (600ms).
- **States.**
  - If DR-3 is declined, the surface stays the anomaly layer of the latest year, the ledger still shows band trends (DR-5), and the period chips act on the ledger only, with the label `SURFACE: {{year}} ANOMALY, NOT TREND`.
  - **Empty:** a band with too little coverage for a trend over the chosen period reads `TOO FEW MEASURED YEARS FOR A TREND SINCE {{start}}`.
  - **Reset:** `RESET VIEW` appears after an override.

#### S04 Transformation: from planet to record (350vh), the signature

- **Composition.** Scrubbed phases, then stepped ones:

| p | What happens |
|---|---|
| 0-0.08 | The planet re-centres from G1s to G1 and faces (0, 0). The year is the visitor's current year (default: latest complete). |
| 0.08-0.30 | **Unwrap.** Every vertex blends from orthographic to Equal Earth. The back hemisphere emerges at the sheet's flanks. The result is G2 (the sheet), and the coastlines unwrap with it. |
| 0.30-0.45 | **Zonal collapse.** Within each 2° latitude row, cells slide horizontally toward the central meridian and merge. The row's width shrinks to the strip width, and its colour becomes the **zonal mean of valid cells** (DERIVED). A row with fewer than 20% valid cells becomes lattice (DR-4 rule). |
| 0.45-0.58 | **Turn and re-space.** The vertical strip rotates 90 degrees (north to the right). Its rows re-space from Equal Earth y-positions to sine-of-latitude spacing, and it lands as the **top stratum** of K1. |
| 0.58-0.85 | **The core builds.** The remaining strata (every earlier year) rise from below the viewport and stack under the first, oldest at the bottom. Each is coloured by its own zonal means, with a staggered rise (older years later). |
| 0.85 | Stepped, **SPINE.** The global column (area-weighted mean of valid cells, DERIVED) grows upward beside the core (scaleY from the bottom). The statement swaps. |
| 0.93 | Stepped, **COVERAGE.** The missing lattice brightens from 40% to 70% for 1200ms, then settles. The readout shows `MEASURED AREA {{facts.gistemp_valid_area_share_first_year}}% IN 1880 → {{facts.gistemp_valid_area_share_latest_year}}% IN {{facts.latest_complete_year}}`. |

- **Per viewport.**
  - **D:**
    - K1 centred (x 610-846).
    - Left column: the statement plus phase captions. These are mono 13px lines that change at each phase: `1 · 16,200 CELLS`, `2 · UNWRAPPED, EQUAL AREA`, `3 · EACH ROW AVERAGED`, `4 · ONE YEAR = ONE LAYER`, `5 · {{n}} LAYERS`.
    - Right of the core (x 880-1344): year labels for the first year, every 20 years and the latest year, plus `S · EQ · N` under it (x positions follow sine spacing).
  - **T:** the sheet uses the full width (G2-T), K1 is centred, and captions sit above.
  - **M:** sheet G2-M, then K1-M (x 120-282). Captions sit in a bottom card. Year labels run at the left of the core every 40 years.
- **After landing** (p 0.85 or more):
  - Hover or tap a stratum to see a tooltip: `{{year}} · GLOBAL {{+0.00}} °C · MEASURED {{pct}}%`.
  - Click sets the shared `year`, used in S05/OBS.
  - The SOURCE toggle is available. With HadCRUT5, the 1850-1879 strata fill in, and on GISTEMP they read as lattice with `GISTEMP BEGINS 1880`.
- **Data:**
  - `grid_*` (the bin plus offsets)
  - client zonal means (DR-4 rule, with a parity fixture)
  - `grid_*.meta.valid_area_share_per_year`
  - `facts.json`
  - `validation.grid_vs_official_global` (footnote)
- **Footnote** (13px, persistent once the spine shows): `SPINE = MEAN OF THE GRID CELLS SHOWN. NASA'S OFFICIAL GLOBAL SERIES DIFFERS BY AT MOST {{validation.grid_vs_official_global.gistemp.max_abs_diff}} °C.`
- **Insight.** A planet can be read as a record. The record warms upward. The north edge of the recent strata glows brightest (amplification, visible without a chart), and the oldest layers carry gaps at the poles. They are far sparser under HadCRUT5, which does not spread stations over 1200 km.
- **Tags.** Cells OBSERVED (native) or DERIVED (rebased), strata DERIVED (zonal means), spine DERIVED.
- **Transition to S05.** The core turns 90 degrees anticlockwise and slides to K3 (the bench), keyed per stratum. The series band fades in above it.
- **States.**
  - Before the grid arrives, the unwrap runs on the coastlines and limb alone. The strata appear as outlines with the line `LOADING GRID_GISTEMP_2DEG · 61%`, and they fill when the data lands.
  - Under the no-WebGL tier, phase 1 starts from the flat Equal Earth map (there is no sphere), and phases 2-5 run in Canvas2D.

#### S05 Experiment: choosing the zero (250vh; the stage stays pinned until 1)

- **Composition (D).**
  - **Left column x 96-560:**
    - the statement "Choose your zero." (64px) and a body
    - controls (mono 13px labels, 18px values):
      - BASELINE: the clamp, which also has 3 square chips as its keyboard surrogate
      - SOURCE
      - TREND WINDOW: from/to readouts plus the handles on the bench
      - SMOOTH: OFF / LOESS
      - BREAKS: OFF / EXPLORATORY
      - RESET
  - **Series band (x 620-1324, y 150-520).** No frame and no gridlines, except 3 hairlines at 25% white with direct labels at the left (`0.0 °C` is the active baseline's zero, labelled `= {{baseline}} MEAN`).
    - GISTEMP global: solid white squares (3px) plus a 1.5px line. OBSERVED or DERIVED.
    - HadCRUT5 global: a 1px white 60% line plus the **stipple band** (`ci_lo`/`ci_hi`). OBSERVED.
    - LOESS (when on): a light-blue 1.5px line with dashed-edge band edges (`trends.loess` fit and band). DERIVED.
    - Trend fit over the window: a light-blue 2px line with the AR(1) CI wedge (10% fill, dashed edges). DERIVED.
    - BREAKS (when on): the `changepoints` selected fit as a dotted light-blue polyline, with break years as dotted verticals and their `break_ci_95` as a bracket on the axis. Captioned `EXPLORATORY · NOT A TEST FOR ACCELERATION`.
  - **The bench (K3, y 560-660):** the core lying horizontal, with time on x shared exactly with the series band.
    - **The clamp:** a white 2px bracket over the bench and series band spanning the baseline years, with a 16px square grip at its centre.
    - **The trend handles:** two 12px white squares on a 1px rail under the bench (y 676), joined by a light-blue 2px span.
  - **Result line** (mono 24px, under the series band at y 530): `TREND {{from}}-{{to}}: {{+0.00}} °C PER DECADE · 95% CI {{lo}} TO {{hi}} (AR(1)-ADJUSTED)`. A second line (13px, 50% white): `NAIVE OLS CI {{nlo}} TO {{nhi}}: TOO NARROW WHEN YEARS ARE AUTOCORRELATED`.
  - **The invariance check** (13px, shown after any baseline change): `SLOPE UNDER {{baseline}} = SLOPE UNDER {{native}} ✓`. It is computed at runtime by fitting both, with tolerance 0.001 °C/decade. If false, it reads `✗ CHECK FAILED` in `--state-error` and the build's Vitest also fails.
- **T:** statement at the top, series band full width (y 330-600), bench (y 620-700), controls in 2 columns below (y 740-940).
- **M:**
  - The series band at the top (y 72-380, x 19-371).
  - The bench at y 400-456.
  - The result line at y 470-540 (2 lines, 14px).
  - Controls in a **bottom sheet** (peek 200px: BASELINE chips and the trend from/to steppers as 44px rows). Expand for SOURCE, SMOOTH and BREAKS.
  - The clamp and handles are draggable, with 44px touch targets that extend beyond the visible marks.
- **Behaviour.**
  - **The clamp snaps.** On release it snaps to the nearest *contracted* baseline (1951-1980, 1991-2020, 1850-1900). Arbitrary windows are not offered, because the contract computes offsets only for these three (a design decision for honesty, not a technical limit).
  - On a snap:
    - every stratum re-bins (`stored - offset` per cell)
    - the series re-level (they shift vertically by the conversion offset)
    - the hairline labels re-label
    - the trend line shifts *with* the series, and its slope does not change
  - **Trend window:** any from/to with at least 10 years (`to - from >= 9`), clamped to the active source's years. The OLS slope and the AR(1)-adjusted CI are computed in the client (`src/model/trend.ts`), with Vitest parity against every `trends.json` fit (`slope_per_decade`, `ci_ar1`, `ci_naive`, to 1e-6).
- **Data:** `series_annual`, `trends.json` (`loess`, parity), `changepoints.json`, the `grid_*` sidecar offsets, `facts.json`.
- **Insight.** The zero is a choice, so the level changes when you move it. The slope is a property of the data, so it does not. And under autocorrelation an honest CI is wider than the naive one.
- **Tags.** Series OBSERVED or DERIVED, as labelled. The trend line, CI, LOESS and breaks are DERIVED, with EXPLORATORY on the breaks.
- **Interactions.** Baseline clamp, source, trend handles, smooth, breaks and reset (interaction 6). Keyboard:
  - The clamp is a `role="slider"` with 3 stops.
  - Each trend handle is a `role="slider"`: arrows ±1 year, PageUp/Down ±10, Home/End to the extremes.
- **Transition to S06.** The bench returns upright (K3 to K1). The core dims to 15% and the spine **detaches** to become K4 (MOTION 5.7).
- **States.**
  - **Disabled:** 1850-1900 under GISTEMP shows the clamp stop hatched with the tooltip `GISTEMP HAS NO 1850-1900 BASELINE`. Dropping the clamp there leaves the baseline unchanged and offers `SWITCH TO HADCRUT5` (a button) beside the result line.
  - **Empty:** if the trend window has fewer than 10 valid years for the source (for example GISTEMP before 1880), the result reads `TOO FEW YEARS FOR A TREND (MIN 10)`, and the handles show a hatched invalid span.
  - **Loading:** `series_annual` is small and loads with the page. If `trends.json` is still loading, SMOOTH is disabled with `LOADING TRENDS`.
  - **Reset:** GISTEMP, 1951-1980, window 1975 to the latest, smooth off, breaks off.

#### S06 Consequences: what is assessed next (250vh)

- **Composition (D):** colour becomes position.
  - The spine's swatches (1850 to latest, now **HadCRUT5 rebased to 1850-1900**, the only source with that baseline) slide horizontally out of the column to their value on a horizontal axis (K4: x 760-1344 spans 0 to 6 °C). Each becomes a 4px square that keeps its bin colour. Time stays vertical (1850 at the bottom), and the y scale compresses to fit 2100 at the top.
  - The HadCRUT5 95% range is a horizontal **stipple band** behind each square (OBSERVED).
  - **Observed 20-year means** are solid white bars, 20 years tall, at x = value:
    - 2001-2020 (`ar6.observed_derived.hadcrut5_rebased_1850_1900.mean_2001_2020`)
    - 2005-2024 (`mean_2005_2024`)

    Beside the 2001-2020 bar sits the IPCC's own assessed value for 2001-2020 (`ar6.observed_published`), drawn as a white **open** bracket with chip `ASSESSED · IPCC AR6`, so like is compared with like.
  - **Future windows,** PREDICTED, the only periwinkle on the site:
    - 2021-2040, 2041-2060 and 2081-2100 sit at their y spans as `#8fa2ff` hatched open brackets from `very_likely_low_c` to `very_likely_high_c`, with a hollow diamond at `best_estimate_c`.
    - The selected scenario is drawn fully. The other four are 1px outlines at 30%.
    - The 2061-2080 gap carries the label `NOT IN TABLE SPM.1`.
    - **No line joins observations to futures.**
  - **Reference levels:** dotted vertical hairlines at 1.5 and 2.0 °C, labelled `1.5 °C` and `2.0 °C`, with the caption `LEVELS NAMED IN THE PARIS AGREEMENT (20-YEAR MEANS)`.
  - Left column: the statement, the scenario selector (5 square chips, `SSP1-1.9` through `SSP5-8.5`, each with its `ghg_description` as a 13px subline), and a source block: `IPCC AR6 WG1 SPM, TABLE SPM.1, PAGE {{ar6.source.page_printed}}`.
  - Persistent chip: `PREDICTED · IPCC AR6 ASSESSED RANGES, NOT OUR PROJECTION`.
- **Conditional callout** (serif 32px), shown only if computed true: when `facts.hadcrut5_latest_year_anomaly_1850_1900` is at least 1.5 **and** `mean_2005_2024` is below 1.5, show "One year above 1.5 °C is not a 20-year mean above it."
- **T:** the same vertical composition (the value axis spans x 96-720), with the scenario chips in a row above.
- **M:** the vertical axis is kept (a tall screen suits it). The value axis spans x 56-374. Scenario chips form a snap-scrolling row at the bottom, and the source block becomes one line.
- **Stepped states** (p = 0.35, 0.55, 0.75): the three windows light up in time order. Before its threshold a window is an outline only. The statement swaps per window.
- **Data:** `series_annual` (HadCRUT5 global, `values["1850-1900"]`, `ci_lo`, `ci_hi`), `ar6.json`, `facts.json`.
- **Insight.** The observed record already sits inside the first assessed window's range, and how far the brackets spread later depends on the scenario. Every future number is the IPCC's, not ours.
- **Tags.** Squares and stipple OBSERVED. 20-year means DERIVED. AR6 values PREDICTED, or per `ar6.tags`.
- **Interactions.** SCENARIO (5 values, interaction 7). Hover or tap a bracket to see `SSP2-4.5 · 2041-2060 · BEST 2.0 °C · VERY LIKELY 1.6 TO 2.5 · RELATIVE TO 1850-1900`.
- **Transition to S07.** The brackets fade, and the squares fall back into the dimmed core's spine (reverse of the detach, 800ms). The first objection card rises.
- **States.**
  - If `ar6.json` fails, the windows show `ASSESSED RANGES UNAVAILABLE` plus RETRY, and the observed column still renders.
  - The baseline control is **locked** in this scene. It shows `1850-1900 (LOCKED: AR6 BASELINE)`, with no toggle.

#### S07 Evidence: how we know (250vh, 7 stepped exchanges)

- **Composition.** The argument stack, with the reference mechanics (diagonal stack; older cards dim and recede).
  - **D:** the stack sits centred-left (x 300-940).
    - Objection cards: `#292929`, header `A SKEPTIC / NOW`.
    - Answer cards: `#F2F2F2` with black text, header `THE RECORD / SINCE 1850`.
    - Answers may embed a mini-visual (max 460x160).
    - The right column (x 1000-1344) holds a mono **receipt** for the current answer: the artifact file name, its `sha256` prefix (8 characters, from `meta.artifact_files`), and the source's `last_modified`.
  - **T:** the stack full width minus 96, with the receipt under it.
  - **M:** full width minus 32, stacked at the bottom. Only the latest 2 cards are visible, and older cards collapse to 8px slivers.
- **The seven exchanges** (copy in section 5):
  1. Urban heat
  2. Two agencies agree?
  3. Why the numbers change
  4. The gaps
  5. Speeding up?
  6. CO2 proof?
  7. How sure is the trend?
- **Mini-visuals:**

| # | Mini-visual |
|---|---|
| 2 | The `agreement.annual.diff_gistemp_minus_hadcrut5` series as 1px bars around a zero line, plus the corr/RMSD numerals |
| 4 | The coverage strip from S02 card 4 |
| 5 | Rolling 30-year slopes (`trends.rolling`) as a light-blue line with its CI as dashed edges |
| 6 | Two small scatters: levels and first differences (`co2.association`), each with its r |
| 7 | Three CI bars (naive / AR(1) / HAC) for the 1975-latest GISTEMP fit, plus the coverage numbers |

- **Data:** `agreement`, `regional`, `ar6`, `trends`, `changepoints`, `co2`, `validation`, `meta`, `facts`.
- **Tags.**
  - 1: per the AR6 value.
  - 2-5: DERIVED.
  - 6: DERIVED, with "association, not attribution".
  - 7: DERIVED, plus the **SIMULATED** chip on the coverage line.
- **Interactions.** The receipt's artifact names link to the GitHub file (`target=_blank rel=noopener`). Tab cycles through the card links.
- **Transition to OBS.** The stack drops away. The core slides to K2 (docked) and the planet returns at OBS geometry.
- **States.** A missing artifact shows `SOURCE UNAVAILABLE` plus RETRY inside that answer card.

#### OBS: The Climate Signal Observatory (100dvh, normal flow, not pinned)

- **Composition (D).**
  - The planet sits at c (560, 470), r 340. **Drag rotates it** (the pointer only; the wheel always scrolls the page, so OBS needs no explore lock).
  - **The docked core K2** (x 1190-1326) is the **year scrubber**:
    - drag or click along its height to set the year
    - a 1px white year line with a 12px square at the left edge, plus the readout `{{year}}` (mono 18px) beside it
    - **click across its width** to select a latitude slice (from the drag start to end, snapped to 2° rows), which outlines the same band on the globe
  - **Top-left:** `THE CLIMATE SIGNAL OBSERVATORY` (mono 13px) plus the serif 44px line "Any year, any place, any zero."
  - **Readout strip** under the title: `{{year}} · {{source}} · {{baseline}} · {{region}} → {{+0.00}} °C · MEASURED {{pct}}%` (the area-weighted mean of the rendered valid cells in the region), plus the current layer's tag chip.
  - **Control rail (top-right of the planet):** square mono buttons in `--surface-glass` with blur 16:
    - VIEW: GLOBE / MAP
    - SOURCE: GISTEMP / HADCRUT5
    - BASELINE: 3
    - LAYER: ANOMALY / TREND / +2 °C / COVERAGE
    - REGION: the 5 `regional.bands` chips plus ALL
    - RESET
  - **Cell inspector** (story-card anatomy, 360x500), entering from the right on a cell click:
    - chip `CELL {{lat}}, {{lon}} · {{source}}` (for example `64°N 22°W`; no place names, because no geocoding is done)
    - the serif title `{{lat}}, {{lon}}`
    - the cell's full annual series under the active baseline as a 312x80 line **broken at missing years** (never joined across a gap)
    - the current year as a white square
    - `VALID YEARS {{n}} OF {{N}}`
    - `TREND SINCE {{start}} {{slope}} ± {{ci}}` (DR-3; hidden if declined)
    - the tag row
- **T.** The planet sits at the top (c 384, 360, r 280). The core is docked vertically at the right (x 640-720). The rail becomes a horizontal scrollable row under the title. The inspector is a bottom sheet (50%).
- **M.**
  - The planet c (195, 330), r 160.
  - The core lies **horizontal** at y 690-750 as the scrubber, with a 44px touch band.
  - A single `LAYERS` square opens a bottom sheet with all controls in 44px rows.
  - The inspector is a bottom sheet (peek 160 / full 80%).
  - Drag-rotate uses single-finger horizontal pans on the globe only (`touch-action: pan-y` on the globe), so vertical page scroll is never captured.
- **Cross-filter contract.**
  - One store holds `{year, source, baseline, layer, view, region (bandId | latRange | null), selectedCell, rotation}`.
  - The globe, core, readout strip and inspector all derive from it through pure selectors.
  - **The readout equals the area-weighted mean of exactly the cells rendered as valid for that filter** (Vitest).
  - For `region = band` and the native baseline, it matches `regional.rows[...].values` to within the DR-4 parity tolerance (Playwright).
- **Layers:**
  - **ANOMALY:** the anomaly bins.
  - **TREND:** DR-3 trend bins with the significance stipple.
  - **+2 °C:** as in S03a.
  - **COVERAGE:** valid cells in white at 30%, missing as the lattice, with the readout `MEASURED AREA {{pct}}%`.
- **MAP view.** The sheet (G2) replaces the sphere with the same cells and no rotation. It is useful for seeing both poles at once. The transition is the unwrap itself, played time-based (1200ms).
- **Data:** all grid and series artifacts, already loaded.
- **Insight.** The visitor's own question, answered with honest coverage.
- **Tags.** Per layer (shown in the readout strip): ANOMALY OBSERVED or DERIVED (rebased), TREND DERIVED, +2 °C DERIVED, COVERAGE OBSERVED.
- **States.**
  - **Empty:** a region and year with no valid cells reads `NO MEASURED CELLS IN {{region}} IN {{year}}`, and the readout shows `n/a` (never 0).
  - **Loading:** per-artifact lines.
  - **Error:** per-artifact RETRY.
  - **Reset:** `RESET VIEW` returns the store to the latest complete year, GISTEMP, 1951-1980, ANOMALY, GLOBE, ALL, no cell, rotation (-30, 15).

#### S08 Conclusion: the return (200vh)

- **Composition.**

| p | What happens |
|---|---|
| 0-0.35 | Scrubbed: the docked core retracts. The strata fall back into one strip, the strip widens into the sheet, and the sheet wraps into the sphere (the S04 unwrap in reverse, compressed). |
| 0.35-0.6 | The planet moves to the centre. Its cells fade, and the Solar halo grows until it is the **G0 orb** again. The planet becomes the orb it came from. |
| 0.4-0.75 | A serif paragraph blur-reveals (D 44px, T 36px, M 28px). |
| 0.75 | **The echo.** The S00 year counter reappears top-right showing `{{facts.latest_complete_year}}`. The orb brightens once (600ms). The caption appears: `{{facts.latest_complete_year}}: {{facts.gistemp_latest_year_anomaly_1951_1980}} °C ABOVE 1951-1980 · GISTEMP v4`. |
| 0.8-1 | The links fade in: `→ OPEN THE OBSERVATORY`, `→ REPLAY THE INTRO`, `→ READ THE METHODOLOGY`, `→ SOURCE CODE`. |

- **Footer** (12px mono, 50% white): sources, `meta.generated_at` and the author.
- **Per viewport.**
  - D: the paragraph sits at the left (x 96-760), and the orb at the right (c 1060, 450).
  - T: the paragraph sits at the top, with the orb below.
  - M: the orb sits at the top (c 195, 220, radius 110), with the paragraph from y 380.
- **Tags.** The caption is OBSERVED.
- **States.** Static if the data is missing: the echo is skipped and the caption hidden. The **closing never uses a horizon arc** (that is P01's closing).

---

## 4. Signature interactions

There are ten interactions. Six are driven by visitor-set analytical parameters (marked P).

| # | Name | Category | P |
|---|---|---|---|
| 1 | Solar Ignition | Cinematic intro transformation | |
| 2 | Year Scrub | Scroll-driven sphere scene | P |
| 3 | Regional Turn | Scroll-driven, stepped sphere scene | P |
| 4 | Provenance Deck | Animated story-card sequence | |
| 5 | The Unwrap | Major data-driven visual transformation (the signature) | P |
| 6 | Zero Lab | User-controlled analytical experiment | P |
| 7 | Assessed Futures | Significant comparison visualisation | P |
| 8 | The Observatory | Significant interactive data visualisation | P |
| 9 | Cell Inspector | Contextual inspection | |
| 10 | The Return | Memorable closing | |

### 1. Solar Ignition (S00)

- **Inputs:** time, plus Skip, Esc and any scroll.
- **State:** `intro: 'playing' | 'done'`, `t` in ms.
- **Permitted values:** t 0..4600.
- **Data:** the DR-1 intro subset, DR-2 coastlines, `facts.latest_complete_year`.
- **Visual output:** the orb glows, contracts into a sphere, and becomes the 1880 planet. The decades run, the latest year lands, and the headline sharpens.
- **Keyboard:** Esc, or Enter on SKIP, finishes. Focus starts on SKIP INTRO.
- **Mobile:** a tap on SKIP, or any touch-scroll, completes it in 350ms.
- **Reduced motion:** the end state renders at once (the latest-year planet at G1, the sharp headline).
- **Text alternative:** a visually hidden paragraph, "Animated introduction: a glowing orb becomes a globe of measured temperature anomalies, running from 1880 to {{year}}. Unmeasured areas are dotted."
- **Test:**
  - Playwright: SKIP is visible at 100ms, and the nav appears within 400ms of the click.
  - The LCP element is `h1[data-hero]`.
  - Under reduced motion, the end state shows in the first screenshot.

### 2. Year Scrub (S03a) [P]

- **Inputs:** scroll progress, BASELINE, SOURCE, `+2 °C CELLS`.
- **State:** `{year (integer), baseline, source, plus2: bool}`.
- **Permitted values:**
  - year: the source's first year to the latest complete year
  - baseline: 3 (1850-1900 only with HadCRUT5)
  - source: 2
- **Data:** `grid_*`, `series_annual`, `co2`, `grid_*.meta`.
- **Visual output:** the anomaly surface for the year (200ms crossfade between integer years) and the readout.
- **Keyboard:** the segmented controls are radio groups. Up/Down on the focused globe step the year.
- **Mobile:** a bottom control row; the baseline list opens upward.
- **Reduced motion:** the track becomes normal flow with 4 static planets (1880, 1940, 1980, latest) in a row on D, 2x2 on T, stacked on M. The controls still redraw all 4.
- **Text alternative:** a visually hidden table of year, global anomaly and rank for the active source and baseline (all years, paginated by decade).
- **Test:**
  - Vitest: the rank under 1991-2020 equals the rank under 1951-1980 for every year, and the readout equals the `series_annual` value.
  - Playwright: selecting HadCRUT5 then 1850-1900 enables that chip, and switching back to GISTEMP snaps to 1951-1980 with the announcement.

### 3. Regional Turn (S03b) [P]

- **Inputs:** scroll thresholds, TREND PERIOD chips, ledger-row clicks, arrow keys, drag.
- **State:** `{state: 1..4, band, period, overridden, rotation}`.
- **Permitted values:** 4 states, 5 bands, 4 periods.
- **Data:** DR-3, `regional`, `trends` (DR-5), `facts`.
- **Visual output:** a 1.2s sphere rotation to the band's face, the band outline, the trend surface, and the ledger.
- **Keyboard:** the globe is a `role="group"`. Left/Right step bands, and the period chips are a radio group.
- **Mobile:** tap the ledger card arrows. Drag rotates.
- **Reduced motion:** the rotation is instant and the title swaps instantly.
- **Text alternative:** the ledger is a real `<ol>` of band, slope, CI and measured share.
- **Test:**
  - Playwright: at p 0.6 (inside state 3), the title is "The least-watched south" both forward and backward.
  - A rapid scroll across all thresholds ends in state 4 with a settled rotation within 1.4s.

### 4. Provenance Deck (S02)

- **Inputs:** scroll, plus the segment tabs.
- **State:** `activeCard 0..3`, `cardProgress 0..1`.
- **Permitted values:** activeCard 0, 1, 2, 3. cardProgress 0..1 (continuous, scrubbed).
- **Data:** `grid_*.meta`, `series_annual.conversions`, `facts`, `meta`.
- **Visual output:** the horizontal deck. Each card's visual animates in on activation: the cell's field rows light up, the two lattices draw, the baseline brackets slide in, and the coverage bars grow from 0.
- **Keyboard:** a tablist.
- **Mobile:** 300px cards.
- **Reduced motion:** a vertical list in normal flow.
- **Text alternative:** the cards are text. The coverage strip carries an `aria-label`, "Measured area rises from {{first}}% in 1880 to {{latest}}% in {{year}}".
- **Test:** Playwright: no card clips at 360x800, and the coverage strip has `n_years` bars.

### 5. The Unwrap (S04) [P]

- **Inputs:** scroll progress, then (after landing) SOURCE, stratum hover/click, and the shared `year` and `baseline` carried in from S03a.
- **State:** `{t: 0..1, phase: 'sphere' | 'sheet' | 'collapse' | 'stratum' | 'core' | 'spine' | 'coverage', source, baseline, year}`.
- **Permitted values:** source 2, baseline 3 (subject to the source rules), year in range.
- **Data:** `grid_*`, DR-4, `validation`, `facts`.
- **Visual output:** a keyed transformation. Every cell keeps its identity from the sphere to the sheet. Each row keeps its identity from the sheet to the strip to the stratum.
- **Keyboard:** the landed core is a `role="slider"` over years (arrows ±1, PageUp/Down ±10).
- **Mobile:** K1-M, with captions in a bottom card.
- **Reduced motion:** 5 static frames (sphere, sheet, strip, core, core plus spine), with the SOURCE control live.
- **Text alternative:** a visually hidden list: "Each year's layer is the average of every measured 2-degree cell in each latitude row," plus a 5-row table of decade-mean zonal anomalies for 5 bands.
- **Test:**
  - Vitest: the client zonal means equal the DR-4 fixture to 1e-6. The spine equals the cos-lat weighted mean of valid cells.
  - Playwright: at p = 0.30, the sheet vertex positions for 3 known points are within 1px of `d3.geoEqualEarth` at the same scale.

### 6. Zero Lab (S05) [P]

- **Inputs:** baseline clamp (3 stops), source, trend handles (from/to), SMOOTH, BREAKS, RESET.
- **State:** `{baseline, source, from, to, smooth, breaks}`.
- **Permitted values:**
  - from/to: integers with `to - from >= 9` inside the source's years
  - smooth: OFF / LOESS
  - breaks: OFF / EXPLORATORY
- **Data:** `series_annual`, `trends`, `changepoints`, the `grid_*` offsets.
- **Visual output:**
  - The re-binned bench and the series re-level (600ms).
  - The trend line and CI wedge (600ms).
  - The result numerals tween, and the invariance check updates.
- **Keyboard:** native-feeling sliders (`role="slider"`), with the chip surrogates for the clamp.
- **Mobile:** a bottom sheet with 44px steppers; the clamp and handles can be dragged.
- **Reduced motion:** values update instantly.
- **Text alternative:** an `aria-live` result sentence (debounced 400ms): "GISTEMP 1975 to 2025: 0.20 °C per decade, 95 percent interval 0.17 to 0.23, autocorrelation-adjusted."
- **Test:**
  - Vitest: the client OLS and AR(1) CI match every `trends.json` fit to 1e-6, and the slope is invariant to the baseline.
  - Playwright: drag the clamp to 1991-2020; the zero label changes, the slope text does not, and RESET restores the defaults.

### 7. Assessed Futures (S06) [P]

- **Inputs:** SCENARIO, plus scroll thresholds for the windows.
- **State:** `{scenario: 'SSP1-1.9' | 'SSP1-2.6' | 'SSP2-4.5' | 'SSP3-7.0' | 'SSP5-8.5', windowsLit: 0..3}`.
- **Permitted values:** 5 scenarios, 0-3 windows.
- **Data:** `ar6`, `series_annual` (HadCRUT5 1850-1900), `facts`.
- **Visual output:** the selected scenario's three brackets at full strength, the others as faint outlines. Colour-to-position (the detach) happens on entry.
- **Keyboard:** a radio group. The brackets are focusable via a hidden list.
- **Mobile:** a snap row.
- **Reduced motion:** instant.
- **Text alternative:** a table of scenario, period, best estimate and very likely range, with a caption giving the page reference.
- **Test:**
  - Vitest: every rendered bracket value equals `ar6.json` exactly, and no polyline connects observed and PREDICTED marks (a scene graph assertion).
  - Playwright: the 1.5 °C callout is visible only when its condition holds.

### 8. The Observatory (OBS) [P]

- **Inputs:** core scrub, latitude slice, drag-rotate, view, source, baseline, layer, region, cell select, reset.
- **State:** the single store (see OBS).
- **Permitted values:**
  - years in range, 5 bands plus a free 2°-row slice plus null
  - 2 views, 2 sources, 3 baselines, 4 layers
  - any valid cell
- **Data:** all artifacts.
- **Visual output:** 200ms year crossfades, the band outline, dimming outside the region, the readout, and the inspector.
- **Keyboard:**
  - The core is a slider: arrows ±1 year, PageUp/Down ±10, Home/End.
  - Shift+Arrows on the core move the latitude slice.
  - The globe is focusable: arrows rotate 10 degrees and Enter opens the inspector for the cell at the centre.
- **Mobile:** the horizontal core scrubber (44px band), the LAYERS sheet, and the inspector sheet.
- **Reduced motion:** instant year and rotation changes.
- **Text alternative:** the readout strip, plus a "Data table for this view" disclosure listing the 5 bands' values for the year.
- **Test:**
  - Playwright: set 1998, HADCRUT5, the northernmost band. The readout equals the a11y-table value, and the band value matches `regional` to within tolerance.
  - A wheel over the globe scrolls the page.

### 9. Cell Inspector (S03a, S03b, OBS)

- **Inputs:** hover (D) or tap (T/M) on a cell.
- **State:** `selectedCell {row, col}` or null (in the store), plus a transient `hoverCell`.
- **Permitted values:** any cell index. Never-valid cells (`reconciliation.cells_never_valid`) open with `NEVER MEASURED IN THIS PRODUCT`.
- **Data:** `grid_*` (the full per-cell series from the loaded grid), DR-3.
- **Visual output:**
  - **Hover:** a tooltip (`#161616`, 200ms) showing `64°N 22°W · 2025 · +2.1 °C · OBSERVED`.
  - **Click:** opens the inspector card.
- **Keyboard:** Esc closes it, and focus returns. The card is a non-modal `role="dialog"`.
- **Mobile:** tap opens the bottom sheet, and a swipe down closes it.
- **Reduced motion:** the card appears without sliding.
- **Text alternative:** the inspector is text. The series line's `aria-label` gives the first and last valid years, the min and max, and the count of missing years.
- **Test:** Playwright: clicking a known cell gives a series length equal to the grid years, and missing years render as gaps (the path has more than one subpath when gaps exist).

### 10. The Return (S08)

- **Inputs:** scroll progress, the threshold at 0.75, and the REPLAY button.
- **State:** `echoPlayed: bool` (reset below 0.73).
- **Permitted values:** echoPlayed true | false.
- **Data:** `facts`.
- **Visual output:** the reverse unwrap, the planet becoming the orb, the counter, the brightening, and the caption.
- **Keyboard:** REPLAY THE INTRO scrolls to the top and replays S00.
- **Mobile:** the same.
- **Reduced motion:** a static orb with the caption.
- **Text alternative:** the caption.
- **Test:** Playwright: the caption is correct at the end. Reverse-crossing 0.75 does not duplicate it.

---

## 5. Copy deck

Rules:

- Serif statements use sentence case. Mono is uppercase.
- Numbers come only from placeholders (section 6).
- (CHECK) claims must be verified against the artifact before build, and use their fallback if the check fails.
- Every °C value is written with its sign and its baseline in view.
- **Shares** in `facts.json` are fractions from 0 to 1 (`unit: share`, for example `0.8265`). They render as whole percents (`83%`), and the conversion lives in one formatter with a Vitest test.
- Copy states only the values present in the 2026-10-10 artifacts: latest complete year 2025, GISTEMP 2025 at +1.185 °C versus 1951-1980, HadCRUT5 2025 at +1.433 °C versus 1850-1900, breaks 1912 / 1942 / 1972. Those values, read at handoff, decided the CHECK branches above. The site always renders the live artifact value, never these numbers.

### S00

- Headline: **"The planet is keeping a record."**
- Top-left: `CLIMATE SIGNAL OBSERVATORY`. Top-right: the year counter.
- Note: `CELLS = GISTEMP v4, 2° ANNUAL MEANS VS 1951-1980. DOTS = NOT MEASURED.`
- Buttons: `SKIP INTRO`, `REPLAY INTRO`.

### S01

- Statement: **"Every cell on this sphere is a measurement, or an honest gap."**
- Cards: as in S01 above.

### S02

1. Chip `RECORD 01 · THE CELL`.
   - Title: **"A cell, not a thermometer."**
   - Body: `STATIONS ON LAND AND SHIPS AND BUOYS AT SEA, BLENDED BY NASA INTO 2° SQUARES. EACH SQUARE HOLDS ONE NUMBER PER YEAR: HOW MUCH WARMER OR COOLER IT WAS THAN ITS OWN 1951-1980 NORMAL.`
2. Chip `RECORD 02 · TWO AGENCIES`.
   - Title: **"Two agencies, two methods."**
   - Body: `NASA GISTEMP: 2° SQUARES FROM 1880. MET OFFICE HADCRUT5: 5° SQUARES FROM 1850. DIFFERENT METHODS, DIFFERENT GAPS. WE SHOW BOTH AND WHERE THEY DISAGREE.`
3. Chip `RECORD 03 · THE ZERO`.
   - Title: **"Every anomaly needs a zero."**
   - Body: `MOVING THE ZERO FROM 1951-1980 TO 1991-2020 SUBTRACTS {{facts.baseline_offset_1951_1980_to_1991_2020_gistemp}} °C FROM EVERY GISTEMP YEAR. THE WARMING TREND DOES NOT CHANGE.`
4. Chip `RECORD 04 · THE GAPS`.
   - Title: **"Gaps stay gaps."**
   - Body: `IN 1880, {{facts.gistemp_valid_area_share_first_year}}% OF THE SURFACE HAD A VALUE IN NASA'S RECORD, MOSTLY THANKS TO 1200 KM SMOOTHING. IN {{facts.latest_complete_year}}, {{facts.gistemp_valid_area_share_latest_year}}%. THE GAPS SIT AT THE POLES. WE NEVER FILL A MISSING SQUARE. IT STAYS DOTTED.`

### S03a

- Statement: **"The planet, one year at a time."**
- Body: `EACH SQUARE IS 2° OF SURFACE. ORANGE IS WARMER THAN THE CHOSEN NORMAL, BLUE IS COOLER, DOTS WERE NOT MEASURED.`
- Readout: `{{year}}` / `GLOBAL {{value}} °C VS {{baseline}}` / `RANK {{k}} OF {{n}} COMPLETE YEARS` / `CO2 {{ppm}} PPM · MAUNA LOA`.

### S03b

- Statement: **"Warming is not spread evenly."**
- State titles and bodies:
  1. **"The far north"**: `{{band.label}} HAS WARMED ABOUT {{facts.arctic_to_global_trend_ratio_1975_latest}} TIMES AS FAST AS THE GLOBE SINCE 1975.` (CHECK: at least 2, else **"The fastest-warming band"** with `{{band.label}}: {{slope}} °C PER DECADE SINCE 1975.`)
  2. **"Land and sea"**: `LAND WARMS FASTER THAN THE OCEAN. IPCC AR6: LAND {{ar6_land}} °C, OCEAN {{ar6_ocean}} °C ABOVE 1850-1900 IN 2011-2020.` (CHECK: the DR-5 gap is above 0, else `LAND AND OCEAN, SIDE BY SIDE: ...`.)
  3. **"The least-watched south"**: `THE FAR SOUTH WAS BARELY MEASURED UNTIL {{facts.south_band_first_year_valid_share_ge_50pct}}. LEAST KNOWN IS NOT LEAST WARMING.`
  4. **"Nowhere is cooling"**: `EVERY LATITUDE BAND HAS WARMED SINCE 1975.` (CHECK: `facts.band_trends_all_positive_1975_latest`, else **"Not everywhere at once"** with `{{n}} OF 5 BANDS HAVE WARMED SINCE 1975 BEYOND THEIR UNCERTAINTY.`)

### S04

- Statement 1: **"Unwrap the planet and it becomes a record."**
- Statement 2 (spine), depending on the value of `facts.years_since_2010_in_gistemp_top10`:
  - 10: **"The ten warmest layers all came after 2010."** (the value in the 2026-10-10 artifacts)
  - 5-9: **"{{n}} of the ten warmest layers came after 2010."**
  - 4 or less: **"The warmest layers are on top."**
- Phase captions: `1 · 16,200 SQUARES`, `2 · UNWRAPPED, EQUAL AREA`, `3 · EACH ROW AVERAGED`, `4 · ONE YEAR = ONE LAYER`, `5 · {{n}} LAYERS, OLDEST AT THE BOTTOM`.
- Footnote: as in S04 above.

### S05

- Statement: **"Choose your zero."**
- Body: `DRAG THE CLAMP TO CHANGE WHAT COUNTS AS NORMAL. DRAG THE HANDLES TO MEASURE A TREND. WATCH WHAT MOVES AND WHAT DOESN'T.`
- Result and naive lines: as in S05 above.
- Breaks caption: `EXPLORATORY: THE BEST-FITTING BENDS IN THE LINE, NOT A TEST FOR ACCELERATION.`

### S06

- Statement (window 1): **"The first assessed window has already begun."**
- Statement (window 2): **"After that, the choice of path matters."**
- Statement (window 3): **"By 2081-2100, the paths are far apart."**
- Chip: `PREDICTED · IPCC AR6 ASSESSED RANGES, NOT OUR PROJECTION`.
- Conditional callout: **"One year above 1.5 °C is not a 20-year mean above it."**
- Source line: `IPCC AR6 WG1 SPM TABLE SPM.1 (PRINTED PAGE {{ar6.source.page_printed}}). VERY LIKELY RANGE = 90-100% PROBABILITY. RELATIVE TO 1850-1900.`

### S07 Evidence (objection, then answer)

1. `CITIES ARE HOTTER. ISN'T THIS JUST URBAN HEAT?` / `THE OCEAN HAS NO CITIES AND IT WARMED TOO: +{{ar6.observed_published[ocean].best_estimate_c}} °C ({{low}} TO {{high}}) IN 2011-2020 VS 1850-1900, AS ASSESSED BY THE IPCC.`
2. `DO THE TWO AGENCIES EVEN AGREE?` / `YEAR TO YEAR, CORRELATION {{facts.gistemp_hadcrut5_annual_corr}}, TYPICAL GAP {{facts.gistemp_hadcrut5_annual_rmsd}} °C. THEIR LONG-RUN TRENDS DIFFER BY {{facts.gistemp_hadcrut5_trend_gap_1880_latest}} °C PER DECADE. WE SHOW THE DISAGREEMENT, NOT AN AVERAGE.`
3. `THE NUMBER WAS DIFFERENT LAST TIME I LOOKED.` / `TWO REASONS. THE ZERO: EVERY ANOMALY IS RELATIVE TO A CHOSEN PERIOD, AND WE NAME IT EVERYWHERE. THE VINTAGE: AGENCIES REVISE PAST MONTHS. THIS SITE USES FILES DATED {{meta.sources.gistemp.last_modified}}.`
4. `WHAT ABOUT THE PLACES NOBODY MEASURED?` / `{{facts.gistemp_missing_cells_total_share}}% OF ALL SQUARE-MONTHS IN NASA'S GRID ARE MISSING. THEY STAY MISSING. AVERAGES USE MEASURED SQUARES ONLY, AND THE MEASURED SHARE IS ALWAYS SHOWN.` (CHECK: the fact's `note` confirms it counts cell-months, else say `SQUARES`.)
5. `IS IT SPEEDING UP?` / `EXPLORATORY ONLY: THE BEST PIECEWISE FIT BENDS AT {{facts.changepoint_gistemp_selected_breaks}}. ROLLING 30-YEAR TRENDS ARE SHOWN WITH THEIR UNCERTAINTY. THIS IS NOT A FORMAL TEST FOR ACCELERATION.`
6. `CO2 AND TEMPERATURE RISE TOGETHER. ISN'T THAT PROOF?` / `NO. TWO RISING LINES CORRELATE ({{facts.co2_temperature_corr_levels}}) EVEN WITHOUT A LINK. YEAR-TO-YEAR CHANGES CORRELATE {{facts.co2_temperature_corr_first_differences}}. ASSOCIATION, NOT ATTRIBUTION. ATTRIBUTION COMES FROM PHYSICS, AS ASSESSED IN IPCC AR6.`
7. `HOW SURE IS THAT TREND?` / `NEIGHBOURING YEARS ARE NOT INDEPENDENT, SO A NAIVE INTERVAL IS TOO NARROW: ±{{facts.trend_gistemp_1975_latest_naive_ci_halfwidth}} NAIVE VERSUS ±{{facts.trend_gistemp_1975_latest_ar1_ci_halfwidth}} ADJUSTED, °C PER DECADE. IN A SIMULATION WITH KNOWN ANSWERS, THE ADJUSTED INTERVAL COVERED THE TRUTH {{validation.trend_ci_simulation.coverage_ar1}} OF THE TIME.` (The simulation line carries a SIMULATED chip.)

### OBS

- Title (mono): `THE CLIMATE SIGNAL OBSERVATORY`.
- Line (serif): **"Any year, any place, any zero."**
- Hint (13px): `DRAG THE CORE TO MOVE THROUGH TIME. DRAG ACROSS IT TO PICK LATITUDES. DRAG THE GLOBE TO TURN IT. SELECT A SQUARE TO INSPECT IT.`

### S08

- Paragraph: **"The planet doesn't speak in words. It speaks in small numbers, written every year, everywhere we look. Some of those numbers are missing. None of them are made up."**
- Caption: as in S08 above.
- Links: `→ OPEN THE OBSERVATORY`, `→ REPLAY THE INTRO`, `→ READ THE METHODOLOGY`, `→ SOURCE CODE`.
- Footer: `DATA: NASA GISS GISTEMP v4 · MET OFFICE HADCRUT5 5.2.0.0 (OPEN GOVERNMENT LICENCE v3) · NOAA GML CO2 · IPCC AR6 WG1 SPM TABLE SPM.1 · COASTLINES: NATURAL EARTH · GENERATED {{meta.generated_at}} · RISHIT MATHUR`.

---

## 6. Placeholder bindings and data requests

### 6.1 Bindings

EXISTS means the value is in a contracted artifact today. DR means a data request is needed.

| Placeholder | Source | Status |
|---|---|---|
| `facts.latest_complete_year`, `gistemp_latest_year_anomaly_1951_1980`, `co2_mlo_latest_ppm`, `co2_mlo_latest_month` | `facts.json` | EXISTS |
| `facts.baseline_offset_1951_1980_to_1991_2020_gistemp` | `facts.json` | EXISTS |
| `facts.gistemp_valid_area_share_first_year`, `_latest_year`, `gistemp_missing_cells_total_share` | `facts.json` | EXISTS |
| `facts.years_since_2010_in_gistemp_top10` | `facts.json` | EXISTS |
| `facts.hadcrut5_latest_year_anomaly_1850_1900` | `facts.json` | EXISTS |
| `facts.gistemp_hadcrut5_annual_corr`, `_rmsd`, `_trend_gap_1880_latest` | `facts.json` | EXISTS |
| `facts.co2_temperature_corr_levels`, `_first_differences` | `facts.json` | EXISTS |
| `facts.trend_gistemp_1975_latest_naive_ci_halfwidth`, `_ar1_ci_halfwidth` | `facts.json` | EXISTS |
| `facts.changepoint_gistemp_selected_breaks` | `facts.json` | EXISTS |
| Year readout global value, rank | `series_annual.series[id].values[baseline]`; rank derived client-side | EXISTS |
| Cell values, rebasing | `grid_*.i8.bin.gz` plus `grid_*.meta.json` `baseline_offsets` | EXISTS |
| Measured area per year | `grid_*.meta.json` `valid_area_share_per_year` | EXISTS |
| CO2 per year | `co2.mlo_annual_ppm`, `co2.annual_years` | EXISTS |
| HadCRUT5 stipple band | `series_annual` `ci_lo` / `ci_hi` | EXISTS |
| LOESS and band, rolling slopes, published trend fits | `trends.json` | EXISTS |
| Break fit and break CI | `changepoints.json` | EXISTS |
| Agreement diff series | `agreement.json` | EXISTS |
| AR6 rows, observed published and derived 20-year means, page refs | `ar6.json` | EXISTS |
| Band values and measured share | `regional.json` | EXISTS (band edges: DR-7) |
| Spine footnote max diff | `validation.grid_vs_official_global.gistemp.max_abs_diff` | EXISTS |
| CI-coverage simulation | `validation.trend_ci_simulation.coverage_ar1` | EXISTS |
| Receipt hashes, file dates | `meta.artifact_files`, `meta.sources.*.last_modified` | EXISTS |
| Intro subset | **DR-1** | DR |
| Coastlines | **DR-2** | DR |
| Cell trend surface and significance | **DR-3** | DR |
| Zonal rule and parity fixture | **DR-4** | DR |
| Band trends and S03b facts | **DR-5** | DR |
| `ar6.observed_published` ocean/land lookup by `quantity` | `ar6.json` (`observed_published[].quantity`) | EXISTS |

### 6.2 Data requests

**Status at handoff (2026-10-10).** I checked this against the data agent's work in progress, not against committed artifacts:

- **Implemented in the working tree** (`pipelines/modeling/build.py`, `analytics/zonal.py`, `analytics/geo.py`), but not yet committed: DR-1 (decadal intro grid), DR-2 (coastlines), DR-3 (cell trend grids), DR-4 (`analytics/zonal.py` with `MIN_ROW_VALID = 0.20`, plus a zonal fixture), DR-5 (band series in `trends.json`), DR-7 (band edges at multiples of 10 degrees) and DR-9 (land fraction).
- **Resolved by the published artifacts:** DR-8. `trends.periods` = 1850 / 1880 / 1900 / 1951 / 1975 / 1991 to 2025.
- **Still open:** DR-6, DR-10, and the four S03b `facts` keys in DR-5. The frontend must re-check all of these against the committed artifacts.

| ID | Request | Why the design needs it | Size |
|---|---|---|---|
| DR-1 | `grid_gistemp_2deg_intro.i8.bin.gz` plus a sidecar: the same encoding as the full grid, years {1880, 1890, ..., 2020, latest complete} only, with their layer years listed | S00 must run its year sweep without waiting for the 0.6 MB full grid (the LCP and TBT budget) | about 70-90 KB gz |
| DR-2 | `coastlines_110m.json`: Natural Earth 110m coastline as flat lon/lat arrays (polyline starts plus a Float32-friendly coordinate list), with a `meta.sources` entry (public domain) | Coastline context on the sphere and sheet. It is unwrapped by the same vertex blend | 60 KB gz or less |
| DR-3 | `grid_trends_gistemp_2deg.i8.bin.gz` (and HadCRUT5 5°): per cell, for each `trends.periods` id used by the chips (1880 / 1951 / 1975 / 1991 to latest), the OLS slope in 0.01 °C/decade Int8 (-128 = insufficient data, min-valid-years rule stated), plus a parallel significance mask (AR(1)-adjusted 95% CI excludes 0) | S03b surface, OBS TREND layer, inspector trend. Significance must come from tested Python, not TS. **Fallback if declined:** the client computes the OLS slope only (with a parity fixture), and the stipple and significance copy are removed | about 4 x 16 KB gz |
| DR-4 | A Python reference function plus the fixture `zonal_fixture.json`: for 3 years x 3 baselines x both sources, the per-row (latitude) mean of valid cells with the **20% valid-cells rule**, the row valid share, and the cos-lat area-weighted global grid mean | The core's strata and spine are computed in the browser from the loaded grid. The rule must be defined once, in tested Python, and mirrored by a Vitest parity test | 20 KB or less |
| DR-5 | Add the 5 `regional.bands` series (and land-only versus land-ocean) to `trends.json` for the standard periods, plus `facts`: `arctic_to_global_trend_ratio_1975_latest`, `land_minus_landocean_gap_latest_decade`, `south_band_first_year_valid_share_ge_50pct`, `band_trends_all_positive_1975_latest` (bool, CI lower bound above 0) | The S03b ledger and its four (CHECK) claims | small |
| DR-6 | `facts.latest_year_rank_gistemp` (and the HadCRUT5 equivalent), and the `ar6` observed-published entries for land and ocean exposed as facts | S03a default readout on first paint and S07 answer 1, without client lookup | tiny |
| DR-7 | `regional.bands` edges that fall on **both** grids' cell boundaries (multiples of 10 degrees, for example 90-60N, 60-30N, 30N-30S, 30-60S, 60-90S), with ids and labels | Band outlines on the globe must coincide with whole cells on 2° and 5° grids, or the outline would cut cells and the readout would not equal the rendered cells | n/a |
| DR-8 (resolved) | Confirm `trends.periods` includes 1880, 1951, 1975 and 1991 to latest. Confirmed: `1850_latest`, `1880_latest`, `1900_latest`, `1951_latest`, `1975_latest`, `1991_latest` | The S03b period chips and the S05 trend parity fixtures use these ids | n/a |
| DR-9 (optional) | Land fraction per 2° cell (Natural Earth 110m land, rasterized, Int8 0-100) | Enables LAND / OCEAN regions in OBS. If declined, OBS offers latitude bands only and land/ocean stays a series comparison in S03b | 10 KB gz or less |
| DR-10 (optional) | The current partial year's YTD mean and month count per source in `facts` (`gistemp_ytd_{{year}}_mean_1951_1980`, `gistemp_ytd_months`) | The hollow `YTD` marker above the core. If declined, the marker is omitted | tiny |

---

## 7. Hard rejection criteria

I fail the build on review if any of these is true:

1. **Any section reads as a dashboard.** That means a KPI tile row, a framed chart with gridlines and a default legend, a fixed filter sidebar, or a gradient legend box. OBS fails if its controls form a sidebar instead of the floating rail plus the core scrubber.
2. **Any ring, chord or dial appears:** a ring of marks, a year ring, lines between places, marks on the globe's limb, a radial time axis, or a rising horizon arc. Those belong to P01, P04 and P07, and their appearance is an automatic redesign.
3. **A missing cell is drawn as a colour,** interpolated, or filled from neighbours, or neutral (±0.2 °C) is indistinguishable from missing in a screenshot. Similarly, a value is shown at a fractional year, or a texture is sampled with LINEAR filtering.
4. **An uncertainty is drawn like an observation:** the HadCRUT5 range as a solid fill, a trend CI without dashed edges, or an AR6 range without hatch and the PREDICTED chip. **Any line joins observed values to PREDICTED windows.**
5. **Any number on screen is not bound** to a contracted field or a DR (section 6), or a (CHECK) claim ships without its check.
6. **A baseline is not named** next to any °C value, or GISTEMP is shown on 1850-1900, or rebased values carry an OBSERVED chip.
7. **The S05 slope changes when only the baseline changes,** or the client trend fails parity with `trends.json`.
8. **The headline LCP is later than 2.5s,** or the hero text starts at opacity 0, or the grid fetch blocks first paint.
9. **Any pinned scene traps the visitor:** reverse or rapid scroll stalls, a nav jump lands on a half-built core, or globe drag captures the wheel or vertical touch scroll.
10. **Mobile is a reflow of desktop.** The M planet-above-headline intro, the M core sizes, the horizontal OBS core scrubber and the S05 bottom sheet must be visibly different compositions, and T must differ from both.
11. **The unwrap is not keyed:** cells cross-fade instead of travelling, rows teleport, or the sheet is more than 1px from `d3.geoEqualEarth` at the parity points.
12. **Two consecutive scenes look the same** in the contact sheet. In particular, S03a and S03b must differ (anomaly versus trend surface, band outline and ledger) and so must S04 and S05 (vertical core versus horizontal bench plus series).
13. **A control does nothing** or changes unrelated values. RETRY doesn't refetch, RESET doesn't restore, or a disabled baseline is silently applied.
14. **Text contrast fails:** `#192CE4` used as text or line, 50% white under 13px, or data colours used for body text.
15. **Any reference asset is used:** Blink fonts, wordmark styling, copy, images or video. The ring dial is also out of bounds (see criterion 2).
16. **No visible tag** on a data visual, SIMULATED appears outside S07 answer 7, or the CO2 statement lacks "association, not attribution".
17. **The closing doesn't return to the opening orb** (the same Solar orb, the same year counter).
18. **A U+2014 or U+2015 dash appears** in the site copy.
