# Aethelgard Sanctuary

**Aethelgard Sanctuary** is an interactive 3D floating fantasy island diorama built with Next.js, React, Three.js, and React Three Fiber. Explore a handcrafted procedural miniature world suspended in an atmospheric sky—complete with smooth Golden Sunset to Starry Aurora Night lighting transitions, curated camera viewpoints, and a procedural ambient nature soundscape.

---

## Features

### Multi-Tiered Floating Island Diorama
- **Sculpted Terrain & Cliff Underside**: Multi-tiered mossy plateaus carved by a winding stream gorge, supported by jagged stratified rock cliffs, glowing underside mana crystals, swaying hanging ivy vines, and five orbiting satellite rock islets.
- **Wizard's Observatory Tower**: Composite stone-and-timber architecture featuring a stepped octagonal plinth, stone buttresses, arched oak doorway with a warm hanging lantern, timber balcony with a brass telescope, glowing leaded stained-glass windows, side library turret, drifting chimney wisps, and a crowning counter-rotating brass astrolabe.
- **Glowing Turquoise Stream, Waterfall & Bridge**: Custom GLSL animated water with scrolling caustics spilling off the southern cliff lip into billowing mist plumes, spanned by an arched cobblestone bridge with keystones and hanging lanterns.
- **Living Flora & Atmosphere**: Sculpted cherry blossom trees with gently fluttering sakura petals, giant bioluminescent mushrooms, moss-draped boulders and ancient runestones, instanced meadow grass and wildflowers, drifting sculpted cloud banks, golden fireflies, and rising mana particles.

### Golden Sunset & Starry Aurora Night
- Smooth exponential transitions morph the entire world between a warm **Golden Sunset** and a luminous **Starry Aurora Night**—animating the custom GLSL sky dome, aurora borealis curtains, a dense twinkling starfield, 3-point lighting, horizon-matched fog, glowing stained-glass windows, lanterns, mushrooms, and fireflies.

### Procedural Ambient Soundscape
- Synthesized entirely with the Web Audio API (no external audio files required), blending high-altitude wind, flowing turquoise stream and distant waterfall murmur, and reverberant wind/crystal chimes.
- Automatically crossfades between a warm sunlit soundscape in **Golden Sunset** and an ethereal aurora pad with celestial chimes and soft nocturnal ambience in **Aurora Night**.

### Server-Side Gemini API Ready
- Includes a server-only Gemini helper and a validated `POST /api/gemini` route reading `process.env.GEMINI_API_KEY` exclusively on the server, keeping API keys out of browser bundles and client code.

---

## Interactive Controls

| Control / Input | Action |
| :--- | :--- |
| **Mouse Drag** | Smoothly orbit 360° around the floating island with inertial damping |
| **Scroll Wheel** | Zoom smoothly in and out within bounded distances |
| **Golden Sunset / Aurora Night** | Toggle between sunset and aurora night lighting, sky, glow, and soundscape |
| **Sanctuary / Observatory / Bridge / Waterfall** | Smoothly glide the camera to curated landmark viewpoints (dragging immediately returns manual control) |
| **Orbit** | Toggle gentle automatic turntable orbiting |
| **Sound** *(or press `M`)* | Toggle the procedural ambient nature soundscape on or off |
| **Hide / Controls** *(or press `H`)* | Collapse or expand the bottom control dock for an unobstructed full-screen view |

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm (or Bun)

### Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to explore the sanctuary.

### Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the Next.js development server on port 3000 |
| `npm run build` | Build the production bundle |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint checks across the codebase |

### Environment Variables
Copy `.env.example` to `.env.local` if you plan to use the server-side `/api/gemini` endpoint locally (or configure `GEMINI_API_KEY` in **Settings > Secrets** when running in AI Studio). Local `.env*` files are ignored by Git and should never be committed.
