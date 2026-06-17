# Expo Analytics Dashboard — Phase Plan

Planning document for the full **Expo Analytics Dashboard** spec. Maps each module to what exists in the repo today, what is feasible next, and how to roll it out in phases.

**Target URL:** `/dash` (alias of or replacement for current `/analytics`)

**Related code:**
- Global UI: `src/dashboard/components/AnalyticsDashboard.tsx`
- Exhibitor UI (per booth): `src/features/exhibitorDashboard/OverviewDashboard.tsx` at `/exbidash`
- Tracking hook: `src/dashboard/hooks/useVisitorTracking.ts`
- API + aggregates: `src/dashboard/server/store.ts`, `src/dashboard/server/routes.ts`
- Standalone deploy: `dashboard-host/` (`npm run dashboard:build && dashboard:start`)

---

## Route & deploy options

| Option | Effort | Result |
|--------|--------|--------|
| **A — Alias `/dash` → `/analytics`** | ~1 hour | Same dashboard, new URL in `App.tsx` |
| **B — Standalone at `https://domain/dash`** | DevOps | `dashboard-host` behind reverse proxy + `VITE_DASHBOARD_URL` |
| **C — New multi-module UI at `/dash`** | Weeks | Full spec dashboard; phases below |

Entry points today: CMS “Visitor analytics”, admin menu → `openAnalyticsDashboard()` in `src/app/App.tsx`.

---

## Current data architecture

### MongoDB collections (actual)

| Collection | Purpose |
|------------|---------|
| `expoAnalyticsEvents` | Event stream: sessions, heartbeats, zone/booth dwell, doc open/close, CTA engagement |
| `expoBoothPresence` | Live who is in which booth (5s ping, 45s TTL index) |
| `visitors` | Registration + lobby check-in |
| `buyerQuestionnaires` | Buyer questionnaire + hot/warm/cold lead scoring |
| `expoFaqSubmissions` | Booth FAQ answers |
| `expoAiChatMessages` | AI assistant messages per booth |
| `expoSalesChatMessages` | Sales chat per booth |

### Not implemented (from original spec)

`visitor_sessions`, `pavilion_visits`, `brochure_events`, `ai_chat_events`, `questionnaire_responses`, `ratings`, `expo_daily_analytics`, `pavilion_daily_analytics`, `heatmap_points`

Most spec collections can be **derived from** `expoAnalyticsEvents` or added as thin wrappers — no need to duplicate unless pre-aggregation is required for scale.

### Existing API surface

```
POST   /api/analytics/track
GET    /api/analytics/dashboard              ← global admin summary
GET    /api/analytics/booth-visitors         ← per-booth stats
GET    /api/analytics/booth-visits
GET    /api/analytics/booth-documents
GET    /api/analytics/booth-live-presence
GET    /api/analytics/booth-faq-responses
GET    /api/analytics/booth-ai-chat
GET    /api/analytics/booth-sales-chat
GET    /api/analytics/booth-engagement-actions
GET    /api/analytics/booth-visitor-engagement
GET    /api/analytics/booth-visitor-profile
GET    /api/analytics/questionnaire-possibility
GET    /api/analytics/health
```


### Real-time layer (today)

- **No Redis, no Socket.IO**
- Heartbeat every **45s** (`useVisitorTracking`)
- Booth presence ping every **5s** (`boothPresence.ts` → MongoDB upsert)
- “Live” session count = heartbeats in last **2 minutes** (`store.ts`)
- Global dashboard refresh every **30s** (`AnalyticsDashboard.tsx`)

---

## Module status & feasibility

### Legend

| Status | Meaning |
|--------|---------|
| ✅ Good | Usable now with minor UI gaps |
| ✅ Partial | Data exists; needs aggregation or global UI |
| ⚠️ Partial | Instrumentation exists; metric not exposed globally |
| ❌ Missing | No tracking or API |

---

### 1. Total visitors

| | |
|---|---|
| **Status** | ✅ Partial |
| **Today** | `visitors` collection via `getVisitorRegistrationStats()`; `totalSessions` from unique `sessionId` in `expoAnalyticsEvents` |
| **Shown on** | Global `/analytics` — registered total, today, lobby check-ins |
| **Gap** | “Unique visitors who entered expo” mixes registered IDs + anonymous session IDs; no single canonical `visitor_sessions` document |

