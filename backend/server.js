require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { testConnection } = require('./config/db');
const { globalErrorHandler } = require('./middleware/errorHandler');
const { startJobs } = require('./jobs');

const authRoutes       = require('./routes/auth');
const feeRoutes        = require('./routes/fees');
const { register }     = require('./controllers/registerController');
const studentRoutes    = require('./routes/students');
const teacherRoutes    = require('./routes/teachers');
const classRoutes      = require('./routes/classes');
const subjectRoutes    = require('./routes/subjects');
const attendanceRoutes = require('./routes/attendance');
const gradeRoutes      = require('./routes/grades');
const reportRoutes     = require('./routes/reports');
const commsRoutes      = require('./routes/comms');
const analyticsRoutes  = require('./routes/analytics');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS ─────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (Render health checks, mobile apps, curl)
    if (!origin) return callback(null, true);

    const allowed = [
      'https://edu-class-pi.vercel.app',
      'http://localhost:3000',
      'http://localhost:5000',
    ];

    // Also allow whatever APP_URL is set to in env
    if (process.env.APP_URL) allowed.push(process.env.APP_URL);

    // Allow any vercel.app preview URL for this project
    if (origin.includes('vercel.app')) return callback(null, true);

    if (allowed.includes(origin)) return callback(null, true);

    // In development allow everything
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    callback(new Error('CORS: ' + origin + ' not allowed'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Handle preflight for all routes
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, env: process.env.NODE_ENV, timestamp: new Date() }));

// ── API routes ───────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.post('/api/auth/register', register);
app.use('/api/fees',       feeRoutes);
app.use('/api/students',   studentRoutes);
app.use('/api/teachers',   teacherRoutes);
app.use('/api/classes',    classRoutes);
app.use('/api/subjects',   subjectRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades',     gradeRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api',            commsRoutes);

// ── Desktop mode static serving ───────────────────────────
if (process.env.DESKTOP_MODE === 'true') {
  const frontendBuild = path.join(__dirname, '../frontend/build');
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendBuild, 'index.html'));
    }
  });
}

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ ok: false, message: `Route ${req.method} ${req.path} not found` }));

// ── Global error handler ─────────────────────────────────
app.use(globalErrorHandler);

async function start() {
  await testConnection();
  if (process.env.NODE_ENV !== 'test') startJobs();
  app.listen(PORT, () => {
    console.log(`EduClass API running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

start();
module.exports = app;