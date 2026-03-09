// Web Chat -> n8n webhook endpoints
// Edit this file to point the website chat to your n8n webhooks.
window.N8N_CONFIG = {
  // POST: send a message from web chat to n8n
  sendUrl: 'https://autoreplyforkhmersoul-production.up.railway.app/chat',

  // GET: poll for new messages from n8n
  pollUrl: 'https://autoreplyforkhmersoul-production.up.railway.app/poll',

  // Optional: how often to poll (ms)
  pollIntervalMs: 2500
};
