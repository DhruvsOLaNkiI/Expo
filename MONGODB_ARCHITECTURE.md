# MongoDB + PageIndex Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER UPLOAD FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User: "Upload brochure for Vertex Elite"                │
│     ↓                                                        │
│  2. PageIndexPortal (React)                                 │
│     → POST /api/pageindex/index?boothId=vertex-elite...     │
│     ↓                                                        │
│  3. Vite Plugin (vite-plugin-pageindex-api.ts)              │
│     → Runs PageIndex Python                                 │
│     → Gets tree.json                                        │
│     → Reads MONGODB_URI from .env ✓                         │
│     ↓                                                        │
│  4. MongoDB Connection (src/server/mongodb.ts)              │
│     → Saves tree to MongoDB                                 │
│     ↓                                                        │
│  5. Response: "Tree saved! ID: 6xxxxx"                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    USER ASK FLOW (Key Part!)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User: "What is the price?"                              │
│     ↓                                                        │
│  2. AiChatbox (React)                                       │
│     → POST /api/pageindex/ask                               │
│     → { question, boothId, documentType }                   │
│     ↓                                                        │
│  3. Vite Plugin (vite-plugin-pageindex-api.ts)              │
│     → Tree not provided?                                    │
│     → Load from MongoDB using boothId + documentType        │
│     ↓                                                        │
│  4. MongoDB Query                                           │
│     → Finds saved tree (NO re-indexing!)                    │
│     ↓                                                        │
│  5. Gemini API                                              │
│     → Tree + question → Gemini                              │
│     → Answer: "Price is ₹5500 per sq ft"                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         .env File (Server-Side Only, NEVER Browser)         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  VITE_GEMINI_API_KEY=AIza...  (OK to expose to browser)     │
│  VITE_GEMINI_MODEL=gemini-3.1-flash-lite-preview (OK)       │
│  ⚠️  MONGODB_URI=mongodb+srv://...  (SECRET! Server only)   │
│                                                              │
│  This string is read by Vite plugin at dev time.            │
│  NOT exposed to React components.                           │
│  NOT visible in browser console.                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
project-root/
├── .env                              ← MONGODB_URI here ✓
├── src/
│   ├── server/
│   │   └── mongodb.ts               ← Database functions
│   ├── components/
│   │   ├── AiChatbox.tsx            ← To be updated (send boothId)
│   │   └── PageIndexPortal.tsx      ← Already works
│   └── store.ts
├── vite-plugin-pageindex-api.ts      ← Reads MONGODB_URI, saves/loads
├── package.json                      ← Has mongodb driver
├── MONGODB_PAGEINDEX.md              ← Full docs
└── MONGODB_CONNECTION_SETUP.md       ← This setup guide
```

## Collections in MongoDB

### `virtual-expo` database:

```
┌─ pageindexes (collection)
│  ├─ boothId: "vertex-elite"
│  ├─ documentType: "brochure"
│  ├─ structure: { /* tree */ }
│  ├─ indexedAt: 2026-05-16T...
│  └─ _id: 6xxxxx (auto-generated)
│
└─ users (collection)
   ├─ email: "visitor@example.com"
   ├─ boothId: "vertex-elite"
   └─ registeredAt: 2026-05-16T...
```

## Connection Flow

```
┌──────────────────────────────────────────────────────────────┐
│  npm run dev                                                 │
│  ↓                                                           │
│  Vite server starts                                          │
│  ↓                                                           │
│  Reads .env file                                             │
│  ↓                                                           │
│  Passes MONGODB_URI to vite-plugin-pageindex-api.ts          │
│  ↓                                                           │
│  Plugin imports mongodb.ts                                   │
│  ↓                                                           │
│  On first API call (/api/pageindex/...):                    │
│    → Creates MongoClient                                     │
│    → Connects using MONGODB_URI                              │
│    → "Connected to MongoDB successfully"  ✓                 │
│  ↓                                                           │
│  Ready to save/load trees                                    │
└──────────────────────────────────────────────────────────────┘
```

## Example: Full Flow

### Upload Phase
```
1. User selects brochure.pdf in PageIndexPortal
2. Clicks "Run PageIndex"
3. Browser: POST /api/pageindex/index?boothId=vertex-elite&documentType=brochure
4. Server: Executes Python PageIndex
5. Server: Reads .env → MONGODB_URI
6. Server: Saves to MongoDB:
   {
     boothId: "vertex-elite",
     documentType: "brochure",
     structure: { /* full tree */ },
     indexedAt: 2026-05-16T12:00:00Z
   }
7. Server: Returns to browser "✓ Saved!"
```

### Question Phase (NO re-index!)
```
1. Visitor near hostess → click "Ask AI"
2. Types: "What is the price per square foot?"
3. Browser: POST /api/pageindex/ask
   {
     question: "What is the price per square foot?",
     boothId: "vertex-elite",
     documentType: "priceList"
   }
4. Server: Query MongoDB → finds saved tree (instant!)
5. Server: Calls Gemini with tree + question
6. Gemini: "₹5500 per sq ft, luxurious finishes"
7. Browser: Shows answer
```

## Token Savings Example

### Before (re-scan every time)
```
Upload brochure → 50 tokens (Gemini indexing)
User Q1 → 50 tokens (re-index) + 10 (answer)
User Q2 → 50 tokens (re-index) + 10 (answer)
Total: 170 tokens
```

### After (index once)
```
Upload brochure → 50 tokens (Gemini indexing, ONCE)
User Q1 → 10 tokens (answer only, no re-index)
User Q2 → 10 tokens (answer only, no re-index)
Total: 70 tokens  ← 60% savings! 🎉
```

---

**Key Takeaway:** The connection string in `.env` is a server-side secret that enables automatic tree persistence. Once set, everything "just works"!
