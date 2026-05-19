# MongoDB Integration Guide for PageIndex

This guide explains how PageIndex trees are now automatically stored in MongoDB and retrieved for AI Q&A without rescanning PDFs.

## 🔧 Setup Instructions

### Step 1: Get MongoDB Connection String

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Sign in or create an account
3. Click **"Create a Project"** (if needed)
4. Click **"Create Deployment"** → Choose **"M0 Free"** tier
5. Once created, click **"Connect"**
6. Select **"Drivers"** → **"Node.js"**
7. **Copy the connection string** (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)

### Step 2: Add Connection String to .env

Open `.env` in your project root and replace the placeholder:

```env
MONGODB_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/virtual-expo?retryWrites=true&w=majority
```

⚠️ **IMPORTANT:** Keep this secret! Never commit it or share it.

### Step 3: Install Dependencies

Run:
```bash
npm install
```

This installs the `mongodb` driver package.

### Step 4: Restart Dev Server

```bash
npm run dev
```

## 📊 How It Works

### When You Upload & Index a PDF

**Before:** Every time you asked a question, PageIndex would re-scan the PDF (expensive tokens).

**After:** 
1. You upload a PDF through `/pageindex` portal
2. PageIndex builds the tree structure
3. Tree is automatically saved to MongoDB
4. Questions retrieve the saved tree (no re-scanning!)

### Data Structure in MongoDB

Your MongoDB database has two collections:

#### `pageindexes` collection
Stores PageIndex trees for each document:
```javascript
{
  boothId: "vertex-elite",
  documentType: "brochure",              // or priceList, siteLayout, unitLayout
  pdfUrl: "path/to/file.pdf",
  pdfHash: "abc123...",                  // for version tracking
  structure: { /* PageIndex tree */ },   // the expensive-to-compute tree
  pages: [ /* raw text per page */ ],
  indexedAt: Date,
  modelVersion: "gemini-3.1-flash-lite-preview",
  createdAt: Date,
  updatedAt: Date
}
```

#### `users` collection
Stores registration hall data:
```javascript
{
  email: "user@example.com",
  name: "John Doe",
  phone: "+91...",
  boothId: "vertex-elite",
  registeredAt: Date,
  visitedBooths: ["vertex-elite", "crown-estates"]
}
```

## 🚀 Using PageIndex with MongoDB

### Uploading Documents (CMS or Portal)

When you upload a PDF in `/pageindex` portal:

```javascript
// Automatically includes boothId and documentType
POST /api/pageindex/index?boothId=vertex-elite&documentType=brochure
```

The API:
1. Runs PageIndex on the PDF
2. Gets the `structure.json` tree
3. **Saves to MongoDB** (automatic)
4. Returns the tree to browser

### Asking Questions

Instead of uploading tree every time, send booth info:

```javascript
POST /api/pageindex/ask
{
  "question": "What is the price per sq ft?",
  "boothId": "vertex-elite",
  "documentType": "priceList"
  // "tree" is optional — API will load from MongoDB
}
```

The API:
1. Loads saved tree from MongoDB (if not provided)
2. Calls Gemini with tree + question
3. Returns answer (NO re-indexing!)

### In AiChatbox Component

Update the ask call to include booth context:

```typescript
const sendMessage = async () => {
  // ... validation ...
  
  const response = await fetch('/api/pageindex/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: userMessage,
      boothId: 'vertex-elite',  // Get from current context
      documentType: 'brochure',
      // tree: optional — omit to load from DB
    }),
  });
};
```

## 💡 Best Practices

### 1. Store Multiple Document Types per Booth

```javascript
// Upload all four documents for one booth:
brochure.pdf       → /api/pageindex/index?boothId=vertex-elite&documentType=brochure
priceList.pdf      → /api/pageindex/index?boothId=vertex-elite&documentType=priceList
siteLayout.pdf     → /api/pageindex/index?boothId=vertex-elite&documentType=siteLayout
unitLayout.pdf     → /api/pageindex/index?boothId=vertex-elite&documentType=unitLayout
```

### 2. Re-index Only When PDF Changes

- **Don't** re-index if no changes → saves tokens
- **Do** re-index when PDF updates → use same `boothId` + `documentType` (overwrites)

### 3. Combine Multiple Indexes in Questions

For complex questions needing multiple documents:

```javascript
// Ask system to check both brochure AND priceList
const combinedContext = `
Brochure context: ${brochureTree}
Price list context: ${priceListTree}
`;
```

Or call API twice:
```javascript
const brochureAnswer = await ask({ boothId, documentType: 'brochure', question });
const priceAnswer = await ask({ boothId, documentType: 'priceList', question });
```

## 🔍 Troubleshooting

### "MONGODB_URI is not set"
- Add `MONGODB_URI=...` to `.env`
- Restart dev server: `npm run dev`
- Check MongoDB Atlas connection string has username + password

### "Failed to save to MongoDB"
- Check network connection
- Verify MongoDB Atlas firewall allows your IP
- In Atlas → Network Access → Add your IP (or 0.0.0.0 for dev)

### "Could not load from MongoDB"
- Ensure PDF was indexed first
- Check `boothId` and `documentType` match what was uploaded
- Tree may still be in `pageindex/results/` if DB save was skipped

### Trees still not persisting after refresh
- On **local dev**: MongoDB connection should persist
- On **Vercel**: `pageindex/results/` is ephemeral → trees only saved to MongoDB
- Query MongoDB directly to verify data saved

## 📦 File Locations

Your MongoDB integration lives in:

```
src/server/mongodb.ts          ← All DB functions
vite-plugin-pageindex-api.ts   ← API endpoints (updated to save/load)
PageIndexPortal.tsx            ← Upload UI (unchanged)
AiChatbox.tsx                  ← Ask questions (to be updated)
```

## 🎯 Next Steps

1. **Test locally**: Upload a PDF, ask questions, refresh page → tree should still work
2. **Deploy to Vercel**: MongoDB will persist trees across deployments
3. **Connect AiChatbox**: Update to pass `boothId` / `documentType` to Ask endpoint
4. **Admin UI**: Build a dashboard to list/manage indexed documents per booth

## 📚 MongoDB Collections Reference

### Query all indexes for a booth:
```javascript
db.pageindexes.find({ boothId: 'vertex-elite' })
```

### Get specific document:
```javascript
db.pageindexes.findOne({ boothId: 'vertex-elite', documentType: 'brochure' })
```

### Delete old versions:
```javascript
db.pageindexes.deleteMany({ boothId: 'vertex-elite', documentType: 'brochure', indexedAt: { $lt: new Date('2024-01-01') } })
```

### Get all users:
```javascript
db.users.find({})
```

---

**Summary:** PageIndex trees now stay in MongoDB forever (until you re-index). Questions load them instantly without re-scanning PDFs — saving tokens and time!
