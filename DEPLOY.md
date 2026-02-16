# Deploy to Vercel - Step by Step

## 1. Test Locally First

```bash
cd "02_ Opportunities/UpWork/Marco Menna/poc"
npm install
npm start
```

Open browser: `http://localhost:3000` (should see "status: running")

Test webhook:
```bash
curl -X POST http://localhost:3000/webhook/hubspot/deal-won \
  -H "Content-Type: application/json" \
  -d '{"objectId": "123", "dealName": "Test Deal", "clientName": "Test Client", "amount": 5000}'
```

View projects: `http://localhost:3000/projects`

## 2. Push to GitHub

```bash
# Initialize git (if not already in a repo)
git init

# Add files
git add .
git commit -m "HubSpot-Basecamp integration POC"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/hubspot-basecamp-poc.git
git push -u origin main
```

## 3. Deploy to Vercel

### Option A: Vercel CLI (Fastest)
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Option B: Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repo
4. Vercel auto-detects Node.js
5. Click "Deploy"

## 4. Get Your Live URL

Vercel gives you a URL like:
- `https://hubspot-basecamp-poc.vercel.app`

Or use your custom domain:
- `https://demo.greyfielddata.com`
- Configure in Vercel → Project Settings → Domains

## 5. Test Live Webhook

```bash
# Health check
curl https://your-app.vercel.app

# Create project
curl -X POST https://your-app.vercel.app/webhook/hubspot/deal-won \
  -H "Content-Type: application/json" \
  -d '{"objectId": "123", "dealName": "Website Redesign", "clientName": "Acme Corp", "amount": 15000}'

# View all projects
curl https://your-app.vercel.app/projects
```

## 6. Share with Marco

Send Marco:
```
Hey Marco - built a quick POC showing the HubSpot → Basecamp flow.

Live demo: https://demo.greyfielddata.com

Try it:
- View projects: GET /projects
- Trigger webhook: POST /webhook/hubspot/deal-won

Example payload:
{
  "objectId": "12345",
  "dealName": "Website Redesign",
  "clientName": "Acme Corp",
  "amount": 15000
}

Code is on GitHub if you want to review the implementation.
```

---

**Total time: ~5 minutes**

## Technical Notes

**File Storage:** Uses `/tmp/projects.json` which persists across serverless invocations on Vercel (within the same execution context). For production, you'd use a database.

**Vercel Config:** The `vercel.json` file routes all requests to `server.js` and uses `@vercel/node` builder for serverless functions.