**What is possible (Phase 1)**
- Add `GET /api/analytics/expo-overview` field: `uniqueVisitors` = distinct `visitorId` OR `sessionId` from `session_start` events
- Show “Total unique sessions” vs “Registered visitors” as two cards (already mostly there)
- **Effort:** Small — aggregation query only

**Phase:** 1

---

### 2. Online visitors (live)

| | |
|---|---|
| **Status** | ✅ Partial |
| **Today** | `heartbeat` events in last 2 min → `sessions.activeNow` on global dashboard |
| **Booth-level** | `expoBoothPresence` + `GET /api/analytics/booth-live-presence` (exhibitor header required for names) |
| **Gap** | Not Redis/WebSocket; 30s UI poll; 2 min window ≠ true real-time |

**What is possible**

| Approach | Effort | Scale |
|----------|--------|-------|
| Reduce dashboard poll to **10s** + tighten heartbeat window to **90s** | Small | OK for hundreds concurrent |
| Expo-wide live list: aggregate all `expoBoothPresence` rows | Medium | OK for thousands |
| **Redis** presence + **Socket.IO** push to dashboard | Large | 10k+ spec target |

**Phase:** 1 (poll + aggregate), 3 (Redis/sockets)

---

### 3. Average / max time spent

| | |
|---|---|
| **Status** | ⚠️ Partial |
| **Today** | `zone_dwell` and `booth_exit` events carry `dwellMs`; per-booth `avgDwellMsInBooth` in `getBoothVisitorStats()` |
| **Gap** | Global admin dashboard does not show expo-wide avg/max or “top visitor by time” |

**What is possible (Phase 1)**
- Aggregate all `booth_exit` + session-level dwell per `visitorKey` (`visitorId` or `sessionId`)
- API fields: `avgSessionMs`, `maxSessionMs`, `topVisitor: { name, company, totalMs }` (company from `visitors` or questionnaire)
- Reuse exhibitor dwell logic from `store.ts` — same `$group` patterns

**Phase:** 1

---

### 4. Pavilion rankings

| | |
|---|---|
| **Status** | ❌ Missing |
| **Today** | `GET /api/analytics/booth-visitors?boothId=` — one booth at a time; exhibitor `OverviewDashboard` charts |
| **Gap** | No loop over all booth IDs, no leaderboard API, no % share on global dashboard |

**What is possible (Phase 1)**
- Load booth list from `src/features/shared/data/boothLayouts.ts` (or CMS hall layout)
- New `GET /api/analytics/pavilion-rankings?metric=visitors|dwell|leads|ai_questions`
- MongoDB `$match` on `booth_enter` / `boothId` → `$group` by booth → sort → return top N + share %
- UI: ranked table on `/dash` — reuse Recharts patterns from `OverviewDashboard.tsx`

**Dependencies:** Stable `boothId` on all events (already on `booth_enter`, `doc_open`, presence)

**Phase:** 1

---

### 5. Pavilion engagement score

| | |
|---|---|
| **Status** | ✅ Partial |
| **Today** | `src/dashboard/engagementLeadScore.ts` — points per CTA (`brochure: 3`, `ai_chat: 2`, etc.); `cta_engagement` events in `expoAnalyticsEvents`; per-booth `getBoothEngagementActionStats()` |
| **Gap** | Score formula in spec (Visitors×1 + Time×2 + Brochure×3 + AI×5 + Leads×10) differs slightly from current point map; no **global ranking** |

**What is possible (Phase 1)**
- Define `computePavilionEngagementScore(boothId)` in `store.ts`:
  - visitors → unique `booth_enter` keys
  - time → sum `dwellMs` on `booth_exit`
  - brochures → `doc_open` count
  - AI → count from `expoAiChatMessages` or `cta_engagement` where action = `ai_chat`
  - leads → FAQ submissions + questionnaire rows tagged with booth (if attribution exists)
- Return sorted leaderboard on `/api/analytics/pavilion-rankings?metric=engagement`

**Phase:** 1

---

### 6. Heatmap (X / Y)

| | |
|---|---|
| **Status** | ❌ Missing |
| **Today** | Zone-level dwell only (`registration_lobby`, `expo_hall`, `booth:{hall}:{id}`) — no coordinates |
| **Player** | `src/features/expo/components/Player.tsx` has world position every frame; not sent to analytics |

