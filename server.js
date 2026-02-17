const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

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

      // Create Basecamp project (mocked for POC)
      const basecampProject = {
        id: Date.now(),
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

// View all created projects
app.get('/projects', (req, res) => {
  const projects = getProjects();
  res.json({
    total: projects.length,
    projects: projects
  });
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 HubSpot connected: ${!!HUBSPOT_ACCESS_TOKEN}`);
  console.log(`📊 View projects: http://localhost:${PORT}/projects`);
});
