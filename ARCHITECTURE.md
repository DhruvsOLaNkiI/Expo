# Virtual Residential Expo — Architecture

Production-oriented layout for the 3D virtual expo, real-estate showcase, AI help desk, teleport navigation, and PageIndex document AI.

## Top-level layout

```
virtual-residential-expo/
├── public/                 # Static assets (videos, GLBs served as URLs)
├── school-chair/           # Ballroom chair GLB (bundled via ?url)
├── server/                 # Node HTTP helpers (future API extraction)
│   └── utils/http.ts
├── vite-plugin-*.ts        # Dev/preview API middleware (chat, CMS, PageIndex)
├── pageindex/              # Python PageIndex pipeline
├── scripts/                # Shim generators, PageIndex runners
└── src/
    ├── app/                # Application shell (routes, Canvas, HUD orchestration)
    ├── api/                # Browser API clients (fetchJson, OpenRouter, Mongo helpers)
    ├── config/             # Client env (VITE_* only)
    ├── constants/
    ├── features/           # Domain modules (primary code lives here)
    ├── store/              # Zustand global state + persist slices
    ├── hooks/
    ├── utils/
    ├── types/
    ├── lib/
    ├── components/         # Back-compat re-exports → features/*
    ├── data/               # Back-compat re-exports → features/shared/data/*
    └── cms/                # Back-compat re-exports → features/cms/*
```

## Feature modules (`src/features/`)

| Module | Responsibility |
|--------|----------------|
| `expo/` | Main hall, player, camera modes, lighting, effects, layout edit HUD |
| `booths/` | All booth meshes, Vertex Elite, side expo, ballroom, CMS preview |
| `registration/` | Registration lobby 3D + HUD |
| `ai/` | Ask AI chatbox, Help Desk concierge panel |
| `teleport/` | Fast Travel HUD + destination builders |
| `visitor/` | Onboarding, badge, visitor profile types |
| `media/` | LED video planes, CTA popups, video hints |
| `cms/` | CMS dashboard, scene panel, 3D preview |
| `pageindex/` | PageIndex admin portal |
| `shared/` | Cross-cutting data (booth layouts, teleport, help desk catalog) |

Import from feature barrels when possible:

```ts
import { Player, ExpoHall } from '@/features/expo';
import { Booths } from '@/features/booths';
import { useStore } from '@/store';
```

## State (`src/store/`)

- `index.ts` — Zustand store (expo phase, scene overrides, CMS page, AI panels, visitor).
- `persist/` — `boothCms`, `hallLayout`, `helpDesk` localStorage slices.

Legacy paths (`src/store.ts`, `src/boothCmsPersist.ts`, etc.) re-export the new modules.

## API layer (`src/api/`)

| File | Role |
|------|------|
| `fetchJson.ts` | Typed fetch with clear errors when `/api/*` is missing (static Hostinger) |
| `openRouterClient.ts` | Browser fallback when server chat route unavailable |
| `visitorMongo.ts`, `cmsUpload.ts`, `pageindexAutoIndex.ts` | Domain API helpers |

Use `@/lib/api/client` for a stable import surface.

## Path aliases

Configured in `tsconfig.json` and `vite.config.ts`:

- `@/*` → `src/*`
- `@features/*`, `@store/*`, `@api/*`, `@config/*`, etc.

## Backward compatibility

Old import paths still work via thin re-export shims:

- `src/components/*.tsx` → `features/*/components/*`
- `src/data/*.ts` → `features/shared/data/*`

Regenerate shims after moving files:

```bash
node scripts/generate-shims.mjs
node scripts/fix-feature-imports.mjs
```

## Routes

| URL | View |
|-----|------|
| `/` | 3D expo (registration → main hall) |
| `/cms` | CMS dashboard (lazy-loaded) |
| `/pageindex` | PageIndex portal (lazy-loaded) |

## Server / deployment

- **Dev**: `npm run dev` — Vite + inline API plugins.
- **Static Hostinger**: `npm run build` → upload `dist/`. Direct AI needs `VITE_OPENROUTER_API_KEY` at build time.
- **Full AI (Booth PDF)**: `npm run start:prod` with `OPENROUTER_API_KEY`, `MONGODB_URI`, Node serving `/api/*`.

See `DEPLOY_HOSTINGER.md`.

## Performance

- Scene **30 FPS compression** via CMS / `modelCompression` in `boothLayouts`.
- `src/utils/glbPerformance.ts`, `src/hooks/useModelCompression.ts`.
- CMS and PageIndex are **code-split** (lazy) to shrink the main expo bundle.

## Future work (safe extensions)

- Move vite-plugin handlers into `server/api/{routes,controllers,services}`.
- Split `features/ai/modules/` into dedicated help-desk, teleport-AI, and PageIndex services.
- `src/pages/` for additional admin routes.
- Multiplayer under `src/multiplayer/` when scaling visitors.

## Onboarding checklist

1. Read this file and `DEPLOY_HOSTINGER.md`.
2. Start with `src/app/App.tsx` (shell) and `src/store/index.ts` (state).
3. Add booth/scene data in `features/shared/data/boothLayouts.ts`.
4. Add 3D UI in the matching `features/<domain>/components/` folder.
5. Run `npm run lint` and `npm run build` before shipping.
