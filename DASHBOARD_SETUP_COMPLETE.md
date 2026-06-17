# 🎉 Dashboard Phase 0 Complete

**shadcn/ui analytics dashboard** successfully scaffolded in `dashboard-host/`.

---

## What Was Built

### ✅ Infrastructure

- **shadcn/ui** initialized with New York style, dark theme
- **Tailwind CSS** configured with proper theme variables
- **TypeScript** setup with path aliases (`@/` for local, `@expo-dashboard` for shared APIs)
- **Vite** dev server on port 3010
- **Production build** tested and working

### ✅ UI Components (shadcn)

All in `dashboard-host/src/components/ui/`:

- `button.tsx` — Primary/secondary/outline variants
- `card.tsx` — Card, CardHeader, CardTitle, CardDescription, CardContent
- `table.tsx` — Full table components
- `tabs.tsx` — Tab navigation (Radix)
- `badge.tsx` — Status badges
- `skeleton.tsx` — Loading states
- `separator.tsx` — Visual dividers

### ✅ Layout Components

`dashboard-host/src/components/layout/`:

- **DashboardLayout** — Sidebar with 5-tab navigation
- **DashboardHeader** — Page title, refresh button, "Back to Expo" link

### ✅ Pages

`dashboard-host/src/pages/`:

1. **OverviewPage** ✅ Fully wired to `fetchAnalyticsDashboard()` API
   - 4 KPI cards (Total Visitors, Registered Today, Live Now, Questionnaires)
   - Lead quality distribution chart
   - Top documents list
   - Recent activity feed
   - Auto-refresh every 30s

2. **PavilionsPage** 🚧 Stub (Phase 1)
   - Placeholder for pavilion rankings
   - Requires new API: `GET /api/analytics/pavilion-rankings`

3. **LivePage** 🚧 Stub (Phase 1)
   - Placeholder for live visitor monitoring
   - Requires new API: `GET /api/analytics/expo-live`

4. **ContentPage** 🚧 Stub (Phase 1)
   - Placeholder for content analytics
   - Will aggregate brochures, videos, AI, FAQ

5. **ReportsPage** 🚧 Stub (Phase 4)
   - Placeholder for PDF/Excel/CSV exports

---

## How to Run

### Development

```bash
# Terminal 1: Start dashboard dev server
npm run dashboard:dev
```

Opens on **http://localhost:3010**

### With main expo (for tracking data)

```bash
# Terminal 1: Dashboard
npm run dashboard:dev

# Terminal 2: Main 3D expo (generates analytics data)
npm run dev
```

Main expo on **http://localhost:3000**  
Dashboard on **http://localhost:3010**

### Production build

```bash
npm run dashboard:build
npm run dashboard:start
```

Starts Express server on port 3010 with built static files.

---

## Environment Setup

Ensure `.env` at repo root has:

```bash
# Required for analytics
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/virtual-expo

# Optional: link from main expo to dashboard
VITE_DASHBOARD_URL=http://localhost:3010

# Optional: expo origin for CORS
ANALYTICS_CORS_ORIGINS=http://localhost:3000

# Admin access
VITE_EXPO_ADMIN_KEY=expo-admin-dev
```

