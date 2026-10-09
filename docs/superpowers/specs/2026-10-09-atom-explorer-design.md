# Atom Explorer — design spec (2026-10-09)

Interactive 3D atom explorer in the browser. Pick an element (Z=1..36), see its
nucleus and electron orbitals as a 3D probability cloud, glow cloud, or
isosurface. Single-orbital mode lets you pick n, l, m directly.

This spec is derived from the user's prompt (`docs/requirements.md`) and records
the design decisions that prompt leaves open. Where they differ, the prompt wins.

## Assumptions taken (open questions in the prompt)

- Element range: Z=1..36 for v1. Data types and configuration generator must not
  block extension to 118, but no f-block work is done now.
- First load: lit spheres on a white background, single-orbital 3d (n=3,l=2,m=0)
  so the hero look is visible immediately. Element view opens when an element is
  clicked.
- Live GTAO only; no path tracer.
- All code original; element data typed by hand; colormap tables from the CC0
  matplotlib colormaps.

## Architecture

```
src/
  physics/        pure, framework-free, unit tested
    laguerre.ts     associated Laguerre L^alpha_k(x)
    legendre.ts     associated Legendre P_l^m(x), m>=0
    radial.ts       R_nl(r; Z) hydrogenic, normalized
    harmonics.ts    real and complex Y_lm
    wavefunction.ts psi(r,theta,phi) for an Orbital {n,l,m,Z,real}
    slater.ts       Slater's rules Z_eff per subshell
    configuration.ts Madelung + exceptions, shells, valence
    elements.ts     typed table Z=1..36
    sampling.ts     inverse-CDF point sampler
    grid.ts         3D density grid + enclosure threshold
    marchingCubes.ts
    colormaps.ts    inferno / magma / viridis LUTs
    extent.ts       grid/sample extent per orbital
  worker/
    orbital.worker.ts   message handler: sample | grid
    protocol.ts         request/response types
    client.ts           promise wrapper, cache, cancellation
  render/
    scene.ts        renderer, camera, controls, lights, composer, theme
    sphereCloud.ts  InstancedMesh cloud
    glowCloud.ts    Points cloud + bloom
    isosurface.ts   marching-cubes mesh
    overlays.ts     nucleus, axes, slice plane
    bohr.ts         flat shell view
    still.ts        high-quality PNG render
  ui/
    periodicTable.ts  HTML grid
    controls.ts       lil-gui panel
    infoPanel.ts
    radialPlot.ts     canvas plot of r^2 R^2
    sliceInset.ts     2D heatmap canvas
    urlState.ts       ?Z=26&mode=iso&n=3&l=2&m=0...
  state.ts          single AppState + change events
  main.ts           wiring
```

Data flow: UI changes `AppState` -> `main.ts` derives the list of orbitals to
show -> worker client returns typed arrays (cached) -> render layer builds or
updates GPU objects -> composer renders. Physics never imports three.

## Physics decisions

- Hydrogenic psi_nlm = R_nl(r) Y_lm(theta,phi), atomic units (a0 = 1).
  R_nl(r) = sqrt((2Z/n)^3 (n-l-1)! / (2n (n+l)!)) e^{-rho/2} rho^l L^{2l+1}_{n-l-1}(rho),
  rho = 2Zr/n. (Griffiths, Intro to QM, eq. 4.89; Laguerre convention of
  Abramowitz & Stegun 22.3.9 where L^a_k has leading coefficient (-1)^k/k!.)
- Real spherical harmonics: for m>0 sqrt(2) N P_l^m cos(m phi), m<0 sqrt(2) N
  P_l^|m| sin(|m| phi), m=0 N P_l^0; Condon-Shortley phase omitted so px, py, pz
  are all positive along their axes. Complex toggle uses N P_l^|m| e^{i m phi}
  and renders |psi|^2 with phase mapped to hue in sphere mode. m is interpreted as
  the real-orbital index in real mode (standard naming: m=0 -> z-type, m=+1 ->
  x-type, m=-1 -> y-type, etc.).
- Multi-electron: hydrogenic R_nl with Z_eff from Slater's rules (1930), using the
  true principal quantum number n, not Slater's n*. Reason: keeps radial nodes
  (n-l-1), which the spheres mode relies on for visible gaps, and keeps the
  normalization tests valid. Documented in the UI info panel and README.
- Configurations: Madelung order with an exceptions table {24: Cr, 29: Cu} for
  Z<=36 (plus 41,42,44,45,46,47,78,79 entries ready for later). Shell counts
  are per n. Valence = electrons in the highest n plus any partially filled
  d subshell of n-1.
- A subshell with e electrons in 2l+1 real orbitals is filled Hund-style (one
  per orbital, then pairing) in the m order 0, +1, -1, +2, -2. The subshell
  cloud samples each occupied orbital with points proportional to its
  occupancy. A full subshell is therefore spherically symmetric, which is
  physically correct.

## Sampling and meshing

- Radial: table of r^2 R^2 on 4096 points from 0 to r_max (r_max from extent.ts),
  cumulative sum -> inverse CDF with linear interpolation.