**What is possible (Phase 2)**
- New event type: `position_sample` with `{ x, z, hallId, boothId? }`
- Sample every **5–10s** in `useVisitorTracking` (subscribe to store player position or R3F ref)
- Collection: `heatmap_points` or append to `expoAnalyticsEvents` with TTL index (e.g. 90 days)
- Dashboard: 2D canvas overlay on hall floor plan bounds (`EXPO_BOUND_X`, `EXPO_BOUND_Z` from `Player.tsx`)
- Color buckets: red / orange / blue by visit density

**Limits**
- High write volume at 10k users × every 5s — use sampling (1 in 3 visitors), batch inserts, or aggregate into grid cells server-side
- Privacy: bucket coordinates to 1m grid, no raw trails in UI

**Phase:** 2

---

### 7. Brochure analytics

| | |
|---|---|
| **Status** | ✅ Good |
| **Today** | `doc_open`, `doc_close`, `doc_heartbeat` in `useVisitorTracking` + `pdfDocTracking.ts`; global top docs on `/analytics`; exhibitor `DocumentsBrochuresPage` with opens, downloads (closes), avg read time |
| **API** | `GET /api/analytics/booth-documents?boothId=` |

**What is possible (Phase 1)**
- Surface global brochure table on `/dash` (already on `/analytics` — move/enhance)
- Per-pavilion breakdown in pavilion detail tab
- **Downloads:** today mapped to `doc_close` count — rename in UI for clarity

**Phase:** 1 (UI polish only)

---

### 8. Video analytics

| | |
|---|---|
| **Status** | ❌ Missing |
| **Today** | Booth `videoUrl`, LED planes in `src/features/media/` — playback not tracked |
| **Gap** | No `video_view`, progress, or completion events |

**What is possible (Phase 2)**
- Instrument video components (booth LED, CTA popup video, ballroom LED):
  - `video_start`, `video_progress` (25/50/75%), `video_complete`, `watchMs`
- Store in `expoAnalyticsEvents` or `video_events` collection
- Dashboard table: Video | Views | Avg watch % — mirror brochure table pattern

**Files to touch:** media/LED components, `trackAnalytics` types in `api/client.ts` + `store.ts`

**Phase:** 2

---

### 9. AI assistant analytics

| | |
|---|---|
| **Status** | ✅ Partial |
| **Today** | `POST /api/analytics/ai-chat`, `GET /api/analytics/booth-ai-chat`; `AiChatbox.tsx` posts messages; exhibitor `ExhibitorAssistanceHistoryPage` |
| **Gap** | Not on global `/analytics`; no “top questions across expo” aggregate |

**What is possible (Phase 1)**
- `GET /api/analytics/expo-ai-summary`: total questions, unique users, avg session length, top question texts (`$group` on message content or intent tags)
- Pavilion rankings metric: `ai_questions`
- Add section to `/dash` global overview

**Phase:** 1

---

### 10. Questionnaire

| | |
|---|---|
| **Status** | ✅ Good |
| **Today** | `buyerQuestionnaires` collection; hot/warm/cold; `GET /api/analytics/questionnaire-possibility`; global dashboard section “Buyer questionnaire ratings” |
| **Gap** | Booth attribution on questionnaire may be limited — verify `boothId` on submit for per-pavilion lead reports |

**What is possible (Phase 1)**
- Expo-wide completion rate = submissions / registered visitors
- Per-pavilion if `boothId` stored on submit (add field if missing)
- “Most selected answers” — aggregate answer keys from questionnaire payload

**Phase:** 1

---

### 11. Ratings & feedback

| | |
|---|---|
| **Status** | ❌ Missing |
| **Today** | No `ratings` collection; questionnaire score is lead intent, not star ratings |

**What is possible (Phase 2)**
- Visitor popup after booth visit or on exit: 1–5 stars + optional text
- `POST /api/analytics/rating` → `ratings` collection `{ boothId, visitorId, stars, comment, createdAt }`
- Dashboard: distribution chart (★★★★★ 72% …) per booth and expo-wide

**Phase:** 2

---

### 12. Live monitoring

| | |
|---|---|
| **Status** | ✅ Partial |
| **Today** | `expoBoothPresence` (5s ping, stale after 12s); exhibitor live visitor table in `OverviewDashboard`; names gated by `X-Expo-Dashboard-Access: exhibitor` |
| **Gap** | No single expo-wide “live visitors” table on admin dashboard; no “current activity” field |