Without `MONGODB_URI`, dashboard shows error: *"Could not load analytics"*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Main Expo (3D)                    Dashboard (Admin)         │
│  localhost:3000                    localhost:3010            │
│                                                               │
│  ┌──────────────────┐             ┌──────────────────┐      │
│  │ Player           │   track()   │ OverviewPage     │      │
│  │ useVisitorTracking│ ────────▶  │ PavilionsPage    │      │
│  │                  │             │ LivePage         │      │
│  └──────────────────┘             │ ContentPage      │      │
│           │                        │ ReportsPage      │      │
│           │                        └──────────────────┘      │
│           ▼                                 │                │
│  ┌──────────────────────────────────────────┘                │
│  │         /api/analytics/*                                  │
│  │    (Express + MongoDB aggregations)                       │
│  └───────────────────────────────────────────────────────────┘
│                          │                                    │
│                          ▼                                    │
│                  ┌──────────────┐                            │
│                  │   MongoDB    │                            │
│                  │ Collections  │                            │
│                  └──────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

**Key separation:**

- `dashboard-host/src/` → **UI only** (shadcn components, pages)
- `src/dashboard/` → **Shared layer** (APIs, server logic, types)

Import pattern:

```ts
// In dashboard-host pages
import { Card } from '@/components/ui/card';  // Local UI
import { fetchAnalyticsDashboard } from '@expo-dashboard/api/client';  // Shared API
```

---

## File Structure

```
dashboard-host/
├── src/
│   ├── components/
│   │   ├── ui/                # shadcn primitives
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── separator.tsx
│   │   └── layout/            # Dashboard shell
│   │       ├── DashboardLayout.tsx
│   │       └── DashboardHeader.tsx
│   ├── pages/                 # Main views
│   │   ├── OverviewPage.tsx   ✅ Complete
│   │   ├── PavilionsPage.tsx  🚧 Phase 1
│   │   ├── LivePage.tsx       🚧 Phase 1
│   │   ├── ContentPage.tsx    🚧 Phase 1
│   │   └── ReportsPage.tsx    🚧 Phase 4
│   ├── lib/
│   │   └── utils.ts           # cn() helper
│   ├── index.css              # Tailwind + theme variables
│   └── App.tsx                # Main router
├── components.json            # shadcn config
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
├── main.tsx                   # Entry point
├── index.html
└── README.md                  # Full docs
```

---

## Next Steps (Phase 1)

### Backend APIs Needed

Create in `src/dashboard/server/store.ts`:

```ts
export async function getExpoOverview() {
  // Total visitors, live count, avg/max time, top visitor
}

export async function getPavilionRankings(metric: string) {
  // Leaderboard by visitors | dwell | leads | ai_questions | engagement
}

export async function getExpoLive() {
  // All booth presence + heartbeat zones
}

export async function getExpoAiSummary() {
  // Cross-booth AI stats
}
```

Add routes in `src/dashboard/server/routes.ts`:

```ts
app.get('/api/analytics/expo-overview', handleExpoOverviewGet);
app.get('/api/analytics/pavilion-rankings', handlePavilionRankingsGet);
app.get('/api/analytics/expo-live', handleExpoLiveGet);
app.get('/api/analytics/expo-ai-summary', handleExpoAiSummaryGet);
```

### Frontend Pages

Wire up the stub pages to call new APIs:

- **PavilionsPage.tsx** — Ranking tables with `@tanstack/react-table`
- **LivePage.tsx** — Live visitor list, 10s polling
- **ContentPage.tsx** — Aggregate doc/video/AI/FAQ stats

Reuse patterns from **OverviewPage.tsx** (cards, loading, error states).

---

## Testing Checklist

- [x] Dashboard builds successfully (`npm run dashboard:build`)
- [x] Dev server starts (`npm run dashboard:dev`)
- [x] Overview page loads and shows data (requires `MONGODB_URI`)
- [x] Sidebar navigation works
- [x] Refresh button triggers reload
- [x] "Back to Expo" link goes to main site
- [ ] Test with real MongoDB data from 3D expo tracking
- [ ] Test on mobile (responsive sidebar)

---

## Known Issues / Limitations

### Current Limitations

1. **No Redis / WebSocket** — Dashboard polls HTTP every 30s; Phase 3
2. **No pavilion rankings** — Single-booth APIs exist; need expo-wide aggregate
3. **No heatmap** — Player position not sampled yet; Phase 2
4. **No video tracking** — LED playback not instrumented; Phase 2
5. **No exports** — PDF/Excel generation; Phase 4

### Build Warnings (safe to ignore)

- Large chunk size (2MB) — expected; includes Recharts, Radix UI
- Dynamic import warnings — safe; shared dashboard code

---

## Comparison: Old vs New Dashboard

| Feature | Old (`/analytics`) | New (`dashboard-host`) |
|---------|-------------------|------------------------|
| UI Library | Tailwind (manual) | shadcn/ui (components) |
| Layout | Single page | Multi-tab sidebar |
| Charts | Recharts (inline) | Recharts (in cards) |
| Theme | Dark + gold | Dark slate (shadcn) |
| Deployment | Embedded in expo | Standalone :3010 |
| Build size | Part of expo bundle | Separate 2MB app |
| Mobile | Basic | Responsive sidebar |
| Phase | Legacy | Phase 0 ✅ |

**Migration plan:** Keep old `/analytics` until Phase 1 parity, then deprecate.

---

## Resources

- **Phase plan:** `Dashboardphase.md`
- **Dashboard docs:** `dashboard-host/README.md`
- **shadcn docs:** https://ui.shadcn.com
- **Vite config:** `dashboard-host/vite.config.ts`
- **Shared APIs:** `src/dashboard/api/client.ts`

---

## Quick Commands

```bash
# Development
npm run dashboard:dev         # Start dev server (:3010)
npm run dev                   # Start main expo (:3000)

# Production
npm run dashboard:build       # Build to dist/
npm run dashboard:start       # Start Express server

# Add shadcn components
cd dashboard-host
npx shadcn@latest add select calendar popover
```

---

**Status:** Phase 0 scaffold complete ✅  
**Next:** Phase 1 — backend APIs + Pavilions/Live pages  
**Timeline:** 1–2 weeks for full Phase 1
