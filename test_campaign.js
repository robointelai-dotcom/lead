const { processEmailCampaignLocally } = require('./src/lib/workers/emailCampaignWorker.js');
// Wait, emailCampaignWorker.js won't work in raw Node without tsx