**What is possible (Phase 1)**
- `GET /api/analytics/expo-live`: merge all booth presence + last `heartbeat` zone → Visitor | Pavilion | Duration | Activity
- Admin auth required for PII (names)
- Pavilion occupancy table: count per booth from presence collection

**Phase:** 1

---

### 13. Reports (PDF / Excel / CSV)

| | |
|---|---|
| **Status** | ❌ Missing |
| **Today** | No export endpoints or client download flow |

**What is possible (Phase 4)**

| Format | Approach |
|--------|----------|
| **CSV** | `GET /api/analytics/export?report=daily&format=csv` — stream aggregated rows |
| **Excel** | Server: `exceljs` or client: CSV with `.xlsx` lib |
| **PDF** | Server: puppeteer print of dashboard snapshot, or `@react-pdf/renderer` report template |

**Filters:** Today, Yesterday, Last 7/30 days, custom range — pass `from` / `to` query params to same aggregates as dashboard.

**Phase:** 4

---

### 14. Pre-computed daily analytics

| | |
|---|---|
| **Status** | ❌ Missing |
| **Today** | All dashboard loads run live aggregation on `expoAnalyticsEvents` (can slow down as data grows) |

**What is possible (Phase 3)**
- Nightly cron (or MongoDB Atlas trigger): roll up into `expo_daily_analytics` and `pavilion_daily_analytics`
- Fields: date, visitors, leads, engagement score, top booth, total dwell
- Dashboard reads last 30 days from rollup + “today” from live events
- TTL on raw `position_sample` / heartbeat events after rollup (retention 12–24 months)

**Phase:** 3 (before 10k+ concurrent target)

---

### 15. Redis + Socket.IO

| | |
|---|---|
| **Status** | ❌ Not used |
| **Today** | MongoDB for presence and heartbeats; HTTP polling for dashboard |
| **Note** | `ws` is in `package.json` but not wired to analytics |

**What is possible (Phase 3)**
- **Redis:** online count, booth occupancy, pub/sub for dashboard refresh
- **Socket.IO:** push `live_update` every 5–10s to connected dashboard clients
- Keep MongoDB as source of truth for history

**When needed:** > ~500 concurrent visitors with frequent dashboard users, or <10s live SLA

**Phase:** 3

---

## Phased rollout

```
Phase 0 — Route & shell          /dash alias, admin gate, layout scaffold
Phase 1 — Global overview        Pavilion rankings, live expo table, time stats, AI summary
Phase 2 — Instrumentation        Heatmap samples, video events, ratings popup
Phase 3 — Scale                  Daily rollups, Redis, Socket.IO, retention TTL
Phase 4 — Reports & RBAC         CSV/Excel/PDF export, role-based API auth
```

### Phase 0 — Quick win (days) ✅ COMPLETE

- [x] shadcn/ui initialized in `dashboard-host/`
- [x] Core components: Button, Card, Table, Tabs, Badge, Skeleton, Separator
- [x] DashboardLayout with sidebar navigation
- [x] Scaffold 5 pages: Overview | Pavilions | Live | Content | Reports
- [x] Overview page wired to existing `fetchAnalyticsDashboard()` API
- [x] Vite config with `@expo-dashboard` alias for shared APIs
- [x] Dark theme with proper Tailwind v4 setup
- [ ] Optional: Update CMS + admin menu to link to `http://localhost:3010`
- [ ] Optional: Set `VITE_DASHBOARD_URL` for production

### Phase 1 — Global overview (1–2 weeks)

Uses **existing data only** — no new tracking.

- [ ] `GET /api/analytics/expo-overview` — totals, live count, avg/max time, top visitor
- [ ] `GET /api/analytics/pavilion-rankings` — visitors, dwell, leads, AI, engagement score
- [ ] `GET /api/analytics/expo-live` — all-booth presence + zones
- [ ] `GET /api/analytics/expo-ai-summary` — cross-booth AI stats
- [ ] `/dash` UI modules 1, 2, 4, 5, 9, 12 + brochure global table
- [ ] Poll interval **10s** for live section

### Phase 2 — New instrumentation (2–3 weeks)

- [ ] `position_sample` in `useVisitorTracking` + heatmap API + floor plan viz
- [ ] Video play tracking on media components
- [ ] Ratings UI + `ratings` collection + API
- [ ] Questionnaire booth attribution if missing

