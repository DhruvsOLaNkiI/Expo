# MongoDB Connection String: Where to Put It

## ✅ The One Place: `.env` file (project root)

Your MongoDB connection string **must only go here**:

```
/your-project-root/.env
```

### Current `.env` content:
```env
VITE_GEMINI_API_KEY=AIzaSyDxOrGB6A0WtkOZwJ1Fef9usLpzZswyEoc
VITE_GEMINI_MODEL=gemini-3.1-flash-lite-preview
MONGODB_URI=your_mongodb_connection_string_here   ← ADD YOUR STRING HERE
```

### Full Example After Setup:
```env
VITE_GEMINI_API_KEY=AIzaSyDxOrGB6A0WtkOZwJ1Fef9usLpzZswyEoc
VITE_GEMINI_MODEL=gemini-3.1-flash-lite-preview
MONGODB_URI=mongodb+srv://dhruv:password123@virtualexpo.mongodb.net/virtual-expo?retryWrites=true&w=majority
```

## ⚠️ Critical Security Rules

### ❌ NEVER do this:
- Put connection string in **React components** (e.g., `AiChatbox.tsx`)
- Put it in **VITE_* env vars** (those get exposed in browser)
- Commit `.env` to Git (add to `.gitignore` if not already there)
- Share the connection string publicly

### ✅ DO this:
- Keep it **only in `.env`** (server-side only)
- The Vite plugin reads it automatically: `process.env.MONGODB_URI`
- On deployed servers (Vercel, etc.), set it as a **Secret/Environment Variable** in the deployment dashboard

## 🔄 How It Works in Your Code

### 1. Vite Plugin reads it:
```typescript
// vite-plugin-pageindex-api.ts (backend only)
import { savePageIndex, getPageIndexByBoothAndType } from './src/server/mongodb';

// Automatically uses process.env.MONGODB_URI when connecting
```

### 2. MongoDB Module connects:
```typescript
// src/server/mongodb.ts
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error('MONGODB_URI environment variable is not set...');
}
const client = new MongoClient(mongoUri);
await client.connect();
```

### 3. API endpoints use it:
```typescript
// When you upload PDF:
POST /api/pageindex/index?boothId=vertex-elite&documentType=brochure
// → Automatically saves tree to MongoDB using .env connection

// When you ask question:
POST /api/pageindex/ask
{ "question": "What is price?", "boothId": "vertex-elite" }
// → Automatically loads tree from MongoDB using .env connection
```

## 🚀 Step-by-Step Setup

### 1. Get Your Connection String from MongoDB Atlas

```
Go to: https://cloud.mongodb.com
→ Click your project
→ Click "Connect"
→ Select "Drivers"
→ Choose "Node.js"
→ Copy the connection string

It looks like:
mongodb+srv://username:password@cluster.mongodb.net/
```

### 2. Open `.env` in Your Project

```bash
# Navigate to project root
cd /Users/dhruvsolanki/Downloads/virtual-residential-expo

# Open with text editor
nano .env
# or
code .env
```

### 3. Paste the Connection String

Replace this line:
```
MONGODB_URI=your_mongodb_connection_string_here
```

With:
```
MONGODB_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/virtual-expo?retryWrites=true&w=majority
```

### 4. Save and Restart Dev Server

```bash
npm run dev
```

### 5. Install MongoDB driver (if not already done)

```bash
npm install
```

## ✨ Verification

After setup, you should see in the console:

```
Connected to MongoDB successfully
✓ Saved PageIndex to MongoDB: vertex-elite/brochure (ID: 6xxxxx)
✓ Loaded PageIndex from MongoDB: vertex-elite/brochure
```

## 📍 Deployment: Vercel/Cloud

For **production deployment** (Vercel, Render, etc.):

1. **Do NOT** commit `.env` file
2. Go to deployment dashboard settings
3. Add as **Environment Variable** / **Secret**:
   - Name: `MONGODB_URI`
   - Value: `mongodb+srv://username:password@...`
4. Deploy — connection works automatically

---

## 🎯 TL;DR

**Question:** Where do I put the MongoDB connection string?  
**Answer:** In `.env` file as: `MONGODB_URI=mongodb+srv://...`  
**That's it.** Everything else is automatic.
