# Deploying on Hostinger (AI / Brochure chat)

## Why you see `Unexpected end of JSON input`

**Booth PDF** (and **Direct AI**) call backend routes:

- `POST /api/pageindex/ask` — brochure Q&A from indexed PDF
- `POST /api/chat` — general OpenRouter chat

Those routes are implemented by **Node.js middleware** in this repo (Vite plugins). They run when you use:

- `npm run dev` (local), or
- `npm run start:prod` / `npm run preview` (production Node server)

If you only upload the **`dist/`** folder to **static** Hostinger hosting, the browser requests `/api/...` and gets **HTML** (your `index.html`) or an **empty** response. `response.json()` then fails with **Unexpected end of JSON input**.

Adding **`VITE_*` variables in the Hostinger panel does not create `/api` routes** — those names only embed values into the frontend at **build** time. The AI keys for chat must exist on the **Node process** that serves the site.

---

## What you need on Hostinger

1. **Node.js hosting** (VPS or Hostinger “Node.js” app), not static-only.
2. On the server (SSH or Hostinger env UI for the **Node app**), set:

| Variable | Required for |
|----------|----------------|
| `OPENROUTER_API_KEY` | Direct AI + Booth PDF answers |
| `OPENROUTER_MODEL` | Optional (default `openrouter/free`) |
| `MONGODB_URI` | Booth PDF (load indexed brochure from DB) |
| `GEMINI_API_KEY` | Optional — PDF indexing if you use Gemini for PageIndex |

Do **not** put `MONGODB_URI` or `OPENROUTER_API_KEY` in `VITE_*` variables (that would expose secrets in the browser bundle).

3. Deploy steps:

```bash
npm install
npm run build
npm run start:prod
```

Keep the Node process running (PM2, Hostinger process manager, etc.). Point your domain to this app’s port.

4. **Index the brochure** (once per booth PDF):

- Open **CMS** on your live site → Media → Vertex Elite (or booth)
- Upload / save brochure PDF URL
- Click **Run PageIndex on current PDF** → wait for **Indexed**
- Then **Booth PDF** chat can answer from that document

---

## Quick test

On the server:

```bash
curl -s -X POST http://127.0.0.1:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}],"systemPrompt":"say ok"}'
```

You should get JSON like `{"ok":true,"answer":"..."}`. If you get HTML or empty body, the API is not running.

---

## Static hosting only (no Node) — Direct AI only

If you **only** upload `dist/` and cannot run Node:

1. In Hostinger **build** environment variables (before `npm run build`), add:
   - `VITE_OPENROUTER_API_KEY=sk-or-...` (from https://openrouter.ai/keys)
   - `VITE_OPENROUTER_MODEL=openrouter/free` (optional)
2. Rebuild and redeploy `dist/`.
3. In the expo, use **Direct AI** (not Booth PDF). The app will call OpenRouter from the browser when `/api/chat` is missing.

**Booth PDF** still needs Node + `MONGODB_URI` + indexed PDF — it cannot work on static-only hosting.

## Workaround with API on another server

Host static `dist/` on Hostinger and run the API on another VPS (Railway, Render, etc.), then proxy `/api` from your domain to that backend — advanced setup; default repo expects same-origin `/api` on the Node server.