### Phase 3 — Performance & retention (2+ weeks)

- [ ] `expo_daily_analytics` / `pavilion_daily_analytics` nightly job
- [ ] TTL indexes on high-volume event types
- [ ] Redis presence layer
- [ ] Socket.IO live channel for dashboard
- [ ] Target: dashboard load < 2s with 12+ months rollup data

### Phase 4 — Reports & enterprise (ongoing)

- [ ] Export APIs with date filters
- [ ] PDF report templates (daily / weekly / pavilion / leads)
- [ ] Server-side JWT or API keys for pavilion owners vs expo admin
- [ ] Future: journey analytics, funnel, notifications (spec “Future Enhancements”)

---

## Limits & risks

| Area | Current limit | Mitigation |
|------|---------------|------------|
| Live accuracy | 2 min heartbeat window | Shorter window + 10s poll (Phase 1) |
| Dashboard refresh | 30s | 10s on live tab only |
| Write load | Every visitor heartbeats + presence | Batch track payload; rollup + TTL (Phase 3) |
| Static Hostinger deploy | No `/api/analytics` on main site | Run `dashboard-host` VPS or Node `start:prod` |
| Auth | Client admin key / visitor ID list | Server verify on analytics APIs (Phase 4) |
| PII on live lists | Names hidden without exhibitor header | Admin-only endpoints for `/dash` |
| Heatmap at scale | Millions of points | Grid aggregation, sampling, TTL |
| Pavilion = booth | Spec says “pavilion”; code uses `boothId` | Document mapping; multi-booth pavilions = future grouping field |

---

## Environment variables

| Variable | Required for | Notes |
|----------|--------------|-------|
| `MONGODB_URI` | All analytics | Same Atlas DB as expo |
| `VITE_EXPO_ADMIN_KEY` | Admin `/dash` login | Default dev: `expo-admin-dev` |
| `VITE_EXPO_ADMIN_VISITOR_IDS` | Admin by visitor ID | Comma-separated |
| `VITE_DASHBOARD_URL` | Open `/dash` in new tab | e.g. `https://domain/dash` |
| `ANALYTICS_CORS_ORIGINS` | Cross-origin tracking | Main expo origin |
| `DASHBOARD_PORT` | Standalone server | Default `3010` |

See `dashboard-host/.env.example`.

---

## Success questions → phase mapping

| Question | Phase | Module |
|----------|-------|--------|
| How many visitors attended? | 1 | Total visitors |
| How many online right now? | 1 / 3 | Online visitors |
| Which pavilion performs best? | 1 | Pavilion rankings + engagement score |
| Which pavilion generates most leads? | 1 | Rankings + questionnaire |
| What content attracts visitors? | 1 / 2 | Brochure + video |
| How much time do visitors spend? | 1 | Avg / max time |
| What are visitors asking AI? | 1 | AI summary |
| Which zones get most traffic? | 2 | Heatmap |
| Which exhibitors get engagement? | 1 | `/exbidash` + global rankings |
| What to improve for next expo? | 4 | Reports + rollups |

---

## Suggested new APIs (summary)

| Endpoint | Phase | Purpose |
|----------|-------|---------|
| `GET /api/analytics/expo-overview` | 1 | Global KPIs |
| `GET /api/analytics/pavilion-rankings` | 1 | Leaderboards |
| `GET /api/analytics/expo-live` | 1 | Live visitors + occupancy |
| `GET /api/analytics/expo-ai-summary` | 1 | Cross-booth AI |
| `GET /api/analytics/heatmap` | 2 | Grid density for hall |
| `POST /api/analytics/rating` | 2 | Star ratings |
| `GET /api/analytics/export` | 4 | CSV / Excel / PDF |
| WebSocket `/api/analytics/live` | 3 | Push updates |

---

## References

- Architecture: `ARCHITECTURE.md` (add `/dash` when implemented)
- MongoDB setup: `MONGODB_CONNECTION_SETUP.md`
- Exhibitor dashboard patterns: `src/features/exhibitorDashboard/OverviewDashboard.tsx`
- Engagement scoring: `src/dashboard/engagementLeadScore.ts`
- Event types: `src/dashboard/server/store.ts` (`AnalyticsEventType`)

---

*Last updated: planning baseline from repo audit. Implement Phase 0 first, then Phase 1 for maximum value without new client instrumentation.*
