# Avatar Realtime

Realtime speaking 3D avatar with phoneme-accurate lipsync.

## Quick Start

### 1. Install

```bash
pnpm install
```

### 2. Configure

```bash
cp .env.example .env
# Add your OPENAI_API_KEY
```

### 3. Run

```bash
# Terminal 1: Start orchestration server
pnpm start:server

# Terminal 2: Start web app
pnpm dev:web

# Open http://localhost:3200
```

### 4. Use with Seline

Set `AVATAR_PROVIDER=seline` and `SELINE_URL=http://localhost:3000` in `.env`.

## Architecture

- `packages/component` — React/Three.js avatar component (`@dyai/avatar-component`)
- `packages/server` — Orchestration server with STT→LLM→TTS→Phoneme pipeline
- `packages/shared` — Shared types and viseme mapping
- `apps/web` — Standalone Next.js web app

## Custom Avatar

Place any VRM file (with ARKit blendshapes) at `apps/web/public/models/default.vrm`.
