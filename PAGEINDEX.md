# PageIndex (separate tool)

The [`pageindex/`](./pageindex/) directory is a **Git submodule** pointing at [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex): vectorless, reasoning-based RAG over PDFs/Markdown. It is **Python** and **not** bundled into the Vite/React build.

## Web UI (dev server)

With **`npm run dev`**, open **`/pageindex`** or click **PageIndex** (bottom-left in the expo). You can upload a PDF, run indexing, open the file in a new tab, and ask Gemini questions using the generated outline. This uses Vite middleware (`/api/pageindex/*`); it is **not** available from a static `dist` deploy unless you add a separate backend.

## Make it work (short path)

1. **Submodule & Python venv** (local venv avoids macOS/Homebrew “externally managed” pip errors)

   ```bash
   git submodule update --init --recursive
   npm run pageindex:install
   ```

   This creates `pageindex/.venv` and installs `pageindex/requirements.txt` there.

2. **API key (Gemini)** — `pageindex/pageindex/config.yaml` uses `gemini/gemini-3.1-flash-lite-preview` via LiteLLM.

   Easiest: put **`VITE_GEMINI_API_KEY`** in the **project root** `.env` (same as the expo web app). The helper script maps it to `GEMINI_API_KEY` for PageIndex.

   Optional: copy [`pageindex.env.example`](./pageindex.env.example) to `pageindex/.env` and set `GEMINI_API_KEY` there instead.

3. **Run indexing on the EOE floor plan deck** (default sample PDF)

   ```bash
   npm run pageindex:run-example
   ```

   Output: `pageindex/results/EOE Floor Plan Deck_structure.json`

   **429 / quota:** One PDF run triggers many Gemini requests. On the **free** tier you can hit **requests-per-minute** limits (e.g. 15 RPM for Flash-Lite). Wait ~1 minute and retry, enable **billing** for higher quotas, or try another model for that run, e.g.  
   `npm run pageindex:run -- --pdf_path \"examples/documents/EOE Floor Plan Deck.pdf\" --model gemini/gemini-2.0-flash`  
   See [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

   **Short PDFs:** Upstream PageIndex required the inferred TOC to reach the *second half* of every document; 9-page floor-plan decks failed with `Exception: Processing failed`. This repo relaxes that for **≤24 pages** in `pageindex/pageindex/page_index.py` and accepts a best-effort TOC if verification is still noisy on small decks.

4. **Run any PageIndex CLI args** (from repo root)

   ```bash
   npm run pageindex:run -- --md_path path/to/file.md
   npm run pageindex:run -- --pdf_path path/to/file.pdf --model gemini/gemini-3.1-flash-lite-preview
   ```

## Setup details

From the repo root (recommended — uses `pageindex/.venv`):

```bash
npm run pageindex:install
```

Manual equivalent:

```bash
cd pageindex
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

## Run without npm (from `pageindex/`)

Activate the venv and set Gemini (or use root `.env` only if you export vars yourself):

```bash
cd pageindex
source .venv/bin/activate   # Windows: .venv\Scripts\activate
export GEMINI_API_KEY="your_key"   # or rely on a pageindex/.env + python-dotenv when using run_pageindex.py directly
python3 run_pageindex.py --pdf_path "examples/documents/EOE Floor Plan Deck.pdf"
```

From the **repo root**, prefer `npm run pageindex:run-example` so `VITE_GEMINI_API_KEY` from the project `.env` is mapped automatically.

## Updating the submodule

```bash
git submodule update --remote pageindex
```

## License

PageIndex is MIT-licensed in its own repository; keep attribution and license files when redistributing.
