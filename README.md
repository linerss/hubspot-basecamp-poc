# HubSpot → Basecamp Integration POC

Simple proof-of-concept showing automated project creation in Basecamp when deals are won in HubSpot.

## What It Does

1. **Receives HubSpot webhook** when a deal is marked as "won"
2. **Extracts deal details** (client name, deal name, amount)
3. **Creates Basecamp project** automatically
4. **Responds to HubSpot** confirming success

## Quick Start

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## Test It

### Option 1: Test Endpoint (Easiest)
```bash
curl -X POST http://localhost:3000/test/trigger
```

### Option 2: Manual Webhook Simulation
```bash
curl -X POST http://localhost:3000/webhook/hubspot/deal-won \
  -H "Content-Type: application/json" \
  -d '{
    "objectId": "12345",
    "dealName": "Website Redesign",
    "clientName": "Acme Corp",
    "amount": 15000
  }'
```

### View Created Projects
```bash
curl http://localhost:3000/projects
```

Or open in browser: `http://localhost:3000/projects`

## Deploy to Railway

1. Push this code to GitHub
2. Connect Railway to your GitHub repo
3. Railway auto-detects Node.js and deploys
4. Get your live webhook URL: `https://your-app.railway.app/webhook/hubspot/deal-won`

## Next Steps (Production)

- Add real HubSpot API integration
- Add real Basecamp API integration
- Add webhook signature verification
- Add error handling & retries
- Add database for persistence
- Add authentication

## Architecture

```
HubSpot (Deal Won)
    ↓
    POST /webhook/hubspot/deal-won
    ↓
Extract deal details
    ↓
Create Basecamp project
    ↓
Return success
```

---

**Built by Greyfield Data**
