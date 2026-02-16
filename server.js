const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

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

// Health check
app.get('/', (req, res) => {
  const projects = getProjects();
  res.json({
    status: 'running',
    message: 'HubSpot-Basecamp Integration POC',
    totalProjects: projects.length
  });
});

// HubSpot webhook endpoint - triggers when deal is won
app.post('/webhook/hubspot/deal-won', async (req, res) => {
  const dealData = req.body;

  console.log('Received HubSpot webhook:', JSON.stringify(dealData, null, 2));

  // Extract deal info
  const dealId = dealData.objectId || 'unknown';
  const dealName = dealData.dealName || 'New Project';
  const clientName = dealData.clientName || 'Unknown Client';
  const dealAmount = dealData.amount || 0;

  // Create Basecamp project (mock for POC)
  const basecampProject = {
    id: Date.now(),
    name: `${clientName} - ${dealName}`,
    dealId: dealId,
    amount: dealAmount,
    createdAt: new Date().toISOString(),
    status: 'created'
  };

  // Save to file (persists across serverless invocations)
  const projects = getProjects();
  projects.push(basecampProject);
  saveProjects(projects);

  console.log('Created Basecamp project:', basecampProject);

  // Respond to HubSpot
  res.status(200).json({
    success: true,
    message: 'Project created in Basecamp',
    project: basecampProject
  });
});

// View all created projects
app.get('/projects', (req, res) => {
  const projects = getProjects();
  res.json({
    total: projects.length,
    projects: projects
  });
});

// Test endpoint - simulate HubSpot webhook
app.post('/test/trigger', (req, res) => {
  const testData = {
    objectId: '12345',
    dealName: 'Website Redesign',
    clientName: 'Acme Corp',
    amount: 15000
  };

  // Call our webhook handler
  fetch(`http://localhost:${PORT}/webhook/hubspot/deal-won`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });

  res.json({ message: 'Test webhook triggered', data: testData });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 View projects: http://localhost:${PORT}/projects`);
  console.log(`🧪 Test webhook: POST http://localhost:${PORT}/test/trigger`);
});
