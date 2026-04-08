# QuantumField — Universal Particle Simulator

> WebGPU-powered particle physics engine with classical, quantum, relativistic mechanics, fluid dynamics, electromagnetic fields, and AI/ML visualizations. Up to 2,000,000 particles at 60fps.

![QuantumField Screenshot](public/og.png)

## Quick Start

```bash
bun install && bun run dev
```

Open [http://localhost:3000](http://localhost:3000) — the simulator loads instantly.

## Prerequisites

| Tool | Version |
|------|---------|
| Bun  | 1.2+    |
| Node | 22+     |
| Chrome / Edge | 113+ (WebGPU) |
| Firefox / Safari | Any (WebGL2 fallback) |

## Environment Variables

Copy `.env.example` → `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_APP_NAME` | `QuantumField` | App display name |
| `NEXT_PUBLIC_MAX_PARTICLES_WEBGPU` | `2000000` | Max particles (WebGPU) |
| `NEXT_PUBLIC_MAX_PARTICLES_WEBGL` | `500000` | Max particles (WebGL2) |
| `NEXT_PUBLIC_DEFAULT_PARTICLE_COUNT` | `50000` | Default on load |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max API requests/min |

## Scripts

```bash
bun run dev          # Development server (Turbopack)
bun run build        # Production build
bun run start        # Start production server
bun run lint         # ESLint + TypeScript check
bun run test         # Vitest unit + integration tests
bun run test:e2e     # Playwright end-to-end tests
bun run smoke        # Smoke test against running server
bun run bench        # Performance benchmark
bun run typecheck    # tsc --noEmit
```

## Deployment

### Vercel (recommended)

```bash
bun install -g vercel
vercel --prod
```

### Docker

```bash
docker compose up -d
```

### Fly.io

```bash
fly launch
fly deploy
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Explode all particles |
| `R` | Reset current preset |
| `P` | Pause / Resume |
| `S` | Toggle sidebar |
| `E` | Toggle equation overlay |
| `←` / `→` | Decrease / Increase time scale |
| `Click + Drag` | Attract particles toward cursor |
| `Shift + Click + Drag` | Repel particles from cursor |

## Physics Modes

| Mode | Equation | Author |
|------|----------|--------|
| Classical Gravity | F = Gm₁m₂/r² | Newton, 1687 |
| Quantum Wavefunction | iℏ∂ψ/∂t = Ĥψ | Schrödinger, 1926 |
| Special Relativity | γ = 1/√(1−v²/c²) | Einstein, 1905 |
| SPH Fluid | ρ(r) = Σmⱼ·W(r−rⱼ,h) | Monaghan, 1977 |
| EM / Lorentz Force | F = q(E + v×B) | Lorentz, 1895 |
| String Theory | S = −1/(2α′)∫d²σ·∂Xᵘ∂Xᵤ | Nambu, 1970 |

## Architecture

```
quantumfield/
├── src/
│   ├── app/                  Next.js 15 App Router
│   │   └── api/              REST endpoints (health, scene)
│   ├── components/
│   │   ├── canvas/           WebGL/WebGPU canvas + engine hook
│   │   │   └── shaders/      WGSL compute + render shaders
│   │   ├── physics/          Physics UI panels (KaTeX equations)
│   │   ├── ml/               ANN, CNN, Transformer visualizers
│   │   ├── media/            Image → particles, Text → particles
│   │   ├── input/            MediaPipe gesture controller
│   │   └── ui/               Sidebar, TopBar, Overlays
│   ├── engine/               Core particle system (SoA buffers)
│   │   └── workers/          Physics compute Web Worker
│   ├── physics/              Classical, Quantum, Relativity, Future
│   ├── lib/                  imageToParticles, textToParticles, security
│   ├── store/                Zustand global state
│   ├── hooks/                useWebGPU, useAnimationFrame, useGesture
│   └── types/                TypeScript interfaces
├── tests/
│   ├── unit/                 Vitest: physics, hash, image
│   ├── integration/          API route tests
│   └── e2e/                  Playwright smoke tests
├── scripts/                  smoke-test.ts, perf-benchmark.ts
├── public/presets/           20 JSON scene presets
├── Dockerfile                Multi-stage (node:22-alpine)
├── docker-compose.yml
└── fly.toml
```

## Performance Expectations

| Device | Max Particles (60fps) |
|--------|-----------------------|
| Desktop (WebGPU, RTX 3070+) | 2,000,000 |
| Desktop (WebGPU, integrated) | 200,000 |
| Desktop (WebGL2) | 100,000 |
| Mobile (WebGL2) | 20,000–50,000 |

## Browser Support

| Browser | Renderer | Notes |
|---------|----------|-------|
| Chrome 113+ | WebGPU | Full performance |
| Edge 113+ | WebGPU | Full performance |
| Firefox | WebGL2 | Requires `dom.webgpu.enabled` in about:config |
| Safari 18+ | WebGPU (partial) | Some features limited |
| Safari < 18 | WebGL2 | Automatic fallback |

## Security

- Content-Security-Policy with strict directives
- `Cross-Origin-Opener-Policy: same-origin` (required for SharedArrayBuffer)
- `Cross-Origin-Embedder-Policy: require-corp`
- Image uploads validated by magic bytes (not extension)
- All API inputs validated with Zod schemas
- Rate limiting: 100 req/min per IP on all API routes
- DOMPurify text sanitization

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Run `bun run lint && bun run test` before committing
4. Open a PR — CI must pass (lint, typecheck, unit tests, E2E)

## License

MIT © 2024 QuantumField Contributors