- Angular: |Y_lm|^2 on a (cos theta, phi) grid of 256 x 256, marginal CDF in
  cos theta, conditional CDF in phi per row, each inverse-sampled with linear
  interpolation. Jitter within the cell to avoid banding.
- Output per point: position xyz (Float32Array 3N) and the signed value psi at
  that point (Float32Array N). sign(psi) gives the phase color; psi^2 gives the
  density for the glow colormap. For complex mode the worker also returns the
  phase angle.
- Extent: r_max = 2.5 n^2 / Z_eff, then grown by 25% steps until the radial CDF
  inside r_max exceeds 0.995. Grid box is [-r_max, r_max]^3.
- Isosurface: grid of |psi|^2 (default 96^3). Threshold found by sorting cell
  densities (or histogram with 1024 bins) so that cells above the threshold
  hold the chosen fraction of total probability. Marching cubes written from
  Lorensen & Cline (1987) with the standard edge/triangle tables (Bourke, public
  domain). Positive and negative lobes split by the sign of psi at the vertex.
- Worker: one Web Worker, request ids, latest-request-wins per render target.
  Results cached in the main thread keyed by (Z_eff, n, l, m, real, N | grid).
  Preview: N=5000 request first, then full N. Transferables throughout.

## Rendering

- `THREE.WebGLRenderer({ antialias: true })`, pixel ratio capped at 2,
  `EffectComposer` -> `RenderPass` -> (`GTAOPass` | `UnrealBloomPass`) ->
  `OutputPass`. Only built-in materials.
- Sphere cloud: `InstancedMesh(IcosahedronGeometry(1, detail), MeshStandardMaterial
  {roughness 0.6, metalness 0})`, detail 2 below 50k instances, 1 above. Instance
  matrices written directly into `instanceMatrix.array`; per-instance colors via
  `instanceColor` attribute written directly. Two shades per subshell color
  (light for psi>0, dark for psi<0). Lights: HemisphereLight + DirectionalLight.
  GTAO radius scaled to a few sphere diameters. Half-resolution AO while
  orbiting, full when idle.
- Glow cloud: `Points(BufferGeometry, PointsMaterial{ vertexColors, map:
  radial-sprite canvas, transparent, blending: AdditiveBlending, depthWrite:
  false, sizeAttenuation: true })`. Color = LUT(gamma(psi^2 / maxDensity)).
  Opacity scaled by 1/sqrt(N). Bloom strength/threshold sliders. Black
  background, fog matching.
- Isosurface: `Mesh(BufferGeometry, MeshPhysicalMaterial{ transparent, opacity 0.75,
  side DoubleSide })` x2 (positive and negative).
- Element view: one cloud object per toggled subshell, combined into a group.
- Disposal: every render object has `dispose()`; swapping orbitals disposes the
  previous; `renderer.info.memory` is exposed in the GUI for checking.
- Still render: temporarily raise pixel ratio to 2x, request a high-N sample,
  raise AO strength, optional BokehPass, render once, `toDataURL`, download, restore.

## UI

- Periodic table: HTML grid 18 columns, blocks colored, Z=1..36 clickable,
  37+ rendered disabled.
- lil-gui panel: mode (spheres | glow | iso), N, sphere radius, AO toggle,
  bloom, colormap, exposure, iso level, grid size, dark theme, overlays
  (nucleus, axes, slice, radial plot, Bohr), valence only, complex toggle,
  Render still button, single-orbital n/l/m.
- Side panel: info, subshell list with toggles and color swatches, radial plot,
  slice inset.
- URL state: `?Z=26&mode=iso&n=3&l=2&m=0&single=1&N=50000&theme=dark`.
- Keyboard: 1/2/3 modes, R reset camera, S still, B Bohr, D dark.

## Testing

Vitest on `src/physics/`:
- Laguerre and Legendre against known closed forms.
- R_nl: R_10(0) = 2 Z^1.5; integral r^2 R^2 dr = 1 to 1e-3 (Simpson); n-l-1
  sign changes in (0, r_max).
- Y_lm: integral |Y|^2 over the sphere = 1; orthogonality for a few pairs;
  l angular nodes (sign changes along a meridian/parallel as appropriate).
- Full |psi|^2 normalization via 3D product quadrature for a few orbitals.
- Slater Z_eff: known values (C 2p 3.25, Fe 3d 6.25, Fe 4s 3.75, Na 3s 2.20).
- Configurations Z=1..36 against a hard-coded list; shell counts; valence.
- Sampler: for 200k samples the empirical radial mean of 1s matches 1.5/Z
  within 1%; symmetry of the 2pz cloud about z.
- Marching cubes: a sphere SDF produces a closed surface with area within 3% of
  4 pi r^2.
- Grid threshold: enclosed fraction equals the requested fraction within 1%.

## Performance

Targets as in the prompt: 60 fps with 50k spheres + AO and 300k glow points +
bloom on a mid-range discrete GPU; <300 ms to first preview; no GPU memory
growth after 50 orbital switches.

## Milestones

1. Physics library + tests.
2. Single-orbital viewer: worker, sphere cloud + GTAO, then glow cloud + bloom.
3. Isosurface.
4. Periodic table + element view.
5. Radial plot, slice, Bohr, info panel.
6. Polish: layout, shortcuts, URL state, README.
