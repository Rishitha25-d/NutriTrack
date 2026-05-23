const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const cron = require('node-cron');
require('dotenv').config();

const app = express();

// ─── Security & Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.use(cors({
  origin: [process.env.CLIENT_URL, 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again in 15 minutes.' }
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Passport ────────────────────────────────────────────────────────
require('./config/passport')(passport);
app.use(passport.initialize());

// ─── Routes ──────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/food-logs',  require('./routes/foodLogs'));
app.use('/api/nutrition',  require('./routes/nutrition'));
app.use('/api/barcode',    require('./routes/barcode'));
app.use('/api/ai',         require('./routes/ai'));
app.use('/api/goals',      require('./routes/goals'));
app.use('/api/analytics',  require('./routes/analytics'));
app.use('/api/upload',     require('./routes/upload'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/payments',   require('./routes/payments'));

// ─── Health Check ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'NutriTrack AI',
    version: '1.0.0',
    time: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ─── 404 ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ─── Database Connection ─────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB connected');
  startServer();
})
.catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});

// ─── Cron Jobs ───────────────────────────────────────────────────────
// Daily streak reset at midnight IST
cron.schedule('0 0 * * *', async () => {
  const { checkAndUpdateStreaks } = require('./utils/streakHelper');
  await checkAndUpdateStreaks();
  console.log('🔄 Daily streak check complete');
}, { timezone: 'Asia/Kolkata' });

// Weekly digest email every Monday 8am IST
cron.schedule('0 8 * * 1', async () => {
  const { sendWeeklyDigests } = require('./utils/emailHelper');
  await sendWeeklyDigests();
  console.log('📧 Weekly digest emails sent');
}, { timezone: 'Asia/Kolkata' });

function startServer() {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 NutriTrack AI server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
