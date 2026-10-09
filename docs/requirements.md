# Requirements (from the user's prompt, 2026-10-09)

See the conversation prompt; the authoritative version is the design spec in
`docs/superpowers/specs/2026-10-09-atom-explorer-design.md`, which restates every
requirement plus the decisions taken. Handoff notes copied verbatim:

- Scaffold: `npm create vite@latest atom-explorer -- --template vanilla-ts`, then `npm i three@0.186.1 lil-gui@0.21.0 && npm i -D @types/three@0.186.0 vitest@5.0.3`. Keep `typescript@~6.0` as the template pins (checked 2026-10-09).
- 3D look: `THREE.InstancedMesh` of `IcosahedronGeometry` spheres + `MeshStandardMaterial`, hemisphere + directional light, `GTAOPass` then `OutputPass` via `EffectComposer` (all in three 0.186.1). Target 50k spheres at 60 fps.
- Glow look: `THREE.Points` + `PointsMaterial` (vertexColors, canvas radial sprite, `AdditiveBlending`, `depthWrite:false`), color = inferno LUT of normalized |psi|^2, then `UnrealBloomPass` + `OutputPass`. Target 300k points at 60 fps.
- Renderer: `THREE.WebGLRenderer` with built-in materials only (no `ShaderMaterial`), so a later swap to `three/webgpu`'s `WebGPURenderer` is a small change. WebGPU on Linux is Chrome-only and driver-dependent as of 2026-05.
- Physics: hydrogenic psi_nlm = R_nl * Y_lm in atomic units, Z_eff from Slater's rules, configurations from Madelung plus an explicit exceptions list; all in `src/physics/` with Vitest tests.
- Sampling/meshing in a Web Worker: inverse-CDF point sampling and a 96^3 grid with marching cubes at a 90% enclosure isosurface; transfer Float32Arrays.
- Licenses: don't vendor CC BY-SA element JSON or GPL (PhET) code; ask before any new dependency.
- Performance: 60 fps orbiting with 50k lit spheres + AO and 300k glow points + bloom on a mid-range discrete GPU; 30 fps on a laptop iGPU. First preview within 300 ms. No GPU memory growth after 50 switches.
- Rules: physics pure in src/physics/; every formula cites a source; no runtime network calls.
