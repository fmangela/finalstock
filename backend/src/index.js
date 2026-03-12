require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
const stockRoutes = require('./routes/stocks');
const newsRoutes = require('./routes/news');
const predictionRoutes = require('./routes/predictions');
const simulationRoutes = require('./routes/simulation');
const analysisRoutes = require('./routes/analysis');
const configRoutes = require('./routes/config');
const promptRoutes = require('./routes/prompts');
const llmConfigRoutes = require('./routes/llmConfig');
const logRoutes = require('./routes/logs');
const backtestRoutes = require('./routes/backtest');
const strategyRoutes = require('./routes/strategy');

app.use('/api/stocks', stockRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/config', configRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/llm-config', llmConfigRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/backtest', backtestRoutes);
app.use('/api/strategy', strategyRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Global error middleware
app.use(async (err, req, res, next) => {
  try {
    const { AppLog } = require('./models');
    const { SystemConfig } = require('./models');
    const cfg = await SystemConfig.findOne({ where: { config_group: 'logging', config_key: 'enabled' } });
    if (!cfg || cfg.config_value === '1') {
      await AppLog.error('api', err.message?.slice(0, 500) || 'Unknown error', 
        JSON.stringify({ url: req.url, method: req.method, stack: err.stack?.slice(0, 2000) }));
    }
  } catch (_) {}
  res.status(500).json({ code: 1, message: err.message || 'Internal server error' });
});

const scheduler = require('./services/scheduler');

sequelize.authenticate()
  .then(() => {
    console.log('Database connected');
    scheduler.start();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
