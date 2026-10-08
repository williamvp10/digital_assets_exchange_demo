const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const Decimal = require('decimal.js');


function createApp(configPath = path.join(__dirname, '../config.json')) {
  
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/screen', async (req, res) => {
    try {
      // Re-read on each request: editing the JSON changes the mock immediately.
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.forceFailure) return res.status(503).json({ error: 'Mock unavailable' });
      if (typeof req.body.amount !== 'string' || !/^\d+(\.\d{1,8})?$/.test(req.body.amount))
        return res.status(400).json({ error: 'amount must be a decimal string' });
      const amount = new Decimal(req.body.amount);
      if (!amount.isPositive()) return res.status(400).json({ error: 'amount must be positive' });
      if (config.delayMs) await new Promise(resolve => setTimeout(resolve, config.delayMs));
      const risk = amount.lt(config.lowBelow) ? 'LOW' : amount.lte(config.mediumThrough) ? 'MEDIUM' : 'HIGH';
      res.json({ risk });
    } catch { res.status(500).json({ error: 'Invalid mock configuration' }); }
  });
  return app;
}

module.exports = { createApp };
