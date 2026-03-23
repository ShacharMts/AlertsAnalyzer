---
name: deploy-netlify
description: "Deploy the AlertsAnalyzer project to Netlify. Use when: deploying, publishing, pushing to cloud, updating the live site, refreshing production data. Handles building, syncing cache data, and deploying to zesty-froyo-b0c972.netlify.app."
argument-hint: "Optional: 'production' for prod deploy, or nothing for draft preview"
---

# Deploy to Netlify

Deploy the AlertsAnalyzer Next.js app to https://zesty-froyo-b0c972.netlify.app/

## Site Details

- **Netlify site**: `zesty-froyo-b0c972`
- **URL**: https://zesty-froyo-b0c972.netlify.app/
- **Framework**: Next.js (auto-detected by Netlify)
- **Build command**: `npm run build`
- **Publish directory**: `.next`

## Pre-Deploy Checklist

Before deploying, always perform these steps in order:

### 1. Sync the bundled cache data

The live site uses bundled data from `src/data/alerts-cache.json`. This must be updated from the local live cache before every deploy:

```bash
cp .alerts-cache.json src/data/alerts-cache.json
```

### 2. Build locally to verify

```bash
npm run build
```

Ensure the build succeeds with no errors before deploying.

### 3. Install Netlify CLI (if needed)

```bash
npm install -g netlify-cli
```

### 4. Login to Netlify (if needed)

```bash
netlify login
```

### 5. Link the project (first time only)

```bash
netlify link --name zesty-froyo-b0c972
```

## Deploy Commands

### Draft deploy (preview URL — for testing)

```bash
netlify deploy
```

This creates a preview URL to verify before going live.

### Production deploy

```bash
netlify deploy --prod
```

This updates the live site at https://zesty-froyo-b0c972.netlify.app/

## Full Deploy Sequence (copy-paste ready)

```bash
cd /Users/sm250451/Dev-Temp/AlertsAnalyzer
cp .alerts-cache.json src/data/alerts-cache.json
npm run build
netlify deploy --prod
```

## Important Notes

- The oref.org.il API is geo-restricted and cannot be called from Netlify's servers. All alert data comes from the bundled `src/data/alerts-cache.json` snapshot.
- The "Refresh Data" button on the live site will attempt to fetch from oref but will likely fail silently on Netlify.
- To update data on the live site, you must sync the local cache and redeploy.
- The `.alerts-cache.json` file in the project root is the live local cache (updated by the scraper and API calls). The copy in `src/data/` is the deploy snapshot.

## Files NOT to deploy

- `node_modules/` — rebuilt by `npm install`
- `.next/` — rebuilt by `npm run build`
- `scripts/` — local dev tools only
- `spec.md` — documentation only
