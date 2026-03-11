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

app.use('/api/stocks', stockRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/config', configRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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
