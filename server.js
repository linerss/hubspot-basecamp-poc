const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const BASECAMP_CLIENT_ID = process.env.BASECAMP_CLIENT_ID;
const BASECAMP_CLIENT_SECRET = process.env.BASECAMP_CLIENT_SECRET;
const BASECAMP_ACCESS_TOKEN = process.env.BASECAMP_ACCESS_TOKEN;
const BASECAMP_ACCOUNT_ID = process.env.BASECAMP_ACCOUNT_ID;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// File-based storage (works on Vercel serverless)
const STORAGE_FILE = path.join('/tmp', 'projects.json');

// Helper: Read projects from file
function getProjects() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading projects:', error);
  }
  return [];
}

// Helper: Save projects to file
function saveProjects(projects) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(projects, null, 2));
  } catch (error) {
    console.error('Error saving projects:', error);
  }
}

// Helper: Fetch deal details from HubSpot API
async function getDealFromHubSpot(dealId) {
  const url = `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,closedate`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}` }
  });
  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status}`);
  }
  return response.json();
}

// API health check
app.get('/api/status', (req, res) => {
  const projects = getProjects();
  res.json({
    status: 'running',
    message: 'HubSpot-Basecamp Integration POC',
    totalProjects: projects.length,
    hubspotConnected: !!HUBSPOT_ACCESS_TOKEN
  });
});

// Debug endpoint - logs raw payload from HubSpot
const debugLog = [];
app.post('/debug/webhook', (req, res) => {
  const entry = { receivedAt: new Date().toISOString(), body: req.body, headers: req.headers };
  debugLog.unshift(entry);
  if (debugLog.length > 20) debugLog.pop();
  console.log('DEBUG webhook received:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });
});

app.get('/debug/log', (req, res) => {
  res.json({ count: debugLog.length, entries: debugLog });
});

// HubSpot webhook endpoint - fires on any deal stage change
app.post('/webhook/hubspot/deal-won', async (req, res) => {
  // HubSpot sends an array of events
  const events = Array.isArray(req.body) ? req.body : [req.body];

  console.log(`Received ${events.length} HubSpot event(s)`);

  // Respond immediately to HubSpot (must respond within 20 seconds)
  res.status(200).json({ received: true });

  // Process each event
  for (const event of events) {
    const { objectId, propertyName, propertyValue, subscriptionType } = event;

    console.log(`Event: ${subscriptionType} | Deal ${objectId} | ${propertyName} = ${propertyValue}`);

    // Only act on deals moving to "closedwon"
    if (propertyName !== 'dealstage' || propertyValue !== 'closedwon') {
      console.log(`Ignored - not a closed won event`);
      continue;
    }

    // Check for duplicates
    const existing = getProjects();
    if (existing.find(p => p.dealId === String(objectId))) {
      console.log(`Duplicate detected - project for deal ${objectId} already exists`);
      continue;
    }

    try {
      // Fetch full deal details from HubSpot
      let dealName = 'New Project';
      let dealAmount = 0;

      if (HUBSPOT_ACCESS_TOKEN) {
        const deal = await getDealFromHubSpot(objectId);
        dealName = deal.properties.dealname || 'New Project';
        dealAmount = parseFloat(deal.properties.amount) || 0;
        console.log(`Fetched deal from HubSpot: ${dealName}`);
      }

      // Create Basecamp project (real if token available, mocked otherwise)
      let basecampId = Date.now();
      if (BASECAMP_ACCESS_TOKEN && BASECAMP_ACCOUNT_ID) {
        const bc = await createBasecampProject(dealName, `HubSpot Deal - $${dealAmount.toLocaleString()}`);
        basecampId = bc.id;
        console.log(`✅ Created real Basecamp project: ${bc.id}`);
      }

      const basecampProject = {
        id: basecampId,
        name: dealName,
        dealId: String(objectId),
        amount: dealAmount,
        source: 'hubspot',
        createdAt: new Date().toISOString(),
        status: 'created'
      };

      const projects = getProjects();
      projects.push(basecampProject);
      saveProjects(projects);

      console.log(`✅ Created Basecamp project: ${basecampProject.name}`);

    } catch (error) {
      console.error(`Failed to process deal ${objectId}:`, error.message);
    }
  }
});

// View all closed won deals from HubSpot (live source of truth)
app.get('/projects', async (req, res) => {
  if (!HUBSPOT_ACCESS_TOKEN) {
    const projects = getProjects();
    return res.json({ total: projects.length, projects });
  }

  try {
    const response = await fetch(
      'https://api.hubapi.com/crm/v3/objects/deals/search',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }] }],
          properties: ['dealname', 'amount', 'dealstage', 'closedate'],
          limit: 20
        })
      }
    );
    const data = await response.json();

    const projects = (data.results || []).map(deal => ({
      id: deal.id,
      name: deal.properties.dealname || 'Unnamed Deal',
      dealId: deal.id,
      amount: parseFloat(deal.properties.amount) || 0,
      source: 'hubspot',
      createdAt: deal.createdAt,
      status: 'created'
    }));

    res.json({ total: projects.length, projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint - simulate HubSpot webhook with real payload format
app.post('/test/trigger', async (req, res) => {
  const testEvent = [{
    eventId: Date.now(),
    objectId: req.body.dealId || '299827921617',
    propertyName: 'dealstage',
    propertyValue: 'closedwon',
    subscriptionType: 'deal.propertyChange',
    portalId: 'test'
  }];

  // Call our webhook handler internally
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${PORT}`;

  fetch(`${baseUrl}/webhook/hubspot/deal-won`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testEvent)
  });

  res.json({ message: 'Test webhook triggered with real HubSpot format', event: testEvent[0] });
});

// Basecamp OAuth - start flow
app.get('/auth/basecamp', (req, res) => {
  const redirectUri = encodeURIComponent('https://hubspot-basecamp-poc.vercel.app/auth/callback');
  const url = `https://launchpad.37signals.com/authorization/new?type=web_server&client_id=${BASECAMP_CLIENT_ID}&redirect_uri=${redirectUri}`;
  res.redirect(url);
});

// Basecamp OAuth - callback, exchange code for token
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  const tokenUrl = `https://launchpad.37signals.com/authorization/token?type=web_server&client_id=${BASECAMP_CLIENT_ID}&client_secret=${BASECAMP_CLIENT_SECRET}&redirect_uri=${encodeURIComponent('https://hubspot-basecamp-poc.vercel.app/auth/callback')}&code=${code}`;
  const response = await fetch(tokenUrl, { method: 'POST' });
  const data = await response.json();

  res.send(`
    <h2>Basecamp Auth Success!</h2>
    <p><strong>Access Token:</strong> <code>${data.access_token}</code></p>
    <p><strong>Refresh Token:</strong> <code>${data.refresh_token}</code></p>
    <p>Copy the access token and add it to Vercel as <code>BASECAMP_ACCESS_TOKEN</code></p>
  `);
});

// Basecamp helper: create a project
async function createBasecampProject(name, description) {
  const response = await fetch(
    `https://3.basecampapi.com/${BASECAMP_ACCOUNT_ID}/projects.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BASECAMP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'HubSpot-Basecamp-POC (linus@greyfielddata.com)'
      },
      body: JSON.stringify({ name, description })
    }
  );
  if (!response.ok) throw new Error(`Basecamp API error: ${response.status}`);
  return response.json();
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 HubSpot connected: ${!!HUBSPOT_ACCESS_TOKEN}`);
  console.log(`📊 View projects: http://localhost:${PORT}/projects`);
});
