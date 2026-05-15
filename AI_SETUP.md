# AI Chatbox Setup Guide

The AI chatbox now uses environment variables for the API key. This is more secure and easier to deploy.

## Quick Setup (3 Steps)

### 1. Get Your FREE Gemini API Key

Visit: **https://aistudio.google.com/app/apikey**

- Sign in with your Google account
- Click **"Create API Key"**
- Copy the key (starts with `AIza...`)

### 2. Add to .env File

Open the `.env` file in the project root and add your key:

```bash
VITE_GEMINI_API_KEY=AIzaSyD1234567890abcdefg...
```

Replace `AIzaSyD1234567890abcdefg...` with your actual API key.

### 3. Restart Dev Server

Stop your current server (Ctrl+C) and restart:

```bash
npm run dev
```

## That's It! 🎉

The AI chatbox is now ready to use:
- Click the **"🤖 Ask AI"** button
- Type a question
- Get instant responses!

## Troubleshooting

**If chatbox says "No API key found":**
1. Check that `.env` file exists in project root
2. Make sure the key is on one line with no spaces
3. Restart the dev server completely

**If you get "Invalid API key" error:**
1. Verify the key starts with `AIza`
2. Make sure you copied the entire key
3. Try creating a new API key

## For Deployment

When deploying to production (Vercel, Netlify, etc.):
1. Add `VITE_GEMINI_API_KEY` as an environment variable in your hosting dashboard
2. Set it to your Gemini API key
3. Rebuild and deploy

## Why Gemini?

- ✅ **100% FREE** - Generous free tier
- ⚡ **Fast responses** - Usually under 1 second
- 🧠 **Smart** - Powered by Gemini 1.5 Flash
- 🔒 **No credit card** - Just sign in with Google
